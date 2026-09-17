# Contributing to PlaywrightScripting

Thanks for your interest in contributing! This project is an AI-orchestrated
Playwright automation framework with auto-healing CI, and contributions
of all sizes are welcome — from fixing a flaky selector to extending the
orchestration layer.

## Getting started

```bash
git clone https://github.com/CoderAbb/PlaywrightScripting.git
cd PlaywrightScripting
npm install
npx playwright install
```

Run the suite locally before opening a PR:

```bash
npx playwright test
```

## Project conventions

- **Page objects** live under `tests/` and should follow the existing
  prioritized-selector pattern (role/text-based selectors first, CSS/XPath
  as a fallback) rather than brittle raw selectors.
- **New specs** should be self-contained and not depend on execution order.
- **Auth/session state** must never be committed — it's covered by
  `.gitignore` for a reason (see `global-setup.ts` for how sessions are
  generated per run).
- **TypeScript**: keep strict typing; avoid `any` unless interfacing with an
  untyped third-party API.

## Making a change

1. Fork the repo and create a branch: `git checkout -b feature/short-description`
2. Make your change, with tests where relevant.
3. Run `npx playwright test` and confirm everything passes locally.
4. Open a pull request describing what changed and why. Link any related
   issue.

## Reporting bugs / requesting features

Please use the issue templates under `.github/ISSUE_TEMPLATE/` — they help
keep reports actionable (repro steps, expected vs. actual behavior, etc.).

## Questions

Open a thread in [Discussions](../../discussions) rather than an issue if
you're not sure something is a bug — it's easier for others to find and
build on.
