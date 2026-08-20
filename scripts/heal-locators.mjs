#!/usr/bin/env node
/**
 * heal-locators.mjs
 *
 * Complementary to scripts/auto-heal.mjs, which fixes code that doesn't
 * compile. This script fixes tests that compile fine but fail at runtime
 * because a locator no longer matches anything on the live page (the site
 * renamed a data-test attribute, moved an element, changed its text, etc).
 *
 * How it works:
 *   1. Runs the Playwright suite with the JSON reporter and finds every
 *      failed test whose error looks like a locator/timeout failure (as
 *      opposed to an assertion failure, network error, etc — those need a
 *      human, this script won't touch them).
 *   2. For each one, walks the error's stack trace to find the exact
 *      repo file + line that constructed the broken locator, and pulls the
 *      literal locator call (page.locator(...), getByRole(...), etc) off
 *      that line via regex.
 *   3. Opens a real headless browser, navigates to the best-effort URL for
 *      that page (the nearest preceding page.goto(...)/BASE_URL constant in
 *      the same file), and asks Claude — given the live page's trimmed DOM,
 *      the old locator, and the error — for a locator that actually matches
 *      something right now, preferring the same strategy priority this repo
 *      already uses elsewhere (role > test id > label/placeholder > text).
 *   4. Patches only that one line in the source file.
 *   5. Re-runs that single spec file to confirm the locator error is gone.
 *   6. In CI, commits healed files to a branch and opens a PR — same
 *      never-touch-main policy as auto-heal.mjs.
 *
 * KNOWN LIMITATION: step 3 navigates directly to a best-effort URL rather
 * than replaying the full test up to the point of failure. This works well
 * for locators on directly-reachable pages (login, contact, product
 * listing) but won't reliably reach state that requires prior actions in
 * the same test (e.g. "the order confirmation page after checkout"). Those
 * cases will usually fail to heal and get reported as needing a human —
 * which is the safe failure mode, not a false "fixed".
 *
 * Local usage:
 *   ANTHROPIC_API_KEY=sk-... npm run heal-locators
 *   ANTHROPIC_API_KEY=sk-... npm run heal-locators -- --dry-run
 *
 * CI usage:
 *   npm run heal-locators -- --pr
 *
 * Exit codes:
 *   0 = no locator failures found, or all found were healed
 *   1 = some locator failures could not be auto-healed (needs a human)
 *   2 = script/config error
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = process.cwd();
const MODEL = 'claude-sonnet-4-6';
const JSON_REPORT_PATH = path.join(REPO_ROOT, '.heal-locators-report.json');

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const OPEN_PR = args.has('--pr');

function log(...msg) {
  console.log('[heal-locators]', ...msg);
}

function summary(markdown) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) appendFileSync(summaryFile, `${markdown}\n`);
}

function run(cmd, opts = {}) {
  return spawnSync(cmd, { cwd: REPO_ROOT, shell: true, encoding: 'utf-8', ...opts });
}

async function callClaude(systemPrompt, userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set.');
  }
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!response.ok) {
    throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  const textBlock = data.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('Claude returned no text content.');
  return textBlock.text.trim();
}

// ---------------------------------------------------------------------------
// Step 1: run the suite, find locator-shaped failures
// ---------------------------------------------------------------------------

const LOCATOR_ERROR_PATTERNS = [
  /Timeout \d+ms exceeded/i,
  /waiting for (locator|selector)/i,
  /strict mode violation/i,
  /element is not (visible|attached|enabled)/i,
  /was not found/i,
  /resolved to \d+ elements/i,
];

function looksLikeLocatorFailure(errorMessage) {
  return LOCATOR_ERROR_PATTERNS.some((p) => p.test(errorMessage));
}

/** Flattens Playwright's nested JSON reporter suite tree into a flat list. */
function flattenSpecs(suites, out = []) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) out.push(spec);
    flattenSpecs(suite.suites, out);
  }
  return out;
}

function runSuiteAndCollectFailures(specFile = null) {
  const target = specFile ? `"${specFile}"` : '';
  const result = run(
    `npx playwright test ${target} --reporter=json > "${JSON_REPORT_PATH}" 2>"${JSON_REPORT_PATH}.stderr"`,
  );

  if (!existsSync(JSON_REPORT_PATH)) {
    log('Playwright did not produce a JSON report. stderr:');
    log(readFileSync(`${JSON_REPORT_PATH}.stderr`, 'utf-8').slice(0, 2000));
    return { failures: [], allPassed: false, ranAtAll: false };
  }

  let report;
  try {
    report = JSON.parse(readFileSync(JSON_REPORT_PATH, 'utf-8'));
  } catch {
    return { failures: [], allPassed: false, ranAtAll: false };
  }

  const specs = flattenSpecs(report.suites);
  const failures = [];

  for (const spec of specs) {
    for (const test of spec.tests ?? []) {
      for (const res of test.results ?? []) {
        if (res.status === 'passed') continue;
        const message = [res.error?.message, res.error?.stack].filter(Boolean).join('\n');
        if (!message) continue;
        failures.push({
          specFile: spec.file, // relative path, e.g. "tests/checkout.spec.ts"
          title: [...(test.projectName ? [test.projectName] : []), spec.title].join(' > '),
          message,
          isLocatorFailure: looksLikeLocatorFailure(message),
        });
      }
    }
  }

  return { failures, allPassed: failures.length === 0, ranAtAll: true, exitCode: result.status };
}

// ---------------------------------------------------------------------------
// Step 2: locate the source line responsible for a failure
// ---------------------------------------------------------------------------

const LOCATOR_CALL_PATTERN =
  /(?:page|this\.\w+)\.(?:locator|getByRole|getByText|getByTestId|getByPlaceholder|getByLabel|getByAltText|getByTitle)\([^;]*?\)(?=[.;\s]|$)/;

function findSourceLocation(errorStack) {
  const framePattern = /\(?([^\s()]+\.(?:ts|tsx)):(\d+):(\d+)\)?/g;
  let match;
  while ((match = framePattern.exec(errorStack)) !== null) {
    const [, rawPath, line] = match;
    const absPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(REPO_ROOT, rawPath);
    if (!absPath.startsWith(REPO_ROOT)) continue;
    if (absPath.includes('node_modules')) continue;
    if (!existsSync(absPath)) continue;
    return { absPath, line: Number(line) };
  }
  return null;
}

function extractLocatorCall(absPath, lineNumber) {
  const lines = readFileSync(absPath, 'utf-8').split('\n');
  const lineText = lines[lineNumber - 1] ?? '';
  const matches = [...lineText.matchAll(new RegExp(LOCATOR_CALL_PATTERN, 'g'))];
  if (matches.length !== 1) return null; // 0 = nothing found, 2+ = ambiguous, skip either way
  return { lineText, oldCall: matches[0][0] };
}

/** Best-effort: nearest preceding page.goto(...) or a `..._URL` constant use in the same file. */
function findLikelyUrl(absPath, upToLine) {
  const lines = readFileSync(absPath, 'utf-8').split('\n').slice(0, upToLine);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const gotoMatch = lines[i].match(/\.goto\(\s*([^,)]+)/);
    if (gotoMatch) return { expression: gotoMatch[1].trim(), sourceLine: i + 1 };
  }
  return null;
}

/** Resolves a simple string/template/const expression found in source to an actual URL, using global-setup.ts's exported constants as the lookup table. */
function resolveUrlExpression(expression) {
  // Strip a single matching pair of quote/backtick delimiters, if present,
  // but always continue to substitution below — a backtick-delimited
  // template literal like `${QA_BASE_URL}/contacts/` is NOT already a
  // plain literal and must not be returned as-is.
  const delimited = expression.match(/^(['"`])(.+)\1$/s);
  let resolved = delimited ? delimited[2] : expression;

  const globalSetupPath = path.join(REPO_ROOT, 'global-setup.ts');
  if (existsSync(globalSetupPath)) {
    const setupSrc = readFileSync(globalSetupPath, 'utf-8');
    const constPattern = /export const (\w+_URL) = ['"](.+?)['"]/g;
    let m;
    while ((m = constPattern.exec(setupSrc)) !== null) {
      resolved = resolved.replaceAll(`\${${m[1]}}`, m[2]).replaceAll(m[1], m[2]);
    }
  }

  return /^https?:\/\//.test(resolved) ? resolved : null;
}

// ---------------------------------------------------------------------------
// Step 3: ask Claude for a working locator, given the live page
// ---------------------------------------------------------------------------

function trimDom(html, maxChars = 40_000) {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ');
  return stripped.length > maxChars ? `${stripped.slice(0, maxChars)}\n<!-- truncated -->` : stripped;
}

async function proposeNewLocator({ oldCall, errorMessage, url, dom }) {
  const systemPrompt = [
    'You repair broken Playwright locators for a test automation framework.',
    'You will be given the OLD locator call that used to work, the error it',
    'now produces, and the CURRENT live DOM of the page it runs against.',
    '',
    'Rules:',
    '- Output ONLY a single valid Playwright locator expression starting with',
    '  `page.` (e.g. page.getByRole(\'button\', { name: \'Submit\' })). No prose,',
    '  no markdown, no explanation, no trailing semicolon.',
    '- Prefer, in this order: getByRole with an accessible name, getByTestId',
    '  (data-testid/data-test), getByLabel/getByPlaceholder, getByText, then',
    '  locator() with a CSS selector only as a last resort.',
    '- Infer the element\'s intent from the OLD locator (its selector text,',
    '  attribute names, or nearby content) and find the closest current match',
    '  in the DOM. Do not invent an element that is not actually present.',
    '- If no reasonable match exists in the DOM, output exactly: NO_MATCH',
  ].join('\n');

  const userPrompt = [
    `Old locator call: ${oldCall}`,
    `Error: ${errorMessage.split('\n')[0]}`,
    `Page URL: ${url}`,
    '',
    'Current live DOM (scripts/styles stripped, may be truncated):',
    '---',
    dom,
    '---',
  ].join('\n');

  const proposal = (await callClaude(systemPrompt, userPrompt)).trim();
  if (proposal === 'NO_MATCH' || !proposal.startsWith('page.')) return null;
  return proposal;
}

// ---------------------------------------------------------------------------
// Step 4-5: patch the source line, re-run to verify
// ---------------------------------------------------------------------------

function patchLocator(absPath, lineNumber, oldCall, newCall) {
  const lines = readFileSync(absPath, 'utf-8').split('\n');
  if (!lines[lineNumber - 1].includes(oldCall)) return false;
  lines[lineNumber - 1] = lines[lineNumber - 1].replace(oldCall, newCall);
  writeFileSync(absPath, lines.join('\n'), 'utf-8');
  return true;
}

async function healOneFailure(failure, chromium) {
  const relSpecFile = failure.specFile;
  const location = findSourceLocation(failure.message);
  if (!location) {
    return { healed: false, reason: 'Could not resolve a repo source line from the stack trace.' };
  }

  const extracted = extractLocatorCall(location.absPath, location.line);
  if (!extracted) {
    return {
      healed: false,
      reason: `Line ${location.line} of ${path.relative(REPO_ROOT, location.absPath)} had zero or multiple locator calls — too ambiguous to patch safely.`,
    };
  }

  const urlInfo = findLikelyUrl(location.absPath, location.line);
  const url = urlInfo ? resolveUrlExpression(urlInfo.expression) : null;
  if (!url) {
    return {
      healed: false,
      reason: 'Could not determine a URL to revisit (no preceding page.goto(...) with a resolvable URL in this file — likely mid-flow state, needs a human).',
    };
  }

  let dom;
  const page = await (await chromium.launch({ headless: true })).newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    dom = trimDom(await page.content());
  } catch (err) {
    return { healed: false, reason: `Could not load ${url}: ${err.message}` };
  } finally {
    await page.close().catch(() => {});
  }

  const newCall = await proposeNewLocator({
    oldCall: extracted.oldCall,
    errorMessage: failure.message,
    url,
    dom,
  });
  if (!newCall) {
    return { healed: false, reason: `Claude found no matching element on ${url} for "${extracted.oldCall}".` };
  }

  if (DRY_RUN) {
    return { healed: false, dryRun: true, reason: `Would replace \`${extracted.oldCall}\` with \`${newCall}\` in ${path.relative(REPO_ROOT, location.absPath)}:${location.line}` };
  }

  const patched = patchLocator(location.absPath, location.line, extracted.oldCall, newCall);
  if (!patched) {
    return { healed: false, reason: 'Source line changed between detection and patching — skipped to avoid clobbering unrelated edits.' };
  }

  const rerun = runSuiteAndCollectFailures(relSpecFile);
  const stillFailing = rerun.failures.some(
    (f) => f.title === failure.title && f.isLocatorFailure,
  );

  if (stillFailing) {
    return {
      healed: false,
      reason: `Patched \`${extracted.oldCall}\` -> \`${newCall}\` but the test still fails on re-run.`,
      file: path.relative(REPO_ROOT, location.absPath),
    };
  }

  return {
    healed: true,
    file: path.relative(REPO_ROOT, location.absPath),
    line: location.line,
    oldCall: extracted.oldCall,
    newCall,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  summary('## 🔧 Locator Auto-Heal Run');
  summary(`_${new Date().toISOString()}_`);

  const status = run('git status --porcelain');
  if (status.stdout.trim() && !DRY_RUN) {
    log('Working tree is not clean. Refusing to run.');
    summary('❌ **Refused to run** — working tree had uncommitted changes.');
    process.exit(2);
  }

  log('Running the full Playwright suite (this can take a while)...');
  const { failures, ranAtAll } = runSuiteAndCollectFailures();

  if (!ranAtAll) {
    log('Playwright suite did not produce a usable report — check that browsers are installed (npx playwright install) and the suite can run in this environment.');
    summary('❌ Suite did not run — check that `npx playwright install` has been run in this environment.');
    process.exit(2);
  }

  const locatorFailures = failures.filter((f) => f.isLocatorFailure);
  const otherFailures = failures.filter((f) => !f.isLocatorFailure);

  if (locatorFailures.length === 0) {
    log(`No locator failures found (${otherFailures.length} other failure(s), if any, are left for a human).`);
    summary(`✅ **No locator failures found.** (${otherFailures.length} other failing test(s), if any, are unrelated to locators and untouched.)`);
    process.exit(0);
  }

  log(`Found ${locatorFailures.length} locator failure(s), ${otherFailures.length} other failure(s) (left untouched).`);
  summary(`### ⚠️ Found ${locatorFailures.length} locator failure(s)`);

  const { chromium } = await import('@playwright/test');
  const healed = [];
  const unhealed = [];

  for (const failure of locatorFailures) {
    log(`Healing: ${failure.title} (${failure.specFile})`);
    const result = await healOneFailure(failure, chromium);
    if (result.healed) {
      log(`  ✅ ${result.file}:${result.line} — ${result.oldCall} -> ${result.newCall}`);
      healed.push({ ...result, title: failure.title });
      summary(`- ✅ \`${result.file}:${result.line}\` — \`${result.oldCall}\` → \`${result.newCall}\``);
    } else {
      log(`  ${result.dryRun ? '[dry-run] ' : '❌ '}${result.reason}`);
      unhealed.push({ title: failure.title, reason: result.reason });
      summary(`- ${result.dryRun ? '🔍' : '🧑‍🔧'} **${failure.title}**: ${result.reason}`);
    }
  }

  if (existsSync(JSON_REPORT_PATH)) run(`rm -f "${JSON_REPORT_PATH}" "${JSON_REPORT_PATH}.stderr"`);

  if (DRY_RUN) {
    log('Dry run complete. No files were modified.');
    process.exit(locatorFailures.length > 0 ? 1 : 0);
  }

  if (healed.length === 0) {
    log('No locator failures could be auto-healed.');
    process.exit(1);
  }

  if (!OPEN_PR) {
    log(`Healed ${healed.length} locator(s) locally. Re-run with --pr in CI to commit + open a pull request.`);
    process.exit(unhealed.length > 0 ? 1 : 0);
  }

  const files = [...new Set(healed.map((h) => h.file))];
  const branch = `heal-locators/${new Date().toISOString().replace(/[:.]/g, '-')}`;
  run(`git checkout -b ${branch}`);
  run(`git add ${files.map((f) => `"${f}"`).join(' ')}`);
  run(`git commit -m "heal-locators: fix ${healed.length} broken locator(s) in ${files.length} file(s)"`);
  const push = run(`git push origin ${branch}`);
  if (push.status !== 0) {
    log('git push failed:', push.stderr);
    process.exit(2);
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const repoSlug = process.env.GITHUB_REPO;
  if (githubToken && repoSlug) {
    const body = {
      title: `heal-locators: fix ${healed.length} broken locator(s)`,
      head: branch,
      base: 'main',
      body: [
        'Opened automatically by `scripts/heal-locators.mjs`.',
        '',
        '**Healed:**',
        ...healed.map((h) => `- \`${h.file}:${h.line}\`: \`${h.oldCall}\` → \`${h.newCall}\` (${h.title})`),
        unhealed.length ? `\n**Still needs a human:**\n${unhealed.map((u) => `- ${u.title}: ${u.reason}`).join('\n')}` : '',
        '\n⚠️ Review carefully — an LLM chose these locators from a live DOM snapshot. Re-run the suite before merging.',
      ].join('\n'),
    };
    const prResponse = await fetch(`https://api.github.com/repos/${repoSlug}/pulls`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json' },
      body: JSON.stringify(body),
    });
    if (prResponse.ok) {
      const pr = await prResponse.json();
      log(`Opened PR: ${pr.html_url}`);
      summary(`\n🔗 **[Opened PR #${pr.number}](${pr.html_url})**`);
    } else {
      log(`Failed to open PR: ${prResponse.status} ${await prResponse.text()}`);
    }
  } else {
    log(`Pushed branch ${branch}. Set GITHUB_TOKEN + GITHUB_REPO to auto-open a PR next time.`);
  }

  process.exit(unhealed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[heal-locators] Fatal error:', err);
  process.exit(2);
});
