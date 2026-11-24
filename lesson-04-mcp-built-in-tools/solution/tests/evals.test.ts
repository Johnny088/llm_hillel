import { describe, expect, it } from "vitest";
import { mcpToolEvalCases } from "../evals/mcp-tools.eval.js";
import { recordedMcpToolResults } from "../evals/recorded-results.js";
import { scoreMcpToolCase } from "../evals/scorer.js";

describe("Lesson 04 MCP routing evals", () => {
  it("містить два MCP, два web і один refusal сценарій", () => {
    expect(mcpToolEvalCases).toHaveLength(5);
    expect(new Set(mcpToolEvalCases.map((evalCase) => evalCase.id)).size).toBe(5);
    expect(mcpToolEvalCases.map((evalCase) => evalCase.expectedTool)).toEqual([
      "read_text_file",
      "read_text_file",
      "web_search",
      "web_search",
      "read_text_file",
    ]);
    expect(mcpToolEvalCases.filter((evalCase) => evalCase.expected?.shouldRefuse)).toHaveLength(1);
  });

  it("проходить deterministic recorded replay", () => {
    const observationsById = new Map(
      recordedMcpToolResults.map((observation) => [observation.id, observation]),
    );
    const scores = mcpToolEvalCases.map((evalCase) => {
      const observation = observationsById.get(evalCase.id);

      if (!observation) {
        throw new Error(`Відсутнє спостереження для ${evalCase.id}.`);
      }

      return scoreMcpToolCase(evalCase, observation);
    });

    expect(scores.every((score) => score.passed)).toBe(true);
  });
});
