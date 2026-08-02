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

## 💡 Benefits

- **Reduced Maintenance Overhead**: User-centric locators decouple tests from implementation details (like brittle CSS/XPath selectors).

- **Lightning-Fast Execution**: Harnesses Playwright's parallel test execution engine to cut down feedback loops in CI/CD pipelines.

- **Flake Resistance**: Built-in auto-waiting mechanisms eliminate the need for arbitrary hardcoded sleep or wait statements.

- **Actionable Debugging**: Rich failure traces and HTML reports allow quick root-cause analysis without digging through raw logs.

## 📂 Project Architecture

```
PlaywrightScripting/
│
├── tests/
│   └── shoppingCheckout.spec.ts  # End-to-end shopping & checkout workflow
│
├── playwright.config.ts          # Global Playwright configuration
├── package.json                  # Dependencies and project scripts
└── README.md                     # Project documentation
```

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
npx playwright test tests/shoppingCheckout.spec.ts
```

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
