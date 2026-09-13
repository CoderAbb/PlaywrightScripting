export function classifyFailure(test) {
  if (!test.error) {
    return {
      category: "UNKNOWN",
      confidence: 0
    };
  }

  const error = test.error.toLowerCase();

  if (
    error.includes("timeout") ||
    error.includes("waiting for")
  ) {
    return {
      category: "TIMEOUT",
      confidence: 0.92
    };
  }

  if (
    error.includes("locator") ||
    error.includes("strict mode") ||
    error.includes("element")
  ) {
    return {
      category: "LOCATOR",
      confidence: 0.95
    };
  }

  if (
    error.includes("expect") ||
    error.includes("received") ||
    error.includes("expected")
  ) {
    return {
      category: "ASSERTION",
      confidence: 0.94
    };
  }

  if (
    error.includes("network") ||
    error.includes("response") ||
    error.includes("econnrefused") ||
    error.includes("500") ||
    error.includes("502") ||
    error.includes("503")
  ) {
    return {
      category: "NETWORK",
      confidence: 0.90
    };
  }

  return {
    category: "UNKNOWN",
    confidence: 0.50
  };
}