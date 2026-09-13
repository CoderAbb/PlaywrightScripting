
import {
  loadResults,
  flattenTests
} from "../graph/intelligence/result-parser.mjs";

import {
  classifyFailure
} from "../graph/intelligence/failure-classifier.mjs";

import {
  saveIntelligence
} from "../graph/intelligence/intelligence-store.mjs";

import {
  failureRcaGraph
} from "../graph/failureRcaAgent.mjs";


// --------------------------------------------------
// 1. Load Playwright JSON results
// --------------------------------------------------

const results = loadResults();


// --------------------------------------------------
// 2. Normalize Playwright tests
// --------------------------------------------------

const tests = flattenTests(results);


// --------------------------------------------------
// 3. Classify every test
// --------------------------------------------------

const analyzedTests = tests.map(test => {

  const failure = classifyFailure(test);

  return {
    ...test,

    failureCategory: failure.category,

    failureConfidence: failure.confidence
  };

});


// --------------------------------------------------
// 4. Calculate test statistics FIRST
// --------------------------------------------------

const failed = analyzedTests.filter(
  test => test.status === "failed"
);

const passed = analyzedTests.filter(
  test => test.status === "passed"
);

const skipped = analyzedTests.filter(
  test => test.status === "skipped"
);


// --------------------------------------------------
// 5. Identify retry / flaky candidates
// --------------------------------------------------

const flakyCandidates = analyzedTests.filter(
  test => test.retryCount > 0
);


// --------------------------------------------------
// 6. AI Failure RCA
// --------------------------------------------------

const rcaResults = [];

for (const test of failed) {

  const classification = classifyFailure(test);

  try {

    const result =
      await failureRcaGraph.invoke({

        test,

        classification

      });


    rcaResults.push({

      test: test.title,

      file: test.file,

      category: classification.category,

      confidence: classification.confidence,

      diagnosis:
        result.diagnosis ||
        "No diagnosis available",

      recommendation:
        result.recommendation ||
        "Manual investigation required",

      error: test.error

    });

  } catch (error) {

    console.error(
      `RCA failed for ${test.title}:`,
      error.message
    );


    // Do not allow one RCA failure
    // to stop the complete analysis.

    rcaResults.push({

      test: test.title,

      file: test.file,

      category: classification.category,

      confidence: classification.confidence,

      diagnosis:
        "RCA agent execution failed",

      recommendation:
        "Review Playwright trace and error manually",

      error: test.error

    });

  }

}


// --------------------------------------------------
// 7. Build intelligence report
// --------------------------------------------------

const total =
  analyzedTests.length;

const passRate =
  total > 0
    ? Number(
        (
          (passed.length / total) *
          100
        ).toFixed(2)
      )
    : 0;


const intelligence = {

  generatedAt:
    new Date().toISOString(),


  summary: {

    total,

    passed:
      passed.length,

    failed:
      failed.length,

    skipped:
      skipped.length,

    flakyCandidates:
      flakyCandidates.length,

    passRate

  },


  // AI RCA results

  failures:
    rcaResults,


  // Retry / flaky candidates

  flakyCandidates:
    flakyCandidates,


  // Complete test inventory

  tests:
    analyzedTests

};


// --------------------------------------------------
// 8. Persist intelligence.json
// --------------------------------------------------

saveIntelligence(
  intelligence
);


// --------------------------------------------------
// 9. Console summary
// --------------------------------------------------

console.log(
  "\n========================================"
);

console.log(
  "AI TEST INTELLIGENCE"
);

console.log(
  "========================================"
);

console.log(
  `Total Tests       : ${total}`
);

console.log(
  `Passed            : ${passed.length}`
);

console.log(
  `Failed            : ${failed.length}`
);

console.log(
  `Skipped           : ${skipped.length}`
);

console.log(
  `Flaky Candidates  : ${flakyCandidates.length}`
);

console.log(
  `Pass Rate         : ${passRate}%`
);

console.log(
  `AI RCA Results    : ${rcaResults.length}`
);

console.log(
  "========================================\n"
);
