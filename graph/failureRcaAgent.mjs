import { StateGraph, Annotation } from "@langchain/langgraph";

const RCAState = Annotation.Root({
  test: Annotation(),
  classification: Annotation(),
  diagnosis: Annotation(),
  recommendation: Annotation()
});

async function analyzeFailure(state) {
  const {
    test,
    classification
  } = state;

  let diagnosis = "Unknown failure";
  let recommendation = "Manual investigation required";

  switch (classification.category) {

    case "LOCATOR":
      diagnosis =
        "The test likely failed because the locator no longer matches the application DOM.";

      recommendation =
        "Inspect the locator and prefer getByRole(), getByTestId(), or another stable user-facing locator.";

      break;

    case "TIMEOUT":
      diagnosis =
        "The expected element or application state was not reached within the configured timeout.";

      recommendation =
        "Inspect application readiness, locator stability, network dependencies and synchronization.";

      break;

    case "ASSERTION":
      diagnosis =
        "The application returned a value different from the expected test state.";

      recommendation =
        "Validate test data, application behavior and assertion expectations.";

      break;

    case "NETWORK":
      diagnosis =
        "The failure appears to originate from a network/API dependency.";

      recommendation =
        "Inspect request/response details, HTTP status, backend availability and network trace.";

      break;
  }

  return {
    ...state,
    diagnosis,
    recommendation
  };
}

const graph = new StateGraph(RCAState)
  .addNode("analyzeFailure", analyzeFailure)
  .addEdge("__start__", "analyzeFailure")
  .addEdge("analyzeFailure", "__end__");

export const failureRcaGraph =
  graph.compile();