const escapeHtml = value =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const escapeXml = value =>
  escapeHtml(value).replaceAll("&#039;", "&apos;");

const number = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const percent = value =>
  `${Math.min(100, Math.max(0, number(value))).toFixed(
    Number.isInteger(number(value)) ? 0 : 1
  )}%`;

const dateLabel = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : date.toLocaleString();
};

const statusClass = status => {
  if (status === "passed") return "passed";
  if (status === "failed") return "failed";
  if (status === "skipped") return "skipped";
  return "unknown";
};

function renderTrend(history, current) {
  const runs = [...history].slice(-7);
  const latest = runs.at(-1);
  if (
    !latest ||
    latest.generatedAt !== current.generatedAt
  ) {
    runs.push(current);
  }

  const visibleRuns = runs.slice(-7);
  if (visibleRuns.length < 2) {
    return `
      <div class="trend-empty">
        <span class="trend-empty-mark">↗</span>
        <strong>Your quality trend starts here</strong>
        <span>Run another analysis to see how pass rate changes over time.</span>
      </div>
    `;
  }

  const width = 720;
  const height = 190;
  const left = 36;
  const right = 18;
  const top = 18;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const points = visibleRuns.map((run, index) => {
    const x =
      left +
      (visibleRuns.length === 1
        ? plotWidth / 2
        : (index / (visibleRuns.length - 1)) * plotWidth);
    const y =
      top +
      ((100 - Math.min(100, Math.max(0, number(run.passRate)))) / 100) *
        plotHeight;
    return { x, y, run };
  });
  const line = points
    .map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`)
    .join(" ");
  const area = `${line} L${points.at(-1).x},${top + plotHeight} L${points[0].x},${top + plotHeight} Z`;
  const labels = points
    .map(
      ({ x, run }) => `
        <text x="${x}" y="${height - 8}" text-anchor="middle" class="chart-date">${escapeXml(
          new Date(run.generatedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric"
          })
        )}</text>
      `
    )
    .join("");
  const dots = points
    .map(
      ({ x, y, run }) => `
        <circle cx="${x}" cy="${y}" r="5" class="chart-dot">
          <title>${escapeXml(
            `${percent(run.passRate)} pass rate · ${dateLabel(run.generatedAt)}`
          )}</title>
        </circle>
      `
    )
    .join("");

  return `
    <div class="trend-chart">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Pass rate across the last ${visibleRuns.length} analysis runs">
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#6558e8" stop-opacity=".2"/>
            <stop offset="100%" stop-color="#6558e8" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <line x1="${left}" y1="${top}" x2="${width - right}" y2="${top}" class="chart-gridline"/>
        <line x1="${left}" y1="${top + plotHeight / 2}" x2="${width - right}" y2="${top + plotHeight / 2}" class="chart-gridline"/>
        <line x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" class="chart-gridline"/>
        <text x="0" y="${top + 4}" class="chart-axis">100%</text>
        <text x="8" y="${top + plotHeight / 2 + 4}" class="chart-axis">50%</text>
        <text x="20" y="${top + plotHeight + 4}" class="chart-axis">0%</text>
        <path d="${area}" fill="url(#trendFill)"/>
        <path d="${line}" class="chart-line"/>
        ${dots}
        ${labels}
      </svg>
    </div>
  `;
}

function renderKnowledgeGraph(categoryCounts) {
  const categories = Object.entries(categoryCounts).slice(0, 4);
  if (!categories.length) {
    return `
      <div class="graph-empty">
        <span class="graph-halo">✓</span>
        <strong>No failure clusters in this run</strong>
        <span>When failures appear, shared categories will be grouped here to make common patterns easier to spot.</span>
      </div>
    `;
  }

  const width = 760;
  const height = 258;
  const center = { x: 380, y: 120 };
  const nodes = categories.map(([category, count], index) => {
    const angle =
      -Math.PI / 2 + (index / categories.length) * Math.PI * 2;
    return {
      category,
      count,
      x: center.x + Math.cos(angle) * 230,
      y: center.y + Math.sin(angle) * 84
    };
  });
  const edges = nodes
    .map(
      node => `
        <line x1="${center.x}" y1="${center.y}" x2="${node.x}" y2="${node.y}" class="graph-edge"/>
        <circle cx="${node.x}" cy="${node.y}" r="28" class="graph-node-outer"/>
        <circle cx="${node.x}" cy="${node.y}" r="20" class="graph-node-inner"/>
        <text x="${node.x}" y="${node.y + 5}" text-anchor="middle" class="graph-count">${node.count}</text>
        <text x="${node.x}" y="${Math.min(height - 8, Math.max(14, node.y + 48))}" text-anchor="middle" class="graph-label">${escapeXml(node.category)}</text>
      `
    )
    .join("");

  return `
    <div class="knowledge-graph">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Quality knowledge graph showing failure categories connected to this analysis">
        ${edges}
        <circle cx="${center.x}" cy="${center.y}" r="42" class="graph-center-halo"/>
        <circle cx="${center.x}" cy="${center.y}" r="33" class="graph-center"/>
        <text x="${center.x}" y="${center.y - 2}" text-anchor="middle" class="graph-center-label">QUALITY</text>
        <text x="${center.x}" y="${center.y + 13}" text-anchor="middle" class="graph-center-label">SIGNALS</text>
      </svg>
    </div>
  `;
}

const remediationByCategory = {
  LOCATOR: {
    title: "Resolve locator mismatches",
    action: "Preview a safe locator repair",
    command: "npm run heal-locators:dry-run",
    detail:
      "Review locator failures together. Preview the proposed repair first, then verify the affected spec."
  },
  TIMEOUT: {
    title: "Investigate slow or unready pages",
    action: "Check for a healable locator timeout",
    command: "npm run heal-locators:dry-run",
    detail:
      "Separate locator timeouts from app-readiness or dependency delays before choosing a fix."
  },
  ASSERTION: {
    title: "Validate expected behavior",
    action: "Review the test report",
    command: "npx playwright show-report",
    detail:
      "An assertion mismatch can signal a genuine product regression. Confirm app behavior before changing expectations."
  },
  NETWORK: {
    title: "Check service availability",
    action: "Inspect the report and network trace",
    command: "npx playwright show-report",
    detail:
      "Review the request, response, and service health. Locator repair will not resolve an unavailable dependency."
  },
  UNKNOWN: {
    title: "Review unclassified failures",
    action: "Inspect the Playwright report",
    command: "npx playwright show-report",
    detail:
      "Inspect the error and trace before deciding on a repair; this failure was not safely classified."
  }
};

function renderFailureRows(failures) {
  if (!failures.length) {
    return `<tr><td colspan="5"><div class="empty-state"><span class="empty-state-icon">✓</span><strong>All clear</strong><span>No failures were recorded in this analysis.</span></div></td></tr>`;
  }
  return failures
    .map(
      failure => `
        <tr>
          <td><strong>${escapeHtml(failure.test || "Untitled test")}</strong><span class="table-subtitle">${escapeHtml(failure.file || "File unavailable")}</span></td>
          <td><span class="pill pill-danger">${escapeHtml(failure.category || "UNKNOWN")}</span></td>
          <td><strong>${Math.round(number(failure.confidence) * 100)}%</strong></td>
          <td>${escapeHtml(failure.diagnosis || failure.error || "No diagnosis available")}</td>
          <td>${escapeHtml(failure.recommendation || "Manual investigation recommended")}</td>
        </tr>
      `
    )
    .join("");
}

function renderFlakyRows(flaky) {
  if (!flaky.length) {
    return `<tr><td colspan="5"><div class="empty-state"><span class="empty-state-icon">✓</span><strong>Consistent results</strong><span>No retry signals were recorded in this analysis.</span></div></td></tr>`;
  }
  return flaky
    .map(
      test => `
        <tr>
          <td><strong>${escapeHtml(test.title || "Untitled test")}</strong><span class="table-subtitle">${escapeHtml(test.file || "File unavailable")}</span></td>
          <td><span class="pill pill-warn">${number(test.retryCount)} ${number(test.retryCount) === 1 ? "retry" : "retries"}</span></td>
          <td><span class="status ${statusClass(test.status)}">${escapeHtml(test.status || "unknown")}</span></td>
          <td>${test.duration ? `${Math.round(number(test.duration))} ms` : "—"}</td>
          <td><span class="text-link">Review stability</span></td>
        </tr>
      `
    )
    .join("");
}

function renderTestRows(tests) {
  if (!tests.length) {
    return `<tr><td colspan="5"><div class="empty-state"><span class="empty-state-icon">◎</span><strong>No test data yet</strong><span>Run your Playwright suite and generate an intelligence report to populate this view.</span></div></td></tr>`;
  }
  return tests
    .map(
      test => `
        <tr>
          <td><strong>${escapeHtml(test.title || "Untitled test")}</strong><span class="table-subtitle">${escapeHtml(test.file || "File unavailable")}</span></td>
          <td><span class="status ${statusClass(test.status)}">${escapeHtml(test.status || "unknown")}</span></td>
          <td>${escapeHtml(test.failureCategory || "—")}</td>
          <td>${number(test.retryCount)}</td>
          <td>${test.duration ? `${Math.round(number(test.duration))} ms` : "—"}</td>
        </tr>
      `
    )
    .join("");
}

function renderRecommendations(failures, flaky) {
  const grouped = new Map();
  for (const failure of failures) {
    const category = String(failure.category || "UNKNOWN").toUpperCase();
    const remediation =
      remediationByCategory[category] || remediationByCategory.UNKNOWN;
    const group = grouped.get(remediation.title) || {
      ...remediation,
      count: 0
    };
    group.count += 1;
    grouped.set(remediation.title, group);
  }

  const cards = [...grouped.values()].map(
    (recommendation, index) => `
      <article class="recommendation-card">
        <div class="recommendation-topline"><span class="recommendation-priority">${index === 0 ? "PRIORITY 01" : `PRIORITY ${String(index + 1).padStart(2, "0")}`}</span><span class="recommendation-count">${recommendation.count} ${recommendation.count === 1 ? "failure" : "failures"}</span></div>
        <h3>${escapeHtml(recommendation.title)}</h3>
        <p>${escapeHtml(recommendation.detail)}</p>
        <div class="recommendation-action">${escapeHtml(recommendation.action)}</div>
        <div class="command-row"><code>${escapeHtml(recommendation.command)}</code><button class="copy-command" type="button" data-command="${escapeHtml(recommendation.command)}">Copy</button></div>
        <div class="copy-status" aria-live="polite"></div>
      </article>
    `
  );
  if (flaky.length) {
    cards.push(`
      <article class="recommendation-card recommendation-secondary">
        <div class="recommendation-topline"><span class="recommendation-priority">STABILITY</span><span class="recommendation-count">${flaky.length} ${flaky.length === 1 ? "test" : "tests"}</span></div>
        <h3>Reduce intermittent reruns</h3>
        <p>These tests required retries in the latest run. Review traces and test synchronization before treating a retry as a product defect.</p>
        <div class="recommendation-action">Inspect flaky candidates</div>
        <button class="button button-secondary" type="button" data-open-view="flaky">View stability signals <span aria-hidden="true">→</span></button>
      </article>
    `);
  }
  if (!cards.length) {
    return `
      <div class="recommendation-clear">
        <span class="graph-halo">✓</span>
        <div><strong>No urgent actions from this run</strong><p>Tests passed without recorded failures or retry signals. Keep monitoring the next execution for changes.</p></div>
      </div>
    `;
  }
  return cards.join("");
}

const views = [
  ["overview", "Overview", "◉"],
  ["failures", "Failure intelligence", "⌕"],
  ["flaky", "Flaky test analytics", "⌁"],
  ["recommendations", "AI recommendations", "✳"],
  ["integrations", "Integrations", "⌘"],
  ["administration", "Administration", "⚙"]
];

export function buildDashboardHtml(
  intelligence = {},
  history = [],
  integrations = {}
) {
  const summary = intelligence.summary || {};
  const failures = Array.isArray(intelligence.failures)
    ? intelligence.failures
    : [];
  const flaky = Array.isArray(intelligence.flakyCandidates)
    ? intelligence.flakyCandidates
    : [];
  const tests = Array.isArray(intelligence.tests) ? intelligence.tests : [];
  const total = number(summary.total);
  const passed = number(summary.passed);
  const failed = number(summary.failed);
  const skipped = number(summary.skipped);
  const flakyCount = flaky.length || number(summary.flakyCandidates);
  const passRate = total
    ? number(summary.passRate) || (passed / total) * 100
    : 0;
  const generatedAt = intelligence.generatedAt || new Date().toISOString();
  const categories = {};
  for (const failure of failures) {
    const category = String(failure.category || "UNKNOWN").toUpperCase();
    categories[category] = (categories[category] || 0) + 1;
  }
  const topCategory = Object.entries(categories).sort(
    (left, right) => right[1] - left[1]
  )[0];
  const runStatus =
    failed > 0
      ? "Attention needed"
      : total > 0
        ? "Looking healthy"
        : "Awaiting first run";
  const recommendationCards = renderRecommendations(failures, flaky);
  const viewButtons = views
    .map(
      ([id, label, icon], index) => `
        <button class="nav-item${index === 0 ? " active" : ""}" type="button" data-view="${id}" aria-current="${index === 0 ? "page" : "false"}">
          <span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>
        </button>
      `
    )
    .join("");
  const viewPanels = views
    .map(([id, label], index) => `
      <section class="view-panel" data-panel="${id}" aria-labelledby="view-title-${id}"${index ? " hidden" : ""}>
        <div class="page-heading"><div><div class="eyebrow">${id === "overview" ? "QUALITY OVERVIEW" : "QUALITY WORKSPACE"}</div><h1 id="view-title-${id}">${label}</h1></div><div class="run-meta"><span class="live-dot"></span><span>${escapeHtml(dateLabel(generatedAt))}</span></div></div>
        ${renderPanel(id, {
          total,
          passed,
          failed,
          skipped,
          flakyCount,
          passRate,
          generatedAt,
          failures,
          flaky,
          tests,
          topCategory,
          categoryCounts: categories,
          history,
          integrations,
          recommendationCards,
          runStatus
        })}
      </section>
    `)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f5f6fa">
  <title>BISO · Quality Intelligence</title>
  <style>
    :root{color-scheme:light;--ink:#17213b;--muted:#75809a;--line:#e9ebf2;--paper:#fff;--canvas:#f5f6fa;--violet:#6558e8;--violet-dark:#5144d5;--violet-wash:#f0eeff;--green:#138a61;--green-wash:#e8f7f0;--red:#c94c60;--red-wash:#fff0f2;--amber:#a56b10;--amber-wash:#fff5e3;--nav:#171a32;--nav-muted:#a0a5bc}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--canvas);color:var(--ink);font:14px/1.5 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button{font:inherit}
    .app-shell{display:grid;grid-template-columns:250px minmax(0,1fr);min-height:100vh}.sidebar{position:sticky;top:0;height:100vh;background:var(--nav);padding:26px 16px 18px;color:#fff;display:flex;flex-direction:column;z-index:5}.brand{display:flex;align-items:center;gap:12px;padding:3px 9px 28px}.brand-mark{width:37px;height:37px;border-radius:12px;background:linear-gradient(145deg,#8c7fff,#5b4bdd);display:grid;place-items:center;box-shadow:0 6px 20px #6558e855}.brand-mark svg{width:22px;height:22px}.brand-name{font-weight:750;letter-spacing:.035em;font-size:15px}.brand-caption{color:#a7aac0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin-top:1px}
    .workspace-label{padding:9px 10px 10px;color:#8288a2;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}.nav-list{display:grid;gap:5px}.nav-item{border:0;background:transparent;color:var(--nav-muted);display:flex;align-items:center;gap:11px;width:100%;text-align:left;padding:10px 11px;border-radius:9px;cursor:pointer;font-size:13px;font-weight:550;transition:background .16s ease,color .16s ease}.nav-item:hover{background:#ffffff0b;color:#fff}.nav-item.active{color:#fff;background:#7063ed2e;box-shadow:inset 2px 0 #9c91ff}.nav-icon{width:20px;text-align:center;font-size:17px;color:#b9b2ff}.sidebar-spacer{flex:1}.sidebar-note{border:1px solid #ffffff17;background:#ffffff08;border-radius:12px;padding:14px;margin:12px 2px 14px}.sidebar-note-label{color:#a7aac0;text-transform:uppercase;letter-spacing:.1em;font-size:9px;font-weight:700}.sidebar-note-title{font-size:13px;font-weight:650;margin-top:6px}.sidebar-note-copy{color:#a7aac0;font-size:11px;line-height:1.55;margin-top:4px}.profile{display:flex;align-items:center;gap:10px;padding:13px 8px 0;border-top:1px solid #ffffff16}.profile-avatar{width:31px;height:31px;border-radius:50%;display:grid;place-items:center;background:#e8e4ff;color:#5144d5;font-weight:750;font-size:12px}.profile-name{font-size:12px;font-weight:650}.profile-role{font-size:10px;color:#a7aac0}
    .main-content{min-width:0;padding:34px clamp(22px,4vw,60px) 55px}.view-panel{max-width:1320px;margin:0 auto}.view-panel[hidden]{display:none}.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin:2px 0 25px}.eyebrow{font-size:10px;font-weight:750;letter-spacing:.14em;color:var(--violet);margin-bottom:5px}.page-heading h1{font-size:27px;line-height:1.2;letter-spacing:-.04em;margin:0;font-weight:730}.run-meta{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:11px;white-space:nowrap}.live-dot{height:7px;width:7px;border-radius:50%;background:#32b989;box-shadow:0 0 0 3px #32b98920}.intro-row{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:0 0 21px}.intro-copy{max-width:650px}.intro-copy h2{font-size:22px;letter-spacing:-.035em;margin:0 0 5px}.intro-copy p{margin:0;color:var(--muted);font-size:13px}.button{border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);padding:9px 12px;font-size:12px;font-weight:650;cursor:pointer}.button:hover{border-color:#cbc6ff;color:var(--violet-dark)}.button-secondary{margin-top:5px}.button-primary{background:var(--violet);border-color:var(--violet);color:#fff}.button-primary:hover{background:var(--violet-dark);color:#fff}
    .card{background:var(--paper);border:1px solid var(--line);border-radius:13px;box-shadow:0 3px 10px #17213b05}.metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin:0 0 16px}.metric-card{padding:17px 18px 15px;position:relative;overflow:hidden}.metric-card:after{content:"";position:absolute;right:-20px;top:-25px;width:75px;height:75px;border-radius:50%;background:var(--metric-wash,var(--violet-wash));opacity:.58}.metric-head{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:11px;font-weight:620}.metric-symbol{width:23px;height:23px;border-radius:7px;display:grid;place-items:center;background:var(--metric-wash,var(--violet-wash));color:var(--metric-color,var(--violet));font-weight:750;font-size:13px}.metric-value{font-size:27px;letter-spacing:-.05em;line-height:1.2;font-weight:740;margin:13px 0 5px;font-variant-numeric:tabular-nums}.metric-foot{font-size:10px;color:var(--muted)}.metric-foot .positive{color:var(--green);font-weight:650}.metric-health{--metric-color:var(--green);--metric-wash:var(--green-wash)}.metric-risk{--metric-color:var(--red);--metric-wash:var(--red-wash)}.metric-flaky{--metric-color:var(--amber);--metric-wash:var(--amber-wash)}
    .content-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(255px,.85fr);gap:14px;margin-top:14px}.section-card{padding:19px 20px}.card-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:12px}.card-heading h2{font-size:14px;margin:0;font-weight:700;letter-spacing:-.015em}.card-heading p{font-size:11px;color:var(--muted);margin:3px 0 0}.card-action{font-size:11px;font-weight:650;color:var(--violet);cursor:pointer;border:0;background:none;padding:2px 0;white-space:nowrap}.card-action:hover{text-decoration:underline}.trend-chart svg{display:block;width:100%;height:auto;max-height:210px;overflow:visible}.chart-gridline{stroke:#edf0f5;stroke-width:1}.chart-axis,.chart-date{fill:#8993a8;font-size:10px}.chart-line{fill:none;stroke:#6558e8;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.chart-dot{fill:#fff;stroke:#6558e8;stroke-width:3}.trend-empty{min-height:175px;border:1px dashed #e6e5f0;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px;gap:5px}.trend-empty-mark{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:var(--violet-wash);color:var(--violet);font-size:19px;margin-bottom:3px}.trend-empty strong{font-size:12px}.trend-empty span:last-child{font-size:11px;color:var(--muted)}
    .health-banner{display:flex;align-items:flex-start;gap:11px;border-radius:10px;padding:13px 14px;background:${failed ? "var(--red-wash)" : total ? "var(--green-wash)" : "var(--violet-wash)"};margin-bottom:13px}.health-icon{flex:none;width:25px;height:25px;display:grid;place-items:center;border-radius:8px;background:#ffffffa8;color:${failed ? "var(--red)" : total ? "var(--green)" : "var(--violet)"};font-weight:750}.health-banner strong{font-size:12px}.health-banner p{color:#64708a;margin:2px 0 0;font-size:11px;line-height:1.5}.signal-list{display:grid;gap:0}.signal-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 1px;border-bottom:1px solid #f0f1f5}.signal-row:last-child{border-bottom:0}.signal-label{font-size:11px;color:var(--muted)}.signal-value{font-size:12px;font-weight:680;text-align:right}.text-danger{color:var(--red)}.text-success{color:var(--green)}.text-warn{color:var(--amber)}.status-chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;background:${failed ? "var(--red-wash)" : total ? "var(--green-wash)" : "var(--violet-wash)"};color:${failed ? "var(--red)" : total ? "var(--green)" : "var(--violet)"};padding:5px 9px;font-size:10px;font-weight:700;white-space:nowrap}
    .subsection{margin-top:18px}.subsection-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:0 0 10px}.subsection-heading h2{font-size:14px;margin:0}.subsection-heading p{font-size:11px;color:var(--muted);margin:2px 0 0}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:700px;text-align:left}th{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#929ab0;font-weight:700;padding:10px 12px;border-bottom:1px solid var(--line);white-space:nowrap}td{padding:12px;border-bottom:1px solid #f0f1f5;font-size:11px;color:#5f6a83;vertical-align:top}tbody tr:last-child td{border-bottom:0}td strong{color:var(--ink);font-weight:650}.table-subtitle{display:block;color:#929ab0;font-size:10px;margin-top:3px;overflow-wrap:anywhere}.status,.pill{display:inline-block;padding:4px 8px;border-radius:999px;font-size:9px;font-weight:700;white-space:nowrap}.status.passed{background:var(--green-wash);color:var(--green)}.status.failed,.pill-danger{background:var(--red-wash);color:var(--red)}.status.skipped,.status.unknown{background:#f0f1f5;color:#78829a}.pill-warn{background:var(--amber-wash);color:var(--amber)}.text-link{color:var(--violet);font-size:10px;font-weight:650}.empty-state{min-height:114px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:4px}.empty-state-icon{width:28px;height:28px;border-radius:50%;background:var(--green-wash);color:var(--green);display:grid;place-items:center;font-size:14px;margin-bottom:3px}.empty-state strong{font-size:12px;color:var(--ink)}.empty-state span:last-child{font-size:10px;color:var(--muted)}
    .section-intro{font-size:13px;color:var(--muted);max-width:760px;margin:-12px 0 19px}.knowledge-card{margin-bottom:14px}.knowledge-graph{padding:5px 0 0}.knowledge-graph svg{display:block;width:100%;height:auto;max-height:282px}.graph-edge{stroke:#d9d5fa;stroke-width:2;stroke-dasharray:4 5}.graph-node-outer{fill:#f1efff;stroke:#ddd9ff;stroke-width:1}.graph-node-inner{fill:#fff}.graph-count{fill:#6558e8;font-size:14px;font-weight:750}.graph-label{fill:#6e7890;font-size:10px;font-weight:650}.graph-center-halo{fill:#efedff}.graph-center{fill:#6558e8}.graph-center-label{fill:#fff;font-size:8px;font-weight:750;letter-spacing:.1em}.graph-empty{min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6px;padding:20px}.graph-halo{height:40px;width:40px;border-radius:13px;background:var(--green-wash);color:var(--green);display:grid;place-items:center;font-size:18px}.graph-empty strong{font-size:12px}.graph-empty span:last-child{max-width:330px;font-size:11px;color:var(--muted)}
    .recommendation-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.recommendation-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px;box-shadow:0 3px 10px #17213b05}.recommendation-secondary{border-style:dashed}.recommendation-topline{display:flex;align-items:center;justify-content:space-between;gap:8px}.recommendation-priority{font-size:9px;color:var(--violet);letter-spacing:.1em;font-weight:750}.recommendation-count{font-size:9px;color:var(--muted);background:#f4f5f9;padding:5px 8px;border-radius:99px}.recommendation-card h3{font-size:14px;margin:12px 0 5px;letter-spacing:-.02em}.recommendation-card p{font-size:11px;line-height:1.6;color:var(--muted);margin:0;min-height:54px}.recommendation-action{font-size:10px;font-weight:700;margin:14px 0 7px}.command-row{display:flex;align-items:center;justify-content:space-between;gap:7px;background:#f6f7fa;border-radius:8px;padding:7px 8px}.command-row code{font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#4d5670;overflow-wrap:anywhere}.copy-command{border:1px solid #e6e8f0;background:#fff;border-radius:6px;padding:5px 8px;color:var(--violet-dark);font-size:10px;font-weight:650;cursor:pointer}.copy-command:hover{border-color:#c9c4ff}.copy-status{min-height:15px;margin-top:3px;color:var(--muted);font-size:9px}.recommendation-clear{display:flex;align-items:center;gap:13px;padding:22px;border:1px solid #dcefe5;background:#f7fcf9;border-radius:12px}.recommendation-clear strong{font-size:13px}.recommendation-clear p{font-size:11px;color:var(--muted);margin:4px 0 0}
    .flaky-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:15px}.mini-stat{padding:15px 16px}.mini-stat-label{color:var(--muted);font-size:10px}.mini-stat-value{font-size:21px;font-weight:740;letter-spacing:-.035em;margin-top:5px}.mini-stat-note{color:var(--muted);font-size:10px;margin-top:2px}.integrations-grid,.admin-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.integration-card,.admin-card{padding:18px;display:flex;align-items:flex-start;gap:13px}.integration-logo{width:38px;height:38px;flex:none;border-radius:11px;display:grid;place-items:center;background:#f1f0ff;color:#5144d5;font-weight:750;font-size:12px}.integration-info{min-width:0;flex:1}.integration-info h3,.admin-card h3{font-size:13px;margin:0 0 3px}.integration-info p,.admin-card p{font-size:10px;color:var(--muted);line-height:1.55;margin:0}.integration-status{font-size:9px;padding:5px 8px;border-radius:99px;background:#f2f3f7;color:#78829a;white-space:nowrap;font-weight:700}.integration-status.available{background:var(--green-wash);color:var(--green)}.integration-note{margin-top:14px;padding:12px 14px;background:#f0efff;border:1px solid #e5e2ff;border-radius:9px;color:#65617f;font-size:10px;line-height:1.55}.admin-card{min-height:123px}.admin-icon{width:31px;height:31px;flex:none;border-radius:9px;background:#f3f1ff;color:var(--violet);display:grid;place-items:center;font-weight:700;font-size:13px}.admin-card .admin-state{display:inline-block;margin-top:9px;font-size:9px;font-weight:700;color:var(--amber);background:var(--amber-wash);padding:4px 7px;border-radius:99px}.admin-footnote{font-size:10px;line-height:1.6;color:var(--muted);margin:14px 0 0}.screen-reader-only{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    @media(min-width:1450px){.main-content{padding-top:43px}.metric-card{padding:19px 20px}.content-grid{gap:17px}}
    @media(max-width:1050px){.app-shell{grid-template-columns:215px minmax(0,1fr)}.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.content-grid{grid-template-columns:minmax(0,1.35fr) minmax(235px,.9fr)}.main-content{padding-left:26px;padding-right:26px}}
    @media(max-width:780px){.app-shell{display:flex;flex-direction:column}.sidebar{height:auto;position:sticky;padding:10px 14px 9px}.brand{padding:0 2px 8px}.brand-mark{width:31px;height:31px;border-radius:9px}.brand-mark svg{width:19px}.brand-caption{display:none}.brand-name{font-size:13px}.workspace-label,.sidebar-spacer,.sidebar-note,.profile{display:none}.nav-list{display:flex;overflow-x:auto;gap:5px;scrollbar-width:none}.nav-list::-webkit-scrollbar{display:none}.nav-item{width:auto;flex:none;padding:8px 10px;font-size:11px}.nav-item.active{box-shadow:inset 0 -2px #9c91ff}.main-content{padding:24px 18px 40px}.page-heading{margin-bottom:19px}.page-heading h1{font-size:23px}.content-grid{grid-template-columns:1fr}.recommendation-grid,.integrations-grid,.admin-grid{grid-template-columns:1fr}}
    @media(max-width:500px){.main-content{padding:19px 13px 32px}.page-heading{align-items:flex-start;flex-direction:column;gap:6px}.page-heading h1{font-size:21px}.run-meta{font-size:9px}.intro-row{align-items:flex-start;flex-direction:column;gap:12px}.intro-copy h2{font-size:19px}.metric-grid{gap:9px}.metric-card{padding:13px}.metric-value{font-size:23px;margin-top:10px}.metric-foot{font-size:9px}.metric-head{font-size:10px}.section-card{padding:15px}.flaky-summary{gap:8px}.mini-stat{padding:12px}.mini-stat-value{font-size:18px}.mini-stat-label,.mini-stat-note{font-size:9px}.card-heading h2{font-size:13px}.run-meta{white-space:normal}}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important}}
  </style>
</head>
<body>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 2.8 20 6v5.3c0 5.2-3.4 8.6-8 10-4.6-1.4-8-4.8-8-10V6l8-3.2Z" stroke="white" stroke-width="1.7"/><path d="m8.2 12.2 2.4 2.4 5.2-5.3" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div><div class="brand-name">BISO</div><div class="brand-caption">Quality intelligence</div></div>
      </div>
      <div class="workspace-label">Workspace</div>
      <nav class="nav-list" aria-label="Dashboard screens">${viewButtons}</nav>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-note"><div class="sidebar-note-label">Your codebase's immune system</div><div class="sidebar-note-title">Quality, connected.</div><div class="sidebar-note-copy">Turn test signals into clear priorities for your team.</div></div>
      <div class="profile"><div class="profile-avatar" aria-hidden="true">Q</div><div><div class="profile-name">Quality workspace</div><div class="profile-role">Local report</div></div></div>
    </aside>
    <main class="main-content">
      ${viewPanels}
      <footer class="screen-reader-only" id="dashboard-announcement" aria-live="polite"></footer>
    </main>
  </div>
  <script>
    const viewTitles = ${JSON.stringify(Object.fromEntries(views.map(([id, label]) => [id, label])))};
    const navItems = [...document.querySelectorAll(".nav-item")];
    const panels = [...document.querySelectorAll(".view-panel")];
    const announcement = document.getElementById("dashboard-announcement");
    function openView(view) {
      if (!viewTitles[view]) return;
      navItems.forEach(item => {
        const active = item.dataset.view === view;
        item.classList.toggle("active", active);
        item.setAttribute("aria-current", active ? "page" : "false");
      });
      panels.forEach(panel => {
        panel.hidden = panel.dataset.panel !== view;
      });
      document.title = viewTitles[view] + " · BISO";
      if (announcement) announcement.textContent = viewTitles[view] + " screen";
    }
    navItems.forEach(item => item.addEventListener("click", () => openView(item.dataset.view)));
    document.querySelectorAll("[data-open-view]").forEach(button => {
      button.addEventListener("click", () => openView(button.dataset.openView));
    });
    document.querySelectorAll(".copy-command").forEach(button => {
      button.addEventListener("click", async () => {
        const status = button.closest(".recommendation-card").querySelector(".copy-status");
        try {
          await navigator.clipboard.writeText(button.dataset.command);
          status.textContent = "Copied. Run this command in your project terminal.";
        } catch {
          status.textContent = "Clipboard unavailable. Select the command above to copy it.";
        }
      });
    });
  </script>
</body>
</html>`;
}

function renderPanel(id, data) {
  const {
    total,
    passed,
    failed,
    skipped,
    flakyCount,
    passRate,
    failures,
    flaky,
    tests,
    topCategory,
    categoryCounts,
    history,
    integrations,
    recommendationCards,
    runStatus
  } = data;
  if (id === "overview") {
    return `
      <div class="intro-row"><div class="intro-copy"><h2>Quality signals, translated into next steps.</h2><p>See how reliably your product is being checked, where engineering effort is going, and what deserves attention next.</p></div><span class="status-chip">${escapeHtml(runStatus)}</span></div>
      <div class="metric-grid">
        <article class="card metric-card metric-health"><div class="metric-head"><span class="metric-symbol">✓</span>Checks passing</div><div class="metric-value">${percent(passRate)}</div><div class="metric-foot">${passed} of ${total} checks passed in the latest run</div></article>
        <article class="card metric-card metric-risk"><div class="metric-head"><span class="metric-symbol">!</span>Failures to review</div><div class="metric-value">${failed}</div><div class="metric-foot">${topCategory ? `${escapeHtml(topCategory[0])} is the most common signal` : "No failure signals in this run"}</div></article>
        <article class="card metric-card metric-flaky"><div class="metric-head"><span class="metric-symbol">↻</span>Tests needing retries</div><div class="metric-value">${flakyCount}</div><div class="metric-foot">Intermittent checks that can slow releases</div></article>
        <article class="card metric-card"><div class="metric-head"><span class="metric-symbol">▤</span>Checks executed</div><div class="metric-value">${total}</div><div class="metric-foot">${skipped} skipped · latest analysis</div></article>
      </div>
      <div class="content-grid">
        <article class="card section-card"><div class="card-heading"><div><h2>Quality over time</h2><p>Pass rate across recent analysis runs</p></div><button class="card-action" type="button" data-open-view="failures">Explore signals →</button></div>${renderTrend(history, { generatedAt: data.generatedAt, total, passed, failed, skipped, passRate })}</article>
        <article class="card section-card"><div class="card-heading"><div><h2>Executive readout</h2><p>What this run says about release confidence</p></div></div>
          <div class="health-banner"><span class="health-icon">${failed ? "!" : total ? "✓" : "i"}</span><div><strong>${total ? `${percent(passRate)} of checks passed` : "No test results to assess"}</strong><p>${failed ? `${failed} failing ${failed === 1 ? "check needs" : "checks need"} review before you can make a confident release decision.` : total ? "No failing checks were recorded. Keep an eye on retry signals for hidden instability." : "Run the suite and generate an analysis to see your quality health."}</p></div></div>
          <div class="signal-list">
            <div class="signal-row"><span class="signal-label">Largest source of rework</span><span class="signal-value ${topCategory ? "text-danger" : "text-success"}">${topCategory ? `${escapeHtml(topCategory[0])} · ${topCategory[1]}` : "No failures"}</span></div>
            <div class="signal-row"><span class="signal-label">Intermittent test signals</span><span class="signal-value ${flakyCount ? "text-warn" : "text-success"}">${flakyCount} ${flakyCount === 1 ? "test" : "tests"}</span></div>
            <div class="signal-row"><span class="signal-label">Skipped coverage</span><span class="signal-value">${skipped} ${skipped === 1 ? "check" : "checks"}</span></div>
          </div>
        </article>
      </div>
      <section class="subsection"><div class="subsection-heading"><div><h2>Where to focus next</h2><p>Recommendations based on this run's observed failure signals.</p></div><button class="card-action" type="button" data-open-view="recommendations">All recommendations →</button></div><div class="recommendation-grid">${recommendationCards}</div></section>
      <section class="subsection"><div class="subsection-heading"><div><h2>Latest checks</h2><p>A quick view of your most recent execution.</p></div><button class="card-action" type="button" data-open-view="failures">Full failure analysis →</button></div><div class="card table-wrap"><table><thead><tr><th>Test</th><th>Outcome</th><th>Failure type</th><th>Retries</th><th>Duration</th></tr></thead><tbody>${renderTestRows(tests.slice(0, 6))}</tbody></table></div></section>`;
  }
  if (id === "failures") {
    return `
      <p class="section-intro">Connect related failures into shared patterns, understand the evidence, and separate genuine product regressions from test or environment issues.</p>
      <article class="card section-card knowledge-card"><div class="card-heading"><div><h2>Quality knowledge graph</h2><p>Related failures grouped by observed classifier category</p></div><span class="status-chip">${failures.length} ${failures.length === 1 ? "signal" : "signals"}</span></div>${renderKnowledgeGraph(categoryCounts)}<p class="admin-footnote">This report correlates test failures by shared category. Application changes, defects, API contracts, and deployment events are not included in the available data yet.</p></article>
      <article class="card section-card"><div class="card-heading"><div><h2>Failure evidence</h2><p>Diagnosis and recommended response for each failed check</p></div></div><div class="table-wrap"><table><thead><tr><th>Test &amp; source</th><th>Pattern</th><th>Confidence</th><th>What happened</th><th>Suggested response</th></tr></thead><tbody>${renderFailureRows(failures)}</tbody></table></div></article>`;
  }
  if (id === "flaky") {
    return `
      <p class="section-intro">Intermittent checks create noisy releases and repeated investigation. These signals come from tests that needed one or more retries in the latest run.</p>
      <div class="flaky-summary"><article class="card mini-stat"><div class="mini-stat-label">Retry candidates</div><div class="mini-stat-value">${flakyCount}</div><div class="mini-stat-note">Tests with retry signals</div></article><article class="card mini-stat"><div class="mini-stat-label">Retry events</div><div class="mini-stat-value">${flaky.reduce((sum, test) => sum + number(test.retryCount), 0)}</div><div class="mini-stat-note">Retries across listed candidates</div></article><article class="card mini-stat"><div class="mini-stat-label">Run-wide pass rate</div><div class="mini-stat-value">${percent(data.passRate)}</div><div class="mini-stat-note">Includes final test outcomes</div></article></div>
      <article class="card section-card"><div class="card-heading"><div><h2>Stability signals</h2><p>Tests that passed or failed only after retries are worth a closer look.</p></div></div><div class="table-wrap"><table><thead><tr><th>Test &amp; source</th><th>Retry evidence</th><th>Final outcome</th><th>Duration</th><th>Next step</th></tr></thead><tbody>${renderFlakyRows(flaky)}</tbody></table></div></article>
      <div class="integration-note">A retry is a signal, not proof of a flaky test. The current report captures within-run retries; it does not yet include cross-run failure history.</div>`;
  }
  if (id === "recommendations") {
    return `
      <p class="section-intro">A focused action list based on the failures and retry signals observed in this run. Review evidence before changing application behavior or test expectations.</p>
      <div class="recommendation-grid">${recommendationCards}</div>
      <article class="card section-card" style="margin-top:14px"><div class="card-heading"><div><h2>How to prioritize</h2><p>Protect product confidence while reducing avoidable investigation time.</p></div></div><div class="signal-list"><div class="signal-row"><span class="signal-label">1 · Confirm product behavior</span><span class="signal-value">Treat assertion mismatches as possible regressions.</span></div><div class="signal-row"><span class="signal-label">2 · Group recurring patterns</span><span class="signal-value">Start with the most common failure category.</span></div><div class="signal-row"><span class="signal-label">3 · Reduce rerun noise</span><span class="signal-value">Investigate tests that needed retries.</span></div></div></article>`;
  }
  if (id === "integrations") {
    const github = integrations.githubActions;
    const jenkins = integrations.jenkins;
    return `
      <p class="section-intro">Quality intelligence becomes more valuable when it can follow signals across your development workflow. This report identifies repository workflow files; it does not verify live credentials or external service connectivity.</p>
      <div class="integrations-grid">
        ${renderIntegrationCard("GH", "GitHub Actions", "CI workflow", github ? "Workflow detected in this repository." : "No GitHub Actions workflow was detected.", github)}
        ${renderIntegrationCard("JK", "Jenkins", "CI workflow", jenkins ? "Jenkins pipeline configuration detected." : "No Jenkins pipeline configuration was detected.", jenkins)}
        ${renderIntegrationCard("PW", "Playwright", "Test execution", "Test results and classified failures power this report.", true)}
        ${renderIntegrationCard("API", "Quality API", "External signals", "Bring in defects, API health, and deployment events to extend the quality graph.", false)}
      </div>
      <div class="integration-note">Workflow detection is based on files in the local repository, not a confirmed connection to GitHub or Jenkins. API ingestion and live connection management are not configured in this static report.</div>`;
  }
  const usageRuns = history.length || (data.total ? 1 : 0);
  return `
    <p class="section-intro">A transparent view of the workspace information available to this report. Team identity, permissions, and billing data require an authenticated product backend and are not represented here.</p>
    <div class="admin-grid">
      <article class="card admin-card"><span class="admin-icon">U</span><div><h3>People &amp; access</h3><p>This local report has no sign-in or team directory. No user identities are collected.</p><span class="admin-state">Not configured</span></div></article>
      <article class="card admin-card"><span class="admin-icon">◇</span><div><h3>Permissions</h3><p>Role-based access controls are not available in a generated local HTML report.</p><span class="admin-state">Not configured</span></div></article>
      <article class="card admin-card"><span class="admin-icon">$</span><div><h3>Billing</h3><p>No subscription, payment, or billing records are present in the test intelligence data.</p><span class="admin-state">No billing data</span></div></article>
      <article class="card admin-card"><span class="admin-icon">↗</span><div><h3>Usage</h3><p>${total} checks in the latest analysis. ${usageRuns} ${usageRuns === 1 ? "run" : "runs"} currently represented in the local quality trend.</p><span class="admin-state">Local report</span></div></article>
    </div>
    <p class="admin-footnote">This screen intentionally reports only what the generated dashboard can verify; it does not create simulated users, permissions, or billing information.</p>`;
}

function renderIntegrationCard(code, name, kind, description, available) {
  return `
    <article class="card integration-card"><span class="integration-logo" aria-hidden="true">${escapeHtml(code)}</span><div class="integration-info"><h3>${escapeHtml(name)}</h3><p>${escapeHtml(kind)} · ${escapeHtml(description)}</p></div><span class="integration-status${available ? " available" : ""}">${available ? "Detected" : "Not connected"}</span></article>
  `;
}
