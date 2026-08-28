/**
 * automation-state.mjs
 *
 * Shared persistence layer for scripts/auto-heal.mjs and scripts/heal-locators.mjs.
 * Both scripts call the same createRunState / record... / finalizeRun functions so
 * their results land in one consistent shape (see types/automation-state.d.ts) — the
 * foundation a future dashboard can read from, without either script needing to
 * know anything about the other or about how the data gets displayed.
 *
 * Three files, all under reports/, all gitignored by default:
 *   - automation-metrics.json  — history of finalized runs (bounded, last 200)
 *   - latest-run.json          — just the most recent run, for quick "current state" reads
 *   - healing-history.json     — append-only log of individual fix attempts (bounded, last 500)
 *
 * SECURITY: every path written here is normalized to repo-relative, and every
 * free-text field (titles, error messages, reasons) is passed through sanitize()
 * to strip absolute filesystem paths before it ever touches disk. This repo has
 * already leaked local machine paths into git twice this session via generated
 * report files — this module exists partly to make sure a third one doesn't
 * happen via these new files.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const REPO_ROOT = process.cwd();
const REPORTS_DIR = path.join(REPO_ROOT, 'reports');
const METRICS_FILE = path.join(REPORTS_DIR, 'automation-metrics.json');
const LATEST_FILE = path.join(REPORTS_DIR, 'latest-run.json');
const HEALING_HISTORY_FILE = path.join(REPORTS_DIR, 'healing-history.json');

const MAX_RUN_HISTORY = 200;
const MAX_HEALING_HISTORY = 500;

function ensureReportsDir() {
  mkdirSync(REPORTS_DIR, { recursive: true });
}

/** Strips absolute filesystem path fragments (Unix and Windows) from free text. */
function sanitize(value) {
  if (value === undefined || value === null) return value;
  return String(value)
    .replace(/\/(Users|home)\/[^\s'")]+/g, '<local-path>')
    .replace(/[A-Za-z]:\\[^\s'")]+/g, '<local-path>');
}

/** Converts an absolute path to repo-relative; leaves already-relative paths alone. */
function toRepoRelative(p) {
  if (!p) return p;
  const rel = path.isAbsolute(p) ? path.relative(REPO_ROOT, p) : p;
  return sanitize(rel);
}

function readJsonArray(file) {
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Starts a new run. `source` should be 'auto-heal' or 'heal-locators' — the
 * two scripts that currently produce these. `suite` is optional context, e.g.
 * a spec file name for a targeted heal-locators run.
 */
export function createRunState({ source, suite } = {}) {
  return {
    runId: crypto.randomUUID(),
    source,
    suite: suite ? toRepoRelative(suite) : undefined,
    tests: { total: 0, passed: 0, failed: 0, skipped: 0 },
    failures: [],
    healing: { attempted: 0, successful: 0, failed: 0 },
    execution: { startTime: new Date().toISOString() },
    status: 'RUNNING',
  };
}

/** Merges in whatever test counts are known so far (partial updates are fine). */
export function recordTestCounts(state, counts) {
  state.tests = { ...state.tests, ...counts };
}

/**
 * Records one failure (a broken file for auto-heal, a failed test for
 * heal-locators). `message` is truncated to 500 chars and sanitized.
 */
export function recordFailure(state, { title, specFile, classification, message }) {
  state.failures.push({
    title: sanitize(title),
    specFile: toRepoRelative(specFile),
    classification,
    message: sanitize(String(message ?? '').split('\n')[0]).slice(0, 500),
  });
}

/** Bumps the run-level healing counters. Call once per fix attempt. */
export function recordHealingAttempt(state, { successful }) {
  state.healing.attempted += 1;
  if (successful) state.healing.successful += 1;
  else state.healing.failed += 1;
}

/**
 * Appends one row to the durable healing-history.json log — this is the
 * per-attempt audit trail (which file, what changed, did it work), separate
 * from the per-run summary in automation-metrics.json.
 */
export function recordHealingEvent({ runId, source, file, line, oldValue, newValue, successful, reason }) {
  ensureReportsDir();
  const history = readJsonArray(HEALING_HISTORY_FILE);
  history.push({
    timestamp: new Date().toISOString(),
    runId,
    source,
    file: toRepoRelative(file),
    line,
    oldValue: oldValue ? sanitize(oldValue).slice(0, 300) : undefined,
    newValue: newValue ? sanitize(newValue).slice(0, 300) : undefined,
    successful,
    reason: reason ? sanitize(reason).slice(0, 500) : undefined,
  });
  const trimmed = history.slice(-MAX_HEALING_HISTORY);
  writeFileSync(HEALING_HISTORY_FILE, JSON.stringify(trimmed, null, 2));
}

/**
 * Marks the run complete, computes duration, and persists it to both
 * automation-metrics.json (appended, bounded history) and latest-run.json
 * (overwritten each time). Returns the finalized state.
 */
export function finalizeRun(state, status) {
  state.status = status;
  state.execution.endTime = new Date().toISOString();
  state.execution.durationMs =
    new Date(state.execution.endTime).getTime() - new Date(state.execution.startTime).getTime();

  ensureReportsDir();
  const history = readJsonArray(METRICS_FILE);
  history.push(state);
  const trimmed = history.slice(-MAX_RUN_HISTORY);
  writeFileSync(METRICS_FILE, JSON.stringify(trimmed, null, 2));
  writeFileSync(LATEST_FILE, JSON.stringify(state, null, 2));

  return state;
}
