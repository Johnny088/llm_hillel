import { describe, expect, it } from "vitest";
import { loadEnvironment } from "../src/config/env.js";
import { resolveModel } from "../src/config/models.js";
import { DEFAULT_OPENROUTER_MODEL } from "../src/config/openrouter.js";
import { calculateCost } from "../src/config/pricing.js";
import { calculateCacheHitRate, extractUsageMetrics } from "../src/lib/metrics.js";
import { DocumentRequestSchema, MAX_DOCUMENT_CHARACTERS } from "../src/schemas/document-request.js";
import { ExtractionSchema } from "../src/schemas/extraction.js";

const requiredEnvironment = {
  OPENROUTER_API_KEY: "test-only-key",
  OPENROUTER_MODEL_FAST: "test-fast",
  OPENROUTER_MODEL_MAIN: "test-main",
};

describe("environment and model routing", () => {
  it("coerces numeric values and applies documented defaults", () => {
    expect(loadEnvironment(requiredEnvironment)).toEqual({
      ...requiredEnvironment,
      OPENROUTER_REASONING_EFFORT: "low",
      OPENROUTER_TIMEOUT_MS: 30_000,
      OPENROUTER_MAX_OUTPUT_TOKENS: 1_600,
      PORT: 3_000,
    });

    expect(
      loadEnvironment({
        ...requiredEnvironment,
        OPENROUTER_TIMEOUT_MS: "45000",
        OPENROUTER_MAX_OUTPUT_TOKENS: "1200",
        OPENROUTER_REASONING_EFFORT: "low",
        PORT: "3100",
      }),
    ).toMatchObject({
      OPENROUTER_TIMEOUT_MS: 45_000,
      OPENROUTER_MAX_OUTPUT_TOKENS: 1_200,
      OPENROUTER_REASONING_EFFORT: "low",
      PORT: 3_100,
    });
  });

  it("uses OPENROUTER_MODEL as the base model for both roles", () => {
    const environment = loadEnvironment({
      OPENROUTER_API_KEY: "test-only-key",
      OPENROUTER_MODEL: DEFAULT_OPENROUTER_MODEL,
    });

    expect(resolveModel("fast", environment)).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(resolveModel("main", environment)).toBe(DEFAULT_OPENROUTER_MODEL);
  });

  it("treats blank optional model overrides from .env.example as absent", () => {
    const environment = loadEnvironment({
      OPENROUTER_API_KEY: "test-only-key",
      OPENROUTER_MODEL: DEFAULT_OPENROUTER_MODEL,
      OPENROUTER_MODEL_FAST: "",
      OPENROUTER_MODEL_MAIN: "   ",
    });

    expect(environment.OPENROUTER_MODEL_FAST).toBeUndefined();
    expect(environment.OPENROUTER_MODEL_MAIN).toBeUndefined();
    expect(resolveModel("fast", environment)).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(resolveModel("main", environment)).toBe(DEFAULT_OPENROUTER_MODEL);
  });

  it("rejects unsupported reasoning efforts", () => {
    expect(() =>
      loadEnvironment({
        ...requiredEnvironment,
        OPENROUTER_REASONING_EFFORT: "extreme",
      }),
    ).toThrow("OPENROUTER_REASONING_EFFORT");
  });

  it("reports only invalid field names and never leaks values", () => {
    expect(() =>
      loadEnvironment({
        OPENROUTER_API_KEY: "secret-value-that-must-not-leak",
        OPENROUTER_REASONING_EFFORT: "extreme",
      }),
    ).toThrow("OPENROUTER_REASONING_EFFORT");

    try {
      loadEnvironment({
        OPENROUTER_API_KEY: "secret-value-that-must-not-leak",
        OPENROUTER_REASONING_EFFORT: "extreme",
      });
    } catch (error) {
      expect(String(error)).not.toContain("secret-value-that-must-not-leak");
    }
  });

  it("routes fast and main tasks through centralized configuration", () => {
    const environment = loadEnvironment(requiredEnvironment);

    expect(resolveModel("fast", environment)).toBe("test-fast");
    expect(resolveModel("main", environment)).toBe("test-main");
  });
});

describe("request and extraction schemas", () => {
  it("trims content, rejects unknown fields and enforces the size limit", () => {
    expect(DocumentRequestSchema.parse({ content: "  Документ  " })).toEqual({
      content: "Документ",
    });
    expect(DocumentRequestSchema.safeParse({ content: "Документ", extra: true }).success).toBe(
      false,
    );
    expect(
      DocumentRequestSchema.safeParse({
        content: "x".repeat(MAX_DOCUMENT_CHARACTERS + 1),
      }).success,
    ).toBe(false);
  });

  it("keeps every extraction field required and rejects extras", () => {
    const extraction = {
      names: [],
      dates: [],
      locations: [],
      summary: "Короткий підсумок.",
    };

    expect(ExtractionSchema.parse(extraction)).toEqual(extraction);
    expect(ExtractionSchema.safeParse({ ...extraction, confidence: 0.9 }).success).toBe(false);
    expect(
      ExtractionSchema.safeParse({
        names: [],
        dates: [],
        summary: "Без locations.",
      }).success,
    ).toBe(false);
  });
});

describe("usage and cost metrics", () => {
  it("normalizes usage and prevents cache counters from exceeding input tokens", () => {
    expect(
      extractUsageMetrics({
        input_tokens: 100,
        output_tokens: 20,
        total_tokens: 120,
        input_tokens_details: {
          cached_tokens: 80,
          cache_write_tokens: 80,
        },
      }),
    ).toEqual({
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
      cachedTokens: 80,
      cacheWriteTokens: 20,
    });

    expect(
      extractUsageMetrics({
        input_tokens: 10,
        output_tokens: 5,
      }),
    ).toMatchObject({ totalTokens: 15 });

    expect(
      extractUsageMetrics({
        input_tokens: 100,
        output_tokens: 20,
        total_tokens: 120,
        input_tokens_details: null,
      }),
    ).toMatchObject({ cachedTokens: 0, cacheWriteTokens: 0 });
  });

  it("calculates cache hit rate defensively", () => {
    expect(calculateCacheHitRate(1_000, 250)).toBe(0.25);
    expect(calculateCacheHitRate(0, 10)).toBe(0);
    expect(calculateCacheHitRate(100, 200)).toBe(1);
  });

  it("calculates cost without double-counting cached or cache-write tokens", () => {
    const usage = {
      inputTokens: 1_000,
      outputTokens: 500,
      totalTokens: 1_500,
      cachedTokens: 200,
      cacheWriteTokens: 100,
    };

    const result = calculateCost("test-main", usage, {
      "test-main": {
        inputCostPerMillion: 10,
        cachedInputCostPerMillion: 1,
        cacheWriteCostPerMillion: 12.5,
        outputCostPerMillion: 20,
      },
    });

    expect(result.pricingAvailable).toBe(true);
    expect(result.estimatedCostUsd).toBeCloseTo(0.01845, 8);
  });

  it("uses the registered DeepSeek price", () => {
    const usage = {
      inputTokens: 1_000,
      outputTokens: 500,
      totalTokens: 1_500,
      cachedTokens: 0,
      cacheWriteTokens: 0,
    };

    const defaultModelCost = calculateCost(DEFAULT_OPENROUTER_MODEL, usage);

    expect(defaultModelCost.pricingAvailable).toBe(true);
    expect(defaultModelCost.estimatedCostUsd).toBeCloseTo(0.0001934, 10);
  });

  it("prefers the exact cost reported by OpenRouter for a resolved alias target", () => {
    const usage = {
      inputTokens: 385,
      outputTokens: 262,
      totalTokens: 647,
      cachedTokens: 256,
      cacheWriteTokens: 0,
    };

    expect(calculateCost("deepseek/deepseek-v4-flash-0731", usage, {}, 0.000025312)).toEqual({
      estimatedCostUsd: 0.000025312,
      pricingAvailable: true,
    });
  });

  it("returns an explicit unavailable state for incomplete pricing", () => {
    const usage = {
      inputTokens: 100,
      outputTokens: 10,
      totalTokens: 110,
      cachedTokens: 20,
      cacheWriteTokens: 0,
    };

    expect(calculateCost("missing", usage)).toEqual({
      estimatedCostUsd: null,
      pricingAvailable: false,
      pricingUnavailableReason: "MODEL_NOT_CONFIGURED",
    });
    expect(
      calculateCost("test", usage, {
        test: {
          inputCostPerMillion: 10,
          outputCostPerMillion: 20,
        },
      }),
    ).toMatchObject({
      pricingAvailable: false,
      pricingUnavailableReason: "CACHED_INPUT_PRICE_MISSING",
    });
    expect(
      calculateCost(
        "test",
        { ...usage, cachedTokens: 0, cacheWriteTokens: 20 },
        {
          test: {
            inputCostPerMillion: 10,
            outputCostPerMillion: 20,
          },
        },
      ),
    ).toMatchObject({
      pricingAvailable: false,
      pricingUnavailableReason: "CACHE_WRITE_PRICE_MISSING",
    });
  });
});
