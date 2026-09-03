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
 *                        generateReport
 *                                |
 *                                v
 *                              END
 *
 * Usage:
 *   npm run orchestrate                 # locator step attempted, PRs not opened
 *   npm run orchestrate -- --pr         # both healer scripts allowed to open PRs
 *   npm run orchestrate -- --skip-locators   # compile-only pass, skips the browser step entirely
 *
 * Exit codes: 0 = everything clean or fully healed, 1 = something needs a
 * human, 2 = the orchestrator itself hit a config/environment error.
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = process.cwd();
const REPORTS_DIR = path.join(REPO_ROOT, 'reports');
const LATEST_RUN_FILE = path.join(REPORTS_DIR, 'latest-run.json');

const args = new Set(process.argv.slice(2));
const OPEN_PR = args.has('--pr');
const SKIP_LOCATORS = args.has('--skip-locators');
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

async function generateReport(state) {
  log('Node: generateReport');
  const report = {
    generatedAt: new Date().toISOString(),
    compile: { status: state.compileStatus, detail: state.compileDetail },
    locators: { status: state.locatorStatus, detail: state.locatorDetail },
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
  .addNode('generateReport', generateReport)
  .addEdge(START, 'checkCompileHealth')
  .addConditionalEdges('checkCompileHealth', routeAfterCompileCheck, [
    'healCompileErrors',
    'checkLocatorHealth',
  ])
  .addEdge('healCompileErrors', 'checkLocatorHealth')
  .addEdge('checkLocatorHealth', 'generateReport')
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
