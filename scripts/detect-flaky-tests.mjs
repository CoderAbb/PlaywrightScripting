#!/usr/bin/env node
/**
 * detect-flaky-tests.mjs
 *
 * Standalone CLI entry point for flaky classification (used directly by
 * the flaky-detection.yml CI workflow, and for ad hoc local runs). The
 * actual scoring logic lives in scripts/lib/flaky-detect.mjs, shared with
 * scripts/analyze-results.mjs so `reports/intelligence.json` carries the
 * same numbers.
 *
 * Usage:
 *   npm run flaky                  # human-readable report + reports/flaky-report.json
 *   npm run flaky -- --json        # machine-readable JSON on stdout (for CI)
 *   npm run flaky -- --quarantine  # also writes reports/quarantine-list.json
 *   npm run flaky -- --strict      # exit 1 if any HIGH severity flaky test is found
 *   npm run flaky -- --threshold=0.15
 *
 * Note: don't run this back-to-back with `npm run analyze` on the same test
 * run — analyze already calls into the same detector and records the run;
 * running both would double-count that run in reports/flaky-history.json.
 */

import { loadResults, flattenTests } from "../graph/intelligence/result-parser.mjs";
import { runFlakyDetection } from "./lib/flaky-detect.mjs";
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

  const report = await runFlakyDetection(tests, { threshold: THRESHOLD });

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  if (QUARANTINE) {
    const quarantineList = report.flakyTests
      .filter(t => t.severity !== "LOW")
      .map(t => ({ id: t.id, title: t.title, file: t.file, reason: t.category }));
    fs.writeFileSync(QUARANTINE_FILE, JSON.stringify(quarantineList, null, 2));
  }

  if (JSON_OUTPUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printSummary(report);
  }

  if (STRICT && report.flakyTests.some(t => t.severity === "HIGH")) {
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
