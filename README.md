# PlaywrightScripting 🚀

Welcome to PlaywrightScripting—a robust, scalable, and modern End-to-End (E2E) UI test automation framework built with Microsoft Playwright and TypeScript.

This repository is architected to showcase production-ready automation patterns, clean code design, and resilient locator strategies to ensure high test reliability across multiple browsers.

## ✨ Key Features

- **TypeScript First**: Fully typed test scripts and configuration for enhanced developer experience, autocompletion, and compile-time safety.

- **Modern Locator Strategies**: Leverages user-facing locators (`getByRole`, `getByText`, `locator`) to mimic real user interactions and reduce test flakiness.

- **Cross-Browser Execution**: Out-of-the-box support for Chromium, Firefox, and WebKit.

- **End-to-End Scenario Coverage**: Includes comprehensive workflows like authentication, product browsing, cart management, form handling, and checkout flows.

- **Rich Reporting & Diagnostics**: Integrated HTML reporting, screenshots, video attachments, and Playwright Trace Viewer support for deep debugging.

- **Modular Architecture**: Clean project directory structure designed for seamless scalability (ready for Page Object Model expansion or custom fixtures).

- **Self-Healing CI**: An automated agent (`scripts/auto-heal.mjs`) scans the codebase for TypeScript errors, uses Claude to generate fixes, verifies they compile, and opens a pull request for review — running daily via GitHub Actions and on-demand via Jenkins.

- **AI-Assisted Login Automation**: A CLI agent (`login-agent.ts` / `login-agent.mjs`) that heuristically discovers login form fields on any site, performs the login, and generates a ready-to-use Playwright spec file from the recorded actions.

## 💡 Benefits

- **Reduced Maintenance Overhead**: User-centric locators decouple tests from implementation details (like brittle CSS/XPath selectors).

- **Lightning-Fast Execution**: Harnesses Playwright's parallel test execution engine to cut down feedback loops in CI/CD pipelines.

- **Flake Resistance**: Built-in auto-waiting mechanisms eliminate the need for arbitrary hardcoded sleep or wait statements.

- **Actionable Debugging**: Rich failure traces and HTML reports allow quick root-cause analysis without digging through raw logs.

- **Proactive Code Health**: Compile errors are caught and reported (or auto-fixed) before they block a release, instead of being discovered mid-test-run.

## 📂 Project Architecture

```
PlaywrightScripting/
│
├── .github/
│   └── workflows/
│       └── auto-heal.yml         # Daily GitHub Actions job: detect + fix + open PR
│
├── pages/                        # Page Object Model classes
│   ├── LoginPage.ts
│   ├── ToolshopProductPage.ts
│   ├── ToolshopCartPage.ts
│   └── ToolshopCheckoutPage.ts
│
├── tests/                        # Spec files (Playwright test runner)
│   ├── checkout.spec.ts
│   ├── toolshopCartCheckout.spec.ts
│   └── ...
├── config/                       # Shared URL and test-data modules
│   ├── urls.ts                   # Centralized site URLs used by tests
│   └── testData.ts               # Centralized test data (emails, names, postal codes)
│
├── scripts/
│   └── auto-heal.mjs             # Self-healing agent: tsc scan -> Claude fix -> verify -> PR
│
├── jenkins-agent/                # Standalone Jenkins job scheduler/reporter
├── jenkins-config.xml            # Freestyle job: install -> heal:detect (non-blocking) -> test
├── Jenkinsfile.autoheal          # Optional Jenkins pipeline mirror of the GitHub Actions job
│
├── login-agent.ts / .mjs         # CLI: auto-discovers login forms, generates a spec file
├── fixtures.ts                   # Custom Playwright fixtures (e.g. authenticatedPage)
├── global-setup.ts               # Shared base URLs, test data, and pre-auth storage state
├── playwright.config.ts          # Global Playwright configuration
├── package.json                  # Dependencies and project scripts
└── README.md                     # Project documentation
```
<img width="1426" height="797" alt="Screenshot 2026-08-30 at 4 54 50 PM" src="https://github.com/user-attachments/assets/16c57a2a-cea9-437f-afd0-babef7b3d593" />


## 🛠️ Getting Started

### Prerequisites

Ensure you have Node.js (v18 or higher) installed on your machine.

### Installation & Setup

**Clone the repository:**

```bash
git clone https://github.com/CoderAbb/PlaywrightScripting.git
cd PlaywrightScripting
```

**Install dependencies:**

```bash
npm install
```

**Install Playwright browsers:**

```bash
npx playwright install
```

## 🏃 Running the Tests

**Run all tests (Headless mode):**

```bash
npx playwright test
```

**Run tests in Headed mode (to watch browser execution):**

```bash
npx playwright test --headed
```

**Run a specific test file:**

```bash
npx playwright test tests/checkout.spec.ts
```

Note: `tests/shoppingCheckout.spec.ts` and its page objects (`ShopPage.ts`, `CartPage.ts`, `CheckoutPage.ts`) were removed and replaced by the shared `config` modules; update any local references accordingly.

**Run tests with UI Mode (Interactive runner):**

```bash
npx playwright test --ui
```

## 📊 Reports & Debugging

**View HTML Test Report:**

```bash
npx playwright show-report
```

**Inspect Traces:**

To run tests with tracing enabled for deep-dive debugging:

```bash
npx playwright test --trace on
npx playwright show-trace trace.zip
```

**Generate an Allure report:**

```bash
npm run test:allure
npx allure open allure-report
```

**Live report while tests run** — Allure 3's `watch` command refreshes the report in your browser as results come in, instead of waiting for the whole suite to finish. Run in a separate terminal from your test command:

```bash
npm run report:watch
# then, in another terminal:
npx playwright test --reporter=line,allure-playwright
```

**AI-friendly failure analysis** — `agent inspect` reads existing `allure-results/` and produces structured markdown/JSONL output (clean separated error/trace per test, run summary, findings) instead of raw logs. Useful for manual debugging or feeding into another tool:

```bash
npm run report:agent-inspect
```

`scripts/heal-locators.mjs` already uses this internally: it runs the suite with `allure-playwright` alongside its own JSON reporter, then calls `agent inspect` to pull a cleanly-parsed error/trace section for the failing test as extra context in the Claude locator-fix prompt. This is best-effort — if `agent inspect` isn't available or finds nothing, healing falls back to the same detection/fix logic that already worked without it.

## 🤖 Login Agent (AI-Assisted Test Generation)

`login-agent.ts` is a CLI tool that points at any URL, heuristically discovers the email/password/submit fields on the page, performs a live login, and writes out a ready-to-run Playwright spec (`generated.spec.ts` by default) from what it did. Optional follow-up steps (clicks, fills, assertions) can be supplied via a JSON flow file — see `flow.example.json`.

```bash
npm run login-agent -- --url https://example.com/login --username user@example.com --password secret
# or, targeting Edge:
npm run login-agent:edge
```

## 🩺 Auto-Heal: Self-Healing CI

`scripts/auto-heal.mjs` keeps the codebase compiling without waiting for a human to notice a broken build. It:

1. Runs `tsc --noEmit` to find TypeScript errors.
2. Sends each broken file + its exact compiler errors to Claude, asking for the smallest possible fix.
3. Writes the fix and re-runs `tsc` to verify it actually compiles — retries once more if not.
4. In CI, commits healed files to a new branch, pushes, and opens a pull request summarizing what was fixed and what still needs a human. **It never merges or touches `main` directly.**

| Command | What it does | Needs `ANTHROPIC_API_KEY`? |
| --- | --- | --- |
| `npm run heal:detect` | Reports broken files only, no fixes attempted | No |
| `npm run heal:dry-run` | Shows what a fix would look like, doesn't write it | Yes |
| `npm run heal` | Applies fixes locally, doesn't commit | Yes |
| `npm run heal:pr` | Applies fixes, commits, pushes, opens a PR | Yes (+ `GITHUB_TOKEN`, `GITHUB_REPO`) |

**Where it runs:**

- **GitHub Actions** (`.github/workflows/auto-heal.yml`) — on-demand only via the Actions tab ("Run workflow"). The daily schedule is disabled by default (commented out in the workflow file) since it's easy enough to trigger by hand; uncomment the `schedule:` block to bring back automatic runs. Results stream live to the run's Summary tab (files found, files healed, PR link) as well as the raw logs. Requires an `ANTHROPIC_API_KEY` repository secret; `GITHUB_TOKEN` is provided automatically.
- **Jenkins** — the main freestyle job (`jenkins-config.xml`) runs `npm run heal:detect` as a free, non-blocking pre-check on every build (no API calls, just logs findings, never fails the build). `Jenkinsfile.autoheal` is an optional separate pipeline that mirrors the full fix-and-PR behavior for teams that want it in Jenkins too — also on-demand only ("Build Now"), same reasoning.

> Cost note: `heal:pr`/`heal` only call the Claude API when `tsc`/`node --check` actually find a broken file — a clean repo costs nothing to check. `heal:detect` never calls Claude at all. Scheduling is disabled by default so runs (and any API spend) only happen when you trigger them.

## 📊 Automation State (dashboard foundation)

Both `auto-heal.mjs` and `heal-locators.mjs` write their results through a shared module, `scripts/lib/automation-state.mjs`, into `reports/` (gitignored — see below):

- `reports/automation-metrics.json` — history of the last 200 runs from either script (test/error counts, healing counts, status, timing)
- `reports/latest-run.json` — just the most recent run, for a quick "current state" read
- `reports/healing-history.json` — append-only log of the last 500 individual fix attempts (file, old value, new value, success/failure)

The shape is documented in `types/automation-state.d.ts`. This is intentionally just the data layer — no orchestration logic, no dashboard yet — laid as a foundation both scripts already write to consistently, so a future dashboard (or a LangGraph orchestrator, if that direction gets picked up) has one place to read from instead of parsing each script's log output.

`reports/` is gitignored by default. Every path field is normalized to repo-relative and every free-text field is sanitized to strip absolute filesystem paths before it's written — this repo has already leaked a local machine path into git twice via generated report files, so this module treats that as a design constraint, not an afterthought.

## 🤝 Contributing

We love community contributions and appreciate your help in making this framework even better! Whether it's adding new test suites, optimizing helper utilities, or improving documentation, all contributions are welcome.

### How to Contribute

1. **Fork the Repository**

2. **Create a Feature Branch:**

   ```bash
   git checkout -b feature/AmazingFeature
   ```

3. **Commit your Changes:**

   ```bash
   git commit -m "feat: add support for [feature name]"
   ```

4. **Push to the Branch:**

   ```bash
   git push origin feature/AmazingFeature
   ```

5. **Open a Pull Request**: Submit your PR with a clear description of the problem solved or feature added.

### Guidelines

- Ensure all existing tests pass successfully (`npx playwright test`) before submitting a PR.

- Write clean, readable TypeScript code adhering to the project's formatting standards.

- Add or update tests for any new functionality introduced.

---

**Happy Testing! 🎭**
