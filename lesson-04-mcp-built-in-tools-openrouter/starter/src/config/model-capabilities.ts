import {
  DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_FREE_ROUTER_MODEL,
  OPENROUTER_REASONING_EFFORTS,
} from "./openrouter.js";

export interface ModelCapabilities {
  responseFormat: boolean;
  reasoning: boolean;
  reasoningEfforts: readonly string[];
}

export const CONSERVATIVE_CAPABILITIES: Readonly<ModelCapabilities> = {
  responseFormat: false,
  reasoning: false,
  reasoningEfforts: [],
};

export const MODEL_CAPABILITIES: Readonly<Record<string, ModelCapabilities>> = {
  [DEFAULT_OPENROUTER_MODEL]: {
    responseFormat: true,
    reasoning: true,
    reasoningEfforts: OPENROUTER_REASONING_EFFORTS,
  },
  [OPENROUTER_FREE_ROUTER_MODEL]: {
    responseFormat: true,
    reasoning: false,
    reasoningEfforts: [],
  },
};

export function resolveModelCapabilities(model: string): ModelCapabilities {
  return MODEL_CAPABILITIES[model] ?? CONSERVATIVE_CAPABILITIES;
}
