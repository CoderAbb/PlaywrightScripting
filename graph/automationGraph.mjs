#!/usr/bin/env node
/**
 * automationGraph.mjs
 *
 * The LangGraph orchestration layer sitting ABOVE the existing scripts —
 * it does not reimplement anything scripts/auto-heal.mjs or
 * scripts/heal-locators.mjs already do. Each node shells out to the real
 * script (same as CI does) and reads its result back from the shared
 * reports/*.json written by scripts/lib/automation-state.mjs. LangGraph's
 * job here is purely routing: decide which script needs to run, in what
 * order, based on what the last one found.
 *
 * generateInsights is the one node that actually calls an LLM through
 * LangChain (@langchain/anthropic's ChatAnthropic) — every other node just
 * shells out to existing scripts, which call Claude via raw fetch, not
 * LangChain. This node reads the accumulated run history
 * (reports/automation-metrics.json) and healing history
 * (reports/healing-history.json) and asks for actual analysis — trend
 * direction, flaky-test candidates, recurring failure patterns,
 * recommendations — instead of just raw counts. Best-effort: no API key or
 * no history yet both degrade gracefully to a SKIPPED status, same pattern
 * as the other nodes.
 *
 * Graph:
 *
 *   START
 *     |
 *     v
 *   checkCompileHealth  (npm run heal:detect — free, no API key needed)
 *     |
 *     +-- issues found --> healCompileErrors (npm run heal:pr — costs API calls)
 *     |                          |
 *     +-- clean -----------------+
 *                                v
 *                       checkLocatorHealth  (npm run heal-locators)
 *                                |
 *                                v
 *                        generateInsights  (LangChain/ChatAnthropic — costs API calls)
 *                                |
 *                                v
 *                        generateReport
 *                                |
 *                                v
 *                              END
 *
 * Usage:
 *   npm run orchestrate                 # locator step attempted, PRs not opened
 *   npm run orchestrate -- --pr         # both healer scripts allowed to open PRs
 *   npm run orchestrate -- --skip-locators   # compile-only pass, skips the browser step entirely
 *   npm run orchestrate -- --skip-insights   # skip the LangChain insights call entirely
 *
 * Exit codes: 0 = everything clean or fully healed, 1 = something needs a
 * human, 2 = the orchestrator itself hit a config/environment error.
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { ChatAnthropic } from '@langchain/anthropic';
import { z } from 'zod';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = process.cwd();
const REPORTS_DIR = path.join(REPO_ROOT, 'reports');
const LATEST_RUN_FILE = path.join(REPORTS_DIR, 'latest-run.json');
const METRICS_FILE = path.join(REPORTS_DIR, 'automation-metrics.json');
const HEALING_HISTORY_FILE = path.join(REPORTS_DIR, 'healing-history.json');
const INSIGHTS_FILE = path.join(REPORTS_DIR, 'insights.json');

const args = new Set(process.argv.slice(2));
const OPEN_PR = args.has('--pr');
const SKIP_LOCATORS = args.has('--skip-locators');
const SKIP_INSIGHTS = args.has('--skip-insights');
const DIAGRAM_ONLY = args.has('--diagram');

function log(...msg) {
  console.log('[orchestrator]', ...msg);
}

/** Runs an npm script as a real child process (same as CI would) and captures its result. */
function runScript(npmScript) {
  log(`  $ npm run ${npmScript}`);
  const result = spawnSync('npm', ['run', npmScript], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    exitCode: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/** Reads reports/latest-run.json, written by whichever healer script last ran. */
function readLatestRun() {
  if (!existsSync(LATEST_RUN_FILE)) return null;
  try {
    return JSON.parse(readFileSync(LATEST_RUN_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function readJsonArraySafe(file) {
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Insights schema — the actual LangChain-driven output. Everything else this
// graph produces is counts and statuses already available from the scripts
// it wraps; this is the one place that turns accumulated history into
// analysis a human wouldn't have to do by hand.
// ---------------------------------------------------------------------------

const InsightsSchema = z.object({
  summary: z.string().describe('2-3 sentence plain-English summary of current automation health'),
  trend: z
    .enum(['improving', 'stable', 'degrading', 'insufficient_data'])
    .describe('Overall trajectory across the recent run history'),
  flakyTests: z
    .array(z.string())
    .describe('Test titles that appear to fail intermittently (pass in some runs, fail in others) — empty array if none detected'),
  recurringFailurePatterns: z
    .array(z.string())
    .describe('Common themes across failures/healing events (e.g. "same locator breaking repeatedly", "checkout flow most fragile") — empty array if none detected'),
  recommendations: z
    .array(z.string())
    .describe('Concrete, actionable next steps for the team — empty array if nothing stands out'),
});

// ---------------------------------------------------------------------------
// Graph state
// ---------------------------------------------------------------------------

const GraphState = Annotation.Root({
  compileStatus: Annotation({
    reducer: (_prev, next) => next,
    default: () => 'PENDING',
  }),
  compileDetail: Annotation({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  locatorStatus: Annotation({
    reducer: (_prev, next) => next,
    default: () => 'PENDING',
  }),
  locatorDetail: Annotation({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  insights: Annotation({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  log: Annotation({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

async function checkCompileHealth() {
  log('Node: checkCompileHealth');
  const result = runScript('heal:detect');
  const latest = readLatestRun();
  const failureCount = latest?.failures?.length ?? 0;

  if (result.exitCode === 0) {
    return {
      compileStatus: 'CLEAN',
      compileDetail: 'No TypeScript/JS syntax errors found.',
      log: ['checkCompileHealth: repo compiles clean'],
    };
  }
  return {
    compileStatus: 'ISSUES_FOUND',
    compileDetail: `${failureCount} file(s) with compile/syntax errors.`,
    log: [`checkCompileHealth: found issues in ${failureCount} file(s)`],
  };
}

async function healCompileErrors() {
  log('Node: healCompileErrors');
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      compileStatus: 'HUMAN_REVIEW',
      compileDetail: 'ANTHROPIC_API_KEY not set — cannot call Claude to attempt a fix. Set the key and re-run, or fix manually.',
      log: ['healCompileErrors: skipped, no API key in this environment'],
    };
  }
  const result = runScript(OPEN_PR ? 'heal:pr' : 'heal');
  const latest = readLatestRun();
  const status = latest?.status === 'PASSED' ? 'HEALED' : 'HUMAN_REVIEW';
  return {
    compileStatus: status,
    compileDetail: result.exitCode === 0 ? 'Healed successfully.' : 'Some files still need a human — see reports/latest-run.json.',
    log: [`healCompileErrors: exit ${result.exitCode}, status ${status}`],
  };
}

async function checkLocatorHealth() {
  log('Node: checkLocatorHealth');
  if (SKIP_LOCATORS) {
    return {
      locatorStatus: 'SKIPPED',
      locatorDetail: 'Skipped via --skip-locators.',
      log: ['checkLocatorHealth: skipped by flag'],
    };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      locatorStatus: 'SKIPPED',
      locatorDetail: 'ANTHROPIC_API_KEY not set — locator healing needs Claude to propose replacement locators.',
      log: ['checkLocatorHealth: skipped, no API key'],
    };
  }
  const result = runScript(OPEN_PR ? 'heal-locators:pr' : 'heal-locators');
  if (result.exitCode === 2) {
    // Environment error (e.g. browsers not installed, no network to the
    // target site) — this is expected and non-fatal in a sandboxed CI
    // runner without the site under test reachable. Report it as data,
    // don't crash the graph over it.
    return {
      locatorStatus: 'SKIPPED',
      locatorDetail: 'Suite could not run in this environment (browsers/network not available) — see stderr below.',
      log: [`checkLocatorHealth: environment error, exit 2. stderr: ${result.stderr.slice(0, 300)}`],
    };
  }
  const latest = readLatestRun();
  const status = latest?.status === 'PASSED' ? 'HEALED' : result.exitCode === 0 ? 'CLEAN' : 'HUMAN_REVIEW';
  return {
    locatorStatus: status,
    locatorDetail: `Exit ${result.exitCode}. ${latest ? `${latest.failures?.length ?? 0} failure(s) recorded.` : ''}`,
    log: [`checkLocatorHealth: exit ${result.exitCode}, status ${status}`],
  };
}

async function generateInsights() {
  log('Node: generateInsights');
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      insights: null,
      log: ['generateInsights: skipped, no API key'],
    };
  }

  const runHistory = readJsonArraySafe(METRICS_FILE);
  const healingHistory = readJsonArraySafe(HEALING_HISTORY_FILE);

  if (runHistory.length < 2) {
    // Not enough history yet to say anything meaningful about a trend —
    // one data point isn't a trend, it's just today. Skip rather than
    // have the LLM invent a narrative from nothing.
    return {
      insights: null,
      log: [`generateInsights: skipped, only ${runHistory.length} run(s) of history so far (need at least 2)`],
    };
  }

  // Keep the prompt bounded regardless of how long the history has grown.
  const recentRuns = runHistory.slice(-30);
  const recentHealing = healingHistory.slice(-100);

  const runSummaryLines = recentRuns.map((r) => {
    const failCount = r.failures?.length ?? 0;
    return `- ${r.execution?.startTime ?? 'unknown time'} [${r.source}] status=${r.status} tests=${JSON.stringify(r.tests)} healing=${JSON.stringify(r.healing)} failures=${failCount}`;
  });
  const healingLines = recentHealing.map(
    (h) => `- ${h.timestamp} [${h.source}] ${h.file}${h.line ? `:${h.line}` : ''} successful=${h.successful}${h.reason ? ` reason="${h.reason}"` : ''}`,
  );
  const failureTitles = recentRuns.flatMap((r) => (r.failures ?? []).map((f) => f.title));

  try {
    const model = new ChatAnthropic({ model: 'claude-sonnet-4-6', temperature: 0 });
    const structuredModel = model.withStructuredOutput(InsightsSchema, { name: 'automation_insights' });

    const prompt = [
      'You are analyzing test automation run history for a Playwright test suite.',
      `Here are the last ${recentRuns.length} run(s), most recent last:`,
      ...runSummaryLines,
      '',
      `Here are the last ${recentHealing.length} healing attempt(s):`,
      ...healingLines,
      '',
      `All failure titles seen across this history: ${JSON.stringify(failureTitles)}`,
      '',
      'Analyze this data. A test title appearing as a failure in some runs but',
      'not others (not simply "always fails") is a flaky-test candidate.',
    ].join('\n');

    const result = await structuredModel.invoke(prompt);
    mkdirSync(REPORTS_DIR, { recursive: true });
    const withTimestamp = { generatedAt: new Date().toISOString(), ...result };
    writeFileSync(INSIGHTS_FILE, JSON.stringify(withTimestamp, null, 2));

    return {
      insights: withTimestamp,
      log: [`generateInsights: trend=${result.trend}, ${result.flakyTests.length} flaky test(s) flagged`],
    };
  } catch (err) {
    return {
      insights: null,
      log: [`generateInsights: LLM call failed: ${err.message}`],
    };
  }
}

async function generateReport(state) {
  log('Node: generateReport');
  const report = {
    generatedAt: new Date().toISOString(),
    compile: { status: state.compileStatus, detail: state.compileDetail },
    locators: { status: state.locatorStatus, detail: state.locatorDetail },
    insights: state.insights,
    log: state.log,
  };
  mkdirSync(REPORTS_DIR, { recursive: true });
  writeFileSync(path.join(REPORTS_DIR, 'orchestrator-summary.json'), JSON.stringify(report, null, 2));
  return { log: ['generateReport: wrote reports/orchestrator-summary.json'] };
}

// ---------------------------------------------------------------------------
// Graph wiring
// ---------------------------------------------------------------------------

function routeAfterCompileCheck(state) {
  return state.compileStatus === 'ISSUES_FOUND' ? 'healCompileErrors' : 'checkLocatorHealth';
}

const graph = new StateGraph(GraphState)
  .addNode('checkCompileHealth', checkCompileHealth)
  .addNode('healCompileErrors', healCompileErrors)
  .addNode('checkLocatorHealth', checkLocatorHealth)
  .addNode('generateInsights', generateInsights)
  .addNode('generateReport', generateReport)
  .addEdge(START, 'checkCompileHealth')
  .addConditionalEdges('checkCompileHealth', routeAfterCompileCheck, [
    'healCompileErrors',
    'checkLocatorHealth',
  ])
  .addEdge('healCompileErrors', 'checkLocatorHealth')
  .addEdge('checkLocatorHealth', SKIP_INSIGHTS ? 'generateReport' : 'generateInsights')
  .addEdge('generateInsights', 'generateReport')
  .addEdge('generateReport', END)
  .compile();

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function main() {
  if (DIAGRAM_ONLY) {
    log('Generating Mermaid diagram of the graph structure (no nodes executed)...');
    const drawable = await graph.getGraphAsync();
    const mermaid = drawable.drawMermaid();
    mkdirSync(REPORTS_DIR, { recursive: true });
    const outFile = path.join(REPORTS_DIR, 'automation-graph.mmd');
    writeFileSync(outFile, mermaid);
    console.log('');
    console.log(mermaid);
    log(`Wrote ${path.relative(REPO_ROOT, outFile)}`);
    process.exit(0);
  }

  log('Starting automation graph run...');
  const finalState = await graph.invoke({});

  console.log('');
  console.log('=== Automation Graph: Final State ===');
  console.log(JSON.stringify(
    {
      compile: { status: finalState.compileStatus, detail: finalState.compileDetail },
      locators: { status: finalState.locatorStatus, detail: finalState.locatorDetail },
    },
    null,
    2,
  ));
  console.log('');
  console.log('Execution log:');
  for (const line of finalState.log) console.log(`  - ${line}`);

  const needsHuman =
    finalState.compileStatus === 'HUMAN_REVIEW' || finalState.locatorStatus === 'HUMAN_REVIEW';
  process.exit(needsHuman ? 1 : 0);
}

main().catch((err) => {
  console.error('[orchestrator] Fatal error:', err);
  process.exit(2);
});
