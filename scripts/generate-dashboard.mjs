#!/usr/bin/env node
/**
 * generate-dashboard.mjs
 *
 * Reads everything scripts/lib/automation-state.mjs and graph/automationGraph.mjs
 * have written to reports/*.json and renders one self-contained HTML file —
 * no CDN dependencies, no build step, opens directly in a browser offline.
 *
 * Usage:
 *   npm run dashboard
 *   open reports/dashboard.html
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = process.cwd();
const REPORTS_DIR = path.join(REPO_ROOT, 'reports');
const OUT_FILE = path.join(REPORTS_DIR, 'dashboard.html');

function readJsonSafe(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------

const runHistory = readJsonSafe(path.join(REPORTS_DIR, 'automation-metrics.json'), []);
const healingHistory = readJsonSafe(path.join(REPORTS_DIR, 'healing-history.json'), []);
const insights = readJsonSafe(path.join(REPORTS_DIR, 'insights.json'), null);
const latestRun = readJsonSafe(path.join(REPORTS_DIR, 'latest-run.json'), null);

const STATUS_COLOR = {
  PASSED: '#5EEAD4',
  HEALED: '#F5A962',
  HUMAN_REVIEW: '#F0677D',
  FAILED: '#F0677D',
  HEALING: '#F5A962',
  RUNNING: '#8890A0',
};

function colorFor(status) {
  return STATUS_COLOR[status] ?? '#8890A0';
}

// ---------------------------------------------------------------------------
// Computed metrics
// ---------------------------------------------------------------------------

const totalRuns = runHistory.length;
const passedRuns = runHistory.filter((r) => r.status === 'PASSED').length;
const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : null;

const totalHealAttempts = runHistory.reduce((sum, r) => sum + (r.healing?.attempted ?? 0), 0);
const totalHealSuccess = runHistory.reduce((sum, r) => sum + (r.healing?.successful ?? 0), 0);
const healSuccessRate = totalHealAttempts > 0 ? Math.round((totalHealSuccess / totalHealAttempts) * 100) : null;

const now = new Date();
const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
const weekRuns = runHistory.filter((r) => {
  const t = r.execution?.startTime;
  return t && new Date(t) >= sevenDaysAgo;
});
const weekPassed = weekRuns.filter((r) => r.status === 'PASSED').length;
const weekFailureTitles = weekRuns.flatMap((r) => (r.failures ?? []).map((f) => f.title));
const weekFailureCounts = {};
for (const title of weekFailureTitles) {
  weekFailureCounts[title] = (weekFailureCounts[title] ?? 0) + 1;
}
const weekTopFailures = Object.entries(weekFailureCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);
const weekHealing = healingHistory.filter((h) => new Date(h.timestamp) >= sevenDaysAgo);

// ---------------------------------------------------------------------------
// Render: run-timeline waveform (inline SVG, no chart library)
// ---------------------------------------------------------------------------

function renderWaveform(runs) {
  if (runs.length === 0) {
    return `<p class="empty">No runs recorded yet. Run <code>npm run heal:detect</code>, <code>npm run heal-locators</code>, or <code>npm run orchestrate</code> to start building history.</p>`;
  }
  const shown = runs.slice(-40);
  const barWidth = 14;
  const gap = 4;
  const height = 90;
  const width = shown.length * (barWidth + gap);

  const bars = shown
    .map((r, i) => {
      const x = i * (barWidth + gap);
      const failCount = r.failures?.length ?? 0;
      const total = r.tests?.total || 1;
      const failRatio = Math.min(failCount / total, 1);
      const barHeight = Math.max(10, height * (failCount === 0 ? 0.25 : 0.25 + failRatio * 0.75));
      const y = height - barHeight;
      const color = colorFor(r.status);
      const title = escapeHtml(
        `${r.execution?.startTime?.slice(0, 10) ?? '?'} · ${r.source} · ${r.status} · ${failCount} failure(s)`,
      );
      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="2" fill="${color}" opacity="0.9"><title>${title}</title></rect>`;
    })
    .join('\n    ');

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="xMinYMax meet" role="img" aria-label="Run history, most recent ${shown.length} runs">
    <line x1="0" y1="${height - 1}" x2="${width}" y2="${height - 1}" stroke="#2A2F3A" stroke-width="1" />
    ${bars}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Render: sections
// ---------------------------------------------------------------------------

function renderStat(label, value, sub) {
  return `<div class="stat">
    <div class="stat-value">${value ?? '—'}</div>
    <div class="stat-label">${escapeHtml(label)}</div>
    ${sub ? `<div class="stat-sub">${escapeHtml(sub)}</div>` : ''}
  </div>`;
}

function renderInsights() {
  if (!insights) {
    return `<p class="empty">No AI insights yet. This needs at least 2 runs of history and <code>ANTHROPIC_API_KEY</code> set when <code>npm run orchestrate</code> runs — then <code>generateInsights</code> will analyze trends and flag flaky tests automatically.</p>`;
  }
  const trendLabel = { improving: 'Improving', stable: 'Stable', degrading: 'Degrading', insufficient_data: 'Not enough data yet' }[
    insights.trend
  ] ?? insights.trend;
  return `
    <p class="insight-summary">${escapeHtml(insights.summary)}</p>
    <p class="insight-trend">Trend: <strong>${escapeHtml(trendLabel)}</strong></p>
    ${insights.flakyTests?.length ? `<h4>Flaky test candidates</h4><ul>${insights.flakyTests.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
    ${insights.recurringFailurePatterns?.length ? `<h4>Recurring patterns</h4><ul>${insights.recurringFailurePatterns.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
    ${insights.recommendations?.length ? `<h4>Recommendations</h4><ul>${insights.recommendations.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
    <p class="insight-generated">Generated ${escapeHtml(insights.generatedAt ?? '')}</p>
  `;
}

function renderHealingTable(events) {
  if (events.length === 0) {
    return `<p class="empty">No healing events recorded yet.</p>`;
  }
  const rows = events
    .slice(-25)
    .reverse()
    .map(
      (h) => `<tr>
        <td class="mono">${escapeHtml(h.timestamp?.slice(0, 16).replace('T', ' ') ?? '')}</td>
        <td>${escapeHtml(h.source)}</td>
        <td class="mono">${escapeHtml(h.file)}${h.line ? `:${h.line}` : ''}</td>
        <td><span class="pill" style="--pill-color:${h.successful ? '#5EEAD4' : '#F0677D'}">${h.successful ? 'healed' : 'needs human'}</span></td>
        <td class="reason">${escapeHtml(h.reason ?? '')}</td>
      </tr>`,
    )
    .join('\n');
  return `<table>
    <thead><tr><th>When</th><th>Source</th><th>File</th><th>Result</th><th>Reason</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderWeekTopFailures() {
  if (weekTopFailures.length === 0) {
    return `<p class="empty">No failures in the last 7 days.</p>`;
  }
  return `<ul class="rank-list">
    ${weekTopFailures.map(([title, count]) => `<li><span class="mono">${count}×</span> ${escapeHtml(title)}</li>`).join('')}
  </ul>`;
}

// ---------------------------------------------------------------------------
// Full page
// ---------------------------------------------------------------------------

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>PlaywrightScripting — Automation Dashboard</title>
<style>
  :root {
    --base: #10131A;
    --surface: #171B24;
    --border: #2A2F3A;
    --text: #E8EAF0;
    --muted: #8890A0;
    --pass: #5EEAD4;
    --healed: #F5A962;
    --review: #F0677D;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--base);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.5;
    padding: 2.5rem 1.5rem 4rem;
  }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  main { max-width: 960px; margin: 0 auto; }
  header { margin-bottom: 2.5rem; }
  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.25rem;
    letter-spacing: -0.01em;
  }
  header p { color: var(--muted); margin: 0; font-size: 0.9rem; }
  section { margin-bottom: 2.75rem; }
  h2 {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--muted);
    margin: 0 0 1rem;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--border);
  }
  h3 { font-size: 1rem; margin: 0 0 0.75rem; }
  h4 { font-size: 0.85rem; color: var(--muted); margin: 1rem 0 0.4rem; font-weight: 600; }
  .waveform-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 1.25rem; overflow-x: auto; }
  .legend { display: flex; gap: 1.25rem; margin-top: 0.75rem; font-size: 0.8rem; color: var(--muted); }
  .legend span { display: inline-flex; align-items: center; gap: 0.4rem; }
  .legend i { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
  .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
  .stat { background: var(--surface); padding: 1.25rem 1.25rem 1rem; }
  .stat-value { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 1.9rem; font-weight: 500; color: var(--pass); }
  .stat-label { color: var(--muted); font-size: 0.8rem; margin-top: 0.2rem; }
  .stat-sub { color: var(--muted); font-size: 0.72rem; margin-top: 0.3rem; }
  .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 1.5rem; }
  .empty { color: var(--muted); font-size: 0.88rem; }
  .empty code { background: var(--base); padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.82rem; }
  .insight-summary { font-size: 0.95rem; }
  .insight-trend { color: var(--muted); font-size: 0.85rem; }
  .insight-generated { color: var(--muted); font-size: 0.72rem; margin-top: 1rem; }
  ul { margin: 0.25rem 0; padding-left: 1.2rem; font-size: 0.88rem; }
  li { margin-bottom: 0.25rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  th { text-align: left; color: var(--muted); font-weight: 500; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); }
  td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); vertical-align: top; }
  td.reason { color: var(--muted); }
  .pill { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 3px; font-size: 0.72rem; background: color-mix(in srgb, var(--pill-color) 18%, transparent); color: var(--pill-color); }
  .rank-list { list-style: none; padding: 0; }
  .rank-list li { padding: 0.3rem 0; border-bottom: 1px solid var(--border); }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  @media (max-width: 640px) { .two-col { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<main>

  <header>
    <h1>PlaywrightScripting automation dashboard</h1>
    <p>Generated ${escapeHtml(new Date().toISOString())} · ${totalRuns} run(s) of history</p>
  </header>

  <section>
    <h2>Run history</h2>
    <div class="waveform-wrap">
      ${renderWaveform(runHistory)}
    </div>
    <div class="legend">
      <span><i style="background:var(--pass)"></i>Passed</span>
      <span><i style="background:var(--healed)"></i>Healed / issues found</span>
      <span><i style="background:var(--review)"></i>Needs a human</span>
    </div>
  </section>

  <section>
    <h2>Current state</h2>
    <div class="stats-row">
      ${renderStat('Pass rate', passRate !== null ? `${passRate}%` : null, `${passedRuns} of ${totalRuns} runs`)}
      ${renderStat('Healing success rate', healSuccessRate !== null ? `${healSuccessRate}%` : null, `${totalHealSuccess} of ${totalHealAttempts} attempts`)}
      ${renderStat('Latest status', latestRun ? escapeHtml(latestRun.status) : null, latestRun?.source)}
    </div>
  </section>

  <section>
    <h2>AI insights</h2>
    <div class="panel">
      ${renderInsights()}
    </div>
  </section>

  <section>
    <h2>Last 7 days</h2>
    <div class="two-col">
      <div class="panel">
        <h3>Runs this week</h3>
        <p class="stat-value" style="font-size:1.4rem">${weekRuns.length ? `${weekPassed} / ${weekRuns.length} passed` : '—'}</p>
        <h3 style="margin-top:1.5rem">Healing events this week</h3>
        <p class="stat-value" style="font-size:1.4rem">${weekHealing.length}</p>
      </div>
      <div class="panel">
        <h3>Most frequent failures this week</h3>
        ${renderWeekTopFailures()}
      </div>
    </div>
  </section>

  <section>
    <h2>Healing history</h2>
    <div class="panel">
      ${renderHealingTable(healingHistory)}
    </div>
  </section>

</main>
</body>
</html>
`;

mkdirSync(REPORTS_DIR, { recursive: true });
writeFileSync(OUT_FILE, html);
console.log(`[dashboard] Wrote ${path.relative(REPO_ROOT, OUT_FILE)}`);

// ---------------------------------------------------------------------------
// Weekly markdown digest — same underlying data, different shape: short,
// postable to Slack/email/a GitHub issue rather than opened as a full page.
// ---------------------------------------------------------------------------

const weeklyLines = [
  `# Weekly automation report`,
  ``,
  `_${now.toISOString().slice(0, 10)} — covering the last 7 days_`,
  ``,
  `## Summary`,
  ``,
  weekRuns.length === 0
    ? `No runs recorded in the last 7 days.`
    : `${weekPassed} of ${weekRuns.length} run(s) passed (${Math.round((weekPassed / weekRuns.length) * 100)}%). ${weekHealing.length} healing event(s) recorded.`,
  ``,
];

if (insights) {
  weeklyLines.push(`## AI insights`, ``, insights.summary, ``, `Trend: **${insights.trend}**`, ``);
  if (insights.flakyTests?.length) {
    weeklyLines.push(`**Flaky test candidates:**`, ...insights.flakyTests.map((t) => `- ${t}`), ``);
  }
  if (insights.recommendations?.length) {
    weeklyLines.push(`**Recommendations:**`, ...insights.recommendations.map((t) => `- ${t}`), ``);
  }
}

weeklyLines.push(`## Most frequent failures this week`, ``);
if (weekTopFailures.length === 0) {
  weeklyLines.push(`None.`);
} else {
  weeklyLines.push(...weekTopFailures.map(([title, count]) => `- **${count}×** ${title}`));
}
weeklyLines.push(``, `## Healing events this week`, ``);
if (weekHealing.length === 0) {
  weeklyLines.push(`None.`);
} else {
  weeklyLines.push(
    ...weekHealing
      .slice(-20)
      .map((h) => `- \`${h.file}${h.line ? `:${h.line}` : ''}\` — ${h.successful ? 'healed' : 'needs a human'}${h.reason ? ` (${h.reason})` : ''}`),
  );
}

const weeklyReportFile = path.join(REPORTS_DIR, 'weekly-report.md');
writeFileSync(weeklyReportFile, `${weeklyLines.join('\n')}\n`);
console.log(`[dashboard] Wrote ${path.relative(REPO_ROOT, weeklyReportFile)}`);
