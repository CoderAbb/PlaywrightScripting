import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..");
const generator = path.join(repoRoot, "scripts/generate-dashboard.mjs");
const store = path.join(
  repoRoot,
  "graph/intelligence/intelligence-store.mjs"
);

function runNode(args, cwd) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

test("dashboard renders six screens from report data without unsafe HTML", t => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "biso-dashboard-")
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  fs.mkdirSync(path.join(directory, "reports"), { recursive: true });
  fs.mkdirSync(path.join(directory, ".github/workflows"), {
    recursive: true
  });
  fs.writeFileSync(path.join(directory, "Jenkinsfile"), "");
  fs.writeFileSync(
    path.join(directory, "reports/intelligence.json"),
    JSON.stringify({
      generatedAt: "2026-10-31T12:00:00.000Z",
      summary: {
        total: 4,
        passed: 2,
        failed: 1,
        skipped: 1,
        flakyCandidates: 1,
        passRate: 50
      },
      failures: [
        {
          test: "unsafe <script>alert('x')</script>",
          file: "tests/example.spec.ts",
          category: "ASSERTION",
          confidence: 0.9,
          diagnosis: "Expected <unsafe> value",
          recommendation: "Review actual behavior"
        }
      ],
      flakyCandidates: [
        {
          title: "intermittent test",
          file: "tests/flaky.spec.ts",
          retryCount: 1,
          status: "passed",
          duration: 225
        }
      ],
      tests: [
        {
          title: "healthy test",
          file: "tests/healthy.spec.ts",
          status: "passed",
          duration: 115
        }
      ]
    })
  );
  fs.writeFileSync(
    path.join(directory, "reports/execution-history.json"),
    JSON.stringify([
      {
        generatedAt: "2026-10-29T12:00:00.000Z",
        passRate: 72
      },
      {
        generatedAt: "2026-10-30T12:00:00.000Z",
        passRate: 84
      }
    ])
  );

  runNode([generator], directory);
  const html = fs.readFileSync(
    path.join(directory, "reports/dashboard.html"),
    "utf8"
  );

  for (const screen of [
    "Overview",
    "Failure intelligence",
    "Flaky test analytics",
    "AI recommendations",
    "Integrations",
    "Administration"
  ]) {
    assert.ok(html.includes(screen), `Expected dashboard screen: ${screen}`);
  }
  assert.match(html, /Quality over time/);
  assert.match(html, /aria-label="Pass rate across the last 3 analysis runs"/);
  assert.match(html, /72%/);
  assert.match(html, /GitHub Actions/);
  assert.match(html, /Jenkins/);
  assert.match(html, /50%/);
  assert.match(html, /unsafe &lt;script&gt;alert\(&#039;x&#039;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\('x'\)<\/script>/);
});

test("analysis history is bounded to the latest 30 real summaries", t => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "biso-history-")
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, "reports"), { recursive: true });

  const previousRuns = Array.from({ length: 30 }, (_, index) => ({
    generatedAt: `2026-10-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    total: 2,
    passed: 1,
    failed: 1,
    skipped: 0,
    passRate: 50
  }));
  fs.writeFileSync(
    path.join(directory, "reports/execution-history.json"),
    JSON.stringify(previousRuns)
  );

  const intelligence = {
    generatedAt: "2026-11-01T12:00:00.000Z",
    summary: {
      total: 5,
      passed: 4,
      failed: 1,
      skipped: 0,
      passRate: 80
    }
  };
  const script = `import { saveIntelligence } from ${JSON.stringify(
    pathToFileURL(store).href
  )}; saveIntelligence(${JSON.stringify(intelligence)});`;
  runNode(["--input-type=module", "-e", script], directory);

  const history = JSON.parse(
    fs.readFileSync(
      path.join(directory, "reports/execution-history.json"),
      "utf8"
    )
  );
  assert.equal(history.length, 30);
  assert.equal(history[0].generatedAt, previousRuns[1].generatedAt);
  assert.deepEqual(history.at(-1), {
    generatedAt: "2026-11-01T12:00:00.000Z",
    total: 5,
    passed: 4,
    failed: 1,
    skipped: 0,
    passRate: 80
  });
});
