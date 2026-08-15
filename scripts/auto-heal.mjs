#!/usr/bin/env node
/**
 * auto-heal.mjs
 *
 * Scans the repo for TypeScript compile errors, asks Claude to fix each
 * broken file, re-verifies the fix actually compiles, and (in CI) commits
 * the result to a branch and opens a PR for review.
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
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

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
 * lines into a { file -> [messages] } map.
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

  const errorList = errors
    .map((e) => `  Line ${e.line}, Col ${e.col} [${e.code}]: ${e.message}`)
    .join('\n');

  const systemPrompt = [
    'You are an automated code-repair tool for a Playwright + TypeScript test',
    'automation framework. You will be given one file\'s full source and the',
    'exact TypeScript compiler errors for that file.',
    '',
    'Rules:',
    '- Output ONLY the complete corrected file contents. No prose, no markdown',
    '  code fences, no explanation.',
    '- Make the smallest change that fixes the reported errors.',
    '- Do not change test logic, selectors, or behavior — only fix what is',
    '  necessary to satisfy the compiler.',
    '- Preserve existing formatting, comments, and style conventions.',
  ].join('\n');

  const userPrompt = [
    `File: ${relPath}`,
    '',
    'TypeScript errors:',
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

  log('Checking out working tree status...');
  const status = run('git status --porcelain');
  if (status.stdout.trim() && !DRY_RUN && !DETECT_ONLY) {
    log('Working tree is not clean. Refusing to auto-heal on top of uncommitted changes.');
    summary('❌ **Refused to run** — working tree had uncommitted changes.');
    process.exit(2);
  }

  log('Running tsc --noEmit to find issues...');
  const errorsByFile = collectTypeScriptErrors();

  if (errorsByFile.size === 0) {
    log('No TypeScript errors found. Repo is healthy. ✅');
    summary('✅ **Repo is healthy** — no TypeScript errors found.');
    process.exit(0);
  }

  log(`Found issues in ${errorsByFile.size} file(s).`);
  summary(`### ⚠️ Found issues in ${errorsByFile.size} file(s)`);
  summary('| File | Errors |');
  summary('| --- | --- |');
  for (const [absPath, errors] of errorsByFile) {
    summary(`| \`${path.relative(REPO_ROOT, absPath)}\` | ${errors.length} |`);
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
    process.exit(1);
  }

  const healedFiles = [];
  const unhealedFiles = [];

  for (const [absPath, errors] of errorsByFile) {
    const relPath = path.relative(REPO_ROOT, absPath);
    log(`Attempting to heal ${relPath} (${errors.length} error(s))...`);

    let healed = false;
    for (let attempt = 1; attempt <= MAX_FIX_ATTEMPTS_PER_FILE; attempt += 1) {
      const currentErrors = collectTypeScriptErrors().get(absPath);
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

      const recheck = collectTypeScriptErrors();
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
  }

  if (DRY_RUN) {
    log('Dry run complete. No files were modified.');
    summary('\n_Dry run — no files were modified._');
    process.exit(errorsByFile.size > 0 ? 1 : 0);
  }

  if (healedFiles.length === 0) {
    log('No files could be auto-healed. Manual review needed.');
    summary('\n❌ **No files could be auto-healed.** Manual review needed.');
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
    process.exit(unhealedFiles.length > 0 ? 1 : 0);
  }

  const branch = `auto-heal/${new Date().toISOString().replace(/[:.]/g, '-')}`;
  run(`git checkout -b ${branch}`);
  run(`git add ${healedFiles.map((f) => `"${f}"`).join(' ')}`);
  run(`git commit -m "auto-heal: fix TypeScript errors in ${healedFiles.length} file(s)"`);
  const push = run(`git push origin ${branch}`);
  if (push.status !== 0) {
    log('git push failed:', push.stderr);
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

  process.exit(unhealedFiles.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[auto-heal] Fatal error:', err);
  process.exit(2);
});
