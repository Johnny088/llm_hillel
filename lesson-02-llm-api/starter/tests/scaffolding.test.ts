import { describe, expect, it } from "vitest";
import { loadEnvironment } from "../src/config/env.js";
import { resolveModel } from "../src/config/models.js";
import { calculateCost } from "../src/config/pricing.js";
import { calculateCacheHitRate, extractUsageMetrics } from "../src/lib/metrics.js";
import { DocumentRequestSchema, MAX_DOCUMENT_CHARACTERS } from "../src/schemas/document-request.js";
import { ExtractionSchema } from "../src/schemas/extraction.js";

const requiredEnvironment = {
  OPENAI_API_KEY: "test-only-key",
  OPENAI_MODEL_FAST: "test-fast",
  OPENAI_MODEL_MAIN: "test-main",
};

describe("Lesson 02 (OpenAI) starter — ready scaffolding", () => {
  it("validates environment defaults and centralizes model routing", () => {
    const environment = loadEnvironment(requiredEnvironment);

    expect(environment).toMatchObject({
      OPENAI_TIMEOUT_MS: 30_000,
      OPENAI_MAX_OUTPUT_TOKENS: 800,
      PORT: 3_000,
    });
    expect(resolveModel("fast", environment)).toBe("test-fast");
    expect(resolveModel("main", environment)).toBe("test-main");
    expect(() =>
      loadEnvironment({
        OPENAI_API_KEY: "secret-value-that-must-not-leak",
        OPENAI_MODEL_FAST: "",
      }),
    ).toThrow("OPENAI_MODEL_FAST, OPENAI_MODEL_MAIN");
  });

  it("keeps request and extraction schemas strict", () => {
    expect(DocumentRequestSchema.parse({ content: "  Документ  " })).toEqual({
      content: "Документ",
    });
    expect(DocumentRequestSchema.safeParse({ content: "Документ", extra: true }).success).toBe(
      false,
    );
    expect(
      DocumentRequestSchema.safeParse({ content: "x".repeat(MAX_DOCUMENT_CHARACTERS + 1) }).success,
    ).toBe(false);
    expect(
      ExtractionSchema.safeParse({ names: [], dates: [], summary: "Без locations." }).success,
    ).toBe(false);
  });

  it("normalizes usage and bounds cache metrics", () => {
    expect(
      extractUsageMetrics({
        input_tokens: 100,
        output_tokens: 20,
        input_tokens_details: { cached_tokens: 80, cache_write_tokens: 80 },
      }),
    ).toEqual({
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
      cachedTokens: 80,
      cacheWriteTokens: 20,
    });
    expect(calculateCacheHitRate(100, 200)).toBe(1);
  });

  it("calculates configured cost without double-counting cached tokens", () => {
    const result = calculateCost(
      "test-main",
      {
        inputTokens: 1_000,
        outputTokens: 500,
        totalTokens: 1_500,
        cachedTokens: 200,
        cacheWriteTokens: 100,
      },
      {
        "test-main": {
          inputCostPerMillion: 10,
          cachedInputCostPerMillion: 1,
          cacheWriteCostPerMillion: 12.5,
          outputCostPerMillion: 20,
        },
      },
    );

    expect(result.estimatedCostUsd).toBeCloseTo(0.01845, 8);
  });

  it("reports unavailable pricing instead of a fake zero", () => {
    expect(
      calculateCost("missing", {
        inputTokens: 100,
        outputTokens: 10,
        totalTokens: 110,
        cachedTokens: 0,
        cacheWriteTokens: 0,
      }),
    ).toEqual({
      estimatedCostUsd: null,
      pricingAvailable: false,
      pricingUnavailableReason: "MODEL_NOT_CONFIGURED",
    });
  });
});
