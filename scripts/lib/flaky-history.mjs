/**
 * flaky-history.mjs
 *
 * Append-only, bounded cross-run history that scripts/detect-flaky-tests.mjs
 * reads to tell "failed once" apart from "fails intermittently across runs".
 * Lives under reports/ (gitignored, same as automation-metrics.json) and is
 * keyed by test id (`${suite}:${title}`) so a test keeps its history even if
 * other specs are added/removed around it.
 *
 * File shape (reports/flaky-history.json):
 * {
 *   runs: [
 *     {
 *       runId, timestamp,
 *       tests: { [testId]: { status, retryCount, durationMs, error } }
 *     },
 *     ...
 *   ]
 * }
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const REPORTS_DIR = path.resolve("reports");
const HISTORY_FILE = path.join(REPORTS_DIR, "flaky-history.json");

const MAX_RUNS = 30;

function ensureReportsDir() {
  mkdirSync(REPORTS_DIR, { recursive: true });
}

export function loadHistory() {
  if (!existsSync(HISTORY_FILE)) return { runs: [] };
  try {
    const parsed = JSON.parse(readFileSync(HISTORY_FILE, "utf8"));
    return Array.isArray(parsed?.runs) ? parsed : { runs: [] };
  } catch {
    return { runs: [] };
  }
}

/**
 * Appends the current run's per-test snapshot and persists the bounded
 * history. `tests` should be the array produced by result-parser's
 * flattenTests() (or compatible shape: id, status, retryCount, duration, error).
 */
export function recordRun(tests) {
  ensureReportsDir();
  const history = loadHistory();

  const snapshot = {};
  for (const test of tests) {
    snapshot[test.id] = {
      status: test.status,
      retryCount: test.retryCount || 0,
      durationMs: test.duration || 0,
      error: test.error ? String(test.error).split("\n")[0].slice(0, 300) : null
    };
  }

  history.runs.push({
    runId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    tests: snapshot
  });

  history.runs = history.runs.slice(-MAX_RUNS);
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  return history;
}

/** Builds the flakiness evidence object flakyTestAgent.mjs expects for one test. */
export function buildEvidence(testId, currentTest, history) {
  const pastRuns = history.runs
    .map(run => run.tests[testId])
    .filter(Boolean);

  const runsObserved = pastRuns.length;
  const failedRuns = pastRuns.filter(r => r.status === "failed").length;
  const interRunFailRate = runsObserved > 0 ? failedRuns / runsObserved : 0;

  const durations = pastRuns.map(r => r.durationMs).filter(d => d > 0);
  const durationVarianceMs =
    durations.length > 1 ? Math.max(...durations) - Math.min(...durations) : 0;

  const errorSignatures = [
    ...pastRuns.map(r => r.error).filter(Boolean),
    currentTest.error
  ].filter(Boolean);

  return {
    intraRunRetries: currentTest.retryCount || 0,
    interRunFailRate: Number(interRunFailRate.toFixed(2)),
    runsObserved,
    errorSignatures,
    durationVarianceMs
  };
}
