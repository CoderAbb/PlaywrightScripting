# AI-Augmented Playwright Quality Engineering

## Proposed Target Architecture

This overview presents the repository's quality-engineering direction. The implementation flow below reflects the LangGraph workflows currently in `graph/`; it distinguishes implemented behavior from ideas in the broader target architecture.

## Implementation: LangGraph Workflows

The repository currently has two orchestration workflows with different purposes:

- `graph/automationGraph.mjs` coordinates compile/syntax detection and locator healing.
- `graph/qaPipeline.mjs` maps requirements to existing Playwright tests, runs and validates them, analyzes failures, and reports results.

### Self-healing orchestrator (`automationGraph.mjs`)

```mermaid
flowchart TD
    START([START]) --> CC[checkCompileHealth<br/>npm run heal:detect]
    CC -->|CLEAN| LH[checkLocatorHealth]
    CC -->|ISSUES_FOUND| HC[healCompileErrors<br/>npm run heal or heal:pr]
    HC --> LH

    LH -->|--skip-locators| SKIP[Mark SKIPPED]
    LH -->|No ANTHROPIC_API_KEY| SKIP
    LH -->|Otherwise| RUNLOC[Run heal-locators<br/>or heal-locators:pr]
    RUNLOC -->|Environment error, exit 2| SKIP
    RUNLOC -->|Result| LOCSTATUS[Set locator status]
    SKIP --> REPORT[generateReport]
    LOCSTATUS --> REPORT
    REPORT --> END([END])

    STATE[(Graph state<br/>compileStatus · compileDetail<br/>locatorStatus · locatorDetail · log)]
    CC -. updates .-> STATE
    HC -. updates .-> STATE
    LH -. updates .-> STATE
    REPORT --> ARTIFACT[reports/orchestrator-summary.json]
    LATEST[(Shared script result<br/>reports/latest-run.json)] -. read by compile/heal nodes .-> CC
    LATEST -. read by compile/heal nodes .-> HC
    LATEST -. read by locator node .-> LH
```

The orchestrator routes existing scripts rather than reimplementing their healing behavior. Compile issues take the compile-healing path before locator handling; a clean compile check goes directly to locator handling. `--skip-locators` and a missing API key skip locator healing. The workflow writes a summary report and does not contain a retry loop.

### Requirements-to-report pipeline (`qaPipeline.mjs`)

```mermaid
flowchart TD
    START([START]) --> RA[requirementAnalysis<br/>Read and validate requirements JSON]
    RA --> TP[testPlanning<br/>Map requirements to exact test titles/files]
    TP --> TCG[testCaseGeneration<br/>Write reports/qa-test-plan.json]
    TCG --> AUTO[automation<br/>Validate mapped spec paths]
    AUTO --> EXEC[execution<br/>Run selected Playwright specs]

    EXEC --> VAL[validation<br/>Compare mapped cases with results]
    VAL --> BA[bugAnalysis<br/>Classify failures and invoke RCA graph]
    BA --> REPORT[reporting<br/>Generate intelligence and pipeline reports]
    REPORT --> END([END])

    EXEC -. "--plan-only: skip test run" .-> VAL
    VAL -. "--plan-only: mark cases PLANNED" .-> BA
    BA --> CLASSIFY[classifyFailure]
    CLASSIFY --> RCA[analyzeFailure<br/>failureRcaGraph]
    RCA --> BA

    INPUT[(requirements JSON<br/>name · requirement IDs/descriptions<br/>mapped test files and exact titles)] --> RA
    STATE[(Pipeline state<br/>plan · specFiles · testResults<br/>coverage · failures · events<br/>execution status · report)] -. carried through nodes .-> RA
    RESULTS[(test-results/results.json)] -. read by validation .-> VAL
    PLAN[reports/qa-test-plan.json] -. written by testCaseGeneration .-> TCG
    INTEL[npm run intelligence<br/>analysis + dashboard] -. invoked by reporting on normal runs .-> REPORT
    OUTPUT[reports/qa-pipeline.json<br/>plus intelligence artifacts] --> REPORT
```

The diagram shows the main graph edges and the RCA subgraph invoked inside `bugAnalysis`. The plan-only mode is handled within execution, validation, and reporting nodes; it does not add conditional graph-routing edges. The pipeline maps requirements only to existing tests—it validates the mapped paths and exact titles rather than generating new assertions or modifying specs.

## State and failure handling

| Workflow | State passed between nodes | Notable outcomes |
|---|---|---|
| Self-healing orchestrator | Compile and locator statuses/details, plus an accumulated log | Compile issues may be healed; locator healing can be skipped; final status and summary are written to `reports/orchestrator-summary.json`. |
| Requirements pipeline | Requirements, test plan, spec files, execution results, coverage, failures, stage events, and report | Coverage is classified per mapped case; failed executions are classified and diagnosed; reports are written under `reports/`. |
| Failure RCA subgraph | Test, classification, diagnosis, recommendation | Handles locator, timeout, assertion, and network categories with a recommendation for review. |

Assertion failures are diagnosed and recommended for investigation by the RCA flow; the architecture does not imply they are automatically repaired. The broader quality-intelligence concepts in the repository overview should not be read as additional nodes in these two workflows.

## Related implementation

- [`graph/automationGraph.mjs`](../../graph/automationGraph.mjs)
- [`graph/qaPipeline.mjs`](../../graph/qaPipeline.mjs)
- [`graph/failureRcaAgent.mjs`](../../graph/failureRcaAgent.mjs)
- [`graph/flakyTestAgent.mjs`](../../graph/flakyTestAgent.mjs)
