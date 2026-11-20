import { describe, expect, it } from "vitest";
import { recordedToolResults } from "../evals/recorded-tool-results.js";
import { classifyTextResponse, scoreToolCallingCase } from "../evals/tool-calling-scorer.js";
import { toolCallingEvalCases } from "../evals/tool-calling.eval.js";

describe("Lesson 03 tool-calling evals", () => {
  it("містить п’ять обов’язкових і унікальних сценаріїв", () => {
    expect(toolCallingEvalCases).toHaveLength(5);
    expect(new Set(toolCallingEvalCases.map((evalCase) => evalCase.id)).size).toBe(5);
    expect(toolCallingEvalCases.map((evalCase) => evalCase.expectedMode)).toEqual([
      "tool",
      "tool",
      "clarification",
      "tool",
      "direct",
    ]);
  });

  it("проходить deterministic recorded replay", () => {
    const observationsById = new Map(
      recordedToolResults.map((observation) => [observation.id, observation]),
    );
    const scores = toolCallingEvalCases.map((evalCase) => {
      const observation = observationsById.get(evalCase.id);

      if (!observation) {
        throw new Error(`Відсутнє спостереження для ${evalCase.id}.`);
      }

      return scoreToolCallingCase(evalCase, observation);
    });

    expect(scores.every((score) => score.passed)).toBe(true);
  });

  it("відрізняє уточнення від прямої відповіді без tool call", () => {
    expect(classifyTextResponse("Уточніть, будь ласка, у яку валюту конвертувати?")).toBe(
      "clarification",
    );
    expect(classifyTextResponse("Париж — столиця Франції.")).toBe("direct");
  });
});
