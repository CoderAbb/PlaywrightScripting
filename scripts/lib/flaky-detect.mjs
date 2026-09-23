/**
 * flaky-detect.mjs
 *
 * The scoring logic scripts/detect-flaky-tests.mjs expects to import.
 * Wires together the pieces that already existed but were never
 * connected:
 *   - flaky-history.mjs   -> cross-run evidence (buildEvidence, recordRun)
 *   - graph/flakyTestAgent.mjs -> category/confidence/recommendation
 *
 * Score is a simple 0..1 blend of the two signals flakyTestAgent.mjs
 * already reasons over:
 *   - intraRunRetries: did it need a retry to pass in THIS run
 *   - interRunFailRate: how often it fails across recent history
 * Whichever signal is stronger drives the score, so a test that only
 * ever needed one retry doesn't get buried by a low history rate, and
 * vice versa.
 */

import { loadHistory, recordRun, buildEvidence } from "./flaky-history.mjs";
import { flakyTestGraph } from "../../graph/flakyTestAgent.mjs";

function computeScore(evidence) {
  const { intraRunRetries = 0, interRunFailRate = 0 } = evidence;

  const retrySignal =
    intraRunRetries > 0 ? Math.min(0.4 + intraRunRetries * 0.1, 0.7) : 0;

  return Math.min(1, Math.max(retrySignal, interRunFailRate));
}

function severityFor(score) {
  if (score >= 0.5) return "HIGH";
  if (score >= 0.25) return "MEDIUM";
  return "LOW";
}

/**
 * @param {Array} tests - flattenTests() output
 * @param {{ threshold?: number }} options
 */
export async function runFlakyDetection(tests, { threshold = 0.1 } = {}) {
  const history = loadHistory();
  const runsInHistory = history.runs.length;

  const flakyTests = [];

  for (const test of tests) {
    const evidence = buildEvidence(test.id, test, history);
    const score = computeScore(evidence);

    if (score < threshold) continue;

    const { category, confidence, recommendation } =
      await flakyTestGraph.invoke({ test, evidence });

    flakyTests.push({
      id: test.id,
      title: test.title,
      file: test.file,
      score: Number(score.toFixed(2)),
      severity: severityFor(score),
      category,
      confidence,
      recommendation
    });
  }

  flakyTests.sort((a, b) => b.score - a.score);

  // Persist this run for next time — after building evidence above, so
  // this run never gets compared against itself.
  recordRun(tests);

  return {
    generatedAt: new Date().toISOString(),
    testsScanned: tests.length,
    runsInHistory,
    threshold,
    flakyCount: flakyTests.length,
    flakyTests
  };
}
