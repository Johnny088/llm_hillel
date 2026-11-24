import type OpenAI from "openai";
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems";
import type {
  ResponseFunctionToolCall,
  ResponseInputItem,
  ResponseOutputItem,
} from "openai/resources/responses/responses";
import { extractUsageMetrics, sumUsageMetrics } from "../lib/metrics.js";
import type { ResponseUsageLike, UsageMetrics } from "../lib/metrics.js";
import type { RetryDependencies } from "../lib/retry.js";
import {
  convertCurrencyTool,
  EducationalRateProvider,
  executeCurrencyToolCall,
} from "../tools/currency.js";
import type { RateProvider } from "../tools/currency.js";

export const TOOL_AGENT_INSTRUCTIONS = [
  "Доступний інструмент convert_currency для конвертації валют.",
  "Інструмент викликається лише тоді, коли в запиті явно задано суму, вихідну та цільову валюти.",
  "Якщо бракує валюти або суми, формується коротке уточнювальне запитання без виклику інструмента.",
  "Для запитів, не пов’язаних із конвертацією валют, надається пряма коротка відповідь.",
  "Курс валют не можна вигадувати.",
].join("\n");

export interface ModelTurn {
  output: ResponseOutputItem[];
  outputText: string;
  model: string;
  usage?: ResponseUsageLike | null;
}

export interface ModelResponseRequest {
  input: ResponseInputItem[];
  tools: Array<typeof convertCurrencyTool>;
  toolChoice: "auto";
  parallelToolCalls: false;
}

export interface ModelResponsesClient {
  createResponse(request: ModelResponseRequest): Promise<ModelTurn>;
}

export interface OpenAIResponsesClientOptions {
  modelName: string;
  maxOutputTokens: number;
}

export class OpenAIResponsesClient implements ModelResponsesClient {
  public constructor(
    private readonly client: OpenAI,
    private readonly options: Readonly<OpenAIResponsesClientOptions>,
  ) {}

  public async createResponse(request: ModelResponseRequest): Promise<ModelTurn> {
    const response = await this.client.responses.create({
      model: this.options.modelName,
      instructions: TOOL_AGENT_INSTRUCTIONS,
      input: request.input,
      tools: request.tools,
      tool_choice: request.toolChoice,
      parallel_tool_calls: request.parallelToolCalls,
      store: false,
      max_output_tokens: this.options.maxOutputTokens,
    });

    return {
      output: response.output,
      outputText: response.output_text,
      model: response.model || this.options.modelName,
      ...(response.usage === undefined ? {} : { usage: response.usage }),
    };
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

export interface ResponsesToolCallingAgentOptions {
  maxToolCalls?: number;
  retryDependencies?: RetryDependencies;
  now?: () => number;
}

export class ResponsesToolCallingAgent implements ToolCallingAgent {
  private readonly maxToolCalls: number;
  private readonly retryDependencies: RetryDependencies;
  private readonly now: () => number;

  public constructor(
    private readonly responsesClient: ModelResponsesClient,
    private readonly provider: RateProvider = new EducationalRateProvider(),
    options: ResponsesToolCallingAgentOptions = {},
  ) {
    this.maxToolCalls = options.maxToolCalls ?? 5;
    this.retryDependencies = options.retryDependencies ?? {};
    this.now = options.now ?? (() => performance.now());

    if (!Number.isInteger(this.maxToolCalls) || this.maxToolCalls < 1) {
      throw new RangeError("maxToolCalls має бути додатним цілим числом.");
    }
  }

  public async run(message: string): Promise<AgentRunResult> {
    const startedAt = this.now();
    const input: ResponseInputItem[] = [{ role: "user", content: message }];
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

      const response = await this.responsesClient.createResponse({
        input,
        tools: [convertCurrencyTool],
        toolChoice: "auto",
        parallelToolCalls: false,
      });

      model = response.model;
      usage = sumUsageMetrics(usage, extractUsageMetrics(response.usage));
      input.push(...toResponseInputItems(response.output));

      const functionCall = response.output.find(
        (item): item is ResponseFunctionToolCall => item.type === "function_call",
      );

      if (!functionCall) {
        const outputText = response.outputText.trim();

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
      console.log("[Tool Call]", {
        callId: functionCall.call_id,
        toolName: functionCall.name,
        toolCallCount,
      });

      const toolOutput = await executeCurrencyToolCall(
        functionCall,
        this.provider,
        retryDependencies,
      );
      input.push(toolOutput);
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
