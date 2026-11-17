import { describe, expect, it } from "vitest";
import { loadEnvironment } from "../src/config/env.js";
import {
  CONSERVATIVE_CAPABILITIES,
  resolveModelCapabilities,
} from "../src/config/model-capabilities.js";
import { resolveModel } from "../src/config/models.js";
import { DEFAULT_OPENROUTER_MODEL } from "../src/config/openrouter.js";
import { calculateCost } from "../src/config/pricing.js";
import { calculateCacheHitRate, extractUsageMetrics } from "../src/lib/metrics.js";
import { DocumentRequestSchema, MAX_DOCUMENT_CHARACTERS } from "../src/schemas/document-request.js";
import { ExtractionSchema } from "../src/schemas/extraction.js";

describe("Lesson 02 (OpenRouter) starter — ready scaffolding", () => {
  it("validates defaults and centralizes model routing", () => {
    const environment = loadEnvironment({ OPENROUTER_API_KEY: "test-only-key" });

    expect(resolveModel("fast", environment)).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(resolveModel("main", environment)).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(environment.OPENROUTER_REASONING_EFFORT).toBe("low");
    expect(environment.OPENROUTER_MAX_OUTPUT_TOKENS).toBe(1_600);
  });

  it("keeps provider capabilities explicit and unknown models conservative", () => {
    expect(resolveModelCapabilities(DEFAULT_OPENROUTER_MODEL)).toMatchObject({
      responseFormat: true,
      reasoning: true,
      reasoningEfforts: ["max", "high", "low"],
    });
    expect(resolveModelCapabilities("unregistered/model")).toBe(CONSERVATIVE_CAPABILITIES);
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

  it("calculates configured cost and reports unknown pricing explicitly", () => {
    const usage = {
      inputTokens: 1_000,
      outputTokens: 500,
      totalTokens: 1_500,
      cachedTokens: 0,
      cacheWriteTokens: 0,
    };

    expect(
      calculateCost("test-main", usage, {
        "test-main": { inputCostPerMillion: 10, outputCostPerMillion: 20 },
      }).estimatedCostUsd,
    ).toBeCloseTo(0.02, 8);
    expect(calculateCost("missing", usage)).toEqual({
      estimatedCostUsd: null,
      pricingAvailable: false,
      pricingUnavailableReason: "MODEL_NOT_CONFIGURED",
    });
  });
});
