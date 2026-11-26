import { describe, expect, it } from "vitest";

import { extractionEvalCases } from "../evals/extraction.eval.js";

import { mcpToolEvalCases } from "../evals/mcp-tools.eval.js";
import { longTermMemoryEvalCases, memoryEvalCases } from "../evals/memory.eval.js";
import {
  recordedLongTermMemoryResults,
  recordedMemoryResults,
  recordedMcpToolResults,
  recordedResults,
} from "../evals/recorded-results.js";
import {
  scoreExtraction,
  scoreLongTermMemoryCase,
  scoreMemoryCase,
  scoreMcpToolCase,
} from "../evals/scorer.js";

describe("Lesson 05 OpenRouter memory evals", () => {
  it("містить п’ять унікальних сценаріїв для двох механізмів стану", () => {
    expect(memoryEvalCases).toHaveLength(5);
    expect(new Set(memoryEvalCases.map((evalCase) => evalCase.id)).size).toBe(5);
    expect(memoryEvalCases.filter((evalCase) => evalCase.expected.mode === "session")).toHaveLength(
      3,
    );
    expect(
      memoryEvalCases.filter((evalCase) => evalCase.expected.mode === "conversation"),
    ).toHaveLength(2);
    expect(memoryEvalCases.every((evalCase) => evalCase.expected.windowingEnabled)).toBe(true);
  });

  it("містить п’ять Long-term Memory сценаріїв з позитивними й негативними кейсами", () => {
    expect(longTermMemoryEvalCases.map((evalCase) => evalCase.id)).toEqual([
      "in-session-recall",
      "session-reset",
      "long-term-persistence",
      "no-false-tool-invocation",
      "sensitive-data-refusal",
    ]);
    expect(
      longTermMemoryEvalCases.find((evalCase) => evalCase.id === "long-term-persistence")?.expected
        .persistsUserFact,
    ).toBe(true);
    expect(
      longTermMemoryEvalCases.find((evalCase) => evalCase.id === "sensitive-data-refusal")?.expected
        .refusesSensitiveData,
    ).toBe(true);
  });

  it("проходить deterministic recorded replay", () => {
    const observationsById = new Map(
      recordedMemoryResults.map((observation) => [observation.id, observation]),
    );
    const scores = memoryEvalCases.map((evalCase) => {
      const observation = observationsById.get(evalCase.id);
      if (!observation) throw new Error(`Відсутнє спостереження для ${evalCase.id}.`);
      return scoreMemoryCase(evalCase, observation);
    });
    const longTermObservationsById = new Map(
      recordedLongTermMemoryResults.map((observation) => [observation.id, observation]),
    );
    const longTermScores = longTermMemoryEvalCases.map((evalCase) => {
      const observation = longTermObservationsById.get(evalCase.id);
      if (!observation) throw new Error(`Відсутнє спостереження для ${evalCase.id}.`);
      return scoreLongTermMemoryCase(evalCase, observation);
    });

    expect(scores.every((score) => score.passed)).toBe(true);
    expect(longTermScores.every((score) => score.passed)).toBe(true);
  });
});

describe("Lesson 04 MCP routing evals (OpenRouter)", () => {
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

describe("inherited extraction evals", () => {
  it("contains five stable and tagged cases", () => {
    expect(extractionEvalCases).toHaveLength(5);
    expect(new Set(extractionEvalCases.map((testCase) => testCase.id)).size).toBe(5);
    expect(extractionEvalCases.every((testCase) => testCase.tags && testCase.tags.length > 0)).toBe(
      true,
    );
  });

  it("passes every deterministic recorded observation", () => {
    for (const testCase of extractionEvalCases) {
      const expected = testCase.expected;
      const actual = recordedResults[testCase.id];

      expect(expected).toBeDefined();
      expect(actual).toBeDefined();

      if (!expected || !actual) {
        continue;
      }

      expect(scoreExtraction(testCase.input, actual, expected)).toEqual({
        passed: true,
        reasons: [],
      });
    }
  });

  it("compares entity arrays without depending on order", () => {
    const testCase = extractionEvalCases[0];

    expect(testCase?.expected).toBeDefined();

    if (!testCase?.expected) {
      return;
    }

    const actual = {
      ...testCase.expected.extraction,
      names: [...testCase.expected.extraction.names].reverse(),
      dates: [...testCase.expected.extraction.dates].reverse(),
      locations: [...testCase.expected.extraction.locations].reverse(),
    };

    expect(scoreExtraction(testCase.input, actual, testCase.expected).passed).toBe(true);
  });

  it("requires exact entity spelling in the input and expected values", () => {
    const testCase = extractionEvalCases[0];

    expect(testCase?.expected).toBeDefined();

    if (!testCase?.expected) {
      return;
    }

    const actual = {
      ...testCase.expected.extraction,
      names: [testCase.expected.extraction.names[0]?.toLocaleUpperCase("uk-UA") ?? ""],
    };
    const score = scoreExtraction(testCase.input, actual, testCase.expected);

    expect(score.passed).toBe(false);
    expect(score.reasons).toContain("names_mismatch");
    expect(score.reasons).toContain("names_not_in_input");
  });
  it("detects hallucinated entities and missing summary facts", () => {
    const testCase = extractionEvalCases[0];

    expect(testCase?.expected).toBeDefined();

    if (!testCase?.expected) {
      return;
    }

    const score = scoreExtraction(
      testCase.input,
      {
        names: ["Вигадане Ім'я"],
        dates: testCase.expected.extraction.dates,
        locations: testCase.expected.extraction.locations,
        summary: "Занадто загальний підсумок.",
      },
      testCase.expected,
    );

    expect(score.passed).toBe(false);
    expect(score.reasons).toContain("names_mismatch");
    expect(score.reasons).toContain("names_not_in_input");
    expect(score.reasons.some((reason) => reason.startsWith("summary_missing:"))).toBe(true);
  });
});
