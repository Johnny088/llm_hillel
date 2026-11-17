import { describe, expect, it } from "vitest";
import { extractionEvalCases } from "../evals/extraction.eval.js";
import { recordedResults } from "../evals/recorded-results.js";
import { scoreExtraction } from "../evals/scorer.js";

describe("extraction eval suite", () => {
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
