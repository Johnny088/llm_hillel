import type { UsageMetrics } from "../lib/metrics.js";
import { DEFAULT_OPENROUTER_MODEL, OPENROUTER_FREE_ROUTER_MODEL } from "./openrouter.js";

export interface ModelPricing {
  inputCostPerMillion: number;
  cachedInputCostPerMillion?: number;
  cacheWriteCostPerMillion?: number;
  outputCostPerMillion: number;
}

const FREE_MODEL_PRICING: Readonly<ModelPricing> = {
  inputCostPerMillion: 0,
  cachedInputCostPerMillion: 0,
  cacheWriteCostPerMillion: 0,
  outputCostPerMillion: 0,
};

// Catalog snapshot: 2026-11-13, DeepSeek V4 Flash 0731.
// Alias/provider prices can change; provider-reported usage.cost takes priority.
export const MODEL_PRICES: Readonly<Record<string, ModelPricing>> = {
  [OPENROUTER_FREE_ROUTER_MODEL]: FREE_MODEL_PRICING,
  [DEFAULT_OPENROUTER_MODEL]: {
    inputCostPerMillion: 0.0434,
    cachedInputCostPerMillion: 0.035,
    outputCostPerMillion: 0.3,
  },
};

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
  providerReportedCostUsd?: number | null,
): CostCalculationResult {
  if (
    typeof providerReportedCostUsd === "number" &&
    Number.isFinite(providerReportedCostUsd) &&
    providerReportedCostUsd >= 0
  ) {
    return { estimatedCostUsd: providerReportedCostUsd, pricingAvailable: true };
  }

  const pricing = prices[model] ?? (model.endsWith(":free") ? FREE_MODEL_PRICING : undefined);

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
