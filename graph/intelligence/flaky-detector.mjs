export function calculateFlakyScore(history) {
  if (!history || history.length < 3) {
    return 0;
  }

  const statuses = history.map(x => x.status);

  const passed = statuses.filter(
    x => x === "passed"
  ).length;

  const failed = statuses.filter(
    x => x === "failed"
  ).length;

  if (passed === 0 || failed === 0) {
    return 0;
  }

  const transitions = statuses.filter(
    (status, index) =>
      index > 0 &&
      status !== statuses[index - 1]
  ).length;

  const transitionRate =
    transitions / (statuses.length - 1);

  const failureRate =
    failed / statuses.length;

  return Number(
    ((transitionRate * 0.6) + (failureRate * 0.4)).toFixed(2)
  );
}

export function isFlaky(score) {
  return score >= 0.35;
}