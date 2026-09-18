/**
 * Shared shape for the persistent automation metrics that scripts/lib/automation-state.mjs
 * writes to reports/*.json. This is the foundation a future dashboard reads from —
 * no orchestration logic lives here, just the data contract.
 */

export type AutomationSource = 'auto-heal' | 'heal-locators';

export type AutomationStatus = 'RUNNING' | 'PASSED' | 'FAILED' | 'HEALING' | 'HUMAN_REVIEW';

/** Broad category, used to route/report failures without leaking raw error internals. */
export type FailureClassification =
  | 'typescript'
  | 'js-syntax'
  | 'locator'
  | 'assertion'
  | 'timeout'
  | 'environment'
  | 'other';

export interface TestCounts {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

export interface FailureRecord {
  /** Test title, or broken file's basename for compile-error runs. */
  title: string;
  /** Always repo-relative — never an absolute local filesystem path. */
  specFile: string;
  classification: FailureClassification;
  /** First line only, truncated, with any absolute path fragments redacted. */
  message: string;
}

export interface HealingCounts {
  attempted: number;
  successful: number;
  failed: number;
}

export interface AutomationRunState {
  runId: string;
  source: AutomationSource;
  suite?: string;
  tests: TestCounts;
  failures: FailureRecord[];
  healing: HealingCounts;
  execution: {
    startTime: string;
    endTime?: string;
    durationMs?: number;
  };
  status: AutomationStatus;
}

/** One row in reports/healing-history.json — an individual fix attempt, not a whole run. */
/** Output categories from graph/flakyTestAgent.mjs's classifyFlakiness node. */
export type FlakyCategory =
  | 'RACE_CONDITION'
  | 'TIMING_SENSITIVE'
  | 'NETWORK_DEPENDENT'
  | 'TEST_ISOLATION'
  | 'ENVIRONMENTAL'
  | 'TRUE_BUG'
  | 'INSUFFICIENT_DATA'
  | 'UNCLASSIFIED';

export type FlakySeverity = 'LOW' | 'MEDIUM' | 'HIGH';

/** Evidence assembled by scripts/lib/flaky-history.mjs for one test. */
export interface FlakyEvidence {
  intraRunRetries: number;
  /** 0–1, share of known runs where this test failed. */
  interRunFailRate: number;
  runsObserved: number;
  errorSignatures: string[];
  durationVarianceMs: number;
}

/** One row in reports/flaky-report.json's flakyTests array. */
export interface FlakyTestRecord {
  id: string;
  title: string;
  file: string;
  score: number;
  severity: FlakySeverity;
  category: FlakyCategory;
  confidence: number;
  recommendation: string;
  evidence: FlakyEvidence;
}

export interface FlakyReport {
  generatedAt: string;
  threshold: number;
  runsInHistory: number;
  testsScanned: number;
  flakyCount: number;
  flakyTests: FlakyTestRecord[];
}

/** One row in reports/flaky-history.json's runs array. */
export interface FlakyHistoryRun {
  runId: string;
  timestamp: string;
  tests: Record<
    string,
    { status: string; retryCount: number; durationMs: number; error: string | null }
  >;
}

export interface HealingEvent {
  timestamp: string;
  runId: string;
  source: AutomationSource;
  /** Repo-relative. */
  file: string;
  line?: number;
  oldValue?: string;
  newValue?: string;
  successful: boolean;
  reason?: string;
}
