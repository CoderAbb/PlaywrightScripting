import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  normalizeSpecPath,
  validateCoverage,
  validateRequirementDocument
} from "../graph/qaPipeline.mjs";

test("requirement analysis accepts mapped tests and rejects paths outside tests", () => {
  const document = {
    name: "smoke coverage",
    requirements: [
      {
        id: "REQ-1",
        description: "The homepage loads.",
        tests: [{ file: "tests/specs/demo.spec.ts", title: "hastitle @title" }]
      }
    ]
  };

  assert.equal(validateRequirementDocument(document).name, "smoke coverage");
  assert.throws(
    () => normalizeSpecPath("../package.json"),
    /inside tests/
  );
  assert.throws(
    () =>
      validateRequirementDocument({
        ...document,
        requirements: [{ ...document.requirements[0], tests: [{ file: "../package.json", title: "x" }] }]
      }),
    /inside tests/
  );
});

test("validation requires all browser executions for a mapped test to pass", () => {
  const plan = [
    {
      requirementId: "REQ-1",
      objective: "The home page loads.",
      file: "tests/specs/demo.spec.ts",
      title: "hastitle @title"
    },
    {
      requirementId: "REQ-2",
      objective: "The page has an installation guide.",
      file: "tests/specs/demo.spec.ts",
      title: "getstarted @link"
    }
  ];
  const results = [
    {
      file: "specs/demo.spec.ts",
      title: "hastitle @title",
      status: "passed",
      retryCount: 0,
      error: null
    },
    {
      file: "specs/demo.spec.ts",
      title: "hastitle @title",
      status: "failed",
      retryCount: 1,
      error: "timeout"
    }
  ];

  const coverage = validateCoverage(plan, results);
  assert.equal(coverage[0].status, "FAILED");
  assert.equal(coverage[0].retryCount, 1);
  assert.equal(coverage[1].status, "MISSING");
  assert.equal(path.basename(coverage[0].file), "demo.spec.ts");
});
