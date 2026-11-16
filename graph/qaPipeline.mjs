#!/usr/bin/env node

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { classifyFailure } from "./intelligence/failure-classifier.mjs";
import { flattenTests } from "./intelligence/result-parser.mjs";
import { failureRcaGraph } from "./failureRcaAgent.mjs";

const REPO_ROOT = process.cwd();
const DEFAULT_REQUIREMENTS = "requirements/qa-requirements.example.json";
const RESULTS_FILE = path.join(REPO_ROOT, "test-results/results.json");
const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const PLAN_FILE = path.join(REPORTS_DIR, "qa-test-plan.json");
const REPORT_FILE = path.join(REPORTS_DIR, "qa-pipeline.json");

function log(stage, message) {
  console.log(`[qa-pipeline] ${stage}: ${message}`);
}

function normalizeRelativePath(file) {
  return file.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

export function normalizeSpecPath(file, root = REPO_ROOT) {
  if (typeof file !== "string" || file.trim() === "" || path.isAbsolute(file)) {
    throw new TypeError("Each test file must be a non-empty relative path.");
  }

  const resolvedRoot = path.resolve(root);
  const testsRoot = path.join(resolvedRoot, "tests");
  const resolvedFile = path.resolve(resolvedRoot, file);
  const relativeToTests = path.relative(testsRoot, resolvedFile);

  if (
    relativeToTests === "" ||
    relativeToTests.startsWith(`..${path.sep}`) ||
    relativeToTests === ".." ||
    path.isAbsolute(relativeToTests)
  ) {
    throw new TypeError(`Test files must be inside tests/: ${file}`);
  }

  return normalizeRelativePath(path.relative(resolvedRoot, resolvedFile));
}

export function validateRequirementDocument(document, root = REPO_ROOT) {
  if (
    !document ||
    typeof document !== "object" ||
    typeof document.name !== "string" ||
    document.name.trim() === "" ||
    !Array.isArray(document.requirements) ||
    document.requirements.length === 0
  ) {
    throw new TypeError(
      "Requirements must include a name and a non-empty requirements array."
    );
  }

  const requirementIds = new Set();
  for (const requirement of document.requirements) {
    if (
      !requirement ||
      typeof requirement.id !== "string" ||
      requirement.id.trim() === "" ||
      typeof requirement.description !== "string" ||
      requirement.description.trim() === "" ||
      !Array.isArray(requirement.tests) ||
      requirement.tests.length === 0
    ) {
      throw new TypeError(
        "Each requirement needs an id, description, and at least one mapped test."
      );
    }

    if (requirementIds.has(requirement.id)) {
      throw new TypeError(`Duplicate requirement id: ${requirement.id}`);
    }
    requirementIds.add(requirement.id);

    for (const test of requirement.tests) {
      if (
        !test ||
        typeof test.title !== "string" ||
        test.title.trim() === ""
      ) {
        throw new TypeError(
          `Each mapped test for ${requirement.id} needs an exact test title.`
        );
      }

      const file = normalizeSpecPath(test.file, root);
      if (!existsSync(path.join(root, file))) {
        throw new TypeError(`Mapped test file does not exist: ${file}`);
      }
    }
  }

  return document;
}

function resultFileKey(file) {
  const normalized = normalizeRelativePath(file);
  return normalized.startsWith("tests/") ? normalized.slice("tests/".length) : normalized;
}

export function validateCoverage(plan, tests) {
  return plan.map(testCase => {
    const matches = tests.filter(
      result =>
        resultFileKey(result.file) === resultFileKey(testCase.file) &&
        result.title === testCase.title
    );

    let status = "MISSING";
    if (matches.length > 0) {
      if (matches.some(result => result.status === "failed" || result.status === "timedOut")) {
        status = "FAILED";
      } else if (matches.some(result => result.status === "skipped")) {
        status = "SKIPPED";
      } else if (matches.every(result => result.status === "passed")) {
        status = "PASSED";
      } else {
        status = "UNKNOWN";
      }
    }

    return {
      ...testCase,
      status,
      executions: matches.length,
      retryCount: matches.reduce((total, result) => total + result.retryCount, 0),
      errors: matches
        .filter(result => result.error)
        .map(result => result.error)
    };
  });
}

function parseArguments(argv) {
  const options = {
    requirementsPath: DEFAULT_REQUIREMENTS,
    planOnly: false,
    project: undefined
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--plan-only") {
      options.planOnly = true;
    } else if (argument === "--requirements") {
      options.requirementsPath = argv[index + 1];
      index += 1;
    } else if (argument.startsWith("--requirements=")) {
      options.requirementsPath = argument.slice("--requirements=".length);
    } else if (argument === "--project") {
      options.project = argv[index + 1];
      index += 1;
    } else if (argument.startsWith("--project=")) {
      options.project = argument.slice("--project=".length);
    } else if (argument === "--help" || argument === "-h") {
      console.log(
        "Usage: npm run qa:pipeline -- [--requirements <file>] [--project <name>] [--plan-only]"
      );
      process.exit(0);
    } else {
      throw new TypeError(`Unknown option: ${argument}`);
    }
  }

  if (!options.requirementsPath) {
    throw new TypeError("Provide a path after --requirements.");
  }
  if (options.project !== undefined && options.project.trim() === "") {
    throw new TypeError("Provide a project name after --project.");
  }

  return options;
}

const PipelineState = Annotation.Root({
  requirementsPath: Annotation(),
  planOnly: Annotation(),
  project: Annotation(),
  runId: Annotation(),
  requirementDocument: Annotation(),
  plan: Annotation(),
  specFiles: Annotation(),
  testResults: Annotation(),
  coverage: Annotation(),
  failures: Annotation(),
  executionExitCode: Annotation(),
  executionError: Annotation(),
  report: Annotation(),
  events: Annotation({
    reducer: (previous, next) => [...previous, ...next],
    default: () => []
  })
});

function event(stage, status, detail = "") {
  return { stage, status, detail, at: new Date().toISOString() };
}

async function requirementAnalysisAgent(state) {
  log("Requirement Analysis Agent", `reading ${state.requirementsPath}`);
  const requirementsPath = path.resolve(REPO_ROOT, state.requirementsPath);
  const document = JSON.parse(readFileSync(requirementsPath, "utf8"));
  validateRequirementDocument(document);
  log(
    "Requirement Analysis Agent",
    `validated ${document.requirements.length} requirement(s)`
  );
  return {
    requirementDocument: document,
    events: [event("requirement-analysis", "PASSED", document.name)]
  };
}

async function testPlanningAgent(state) {
  log("Test Planning Agent", "mapping requirements to existing Playwright tests");
  const plan = state.requirementDocument.requirements.flatMap(requirement =>
    requirement.tests.map(test => ({
      requirementId: requirement.id,
      objective: requirement.description,
      file: normalizeSpecPath(test.file),
      title: test.title
    }))
  );
  const specFiles = [...new Set(plan.map(testCase => testCase.file))];
  log("Test Planning Agent", `planned ${plan.length} test case(s)`);
  return {
    plan,
    specFiles,
    events: [event("test-planning", "PASSED", `${plan.length} test case(s)`)]
  };
}

async function testCaseGeneratorAgent(state) {
  log("Test Case Generator Agent", `writing ${path.relative(REPO_ROOT, PLAN_FILE)}`);
  mkdirSync(REPORTS_DIR, { recursive: true });
  const testPlan = {
    generatedAt: new Date().toISOString(),
    requirements: state.requirementDocument.name,
    cases: state.plan
  };
  writeFileSync(PLAN_FILE, JSON.stringify(testPlan, null, 2));
  return {
    events: [event("test-case-generation", "PASSED", path.relative(REPO_ROOT, PLAN_FILE))]
  };
}

async function automationAgent(state) {
  log("Automation Agent", `checking ${state.specFiles.length} spec file(s)`);
  for (const file of state.specFiles) {
    const safePath = normalizeSpecPath(file);
    if (!existsSync(path.join(REPO_ROOT, safePath))) {
      throw new Error(`Mapped Playwright spec disappeared: ${safePath}`);
    }
  }
  return {
    events: [event("automation", "PASSED", `${state.specFiles.length} spec file(s)`)]
  };
}

async function executionAgent(state) {
  if (state.planOnly) {
    log("Execution Agent", "skipped by --plan-only");
    return {
      executionExitCode: null,
      executionError: null,
      events: [event("execution", "SKIPPED", "Plan-only run")]
    };
  }

  log("Execution Agent", `starting Playwright${state.project ? ` (${state.project})` : ""}`);
  mkdirSync(path.dirname(RESULTS_FILE), { recursive: true });
  rmSync(RESULTS_FILE, { force: true });
  const args = ["playwright", "test", ...state.specFiles];
  if (state.project) args.push("--project", state.project);

  const result = spawnSync("npx", args, {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: process.env
  });
  const executionError = result.error?.message ?? null;
  const executionExitCode = result.status ?? 2;
  log("Execution Agent", `Playwright exited with code ${executionExitCode}`);
  return {
    executionExitCode,
    executionError,
    events: [
      event(
        "execution",
        executionExitCode === 0 ? "PASSED" : "FAILED",
        executionError ?? `exit code ${executionExitCode}`
      )
    ]
  };
}

async function validationAgent(state) {
  if (state.planOnly) {
    const coverage = state.plan.map(testCase => ({ ...testCase, status: "PLANNED" }));
    return {
      testResults: [],
      coverage,
      events: [event("validation", "SKIPPED", "Plan-only run")]
    };
  }

  const results = existsSync(RESULTS_FILE)
    ? JSON.parse(readFileSync(RESULTS_FILE, "utf8"))
    : { suites: [] };
  const testResults = flattenTests(results);
  const coverage = validateCoverage(state.plan, testResults);
  const passed = coverage.filter(item => item.status === "PASSED").length;
  log("Validation Agent", `${passed}/${coverage.length} mapped case(s) passed`);
  return {
    testResults,
    coverage,
    events: [
      event(
        "validation",
        coverage.every(item => item.status === "PASSED") ? "PASSED" : "FAILED",
        `${passed}/${coverage.length} mapped case(s) passed`
      )
    ]
  };
}

async function bugAnalysisAgent(state) {
  const failures = [];
  for (const testCase of state.coverage.filter(item => item.status === "FAILED")) {
    const matchingFailures = state.testResults.filter(
      result =>
        resultFileKey(result.file) === resultFileKey(testCase.file) &&
        result.title === testCase.title &&
        (result.status === "failed" || result.status === "timedOut")
    );

    for (const test of matchingFailures) {
      const classification = classifyFailure(test);
      const analysis = await failureRcaGraph.invoke({ test, classification });
      failures.push({
        requirementId: testCase.requirementId,
        test: test.title,
        file: test.file,
        category: classification.category,
        confidence: classification.confidence,
        diagnosis: analysis.diagnosis,
        recommendation: analysis.recommendation,
        error: test.error
      });
    }
  }

  log("Bug Analysis Agent", `analyzed ${failures.length} failed execution(s)`);
  return {
    failures,
    events: [event("bug-analysis", "PASSED", `${failures.length} failure(s) analyzed`)]
  };
}

function buildPipelineReport(state, reportingStatus, reportingDetail) {
  const passed = state.coverage.filter(item => item.status === "PASSED").length;
  const failed = state.coverage.filter(item => item.status === "FAILED").length;
  const missing = state.coverage.filter(
    item => item.status === "MISSING" || item.status === "UNKNOWN"
  ).length;
  const skipped = state.coverage.filter(item => item.status === "SKIPPED").length;
  const planOnly = state.planOnly;
  const executionPassed =
    state.executionExitCode === 0 && state.executionError === null;
  const stages = [
    ...state.events,
    event("reporting", reportingStatus, reportingDetail)
  ];

  return {
    generatedAt: new Date().toISOString(),
    runId: state.runId,
    status: planOnly
      ? "PLAN_ONLY"
      : executionPassed &&
          reportingStatus === "PASSED" &&
          failed === 0 &&
          missing === 0 &&
          skipped === 0 &&
          passed === state.plan.length
        ? "PASSED"
        : "FAILED",
    requirements: state.requirementDocument.name,
    execution: {
      exitCode: state.executionExitCode,
      error: state.executionError,
      project: state.project ?? null
    },
    summary: {
      planned: state.plan.length,
      passed,
      failed,
      missing,
      skipped,
      passRate: state.plan.length ? Number(((passed / state.plan.length) * 100).toFixed(2)) : 0
    },
    coverage: state.coverage,
    failures: state.failures,
    artifacts: {
      testPlan: path.relative(REPO_ROOT, PLAN_FILE),
      playwrightResults: path.relative(REPO_ROOT, RESULTS_FILE),
      intelligenceReport: path.join("reports", "intelligence.json"),
      dashboard: path.join("reports", "dashboard.html")
    },
    stages
  };
}

async function reportingAgent(state) {
  log("Reporting Agent", "generating pipeline report and dashboard");
  let reportingStatus = "PASSED";
  let reportingDetail = "";

  if (!state.planOnly) {
    const result = spawnSync("npm", ["run", "intelligence"], {
      cwd: REPO_ROOT,
      stdio: "inherit",
      env: process.env
    });
    if (result.status !== 0) {
      reportingStatus = "FAILED";
      reportingDetail = result.error?.message ?? `npm run intelligence exited with ${result.status}`;
    }
  } else {
    reportingDetail = "Dashboard generation skipped for plan-only run.";
  }

  const report = buildPipelineReport(state, reportingStatus, reportingDetail);
  mkdirSync(REPORTS_DIR, { recursive: true });
  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  log("Reporting Agent", `wrote ${path.relative(REPO_ROOT, REPORT_FILE)}`);
  if (reportingStatus !== "PASSED") {
    throw new Error(`Could not refresh the intelligence dashboard: ${reportingDetail}`);
  }
  return {
    report,
    events: [event("reporting", reportingStatus, reportingDetail)]
  };
}

const pipeline = new StateGraph(PipelineState)
  .addNode("requirementAnalysis", requirementAnalysisAgent)
  .addNode("testPlanning", testPlanningAgent)
  .addNode("testCaseGeneration", testCaseGeneratorAgent)
  .addNode("automation", automationAgent)
  .addNode("execution", executionAgent)
  .addNode("validation", validationAgent)
  .addNode("bugAnalysis", bugAnalysisAgent)
  .addNode("reporting", reportingAgent)
  .addEdge(START, "requirementAnalysis")
  .addEdge("requirementAnalysis", "testPlanning")
  .addEdge("testPlanning", "testCaseGeneration")
  .addEdge("testCaseGeneration", "automation")
  .addEdge("automation", "execution")
  .addEdge("execution", "validation")
  .addEdge("validation", "bugAnalysis")
  .addEdge("bugAnalysis", "reporting")
  .addEdge("reporting", END)
  .compile();

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const finalState = await pipeline.invoke({
    requirementsPath: options.requirementsPath,
    planOnly: options.planOnly,
    project: options.project ?? null,
    runId: new Date().toISOString().replaceAll(/[:.]/g, "-")
  });

  console.log("");
  console.log(`QA pipeline status: ${finalState.report.status}`);
  console.log(`Pipeline report: ${path.relative(REPO_ROOT, REPORT_FILE)}`);
  if (finalState.report.status === "FAILED") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error("[qa-pipeline] Fatal error:", error);
    process.exitCode = 2;
  });
}
