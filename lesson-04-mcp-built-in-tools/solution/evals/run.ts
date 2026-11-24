import { mcpToolEvalCases } from "./mcp-tools.eval.js";
import { recordedMcpToolResults } from "./recorded-results.js";
import { scoreMcpToolCase } from "./scorer.js";

const observationsById = new Map(
  recordedMcpToolResults.map((observation) => [observation.id, observation]),
);
const scores = mcpToolEvalCases.map((evalCase) => {
  const observation = observationsById.get(evalCase.id);

  if (!observation) {
    return {
      id: evalCase.id,
      passed: false,
      reasons: ["Відсутнє записане спостереження."],
    };
  }

  return scoreMcpToolCase(evalCase, observation);
});

for (const score of scores) {
  const details = score.reasons.length === 0 ? "" : ` — ${score.reasons.join(" ")}`;
  console.log(`${score.passed ? "PASS" : "FAIL"} ${score.id}${details}`);
}

const passed = scores.filter((score) => score.passed).length;
const averageLatencyMs =
  recordedMcpToolResults.reduce((sum, observation) => sum + observation.latencyMs, 0) /
  recordedMcpToolResults.length;

console.log(`Result: ${passed}/${scores.length}`);
console.log(`Average latency: ${Math.round(averageLatencyMs)}ms`);

if (passed !== scores.length) {
  process.exitCode = 1;
}
