export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const DEFAULT_OPENROUTER_MODEL = "~deepseek/deepseek-v4-flash-latest";
export const OPENROUTER_FREE_ROUTER_MODEL = "openrouter/free";
export const OPENROUTER_REASONING_EFFORTS = ["max", "high", "low"] as const;
export const DEFAULT_REASONING_EFFORT = "low";
export const DEFAULT_MAX_OUTPUT_TOKENS = 1_600;

export const OPENROUTER_APP_REFERER =
  "https://gitlab.com/AndreyFomenko/ai-agents-for-developers-practical";
export const OPENROUTER_APP_TITLE = "ai-agents-for-developers-practical";

export type ReasoningEffort = (typeof OPENROUTER_REASONING_EFFORTS)[number];
