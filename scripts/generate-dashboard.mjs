import fs from "node:fs";
import path from "node:path";

const REPORT_DIR = path.resolve("reports");
const INTELLIGENCE_FILE = path.join(REPORT_DIR, "intelligence.json");
const OUTPUT_FILE = path.join(REPORT_DIR, "dashboard.html");

if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

let intelligence = {
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

if (fs.existsSync(INTELLIGENCE_FILE)) {
  try {
    intelligence = JSON.parse(
      fs.readFileSync(INTELLIGENCE_FILE, "utf8")
    );
  } catch (error) {
    console.error(
      "Unable to parse intelligence.json:",
      error.message
    );
  }
}

const summary = intelligence.summary || {};
const failures = intelligence.failures || [];
const flaky = intelligence.flakyCandidates || [];
const tests = intelligence.tests || [];

const escapeHtml = value =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const statusClass = status => {
  if (status === "passed") return "passed";
  if (status === "failed") return "failed";
  if (status === "skipped") return "skipped";
  return "unknown";
};

const failureRows =
  failures.length > 0
    ? failures
        .map(
          failure => `
        <tr>
          <td>
            <strong>${escapeHtml(failure.test)}</strong>
            <div class="muted">
              ${escapeHtml(failure.file)}
            </div>
          </td>

          <td>
            <span class="badge failure">
              ${escapeHtml(failure.category)}
            </span>
          </td>

          <td>
            <strong>
              ${Math.round((failure.confidence || 0) * 100)}%
            </strong>
          </td>

          <td>
            ${escapeHtml(
              failure.diagnosis ||
                failure.error ||
                "No diagnosis available"
            )}
          </td>

          <td>
            ${escapeHtml(
              failure.recommendation ||
                "Manual investigation required"
            )}
          </td>
        </tr>
      `
        )
        .join("")
    : `
      <tr>
        <td colspan="5" class="empty">
          No failures detected 🎉
        </td>
      </tr>
    `;

const flakyRows =
  flaky.length > 0
    ? flaky
        .map(
          test => `
        <tr>
          <td>
            <strong>${escapeHtml(test.title)}</strong>
            <div class="muted">
              ${escapeHtml(test.file)}
            </div>
          </td>

          <td>
            ${escapeHtml(test.retryCount ?? 0)}
          </td>

          <td>
            ${escapeHtml(test.status)}
          </td>

          <td>
            ${escapeHtml(
              test.duration
                ? `${Math.round(test.duration)} ms`
                : "-"
            )}
          </td>

          <td>
            <span class="badge warning">
              INVESTIGATE
            </span>
          </td>
        </tr>
      `
        )
        .join("")
    : `
      <tr>
        <td colspan="5" class="empty">
          No flaky candidates detected.
        </td>
      </tr>
    `;

const testRows =
  tests.length > 0
    ? tests
        .map(
          test => `
        <tr>
          <td>${escapeHtml(test.title)}</td>

          <td>
            <span class="status ${statusClass(test.status)}">
              ${escapeHtml(test.status)}
            </span>
          </td>

          <td>
            ${escapeHtml(
              test.failureCategory || "-"
            )}
          </td>

          <td>
            ${escapeHtml(test.retryCount ?? 0)}
          </td>

          <td>
            ${escapeHtml(
              test.duration
                ? `${Math.round(test.duration)} ms`
                : "-"
            )}
          </td>
        </tr>
      `
        )
        .join("")
    : `
      <tr>
        <td colspan="5" class="empty">
          No test data available.
        </td>
      </tr>
    `;

const categoryCounts = {};

for (const failure of failures) {
  const category = failure.category || "UNKNOWN";

  categoryCounts[category] =
    (categoryCounts[category] || 0) + 1;
}

const categoryLabels = JSON.stringify(
  Object.keys(categoryCounts)
);

const categoryValues = JSON.stringify(
  Object.values(categoryCounts)
);

const generatedTime = new Date(
  intelligence.generatedAt || Date.now()
).toLocaleString();

const html = `
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
/>

<title>
  AI Test Intelligence Dashboard
</title>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;

  background:
    linear-gradient(
      135deg,
      #07111f,
      #0b1728 50%,
      #101827
    );

  color: #e6edf7;
  min-height: 100vh;
}

.container {
  max-width: 1500px;
  margin: auto;
  padding: 32px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 30px;
}

h1 {
  margin: 0;
  font-size: 32px;
}

.subtitle {
  color: #8fa2b8;
  margin-top: 8px;
}

.timestamp {
  color: #7f93aa;
  font-size: 13px;
}

.grid {
  display: grid;
  grid-template-columns:
    repeat(4, minmax(0, 1fr));

  gap: 18px;
  margin-bottom: 24px;
}

.card {
  background:
    rgba(17, 29, 48, 0.82);

  border:
    1px solid rgba(255,255,255,0.08);

  border-radius: 16px;
  padding: 22px;

  box-shadow:
    0 12px 40px rgba(0,0,0,0.25);
}

.metric-label {
  color: #91a4ba;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: .08em;
}

.metric {
  font-size: 34px;
  font-weight: 700;
  margin-top: 8px;
}

.metric-small {
  color: #7f93aa;
  font-size: 13px;
  margin-top: 6px;
}

.section {
  margin-top: 24px;
}

.section-title {
  font-size: 20px;
  margin-bottom: 14px;
}

.dashboard-grid {
  display: grid;

  grid-template-columns:
    1.3fr .7fr;

  gap: 20px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  color: #91a4ba;
  font-size: 12px;
  text-transform: uppercase;
  padding: 12px;
  border-bottom:
    1px solid rgba(255,255,255,.08);
}

td {
  padding: 14px 12px;
  border-bottom:
    1px solid rgba(255,255,255,.06);

  vertical-align: top;
}

.muted {
  color: #71869d;
  font-size: 12px;
  margin-top: 4px;
}

.badge,
.status {
  display: inline-block;
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 11px;
  font-weight: 700;
}

.badge.failure {
  background: rgba(239,68,68,.15);
  color: #ff8f8f;
}

.badge.warning {
  background: rgba(245,158,11,.15);
  color: #ffc45c;
}

.status.passed {
  background: rgba(34,197,94,.15);
  color: #71e39a;
}

.status.failed {
  background: rgba(239,68,68,.15);
  color: #ff8f8f;
}

.status.skipped {
  background: rgba(148,163,184,.15);
  color: #aebaca;
}

.status.unknown {
  background: rgba(148,163,184,.15);
  color: #aebaca;
}

.empty {
  text-align: center;
  color: #71869d;
  padding: 35px;
}

.chart-container {
  height: 280px;
}

.progress {
  height: 8px;
  background: #1b293d;
  border-radius: 999px;
  overflow: hidden;
  margin-top: 14px;
}

.progress-bar {
  height: 100%;
  width: ${summary.passRate || 0}%;
  background: #35d07f;
}

.insight {
  padding: 16px;
  border-radius: 12px;
  background: rgba(255,255,255,.035);
  margin-bottom: 12px;
}

.insight-title {
  font-weight: 700;
  margin-bottom: 6px;
}

.insight-text {
  color: #9aacc0;
  font-size: 13px;
  line-height: 1.6;
}

@media(max-width: 1000px) {

  .grid {
    grid-template-columns:
      repeat(2, 1fr);
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media(max-width: 600px) {

  .container {
    padding: 18px;
  }

  .grid {
    grid-template-columns: 1fr;
  }

  .header {
    flex-direction: column;
  }
}

</style>

</head>

<body>

<div class="container">

<header class="header">

<div>

<h1>
AI Test Intelligence
</h1>

<div class="subtitle">
Playwright + LangGraph + AI-powered test analysis
</div>

</div>

<div class="timestamp">
Last analysis:
${escapeHtml(generatedTime)}
</div>

</header>


<!-- METRICS -->

<section class="grid">

<div class="card">

<div class="metric-label">
Total Tests
</div>

<div class="metric">
${summary.total || 0}
</div>

<div class="metric-small">
Executed in latest run
</div>

</div>


<div class="card">

<div class="metric-label">
Pass Rate
</div>

<div class="metric">
${summary.passRate || 0}%
</div>

<div class="progress">
<div class="progress-bar"></div>
</div>

</div>


<div class="card">

<div class="metric-label">
Failures
</div>

<div class="metric">
${summary.failed || 0}
</div>

<div class="metric-small">
AI investigation candidates
</div>

</div>


<div class="card">

<div class="metric-label">
Flaky Candidates
</div>

<div class="metric">
${summary.flakyCandidates || 0}
</div>

<div class="metric-small">
Require stability analysis
</div>

</div>

</section>


<!-- ANALYTICS -->

<section class="dashboard-grid">

<div class="card">

<div class="section-title">
Failure Intelligence
</div>

<div class="chart-container">
<canvas id="failureChart"></canvas>
</div>

</div>


<div class="card">

<div class="section-title">
AI Insights
</div>

<div class="insight">

<div class="insight-title">
Failure Analysis
</div>

<div class="insight-text">
${failures.length}
failure(s) were classified by the
intelligence pipeline.
</div>

</div>


<div class="insight">

<div class="insight-title">
Flakiness
</div>

<div class="insight-text">
${flaky.length}
test(s) show retry or instability
signals and should be investigated.
</div>

</div>


<div class="insight">

<div class="insight-title">
Automation Health
</div>

<div class="insight-text">
Current pass rate:
<strong>
${summary.passRate || 0}%
</strong>
</div>

</div>

</div>

</section>


<!-- RCA -->

<section class="section">

<div class="card">

<div class="section-title">
AI Failure RCA
</div>

<div style="overflow-x:auto">

<table>

<thead>

<tr>
<th>Test</th>
<th>Category</th>
<th>Confidence</th>
<th>Diagnosis</th>
<th>Recommendation</th>
</tr>

</thead>

<tbody>

${failureRows}

</tbody>

</table>

</div>

</div>

</section>


<!-- FLAKY -->

<section class="section">

<div class="card">

<div class="section-title">
Flaky Test Candidates
</div>

<div style="overflow-x:auto">

<table>

<thead>

<tr>
<th>Test</th>
<th>Retries</th>
<th>Status</th>
<th>Duration</th>
<th>Action</th>
</tr>

</thead>

<tbody>

${flakyRows}

</tbody>

</table>

</div>

</div>

</section>


<!-- TEST INVENTORY -->

<section class="section">

<div class="card">

<div class="section-title">
Test Execution Inventory
</div>

<div style="overflow-x:auto">

<table>

<thead>

<tr>
<th>Test</th>
<th>Status</th>
<th>Failure Type</th>
<th>Retries</th>
<th>Duration</th>
</tr>

</thead>

<tbody>

${testRows}

</tbody>

</table>

</div>

</div>

</section>

</div>


<script>

const categoryLabels =
${categoryLabels};

const categoryValues =
${categoryValues};

new Chart(
  document.getElementById("failureChart"),
  {
    type: "doughnut",

    data: {
      labels: categoryLabels,

      datasets: [{
        data: categoryValues
      }]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#aebaca"
          }
        }
      }
    }
  }
);

</script>

</body>

</html>
`;

fs.writeFileSync(
  OUTPUT_FILE,
  html,
  "utf8"
);

console.log(
  `AI Test Intelligence dashboard generated:
${OUTPUT_FILE}\`
`);