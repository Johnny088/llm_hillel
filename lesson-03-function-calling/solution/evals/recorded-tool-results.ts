import type { ExpectedResponseMode } from "./tool-calling.eval.js";

export interface ToolCallingObservation {
  id: string;
  observedMode: ExpectedResponseMode;
  observedTool?: string;
  observedArgs?: Record<string, unknown>;
  observedStatus?: "success" | "error";
  observedErrorCode?: string;
  latencyMs: number;
  modelCallCount: number;
  toolCallCount: number;
  retryCount: number;
  inputTokens: number;
  outputTokens: number;
}

export const recordedToolResults: ToolCallingObservation[] = [
  {
    id: "currency-happy-path",
    observedMode: "tool",
    observedTool: "convert_currency",
    observedArgs: { amount: 250, from: "USD", to: "UAH" },
    observedStatus: "success",
    latencyMs: 410,
    modelCallCount: 2,
    toolCallCount: 1,
    retryCount: 0,
    inputTokens: 220,
    outputTokens: 48,
  },
  {
    id: "currency-normalization",
    observedMode: "tool",
    observedTool: "convert_currency",
    observedArgs: { amount: 100, from: "EUR", to: "UAH" },
    observedStatus: "success",
    latencyMs: 395,
    modelCallCount: 2,
    toolCallCount: 1,
    retryCount: 0,
    inputTokens: 214,
    outputTokens: 45,
  },
  {
    id: "currency-clarification",
    observedMode: "clarification",
    latencyMs: 180,
    modelCallCount: 1,
    toolCallCount: 0,
    retryCount: 0,
    inputTokens: 145,
    outputTokens: 18,
  },
  {
    id: "currency-unsupported-pair",
    observedMode: "tool",
    observedTool: "convert_currency",
    observedArgs: { amount: 1_000, from: "JPY", to: "KZT" },
    observedStatus: "error",
    observedErrorCode: "UNSUPPORTED_CURRENCY_PAIR",
    latencyMs: 430,
    modelCallCount: 2,
    toolCallCount: 1,
    retryCount: 0,
    inputTokens: 232,
    outputTokens: 55,
  },
  {
    id: "currency-no-tool-needed",
    observedMode: "direct",
    latencyMs: 165,
    modelCallCount: 1,
    toolCallCount: 0,
    retryCount: 0,
    inputTokens: 142,
    outputTokens: 12,
  },
];
