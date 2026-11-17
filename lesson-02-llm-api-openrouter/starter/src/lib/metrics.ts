export interface ResponseUsageLike {
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  input_tokens_details?: {
    cached_tokens?: number | null;
    cache_write_tokens?: number | null;
  } | null;
}

export interface ChatCompletionUsageLike {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  prompt_tokens_details?: {
    cached_tokens?: number | null;
    cache_write_tokens?: number | null;
  } | null;
}

export interface UsageMetrics {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
}

export function normalizeChatUsage(
  usage: ChatCompletionUsageLike | null | undefined,
): ResponseUsageLike | null {
  if (!usage) {
    return null;
  }

  return {
    input_tokens: usage.prompt_tokens ?? null,
    output_tokens: usage.completion_tokens ?? null,
    total_tokens: usage.total_tokens ?? null,
    input_tokens_details: {
      cached_tokens: usage.prompt_tokens_details?.cached_tokens ?? null,
      cache_write_tokens: usage.prompt_tokens_details?.cache_write_tokens ?? null,
    },
  };
}

function toNonNegativeInteger(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

export function extractUsageMetrics(usage?: ResponseUsageLike | null): UsageMetrics {
  const inputTokens = toNonNegativeInteger(usage?.input_tokens);
  const outputTokens = toNonNegativeInteger(usage?.output_tokens);
  const cachedTokens = Math.min(
    inputTokens,
    toNonNegativeInteger(usage?.input_tokens_details?.cached_tokens),
  );
  const cacheWriteTokens = Math.min(
    inputTokens - cachedTokens,
    toNonNegativeInteger(usage?.input_tokens_details?.cache_write_tokens),
  );
  const reportedTotal = toNonNegativeInteger(usage?.total_tokens);

  return {
    inputTokens,
    outputTokens,
    totalTokens: reportedTotal || inputTokens + outputTokens,
    cachedTokens,
    cacheWriteTokens,
  };
}

export function calculateCacheHitRate(inputTokens: number, cachedTokens: number): number {
  if (inputTokens <= 0) {
    return 0;
  }

  return Number((Math.min(inputTokens, Math.max(0, cachedTokens)) / inputTokens).toFixed(4));
}
