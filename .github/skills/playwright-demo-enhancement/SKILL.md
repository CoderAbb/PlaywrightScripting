---
name: playwright-demo-enhancement
description: Use when adding features or improving reliability in this PlaywrightScripting demo, including tests, page objects, fixtures, CI, reporting, and failure diagnostics.
---

# Playwright Demo Feature Enhancements

Use this workflow when extending the demo's Playwright framework. The repo combines TypeScript
specs and page objects with JavaScript-based analysis, healing, and reporting scripts; keep changes
within the established patterns and validate the feature through the existing npm scripts.

## Workflow

1. Inspect the relevant code and `package.json` before changing anything. Identify whether the
   feature belongs in `tests/`, `pages/`, `config/`, `scripts/`, `graph/`, or CI.
2. Keep the change focused, and preserve the existing public commands and report formats unless the
   feature explicitly requires changing them.
3. For browser behavior, prefer Playwright's role, label, and test-id locators. Put reusable page
   interactions in a page object under `pages/`; keep specs self-contained and independent of test
   order.
4. For test infrastructure, use Playwright config, fixtures, and typed helpers rather than adding
   ad hoc setup to individual specs. Never commit generated auth state, credentials, or test
   artifacts.
5. Add or update documentation where users need to discover or operate the feature.
6. Run the narrowest relevant existing command first, then `npm test` when the change affects the
   shared runner or framework. Report external-site or environment failures accurately; do not
   hide them by skipping tests or weakening assertions.

## Failure diagnostics example

Capture useful evidence only for failed tests so successful runs do not accumulate large artifacts:

```ts
use: {
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'retain-on-failure',
}
```

Keep generated evidence in Playwright's ignored `test-results/` directory, and document the
corresponding `npx playwright show-trace` command when introducing trace capture.
