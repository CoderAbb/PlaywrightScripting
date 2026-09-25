#!/usr/bin/env node
/**
 * heal-locators.mjs
 *
 * Runs the Playwright suite (JSON reporter), finds test failures caused by
 * a locator that couldn't resolve to an element (timeouts, strict-mode
 * violations, "no element found", etc.), and asks Claude to propose a
 * replacement using Playwright's recommended priority ladder:
 *   getByRole -> getByTestId -> getByLabel -> getByText -> css (last resort)
 * Applies the fix to the spec file, then re-runs just that file to verify.
 *
 * This is the counterpart to auto-heal.mjs, which only checks
 * TypeScript/JS syntax and never looks at runtime test failures at all.
 *
 * Local usage:
 *   ANTHROPIC_API_KEY=sk-... npm run heal-locators
 *   ANTHROPIC_API_KEY=sk-... npm run heal-locators -- --dry-run
 *   npm run heal-locators -- --detect-only   # no API key needed
 *
 * CI usage (mirrors auto-heal.mjs):
 *   ANTHROPIC_API_KEY / GITHUB_TOKEN supplied as credential bindings, then:
 *   npm run heal-locators -- --pr
 *
 * Exit codes:
 *   0 = no locator failures found, or all found were healed and verified
 *   1 = failures found that could not be auto-fixed (needs a human)
 *   2 = script/config error (missing API key, git failure, etc.)
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  createRunState,
  recordFailure,
  recordHealingAttempt,
  recordHealingEvent,
  finalizeRun,
} from './lib/automation-state.mjs';

const REPO_ROOT = process.cwd();
const MODEL = 'claude-sonnet-4-6';
const MAX_FIX_ATTEMPTS_PER_TEST = 2;

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const OPEN_PR = args.has('--pr');
const DETECT_ONLY = args.has('--detect-only');

// Messages that indicate the failure is a locator-resolution problem, not
// an assertion-value mismatch, network error, or app bug.
const LOCATOR_FAILURE_PATTERN =
  /waiting for locator|strict mode violation|resolved to \d+ elements?|element(?:\(s\))? not found|Timeout \d+ms exceeded while waiting for|target closed|locator\.\w+: Error/i;

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

/**
 * Resolves the locally installed `playwright` CLI binary directly, instead
 * of going through `npx`. Recent npm versions print "npm notice run ..."
 * lines around npx calls, and on some setups those land on stdout instead
 * of stderr — silently corrupting any JSON we try to capture from it.
 * Calling node_modules/.bin/playwright directly sidesteps npm entirely.
 */
function resolvePlaywrightBin() {
  const ext = process.platform === 'win32' ? '.cmd' : '';
  const local = path.join(REPO_ROOT, 'node_modules', '.bin', `playwright${ext}`);
  return existsSync(local) ? local : 'npx playwright'; // fallback, less reliable
}

/**
 * Pulls the JSON object out of stdout even if something unexpected (an npm
 * notice, a warning banner, etc.) got mixed in around it. Playwright's
 * json reporter output is always a single top-level object, so grabbing
 * from the first "{" to the last "}" is safe.
 */
function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Runs the full suite through Playwright's built-in JSON reporter and
 * returns the parsed report. We don't rely on any reporter config in
 * playwright.config.ts — passing --reporter=json overrides it for this run
 * and writes the report to stdout.
 */
function runSuiteAndCollectResults(specFile) {
  const bin = resolvePlaywrightBin();
  const target = specFile ? `"${specFile}"` : '';
  const result = run(`${bin} test ${target} --reporter=json --workers=1 --timeout=120000`);

  const parsed = extractJson(result.stdout);
  if (parsed) return parsed;

  log('Could not parse Playwright JSON output.');
  log('--- stdout ---');
  log(result.stdout);
  log('--- stderr ---');
  log(result.stderr);
  return null;
}

/**
 * Walks the JSON reporter's nested suite tree and yields every failed test
 * result along with the spec file it belongs to.
 */
function* walkFailedTests(suite, fileHint) {
  const file = suite.file ? path.resolve(REPO_ROOT, suite.file) : fileHint;
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      for (const result of t.results ?? []) {
        if (result.status === 'failed' || result.status === 'timedOut') {
          yield { file, specTitle: spec.title, result };
        }
      }
    }
  }
  for (const child of suite.suites ?? []) {
    yield* walkFailedTests(child, file);
  }
}

/**
 * Collects locator-related failures from a JSON report, grouped by spec
 * file. Each entry keeps the error message and Playwright's own code-frame
 * snippet (error.snippet), which already shows the exact broken line in
 * context — no need to re-derive it ourselves.
 */
function collectLocatorFailures(report) {
  const byFile = new Map();
  if (!report?.suites) return byFile;

  for (const topSuite of report.suites) {
    for (const { file, specTitle, result } of walkFailedTests(topSuite)) {
      for (const error of result.errors ?? []) {
        const message = error.message ?? '';
        if (!LOCATOR_FAILURE_PATTERN.test(message)) continue;
        if (!byFile.has(file)) byFile.set(file, []);
        byFile.get(file).push({
          specTitle,
          message: stripAnsi(message),
          snippet: error.snippet ? stripAnsi(error.snippet) : null,
          location: error.location ?? null,
        });
      }
    }
  }
  return byFile;
}

function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

async function callClaude(systemPrompt, userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Export it or add it as a Jenkins credential.');
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
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }
  const data = await response.json();
  const textBlock = data.content.find((block) => block.type === 'text');
  if (!textBlock) throw new Error('Claude returned no text content.');
  return textBlock.text;
}

function stripCodeFence(text) {
  const fenced = text.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  return fenced ? fenced[1] : text;
}

async function proposeFix(absPath, failures) {
  const relPath = path.relative(REPO_ROOT, absPath);
  const original = readFileSync(absPath, 'utf-8');

  const failureList = failures
    .map((f, i) => {
      const loc = f.location ? ` (${f.location.file}:${f.location.line}:${f.location.column})` : '';
      return [
        `Failure ${i + 1} — test "${f.specTitle}"${loc}`,
        f.message,
        f.snippet ? `\nCode frame:\n${f.snippet}` : '',
      ].join('\n');
    })
    .join('\n\n');

  const systemPrompt = [
    'You are an automated locator-repair tool for a Playwright + TypeScript',
    'test automation framework. You will be given one spec file\'s full',
    'source and the runtime failures Playwright reported for it, each',
    'caused by a locator that could not resolve to an element.',
    '',
    'Rules:',
    '- Output ONLY the complete corrected file contents. No prose, no',
    '  markdown code fences, no explanation.',
    '- Fix ONLY the broken locator(s) identified by the failures below.',
    '  Do not change unrelated test logic or assertions.',
    '- Prefer this priority ladder for the replacement locator, in order:',
    '  1. page.getByRole(...)  2. page.getByTestId(...)',
    '  3. page.getByLabel(...) 4. page.getByText(...)',
    '  5. a CSS/XPath locator only if none of the above are feasible from',
    '     the given context.',
    '- If the code frame does not give enough information to infer a safe',
    '  replacement (e.g. no visible attributes, ambiguous text), leave that',
    '  specific locator unchanged rather than guessing.',
    '- Preserve existing formatting, comments, and style conventions.',
  ].join('\n');

  const userPrompt = [
    `File: ${relPath}`,
    '',
    'Locator failures:',
    failureList,
    '',
    'Full file contents:',
    '---',
    original,
    '---',
  ].join('\n');

  const fixed = stripCodeFence((await callClaude(systemPrompt, userPrompt)).trim());
  return fixed;
}

async function main() {
  summary('## 🎯 Heal-Locators Run');
  summary(`_${new Date().toISOString()}_`);
  const runState = createRunState({ source: 'heal-locators' });

  log('Checking out working tree status...');
  const status = run('git status --porcelain');
  if (status.stdout.trim() && !DRY_RUN && !DETECT_ONLY) {
    log('Working tree is not clean. Refusing to heal on top of uncommitted changes.');
    summary('❌ **Refused to run** — working tree had uncommitted changes.');
    finalizeRun(runState, 'FAILED');
    process.exit(2);
  }

  log('Running suite with --reporter=json to capture failures...');
  const report = runSuiteAndCollectResults();
  if (!report) {
    finalizeRun(runState, 'FAILED');
    process.exit(2);
  }

  const failuresByFile = collectLocatorFailures(report);

  if (failuresByFile.size === 0) {
    log('No locator-resolution failures found. ✅ (Other kinds of failures, if any, are not in scope for this script.)');
    summary('✅ **No locator failures found.**');
    finalizeRun(runState, 'PASSED');
    process.exit(0);
  }

  log(`Found locator failures in ${failuresByFile.size} file(s).`);
  summary(`### ⚠️ Locator failures in ${failuresByFile.size} file(s)`);
  summary('| File | Failed tests |');
  summary('| --- | --- |');
  for (const [absPath, failures] of failuresByFile) {
    const relPath = path.relative(REPO_ROOT, absPath);
    summary(`| \`${relPath}\` | ${failures.length} |`);
    recordFailure(runState, {
      title: relPath,
      specFile: absPath,
      classification: 'locator',
      message: failures.map((f) => `${f.specTitle}: ${f.message}`).join(' | '),
    });
  }

  if (DETECT_ONLY) {
    for (const [absPath, failures] of failuresByFile) {
      const relPath = path.relative(REPO_ROOT, absPath);
      log(`  ${relPath}:`);
      for (const f of failures) log(`    "${f.specTitle}" — ${f.message.split('\n')[0]}`);
    }
    log('Detect-only mode: no fixes attempted. Run "npm run heal-locators" to auto-fix.');
    summary('\n_Detect-only mode — no fixes attempted._');
    finalizeRun(runState, 'HUMAN_REVIEW');
    process.exit(1);
  }

  const healedFiles = [];
  const unhealedFiles = [];

  for (const [absPath, failures] of failuresByFile) {
    const relPath = path.relative(REPO_ROOT, absPath);
    log(`Attempting to heal ${relPath} (${failures.length} failure(s))...`);

    let healed = false;
    for (let attempt = 1; attempt <= MAX_FIX_ATTEMPTS_PER_TEST; attempt += 1) {
      let fixed;
      try {
        fixed = await proposeFix(absPath, failures);
      } catch (err) {
        log(`  Claude call failed for ${relPath}: ${err.message}`);
        break;
      }

      if (DRY_RUN) {
        log(`  [dry-run] Would write proposed fix to ${relPath} (attempt ${attempt}).`);
        log('  --- proposed diff preview skipped in dry-run; inspect manually if needed ---');
        break;
      }

      writeFileSync(absPath, fixed, 'utf-8');

      log(`  Re-running ${relPath} to verify...`);
      const verifyReport = runSuiteAndCollectResults(relPath);
      const remaining = verifyReport ? collectLocatorFailures(verifyReport) : new Map();

      if (!remaining.has(path.resolve(REPO_ROOT, relPath))) {
        log(`  Fixed ${relPath} on attempt ${attempt}. ✅`);
        healed = true;
        break;
      }
      log(`  Attempt ${attempt} did not fully resolve failures in ${relPath}, retrying...`);
    }

    if (DRY_RUN) continue;
    if (healed) healedFiles.push(relPath);
    else unhealedFiles.push(relPath);
    recordHealingAttempt(runState, { successful: healed });
    recordHealingEvent({
      runId: runState.runId,
      source: 'heal-locators',
      file: absPath,
      successful: healed,
      reason: healed ? undefined : 'Did not fully resolve after max attempts',
    });
  }

  if (DRY_RUN) {
    log('Dry run complete. No files were modified.');
    summary('\n_Dry run — no files were modified._');
    finalizeRun(runState, 'HUMAN_REVIEW');
    process.exit(failuresByFile.size > 0 ? 1 : 0);
  }

  if (healedFiles.length === 0) {
    log('No files could be auto-healed. Manual review needed.');
    summary('\n❌ **No files could be auto-healed.** Manual review needed.');
    finalizeRun(runState, 'HUMAN_REVIEW');
    process.exit(1);
  }

  log(`Healed: ${healedFiles.join(', ')}`);
  if (unhealedFiles.length > 0) log(`Still broken (needs a human): ${unhealedFiles.join(', ')}`);
  summary(`\n### ✅ Healed ${healedFiles.length} file(s)`);
  for (const f of healedFiles) summary(`- \`${f}\``);
  if (unhealedFiles.length > 0) {
    summary(`\n### 🧑‍🔧 Still needs a human (${unhealedFiles.length})`);
    for (const f of unhealedFiles) summary(`- \`${f}\``);
  }

  if (!OPEN_PR) {
    log('Fixes applied locally. Re-run with --pr in CI to commit + open a pull request.');
    finalizeRun(runState, unhealedFiles.length > 0 ? 'HUMAN_REVIEW' : 'PASSED');
    process.exit(unhealedFiles.length > 0 ? 1 : 0);
  }

  const branch = `heal-locators/${new Date().toISOString().replace(/[:.]/g, '-')}`;
  run(`git checkout -b ${branch}`);
  run(`git add ${healedFiles.map((f) => `"${f}"`).join(' ')}`);
  run(`git commit -m "heal-locators: fix broken locator(s) in ${healedFiles.length} file(s)"`);
  const push = run(`git push origin ${branch}`);
  if (push.status !== 0) {
    log('git push failed:', push.stderr);
    finalizeRun(runState, 'FAILED');
    process.exit(2);
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const repoSlug = process.env.GITHUB_REPO;
  if (githubToken && repoSlug) {
    const body = {
      title: `heal-locators: fix broken locator(s) in ${healedFiles.length} file(s)`,
      head: branch,
      base: 'main',
      body: [
        'Opened automatically by `scripts/heal-locators.mjs`.',
        '',
        '**Healed files:**',
        ...healedFiles.map((f) => `- \`${f}\``),
        unhealedFiles.length
          ? `\n**Still needs manual review:**\n${unhealedFiles.map((f) => `- \`${f}\``).join('\n')}`
          : '',
        '\nReview the diff carefully before merging — locator fixes were proposed by an LLM and verified by re-running only the affected spec.',
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
      const errBody = await prResponse.text();
      log(`Failed to open PR: ${prResponse.status} ${errBody}`);
      summary(`\n❌ Failed to open PR: ${prResponse.status}`);
    }
  } else {
    log(`Pushed branch ${branch}. Set GITHUB_TOKEN + GITHUB_REPO to auto-open a PR next time.`);
    summary(`\n📤 Pushed branch \`${branch}\`. Set \`GITHUB_TOKEN\` + \`GITHUB_REPO\` to auto-open a PR next time.`);
  }

  finalizeRun(runState, unhealedFiles.length > 0 ? 'HUMAN_REVIEW' : 'PASSED');
  process.exit(unhealedFiles.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[heal-locators] Fatal error:', err);
  process.exit(2);
});
