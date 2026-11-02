import fs from "node:fs";
import path from "node:path";

const REPORT_DIR = "reports";
const MAX_EXECUTION_HISTORY = 30;

export function saveIntelligence(data) {
  fs.mkdirSync(REPORT_DIR, {
    recursive: true
  });

  const output = path.join(
    REPORT_DIR,
    "intelligence.json"
  );

  fs.writeFileSync(
    output,
    JSON.stringify(data, null, 2)
  );

  const historyFile = path.join(
    REPORT_DIR,
    "execution-history.json"
  );
  const history = fs.existsSync(historyFile)
    ? JSON.parse(fs.readFileSync(historyFile, "utf8"))
    : [];

  if (!Array.isArray(history)) {
    throw new TypeError("execution-history.json must contain an array.");
  }

  const summary = data.summary || {};
  history.push({
    generatedAt: data.generatedAt,
    total: Number(summary.total) || 0,
    passed: Number(summary.passed) || 0,
    failed: Number(summary.failed) || 0,
    skipped: Number(summary.skipped) || 0,
    passRate: Number(summary.passRate) || 0
  });
  fs.writeFileSync(
    historyFile,
    JSON.stringify(history.slice(-MAX_EXECUTION_HISTORY), null, 2)
  );

  console.log(`Intelligence report: ${output}`);
}