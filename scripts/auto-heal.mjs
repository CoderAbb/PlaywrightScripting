#!/usr/bin/env node
/**
 * auto-heal.mjs
 *
 * Scans EVERY checkable source file in the repo — all .ts files via
 * `tsc --noEmit`, all hand-written .mjs/.cjs files via `node --check` (tsc
 * doesn't look at plain JS at all) — asks Claude to fix each broken file,
 * re-verifies the fix actually resolves cleanly, and (in CI) commits the
 * result to a branch and opens a PR for review.
 *
 * Local usage:
 *   ANTHROPIC_API_KEY=sk-... npm run heal
 *   ANTHROPIC_API_KEY=sk-... npm run heal -- --dry-run
 *   npm run heal:detect          # no API key needed, tsc-only, safe on every build
 *
 * CI usage (Jenkins):
 *   ANTHROPIC_API_KEY / GITHUB_TOKEN supplied as credential bindings, then:
 *   npm run heal -- --pr
 *
 * Exit codes:
 *   0 = no issues found, or issues found and fixed successfully
 *   1 = issues found that could not be auto-fixed (needs a human)
 *   2 = script/config error (missing API key, git failure, etc.)
 */

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, readdirSync, statSync } from 'node:fs';
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
const MAX_FIX_ATTEMPTS_PER_FILE = 2;

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const OPEN_PR = args.has('--pr');
const DETECT_ONLY = args.has('--detect-only');

function log(...msg) {
  console.log('[auto-heal]', ...msg);
}

/**
 * Appends markdown to the GitHub Actions run summary (visible right in the
 * Actions tab UI). No-op anywhere else (Jenkins, local) since
 * GITHUB_STEP_SUMMARY is only set by the Actions runner.
 */
function summary(markdown) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    appendFileSync(summaryFile, `${markdown}\n`);
  }
}

function run(cmd, opts = {}) {
  return spawnSync(cmd, {
    cwd: REPO_ROOT,
    shell: true,
    encoding: 'utf-8',
    ...opts,
  });
}

/**
 * Runs `tsc --noEmit` and parses "file(line,col): error TSxxxx: message"
 * lines into a { file -> [messages] } map. Covers every .ts file in the
 * repo (tsconfig.json's include/exclude is repo-wide by design).
 */
function collectTypeScriptErrors() {
  const result = run('npx tsc --noEmit --pretty false');
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const errorsByFile = new Map();

  const pattern = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/gm;
  let match;
  while ((match = pattern.exec(output)) !== null) {
    const [, file, line, col, code, message] = match;
    const key = path.resolve(REPO_ROOT, file);
    if (!errorsByFile.has(key)) errorsByFile.set(key, []);
    errorsByFile.get(key).push({ line: Number(line), col: Number(col), code, message });
  }

  return errorsByFile;
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'allure-report', 'allure-results', 'test-results', 'playwright-report']);

/**
 * Recursively finds every hand-written JS source file (.mjs, .cjs) in the
 * repo. Plain .js is deliberately excluded: in this repo .js files next to
 * a same-named .ts file are local tsc build output, not source — checking
 * them would just re-report the same error twice under a stale filename.
 */
function findJsSourceFiles(dir = REPO_ROOT) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findJsSourceFiles(full));
    } else if (/\.(mjs|cjs)$/.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

/**
 * `tsc` never looks at .mjs/.cjs files, so a broken auto-heal.mjs or
 * login-agent.mjs could go undetected forever. `node --check` does a real
 * parse (syntax only, no type info) without executing the file — exactly
 * what we need to catch the class of bug (mismatched parens, bad template
 * literals, etc.) that TypeScript would have caught if these were .ts.
 */
function collectJsSyntaxErrors() {
  const errorsByFile = new Map();
  for (const file of findJsSourceFiles()) {
    const result = spawnSync('node', ['--check', file], { encoding: 'utf-8' });
    if (result.status !== 0) {
      const stderr = result.stderr ?? '';
      // node's syntax error format: "<file>:<line>\n...\nSyntaxError: <msg>"
      const lineMatch = stderr.match(/:(\d+)\n/);
      const msgMatch = stderr.match(/SyntaxError: (.+)/);
      errorsByFile.set(file, [
        {
          line: lineMatch ? Number(lineMatch[1]) : 0,
          col: 0,
          code: 'JS-SYNTAX',
          message: msgMatch ? msgMatch[1].trim() : stderr.trim().split('\n').pop(),
        },
      ]);
    }
  }
  return errorsByFile;
}

/**
 * Merges TypeScript compiler errors (all .ts files) and JS syntax errors
 * (all .mjs/.cjs files) into a single map covering every checkable source
 * file in the repo.
 */
function collectAllErrors() {
  const merged = new Map(collectTypeScriptErrors());
  for (const [file, errors] of collectJsSyntaxErrors()) {
    merged.set(file, errors);
  }
  return merged;
}

/**
 * Re-checks a single file using whichever checker applies to its
 * extension, so the per-file retry loop stays accurate for both .ts and
 * .mjs/.cjs files instead of only ever looking at TypeScript output.
 */
function recheckFile(absPath) {
  if (/\.(mjs|cjs)$/.test(absPath)) {
    const single = new Map();
    const result = spawnSync('node', ['--check', absPath], { encoding: 'utf-8' });
    if (result.status !== 0) {
      const stderr = result.stderr ?? '';
      const lineMatch = stderr.match(/:(\d+)\n/);
      const msgMatch = stderr.match(/SyntaxError: (.+)/);
      single.set(absPath, [
        {
          line: lineMatch ? Number(lineMatch[1]) : 0,
          col: 0,
          code: 'JS-SYNTAX',
          message: msgMatch ? msgMatch[1].trim() : stderr.trim().split('\n').pop(),
        },
      ]);
    }
    return single;
  }
  return collectTypeScriptErrors();
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
  if (!textBlock) {
    throw new Error('Claude returned no text content.');
  }
  return textBlock.text;
}

/**
 * Strips a ```lang ... ``` fence if Claude wrapped the file in one,
 * despite being told not to.
 */
function stripCodeFence(text) {
  const fenced = text.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  return fenced ? fenced[1] : text;
}

async function fixFile(absPath, errors) {
  const relPath = path.relative(REPO_ROOT, absPath);
  const original = readFileSync(absPath, 'utf-8');
  const isJs = /\.(mjs|cjs)$/.test(absPath);

  const errorList = errors
    .map((e) => `  Line ${e.line}, Col ${e.col} [${e.code}]: ${e.message}`)
    .join('\n');

  const systemPrompt = [
    'You are an automated code-repair tool for a Playwright + TypeScript test',
    'automation framework. You will be given one file\'s full source and the',
    `exact ${isJs ? 'Node.js syntax' : 'TypeScript compiler'} errors for that file.`,
    '',
    'Rules:',
    '- Output ONLY the complete corrected file contents. No prose, no markdown',
    '  code fences, no explanation.',
    '- Make the smallest change that fixes the reported errors.',
    '- Do not change test logic, selectors, or behavior — only fix what is',
    '  necessary to satisfy the compiler/parser.',
    '- Preserve existing formatting, comments, and style conventions.',
  ].join('\n');

  const userPrompt = [
    `File: ${relPath}`,
    '',
    `${isJs ? 'Node.js syntax' : 'TypeScript'} errors:`,
    errorList,
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
  summary('## 🩺 Auto-Heal Run');
  summary(`_${new Date().toISOString()}_`);
  const runState = createRunState({ source: 'auto-heal' });

  log('Checking out working tree status...');
  const status = run('git status --porcelain');
  if (status.stdout.trim() && !DRY_RUN && !DETECT_ONLY) {
    log('Working tree is not clean. Refusing to auto-heal on top of uncommitted changes.');
    summary('❌ **Refused to run** — working tree had uncommitted changes.');
    finalizeRun(runState, 'FAILED');
    process.exit(2);
  }

  log('Scanning entire repo: tsc for all .ts files, node --check for all .mjs/.cjs files...');
  const errorsByFile = collectAllErrors();

  if (errorsByFile.size === 0) {
    log('No errors found across the repo. Repo is healthy. ✅');
    summary('✅ **Repo is healthy** — no errors found in any `.ts`, `.mjs`, or `.cjs` file.');
    finalizeRun(runState, 'PASSED');
    process.exit(0);
  }

  log(`Found issues in ${errorsByFile.size} file(s).`);
  summary(`### ⚠️ Found issues in ${errorsByFile.size} file(s)`);
  summary('| File | Errors |');
  summary('| --- | --- |');
  for (const [absPath, errors] of errorsByFile) {
    const relPath = path.relative(REPO_ROOT, absPath);
    summary(`| \`${relPath}\` | ${errors.length} |`);
    recordFailure(runState, {
      title: relPath,
      specFile: absPath,
      classification: /\.(mjs|cjs)$/.test(absPath) ? 'js-syntax' : 'typescript',
      message: errors.map((e) => `[${e.code}] ${e.message}`).join('; '),
    });
  }

  if (DETECT_ONLY) {
    // No API calls here at all — just report what's broken. Safe to run on
    // every single build without burning Anthropic/GitHub API quota.
    for (const [absPath, errors] of errorsByFile) {
      const relPath = path.relative(REPO_ROOT, absPath);
      log(`  ${relPath}: ${errors.length} error(s)`);
      for (const e of errors) {
        log(`    Line ${e.line}, Col ${e.col} [${e.code}]: ${e.message}`);
      }
    }
    log('Detect-only mode: no fixes attempted. Run "npm run heal" or "npm run heal:pr" to auto-fix.');
    summary('\n_Detect-only mode — no fixes attempted. The nightly auto-heal job will attempt fixes and open a PR._');
    finalizeRun(runState, 'HUMAN_REVIEW');
    process.exit(1);
  }

  const healedFiles = [];
  const unhealedFiles = [];

  for (const [absPath, errors] of errorsByFile) {
    const relPath = path.relative(REPO_ROOT, absPath);
    log(`Attempting to heal ${relPath} (${errors.length} error(s))...`);

    let healed = false;
    for (let attempt = 1; attempt <= MAX_FIX_ATTEMPTS_PER_FILE; attempt += 1) {
      const currentErrors = recheckFile(absPath).get(absPath);
      if (!currentErrors || currentErrors.length === 0) {
        healed = true;
        break;
      }

      try {
        const fixed = await fixFile(absPath, currentErrors);
        if (DRY_RUN) {
          log(`  [dry-run] Would write fix to ${relPath} (attempt ${attempt}).`);
          break;
        }
        writeFileSync(absPath, fixed, 'utf-8');
      } catch (err) {
        log(`  Claude call failed for ${relPath}: ${err.message}`);
        break;
      }

      const recheck = recheckFile(absPath);
      if (!recheck.has(absPath)) {
        log(`  Fixed ${relPath} on attempt ${attempt}. ✅`);
        healed = true;
        break;
      }
      log(`  Attempt ${attempt} did not fully resolve errors in ${relPath}, retrying...`);
    }

    if (DRY_RUN) continue;
    if (healed) healedFiles.push(relPath);
    else unhealedFiles.push(relPath);
    recordHealingAttempt(runState, { successful: healed });
    recordHealingEvent({
      runId: runState.runId,
      source: 'auto-heal',
      file: absPath,
      successful: healed,
      reason: healed ? undefined : 'Did not fully resolve after max attempts',
    });
  }

  if (DRY_RUN) {
    log('Dry run complete. No files were modified.');
    summary('\n_Dry run — no files were modified._');
    finalizeRun(runState, 'HUMAN_REVIEW');
    process.exit(errorsByFile.size > 0 ? 1 : 0);
  }

  if (healedFiles.length === 0) {
    log('No files could be auto-healed. Manual review needed.');
    summary('\n❌ **No files could be auto-healed.** Manual review needed.');
    finalizeRun(runState, 'HUMAN_REVIEW');
    process.exit(1);
  }

  log(`Healed: ${healedFiles.join(', ')}`);
  if (unhealedFiles.length > 0) {
    log(`Still broken (needs a human): ${unhealedFiles.join(', ')}`);
  }
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

  const branch = `auto-heal/${new Date().toISOString().replace(/[:.]/g, '-')}`;
  run(`git checkout -b ${branch}`);
  run(`git add ${healedFiles.map((f) => `"${f}"`).join(' ')}`);
  run(`git commit -m "auto-heal: fix TypeScript errors in ${healedFiles.length} file(s)"`);
  const push = run(`git push origin ${branch}`);
  if (push.status !== 0) {
    log('git push failed:', push.stderr);
    finalizeRun(runState, 'FAILED');
    process.exit(2);
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const repoSlug = process.env.GITHUB_REPO; // e.g. "CoderAbb/PlaywrightScripting"
  if (githubToken && repoSlug) {
    const body = {
      title: `auto-heal: fix TypeScript errors in ${healedFiles.length} file(s)`,
      head: branch,
      base: 'main',
      body: [
        'Opened automatically by `scripts/auto-heal.mjs`.',
        '',
        '**Healed files:**',
        ...healedFiles.map((f) => `- \`${f}\``),
        unhealedFiles.length
          ? `\n**Still needs manual review:**\n${unhealedFiles.map((f) => `- \`${f}\``).join('\n')}`
          : '',
        '\nReview the diff carefully before merging — this was generated by an LLM.',
      ].join('\n'),
    };
    const prResponse = await fetch(`https://api.github.com/repos/${repoSlug}/pulls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
      },
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
  console.error('[auto-heal] Fatal error:', err);
  process.exit(2);
});
