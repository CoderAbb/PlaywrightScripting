import fs from "node:fs";
import path from "node:path";
import { buildDashboardHtml } from "./lib/dashboard-html.mjs";

const REPORT_DIR = path.resolve("reports");
const INTELLIGENCE_FILE = path.join(REPORT_DIR, "intelligence.json");
const HISTORY_FILE = path.join(REPORT_DIR, "execution-history.json");
const OUTPUT_FILE = path.join(REPORT_DIR, "dashboard.html");

fs.mkdirSync(REPORT_DIR, { recursive: true });

const intelligence = fs.existsSync(INTELLIGENCE_FILE)
  ? JSON.parse(fs.readFileSync(INTELLIGENCE_FILE, "utf8"))
  : {
      generatedAt: new Date().toISOString(),
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        flakyCandidates: 0,
        passRate: 0
      },
      failures: [],
      flakyCandidates: [],
      tests: []
    };

const history = fs.existsSync(HISTORY_FILE)
  ? JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"))
  : [];

if (!Array.isArray(history)) {
  throw new TypeError("execution-history.json must contain an array.");
}

const integrations = {
  githubActions: fs.existsSync(path.resolve(".github/workflows")),
  jenkins: fs.existsSync(path.resolve("Jenkinsfile"))
};

fs.writeFileSync(
  OUTPUT_FILE,
  buildDashboardHtml(intelligence, history, integrations),
  "utf8"
);

console.log(`BISO Quality Intelligence dashboard generated:\n${OUTPUT_FILE}`);
