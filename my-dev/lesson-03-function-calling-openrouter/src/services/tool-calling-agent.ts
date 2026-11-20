import { extractUsageMetrics, sumUsageMetrics } from "../lib/metrics.js";
import type { UsageMetrics } from "../lib/metrics.js";
import type { RetryDependencies } from "../lib/retry.js";
import {
  convertCurrencyTool,
  EducationalRateProvider,
  executeCurrencyToolCall,
} from "../tools/currency.js";
import type { RateProvider } from "../tools/currency.js";
import type { ChatCompletionToolMessageParam } from "openai/resources/chat/completions";

import type OpenAI from "openai";
import type {
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { resolveModelCapabilities } from "../config/model-capabilities.js";
import { DEFAULT_REASONING_EFFORT, type ReasoningEffort } from "../config/openrouter.js";
import { DocumentAiError } from "../lib/errors.js";
import { normalizeChatUsage } from "../lib/metrics.js";
import type { ResponseUsageLike } from "../lib/metrics.js";
import { mapOpenRouterError } from "./openrouter-document-ai.js";

export const TOOL_AGENT_INSTRUCTIONS = [
  "Доступний інструмент convert_currency для конвертації валют.",
  "Інструмент викликається лише тоді, коли в запиті явно задано суму, вихідну та цільову валюти.",
  "Коди валют завжди передаються у 3-літерному верхньому регістрі ISO 4217 (наприклад: USD, EUR, UAH).",
  "Якщо бракує валюти або суми, формується коротке уточнювальне запитання без виклику інструмента.",
  "Для запитів, не пов’язаних із конвертацією валют, надається пряма коротка відповідь.",
  "Курс валют не можна вигадувати.",
].join("\n");

export interface ModelTurn {
  outputText: string;
  toolCalls: ChatCompletionMessageFunctionToolCall[];
  model: string;
  usage?: ResponseUsageLike | null;
  reasoning?: string;
  reasoningDetails?: unknown[];
}

export interface ModelResponseRequest {
  messages: ChatCompletionMessageParam[];
  tools: ChatCompletionTool[];
  toolChoice: "auto";
}

export interface ModelResponsesClient {
  createResponse(request: ModelResponseRequest): Promise<ModelTurn>;
}

export interface OpenAIChatCompletionsClientOptions {
  modelName: string;
  /** Retained for Lesson 04 shared typing; this Lesson 03 client never routes to it. */
  maxOutputTokens: number;
  reasoningEffort?: ReasoningEffort;
}

interface OpenRouterToolRequest {
  model: string;
  messages: ChatCompletionMessageParam[];
  tools: ChatCompletionTool[];
  tool_choice: "auto";
  max_completion_tokens: number;
  temperature: number;
  provider: { require_parameters: true };
  reasoning?: { effort: ReasoningEffort; exclude: false };
  stream?: false;
}

export class OpenAIChatCompletionsClient implements ModelResponsesClient {
  public constructor(
    private readonly client: OpenAI,
    private readonly options: Readonly<OpenAIChatCompletionsClientOptions>,
  ) {}

  public async createResponse(request: ModelResponseRequest): Promise<ModelTurn> {
    const capabilities = resolveModelCapabilities(this.options.modelName);

    try {
      const openRouterRequest: OpenRouterToolRequest = {
        model: this.options.modelName,
        messages: [{ role: "system", content: TOOL_AGENT_INSTRUCTIONS }, ...request.messages],
        tools: request.tools,
        tool_choice: request.toolChoice,
        max_completion_tokens: this.options.maxOutputTokens,
        temperature: 0,
        provider: { require_parameters: true },
        ...(capabilities.reasoning
          ? {
              reasoning: {
                effort: this.options.reasoningEffort ?? DEFAULT_REASONING_EFFORT,
                exclude: false as const,
              },
            }
          : {}),
      };
      const response = await this.client.chat.completions.create(openRouterRequest);
      const choice = response.choices[0];

      if (!choice) {
        throw new DocumentAiError(
          "RESPONSE_FAILED",
          "Модель не повернула результат генерації.",
          502,
        );
      }

      if (choice.finish_reason === "length") {
        throw new DocumentAiError("INCOMPLETE_RESPONSE", "Генерацію не було завершено.", 502, {
          reason: "max_tokens",
        });
      }

      if (choice.finish_reason === "content_filter" || choice.message.refusal) {
        throw new DocumentAiError("REQUEST_REFUSED", "Модель відхилила запит.", 422);
      }

      const toolCalls = (choice.message.tool_calls ?? []).filter(
        (call): call is ChatCompletionMessageFunctionToolCall => call.type === "function",
      );
      const openRouterMessage = choice.message as typeof choice.message & {
        reasoning?: unknown;
        reasoning_details?: unknown;
      };
      const reasoning =
        typeof openRouterMessage.reasoning === "string" ? openRouterMessage.reasoning : undefined;
      const reasoningDetails = Array.isArray(openRouterMessage.reasoning_details)
        ? openRouterMessage.reasoning_details
        : undefined;

      return {
        outputText: choice.message.content ?? "",
        toolCalls,
        model: response.model || this.options.modelName,
        ...(response.usage === undefined ? {} : { usage: normalizeChatUsage(response.usage) }),
        ...(reasoning === undefined ? {} : { reasoning }),
        ...(reasoningDetails === undefined ? {} : { reasoningDetails }),
      };
    } catch (error) {
      throw mapOpenRouterError(error);
    }
  }
}

export interface AgentRunMetrics {
  modelCallCount: number;
  toolCallCount: number;
  retryCount: number;
  totalLatencyMs: number;
}

interface AgentRunBase {
  model: string;
  usage: UsageMetrics;
  metrics: AgentRunMetrics;
}

export type AgentRunResult =
  | (AgentRunBase & {
      status: "success";
      text: string;
    })
  | (AgentRunBase & {
      status: "error";
      code: "EMPTY_MODEL_RESPONSE" | "TOOL_CALL_LIMIT_REACHED";
      message: string;
    });

export interface ToolCallingAgent {
  run(message: string): Promise<AgentRunResult>;
}

export interface ChatCompletionsToolCallingAgentOptions {
  maxToolCalls?: number;
  retryDependencies?: RetryDependencies;
  now?: () => number;
  onToolCall?: (event: Readonly<ToolCallTrace>) => void;
  onToolOutput?: (output: Readonly<ChatCompletionToolMessageParam>) => void;
}

export interface ToolCallTrace {
  callId: string;
  toolName: string;
  arguments: string;
  toolCallCount: number;
}

export class ChatCompletionsToolCallingAgent implements ToolCallingAgent {
  private readonly maxToolCalls: number;
  private readonly retryDependencies: RetryDependencies;
  private readonly now: () => number;
  private readonly onToolCall: ChatCompletionsToolCallingAgentOptions["onToolCall"];
  private readonly onToolOutput: ChatCompletionsToolCallingAgentOptions["onToolOutput"];

  public constructor(
    private readonly responsesClient: ModelResponsesClient,
    private readonly provider: RateProvider = new EducationalRateProvider(),
    options: ChatCompletionsToolCallingAgentOptions = {},
  ) {
    this.maxToolCalls = options.maxToolCalls ?? 5;
    this.retryDependencies = options.retryDependencies ?? {};
    this.now = options.now ?? (() => performance.now());
    this.onToolCall = options.onToolCall;
    this.onToolOutput = options.onToolOutput;

    if (!Number.isInteger(this.maxToolCalls) || this.maxToolCalls < 1) {
      throw new RangeError("maxToolCalls має бути додатним цілим числом.");
    }
  }

  public async run(message: string): Promise<AgentRunResult> {
    const startedAt = this.now();
    const messages: ChatCompletionMessageParam[] = [{ role: "user", content: message }];
    let model = "unknown";
    let usage = extractUsageMetrics();
    let modelCallCount = 0;
    let toolCallCount = 0;
    let retryCount = 0;

    const retryDependencies: RetryDependencies = {
      ...this.retryDependencies,
      onRetry: (event) => {
        retryCount += 1;
        console.warn("[Tool Retry]", {
          operationName: event.operationName,
          attempt: event.attempt,
          delayMs: Math.round(event.delayMs),
          code: event.code,
        });
        this.retryDependencies.onRetry?.(event);
      },
    };

    while (true) {
      modelCallCount += 1;

      const turn = await this.responsesClient.createResponse({
        messages,
        tools: [convertCurrencyTool],
        toolChoice: "auto",
      });

      model = turn.model;
      usage = sumUsageMetrics(usage, extractUsageMetrics(turn.usage));

      if (turn.toolCalls.length === 0) {
        const outputText = turn.outputText.trim();

        if (outputText === "") {
          return {
            status: "error",
            code: "EMPTY_MODEL_RESPONSE",
            message: "Модель не повернула фінальної відповіді.",
            model,
            usage,
            metrics: createMetrics(modelCallCount, toolCallCount, retryCount, startedAt, this.now),
          };
        }

        return {
          status: "success",
          text: outputText,
          model,
          usage,
          metrics: createMetrics(modelCallCount, toolCallCount, retryCount, startedAt, this.now),
        };
      }

      messages.push({
        role: "assistant",
        ...(turn.outputText.length > 0 ? { content: turn.outputText } : { content: null }),
        tool_calls: turn.toolCalls,
        ...(turn.reasoning === undefined ? {} : { reasoning: turn.reasoning }),
        ...(turn.reasoningDetails === undefined
          ? {}
          : { reasoning_details: turn.reasoningDetails }),
      } as ChatCompletionMessageParam);

      for (const functionCall of turn.toolCalls) {
        if (toolCallCount >= this.maxToolCalls) {
          return {
            status: "error",
            code: "TOOL_CALL_LIMIT_REACHED",
            message: "Запит не завершено в межах дозволеної кількості викликів інструментів.",
            model,
            usage,
            metrics: createMetrics(modelCallCount, toolCallCount, retryCount, startedAt, this.now),
          };
        }

        toolCallCount += 1;
        this.onToolCall?.({
          callId: functionCall.id,
          toolName: functionCall.function.name,
          arguments: functionCall.function.arguments,
          toolCallCount,
        });

        const toolOutput = await executeCurrencyToolCall(
          functionCall,
          this.provider,
          retryDependencies,
        );
        this.onToolOutput?.(toolOutput);
        messages.push(toolOutput);
      }
    }
  }
}

function createMetrics(
  modelCallCount: number,
  toolCallCount: number,
  retryCount: number,
  startedAt: number,
  now: () => number,
): AgentRunMetrics {
  return {
    modelCallCount,
    toolCallCount,
    retryCount,
    totalLatencyMs: Math.max(0, Math.round(now() - startedAt)),
  };
}
