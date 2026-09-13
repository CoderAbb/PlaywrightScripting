import fs from "node:fs";

export function loadResults(file = "test-results/results.json") {
  if (!fs.existsSync(file)) {
    return {
      suites: [],
      stats: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        flaky: 0
      }
    };
  }

  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function flattenTests(results) {
  const tests = [];

  function walk(suite, parent = "") {
    const suiteName = parent
      ? `${parent} > ${suite.title}`
      : suite.title;

    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const resultsList = test.results || [];

        const lastResult =
          resultsList[resultsList.length - 1];

        const status = lastResult?.status || "unknown";

        tests.push({
          id: `${suiteName}:${spec.title}`,
          suite: suiteName,
          title: spec.title,
          file: spec.file,
          status,
          duration: lastResult?.duration || 0,
          error: lastResult?.error?.message || null,
          retryCount: Math.max(resultsList.length - 1, 0),
          retries: resultsList.map(r => ({
            status: r.status,
            duration: r.duration
          }))
        });
      }
    }

    for (const child of suite.suites || []) {
      walk(child, suiteName);
    }
  }

  for (const suite of results.suites || []) {
    walk(suite);
  }

  return tests;
}