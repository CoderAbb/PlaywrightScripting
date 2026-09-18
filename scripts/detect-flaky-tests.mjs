#!/usr/bin/env node
/**
 * detect-flaky-tests.mjs
 *
 * Fills in the "flaky" script that package.json already pointed at. Reads
 * the current run's Playwright results, records this run into
 * reports/flaky-history.json, then combines in-run retry evidence with
 * cross-run pass/fail history to flag tests worth attention — routing each
 * one through graph/flakyTestAgent.mjs for a category + recommendation,
 * the same way scripts/analyze-results.mjs routes failures through
 * failureRcaAgent.mjs.
 *
 * Usage:
 *   npm run flaky                  # human-readable report + reports/flaky-report.json
 *   npm run flaky -- --json        # machine-readable JSON on stdout (for CI)
 *   npm run flaky -- --quarantine  # also writes reports/quarantine-list.json
 *   npm run flaky -- --strict      # exit 1 if any HIGH severity flaky test is found
 *   npm run flaky -- --threshold=0.15
 */

import { loadResults, flattenTests } from "../graph/intelligence/result-parser.mjs";
import { flakyTestGraph } from "../graph/flakyTestAgent.mjs";
import { recordRun, loadHistory, buildEvidence } from "./lib/flaky-history.mjs";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const option = (name, fallback) => {
  const match = args.find(a => a.startsWith(`--${name}=`));
  return match ? match.split("=")[1] : fallback;
};

const JSON_OUTPUT = flag("json");
const QUARANTINE = flag("quarantine");
const STRICT = flag("strict");
const THRESHOLD = Number(option("threshold", "0.1"));

const REPORT_DIR = path.resolve("reports");
const REPORT_FILE = path.join(REPORT_DIR, "flaky-report.json");
const QUARANTINE_FILE = path.join(REPORT_DIR, "quarantine-list.json");

function severityFor(interRunFailRate, intraRunRetries) {
  if (interRunFailRate >= 0.4 || intraRunRetries >= 2) return "HIGH";
  if (interRunFailRate > 0 || intraRunRetries === 1) return "MEDIUM";
  return "LOW";
}

async function main() {
  const results = loadResults();
  const tests = flattenTests(results);

  if (tests.length === 0) {
    if (!JSON_OUTPUT) {
      console.log(
        "No test-results/results.json found (or it's empty) — run `npm test` first."
      );
    }
    process.exit(0);
  }

  // Persist this run, then look at everything we know including it.
  recordRun(tests);
  const history = loadHistory();

  // Don't pre-filter by this run's status alone — a test that passed clean
  // this run but flipped status in earlier runs is exactly what history is
  // for. hasFlakinessSignal below does the real filtering.
  const flaky = [];

  for (const test of tests) {
    const evidence = buildEvidence(test.id, test, history);

    // Skip tests that only ever failed cleanly with no retry/history signal —
    // that's a real failure, not a flakiness candidate, and analyze-results.mjs
    // / failureRcaAgent.mjs already cover it.
    const hasFlakinessSignal =
      evidence.intraRunRetries > 0 ||
      (evidence.runsObserved > 0 && evidence.interRunFailRate > 0 && evidence.interRunFailRate < 1);

    if (!hasFlakinessSignal) continue;

    const combinedScore = Math.max(
      evidence.intraRunRetries > 0 ? 0.5 : 0,
      evidence.interRunFailRate
    );

    if (combinedScore < THRESHOLD) continue;

    const { category, confidence, recommendation } = await flakyTestGraph.invoke({
      test,
      evidence
    });

    flaky.push({
      id: test.id,
      title: test.title,
      file: test.file,
      score: Number(combinedScore.toFixed(2)),
      severity: severityFor(evidence.interRunFailRate, evidence.intraRunRetries),
      category,
      confidence,
      recommendation,
      evidence
    });
  }

  flaky.sort((a, b) => b.score - a.score);

  const report = {
    generatedAt: new Date().toISOString(),
    threshold: THRESHOLD,
    runsInHistory: history.runs.length,
    testsScanned: tests.length,
    flakyCount: flaky.length,
    flakyTests: flaky
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  if (QUARANTINE) {
    const quarantineList = flaky
      .filter(t => t.severity !== "LOW")
      .map(t => ({ id: t.id, title: t.title, file: t.file, reason: t.category }));
    fs.writeFileSync(QUARANTINE_FILE, JSON.stringify(quarantineList, null, 2));
  }

  if (JSON_OUTPUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printSummary(report);
  }

  if (STRICT && flaky.some(t => t.severity === "HIGH")) {
    process.exit(1);
  }
}

function printSummary(report) {
  console.log("\n========================================");
  console.log("FLAKY TEST DETECTION");
  console.log("========================================");
  console.log(`Tests scanned     : ${report.testsScanned}`);
  console.log(`Runs in history   : ${report.runsInHistory}`);
  console.log(`Flaky candidates  : ${report.flakyCount}`);
  console.log("========================================\n");

  if (report.flakyTests.length === 0) {
    console.log("No flaky tests detected above threshold " + report.threshold + ".\n");
    return;
  }

  for (const t of report.flakyTests) {
    console.log(`[${t.severity}] ${t.title}`);
    console.log(`  file        : ${t.file}`);
    console.log(`  score       : ${t.score}  (category: ${t.category}, confidence: ${t.confidence})`);
    console.log(`  recommend   : ${t.recommendation}`);
    console.log("");
  }

  console.log(`Full report written to reports/flaky-report.json`);
  if (QUARANTINE) {
    console.log(`Quarantine list written to reports/quarantine-list.json`);
  }
  console.log("");
}

main().catch(error => {
  console.error("detect-flaky-tests failed:", error.message);
  process.exit(1);
});
