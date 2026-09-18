import { StateGraph, Annotation } from "@langchain/langgraph";

/**
 * flakyTestAgent.mjs
 *
 * Sits next to failureRcaAgent.mjs and follows the same shape: a single
 * routing node that turns evidence into a diagnosis, with no external API
 * calls (so `npm run flaky` works with zero config, same as `npm run
 * analyze`). Input is one test's aggregated flakiness evidence — built by
 * scripts/detect-flaky-tests.mjs from the current run plus
 * reports/flaky-history.json — output is a category + confidence +
 * recommendation a human can act on.
 */

const FlakyState = Annotation.Root({
  test: Annotation(),
  evidence: Annotation(),
  category: Annotation(),
  confidence: Annotation(),
  recommendation: Annotation()
});

async function classifyFlakiness(state) {
  const { evidence } = state;

  const {
    intraRunRetries = 0,
    interRunFailRate = 0,
    runsObserved = 0,
    errorSignatures = [],
    durationVarianceMs = 0
  } = evidence || {};

  const errors = errorSignatures.join(" ").toLowerCase();

  let category = "UNCLASSIFIED";
  let confidence = 0.5;
  let recommendation = "Re-run in isolation to confirm before triaging further.";

  const notEnoughData = runsObserved < 2 && intraRunRetries === 0;

  if (notEnoughData) {
    category = "INSUFFICIENT_DATA";
    confidence = 0.3;
    recommendation =
      "Only one run observed so far — let this test accumulate a few more CI runs before acting on it.";
  } else if (
    errors.includes("econnrefused") ||
    errors.includes("network") ||
    errors.includes("502") ||
    errors.includes("503")
  ) {
    category = "NETWORK_DEPENDENT";
    confidence = 0.85;
    recommendation =
      "Failures correlate with network/backend errors. Add a retry-with-backoff around the request or stub the dependency rather than retrying the whole test.";
  } else if (
    errors.includes("strict mode") ||
    (errors.includes("resolved to") && errors.includes("elements"))
  ) {
    category = "RACE_CONDITION";
    confidence = 0.82;
    recommendation =
      "Multiple elements matched intermittently — the DOM is still settling when the locator runs. Wait on a more specific, stable state before interacting.";
  } else if (errors.includes("timeout") || errors.includes("waiting for")) {
    if (durationVarianceMs > 3000) {
      category = "TIMING_SENSITIVE";
      confidence = 0.78;
      recommendation =
        "Duration swings widely across runs alongside timeouts — this looks like a race against app/animation timing rather than a broken locator. Replace fixed waits with condition-based waits.";
    } else {
      category = "ENVIRONMENTAL";
      confidence = 0.6;
      recommendation =
        "Consistent timeouts with stable duration suggest CI resource contention (workers, runner load) rather than app behavior. Try isolating the test or raising its timeout before rewriting it.";
    }
  } else if (intraRunRetries > 0 && interRunFailRate === 0) {
    category = "RACE_CONDITION";
    confidence = 0.7;
    recommendation =
      "Passes on retry within the same run every time — classic race condition. Look for a missing awaited state change right before the failing step.";
  } else if (interRunFailRate >= 0.5) {
    category = "TRUE_BUG";
    confidence = 0.75;
    recommendation =
      "Fails as often as it passes across runs — this is not flakiness, it's an intermittent but real bug or unstable test data. Do not quarantine without also filing an issue.";
  } else if (interRunFailRate > 0) {
    category = "TEST_ISOLATION";
    confidence = 0.65;
    recommendation =
      "Fails a minority of runs with no clear timing/network signature — check for shared state leaking between tests (auth session, cart contents, test data) rather than the test itself.";
  }

  return {
    ...state,
    category,
    confidence,
    recommendation
  };
}

const graph = new StateGraph(FlakyState)
  .addNode("classifyFlakiness", classifyFlakiness)
  .addEdge("__start__", "classifyFlakiness")
  .addEdge("classifyFlakiness", "__end__");

export const flakyTestGraph = graph.compile();
