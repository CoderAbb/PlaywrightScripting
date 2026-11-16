# PlaywrightScripting

**AI-orchestrated end-to-end test automation with Playwright, TypeScript, and LangGraph.**

![Playwright](https://img.shields.io/badge/Playwright-45ba4b?logo=playwright&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![Self-Healing](https://img.shields.io/badge/self--healing-AI%20powered-8A2BE2)
[![Flaky Test Detection](https://github.com/CoderAbb/PlaywrightScripting/actions/workflows/flaky-detection.yml/badge.svg)](https://github.com/CoderAbb/PlaywrightScripting/actions/workflows/flaky-detection.yml)
[![CodeQL](https://github.com/CoderAbb/PlaywrightScripting/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/CoderAbb/PlaywrightScripting/actions/workflows/github-code-scanning/codeql)

Started as a straightforward Playwright + TypeScript automation project and has grown into a
self-healing test framework: it runs your suite, classifies *why* each test failed, auto-fixes
what's safe to auto-fix, and flags what isn't — with a live dashboard showing the full picture.

<img width="1393" height="795" alt="Screenshot 2026-11-05 at 5 23 58 PM" src="https://github.com/user-attachments/assets/9dff1c15-9e61-4532-bfda-1f893605841a" />

---

## What this is

✔ Playwright Test Runner with TypeScript, cross-browser (Chromium, Firefox, WebKit)  
✔ Structured test flows (login → shop → cart → checkout) with modern selectors (`getByRole`, `getByTestId`, `getByText`)  
✔ **AI-powered failure triage** — failures are classified and diagnosed with confidence scores and recommendations  
✔ **Self-healing CI** — syntax/type errors and broken locators are auto-fixed and verified; behavior regressions are flagged for human review  
✔ **Flaky test detection** — tests that fail then pass on retry are surfaced as flaky candidates  
✔ **AI Test Intelligence dashboard** — pass rate, failure breakdown, RCA table, and flaky candidates  
✔ CI integration for GitHub Actions and Jenkins  
✔ HTML reports, Allure reporting, and trace viewer support

---

## How the self-healing pipeline works

| Failure type | Example | What happens |
|---|---|---|
| **Syntax / type error** | A `.ts`/`.mjs` file doesn't compile | `auto-heal.mjs` attempts a fix and verifies it before tests run |
| **Locator-class failure** | `locator.click: Timeout 10000ms exceeded` | `heal-locators.mjs` uses a role → testid → label → text priority ladder, then re-runs the spec to check the fix |
| **Assertion-class failure** | App returned a value different from the expected value | **Never auto-fixed.** The app's behavior may have changed; the failure is reported for human review |

The LangGraph runner in `graph/automationGraph.mjs` coordinates the existing healing scripts without
reimplementing them.

---

## AI-Augmented Quality Engineering Architecture

Explore how Playwright, LangGraph agents, AutoHeal,
and BISO Quality Intelligence work together.

[View the architecture](docs/architecture/ai-augmented-playwright-quality-engineering.md)

---

## Project Structure

```
PlaywrightScripting/
├── tests/
│   ├── fixtures.ts
│   ├── global-setup.ts
│   ├── login-agent.test.mjs
│   └── specs/
│       └── *.spec.ts
├── pages/                         # Page objects
├── config/
│   ├── testData.ts                # Shared test data
│   └── urls.ts                    # Site URLs
├── scripts/
│   ├── auto-heal.mjs
│   ├── heal-locators.mjs
│   ├── detect-flaky-tests.mjs
│   ├── analyze-results.mjs
│   └── lib/                       # Shared automation and flaky-test utilities
├── graph/                         # LangGraph automation and analysis
├── requirements/                  # Requirement-to-test mapping files
├── .github/workflows/             # GitHub Actions workflows
├── jenkins-agent/                 # Jenkins agent config
├── jenkins-config.xml
├── login-agent.mjs
├── login-agent.ts
├── playwright.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Installation

Requires Node.js 18+.

```bash
git clone https://github.com/CoderAbb/PlaywrightScripting.git
cd PlaywrightScripting
npm install
npx playwright install
```

The requirement-to-report QA pipeline uses local deterministic agents and does not require an AI API
key. AI-powered healing and failure-analysis scripts may require an Anthropic API key:

```bash
export ANTHROPIC_API_KEY=sk-...
```

---

## Running Tests

```bash
npx playwright test                              # full suite
npx playwright test --headed                     # headed mode
npx playwright test tests/specs/checkout.spec.ts # a specific spec
```

## Running the self-healing orchestrator

```bash
npm run orchestrate           # run the LangGraph healing workflow
npm run orchestrate:pr        # allow healing scripts to open pull requests
```

## Running the AI requirement-to-report QA pipeline

The LangGraph QA pipeline connects requirements to existing Playwright specs, then plans, executes,
validates, diagnoses, and reports the run. The pipeline uses deterministic local agents to orchestrate
the workflow; it does not use an LLM to invent tests. Each requirement must map to exact Playwright
test titles and spec paths. The pipeline does not create assertions or modify your specs.

```bash
npm run qa:pipeline -- --requirements requirements/qa-requirements.example.json --project chromium
npm run qa:pipeline -- --requirements requirements/qa-requirements.example.json --plan-only
```

Copy `requirements/qa-requirements.example.json` and replace the sample requirements and test mappings.
Each requirement includes an ID, description, and one or more mapped tests. Spec paths must stay under
`tests/`, and test titles must exactly match the Playwright test title.

### Pipeline stages

1. **Requirement analysis** validates the requirements JSON and mapped tests.
2. **Test planning** maps each requirement to its configured test cases.
3. **Test-case generation** writes the plan to `reports/qa-test-plan.json`.
4. **Automation** validates spec paths and selects the mapped spec files.
5. **Execution** runs Playwright against those files, optionally for one project.
6. **Validation** compares each mapped test with its recorded execution, including missing or skipped tests.
7. **Bug analysis** reuses the existing failure classifier and RCA graph.
8. **Reporting** writes `reports/qa-pipeline.json` and refreshes the existing intelligence dashboard.

`--plan-only` validates the requirements and emits the test plan without starting browsers or
refreshing reports from an earlier run. A normal run writes Playwright results to
`test-results/results.json`; the QA pipeline JSON and intelligence outputs are under `reports/`.

Individual pieces can also be run on their own:

```bash
npm run heal:detect           # syntax check only, no API key needed
npm run heal                  # auto-fix syntax/type errors
npm run heal-locators:dry-run # preview locator fixes without applying
npm run heal-locators         # fix + verify locator failures
npm run flaky                 # detect flaky candidates (needs --retries on the run that fed it)
npm run intelligence          # analyze + render the dashboard
```

## Dashboard & Reports

```bash
npm run dashboard             # render the AI Test Intelligence dashboard
npx playwright show-report    # standard Playwright HTML report
npx playwright test --trace on && npx playwright show-trace trace.zip
```

The dashboard shows total tests, pass rate, and failure diagnoses with category, confidence, and
recommendations. Its **Recommended Next Steps** section groups failures by type, explains whether
auto-heal is appropriate, and provides commands to preview safe locator repairs or inspect failures
that need manual review. Assertion mismatches are never recommended for auto-healing. Flaky candidates
are listed separately for stability follow-up.

Playwright retains a trace and video for failed tests (alongside the failure screenshot) under
`test-results/`. To inspect a trace, open the test's `trace.zip` with:

```bash
npx playwright show-trace test-results/<test-folder>/trace.zip
```

Successful tests do not retain video or trace files, keeping routine run artifacts smaller.

---

## Recommended VS Code Extensions

- Playwright Test for VS Code
- ESLint
- Prettier

---

## Roadmap

- [ ] Quarantine tests that stay flaky across N consecutive runs instead of re-healing every time
- [ ] Wire the dashboard's "Investigate" action to open the relevant trace file
- [ ] Persist flaky/failure history across runs for trend tracking
