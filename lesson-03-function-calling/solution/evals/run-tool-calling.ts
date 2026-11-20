import { recordedToolResults } from "./recorded-tool-results.js";
import { scoreToolCallingCase } from "./tool-calling-scorer.js";
import { toolCallingEvalCases } from "./tool-calling.eval.js";

const observationsById = new Map(
  recordedToolResults.map((observation) => [observation.id, observation]),
);
const scores = toolCallingEvalCases.map((evalCase) => {
  const observation = observationsById.get(evalCase.id);

  if (!observation) {
    return {
      id: evalCase.id,
      passed: false,
      reasons: ["Відсутнє записане спостереження."],
    };
  }

  return scoreToolCallingCase(evalCase, observation);
});

for (const score of scores) {
  const details = score.reasons.length === 0 ? "" : ` — ${score.reasons.join(" ")}`;
  console.log(`${score.passed ? "PASS" : "FAIL"} ${score.id}${details}`);
}

const passed = scores.filter((score) => score.passed).length;
const total = scores.length;
const successRate = total === 0 ? 0 : (passed / total) * 100;
const averageLatencyMs =
  recordedToolResults.reduce((sum, observation) => sum + observation.latencyMs, 0) /
  recordedToolResults.length;
const totals = recordedToolResults.reduce(
  (accumulator, observation) => ({
    modelCallCount: accumulator.modelCallCount + observation.modelCallCount,
    toolCallCount: accumulator.toolCallCount + observation.toolCallCount,
    retryCount: accumulator.retryCount + observation.retryCount,
    inputTokens: accumulator.inputTokens + observation.inputTokens,
    outputTokens: accumulator.outputTokens + observation.outputTokens,
  }),
  {
    modelCallCount: 0,
    toolCallCount: 0,
    retryCount: 0,
    inputTokens: 0,
    outputTokens: 0,
  },
);

console.log(`Result: ${passed}/${total}`);
console.log(`Success rate: ${successRate.toFixed(1)}%`);
console.log(`Average latency: ${Math.round(averageLatencyMs)}ms`);
console.log(
  `Calls: model=${totals.modelCallCount}, tool=${totals.toolCallCount}, retry=${totals.retryCount}`,
);
console.log(
  `Token usage: input=${totals.inputTokens}, output=${totals.outputTokens}, total=${
    totals.inputTokens + totals.outputTokens
  }`,
);

if (passed !== total) {
  process.exitCode = 1;
}
