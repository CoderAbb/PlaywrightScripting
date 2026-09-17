# PlaywrightScripting

**An AI-orchestrated, self-healing Playwright automation framework** — built
with TypeScript, LangGraph-based orchestration, and Allure 3 reporting.

This isn't just a Playwright starter kit. It's a layered system where CI
failures are diagnosed and auto-repaired by an orchestration agent before a
human ever has to touch a broken selector.

[![CI](https://github.com/CoderAbb/PlaywrightScripting/actions/workflows/YOUR_WORKFLOW_FILE.yml/badge.svg)](https://github.com/CoderAbb/PlaywrightScripting/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## How it works

```mermaid
flowchart LR
    A[Playwright Test Run] -->|failure detected| B[CI Failure Signal]
    B --> C[LangGraph Orchestration Agent]
    C -->|diagnoses selector/auth issue| D[Auto-Heal Script]
    D -->|patches page object| E[Re-run Test]
    E -->|pass| F[Allure 3 Report + Offline Dashboard]
    E -->|still failing| G[Flag for Human Review]
```

- **Auto-healing CI**: when a run fails on a broken selector or a stale
  session, an orchestration agent attempts to diagnose and patch it rather
  than just reporting red.
- **LangGraph orchestration**: coordinates multi-step diagnosis/repair flows
  instead of a single monolithic retry.
- **Allure 3 + offline HTML dashboard**: results are viewable without a
  hosted Allure server.
- **Prioritized selector strategy**: role/text-based selectors first, with
  fallbacks, to reduce brittleness in the first place.

> ⚠️ This project is under active development — see [Issues](../../issues)
> and [Discussions](../../discussions) for current direction.

---

## 🚀 Core features

- Playwright Test Runner with TypeScript
- Cross-browser automation (Chromium, Firefox, WebKit)
- Modern selectors (`getByRole`, `getByText`, `locator`)
- Auto-healing CI scripts for GitHub Actions
- LangGraph-based orchestration layer
- Allure 3 reporting + offline HTML dashboard
- Structured test flows (login → shop → cart → checkout)
- Reusable CLI login agent (Playwright MCP-based)

## 📂 Project structure

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

<img width="1370" height="691" alt="Screenshot 2026-09-03 at 12 13 18 PM" src="https://github.com/user-attachments/assets/5ea8ec40-f1b2-4891-8b9a-10579adab49e" />

## 🛠️ Getting Started

### Prerequisites

Ensure you have Node.js (v18 or higher) installed on your machine.

### Installation & Setup

**Clone the repository:**

```bash
git clone https://github.com/CoderAbb/PlaywrightScripting.git
cd PlaywrightScripting
npm install
npx playwright install
```

## ▶️ Running tests

```bash
npx playwright test              # full suite
npx playwright test --headed     # headed mode
npx playwright test tests/shoppingCheckout.spec.ts   # single spec
```

## 📊 Reports & tracing

```bash
npx playwright show-report       # HTML report
npx playwright test --trace on   # enable tracing
npx playwright show-trace trace.zip
```

Allure results are generated under `allure-results/` (gitignored) and
rendered into `allure-report/` — see [Allure docs](https://allurereport.org/)
for hosting the report as a static site (e.g. GitHub Pages) if you want a
shareable link.

## 🤝 Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for
setup, conventions, and how to open a PR. Bug reports and feature ideas go
through [Issues](../../issues); open-ended questions go in
[Discussions](../../discussions).

## 📦 Recommended VS Code extensions

- Playwright Test for VS Code
- ESLint
- Prettier

## License

[MIT](./LICENSE)
