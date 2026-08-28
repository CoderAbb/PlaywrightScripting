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
