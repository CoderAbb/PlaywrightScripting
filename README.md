📘 PlaywrightScripting
End‑to‑End UI Automation with Playwright & TypeScript
Welcome to PlaywrightScripting, a hands‑on automation project built using Microsoft Playwright with TypeScript.
This repository demonstrates real‑world UI automation patterns, including selectors, navigation, assertions, and reusable helpers.

Whether you're learning Playwright or building a scalable automation suite, this project gives you a clean foundation to grow from.

🚀 Features
✔ Playwright Test Runner with TypeScript

✔ Cross‑browser automation (Chromium, Firefox, WebKit)

✔ Modern selectors (getByRole, getByText, locator)

✔ Reusable helper functions

✔ Structured test flows (login → shop → cart → checkout)

✔ Easy to extend for POM or fixtures

✔ HTML reports & trace viewer support

📂 Project Structure
Code
PlaywrightScripting/
│
├── tests/
│   └── shoppingCheckout.spec.ts
│
├── playwright.config.ts
├── package.json
└── README.md
🛠 Installation
Make sure you have Node.js 18+ installed.

bash
git clone https://github.com/CoderAbb/PlaywrightScripting.git
cd PlaywrightScripting
npm install
Install Playwright browsers:

bash
npx playwright install
▶️ Running Tests
Run the full test suite:

bash
npx playwright test
Run in headed mode:

bash
npx playwright test --headed
Run a specific test:

bash
npx playwright test tests/shoppingCheckout.spec.ts
📊 View Reports
Generate and open the HTML report:

bash
npx playwright show-report
Enable tracing:

bash
npx playwright test --trace on
Open trace viewer:

bash
npx playwright show-trace trace.zip
🧪 Example Test Included
The repository includes a complete end‑to‑end flow:

Login

Browse products

Add items to cart

Remove an item

Proceed to checkout

Fill checkout form

This demonstrates how to build stable, readable automation using Playwright’s modern APIs.

📦 Recommended Extensions
If you're using VS Code:

Playwright Test for VS Code

ESLint

Prettier

These improve debugging, formatting, and test authoring.

🧭 Roadmap
Future enhancements may include:

Page Object Model (POM) structure

Custom fixtures

API + UI hybrid tests

CI/CD integration (GitHub Actions)

Allure reporting
