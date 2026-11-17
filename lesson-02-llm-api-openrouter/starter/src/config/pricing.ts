import type { UsageMetrics } from "../lib/metrics.js";

export interface ModelPricing {
  inputCostPerMillion: number;
  cachedInputCostPerMillion?: number;
  cacheWriteCostPerMillion?: number;
  outputCostPerMillion: number;
}

// MODEL_PRICES навмисно порожній: неперевірена ціна не підмінюється нулем.
// Ціну моделі вносять лише після перевірки в публічному каталозі
// OpenRouter (GET https://openrouter.ai/api/v1/models).
export const MODEL_PRICES: Readonly<Record<string, ModelPricing>> = {};

export type PricingUnavailableReason =
  "MODEL_NOT_CONFIGURED" | "CACHED_INPUT_PRICE_MISSING" | "CACHE_WRITE_PRICE_MISSING";

export type CostCalculationResult =
  | {
      estimatedCostUsd: number;
      pricingAvailable: true;
    }
  | {
      estimatedCostUsd: null;
      pricingAvailable: false;
      pricingUnavailableReason: PricingUnavailableReason;
    };

export function calculateCost(
  model: string,
  usage: UsageMetrics,
  prices: Readonly<Record<string, ModelPricing>> = MODEL_PRICES,
): CostCalculationResult {
  const pricing = prices[model];

  if (!pricing) {
    return {
      estimatedCostUsd: null,
      pricingAvailable: false,
      pricingUnavailableReason: "MODEL_NOT_CONFIGURED",
    };
  }

  if (usage.cachedTokens > 0 && pricing.cachedInputCostPerMillion === undefined) {
    return {
      estimatedCostUsd: null,
      pricingAvailable: false,
      pricingUnavailableReason: "CACHED_INPUT_PRICE_MISSING",
    };
  }

  if (usage.cacheWriteTokens > 0 && pricing.cacheWriteCostPerMillion === undefined) {
    return {
      estimatedCostUsd: null,
      pricingAvailable: false,
      pricingUnavailableReason: "CACHE_WRITE_PRICE_MISSING",
    };
  }

  const regularInputTokens = Math.max(
    0,
    usage.inputTokens - usage.cachedTokens - usage.cacheWriteTokens,
  );
  const cachedInputPrice = pricing.cachedInputCostPerMillion ?? pricing.inputCostPerMillion;
  const cacheWritePrice = pricing.cacheWriteCostPerMillion ?? pricing.inputCostPerMillion;

  const estimatedCostUsd =
    (regularInputTokens / 1_000_000) * pricing.inputCostPerMillion +
    (usage.cachedTokens / 1_000_000) * cachedInputPrice +
    (usage.cacheWriteTokens / 1_000_000) * cacheWritePrice +
    (usage.outputTokens / 1_000_000) * pricing.outputCostPerMillion;

  return { estimatedCostUsd, pricingAvailable: true };
}
