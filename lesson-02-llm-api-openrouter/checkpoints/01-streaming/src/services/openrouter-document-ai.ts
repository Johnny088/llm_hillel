import OpenAI from "openai";
import { resolveModelCapabilities } from "../config/model-capabilities.js";
import { SUMMARY_INSTRUCTIONS } from "../config/prompts.js";
import type { ReasoningEffort } from "../config/openrouter.js";
import { DocumentAiError } from "../lib/errors.js";
import { normalizeChatUsage, type ChatCompletionUsageLike } from "../lib/metrics.js";
import type { DocumentAi, ExtractionResult, SummaryStreamEvent } from "./document-ai.js";

export interface OpenRouterDocumentAiOptions {
  fastModel: string;
  mainModel: string;
  reasoningEffort: ReasoningEffort;
  maxOutputTokens: number;
}

export interface OpenRouterChatMessage {
  role: "system" | "user";
  content: string;
}

export interface OpenRouterSummaryRequest {
  model: string;
  messages: OpenRouterChatMessage[];
  max_completion_tokens: number;
  temperature: number;
  stream: true;
  reasoning?: { effort: ReasoningEffort; exclude: true };
}

type OpenRouterErrorExtension = {
  code?: string | number;
  message?: string;
  metadata?: {
    error_type?: string;
  };
};

type OpenRouterErrorContainer = {
  error?: OpenRouterErrorExtension;
};

const SAFE_ERROR_REASON = /^[a-z0-9][a-z0-9_.:-]{0,79}$/i;

function createApiError(error: InstanceType<typeof OpenAI.APIError>): DocumentAiError {
  const details = {
    status: error.status,
    requestId: error.requestID ?? null,
  };

  if (error.status === 429) {
    return new DocumentAiError(
      "UPSTREAM_RATE_LIMITED",
      "OpenRouter тимчасово обмежив частоту запитів.",
      429,
      details,
      { cause: error },
    );
  }

  if (error.status === 408 || error.status === 504) {
    return new DocumentAiError(
      "GATEWAY_TIMEOUT",
      "Перевищено час очікування відповіді OpenRouter API.",
      504,
      details,
      { cause: error },
    );
  }

  if (error.status === 503) {
    return new DocumentAiError(
      "UPSTREAM_UNAVAILABLE",
      "OpenRouter або провайдер моделі тимчасово недоступний.",
      503,
      details,
      { cause: error },
    );
  }

  return new DocumentAiError(
    "UPSTREAM_API_ERROR",
    "OpenRouter API не виконав запит.",
    502,
    details,
    { cause: error },
  );
}

function mapOpenRouterError(error: unknown): DocumentAiError {
  if (error instanceof DocumentAiError) {
    return error;
  }

  if (error instanceof OpenAI.APIUserAbortError) {
    return new DocumentAiError("REQUEST_ABORTED", "Запит було скасовано.", 499, undefined, {
      cause: error,
    });
  }
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new DocumentAiError(
      "GATEWAY_TIMEOUT",
      "Перевищено час очікування відповіді OpenRouter API.",
      504,
      undefined,
      { cause: error },
    );
  }

  if (error instanceof OpenAI.APIConnectionError) {
    return new DocumentAiError(
      "UPSTREAM_CONNECTION_ERROR",
      "Не вдалося з'єднатися з OpenRouter API.",
      502,
      undefined,
      { cause: error },
    );
  }

  if (error instanceof OpenAI.APIError) {
    return createApiError(error);
  }

  return new DocumentAiError(
    "UPSTREAM_ERROR",
    "Не вдалося виконати запит до моделі.",
    502,
    undefined,
    error instanceof Error ? { cause: error } : undefined,
  );
}

function readProviderErrorReason(container: unknown): string | null {
  const error = (container as OpenRouterErrorContainer | undefined)?.error;

  if (!error) {
    return null;
  }

  const candidate = error.metadata?.error_type ?? error.code;

  if (typeof candidate !== "string" && typeof candidate !== "number") {
    return "provider_error";
  }

  const reason = String(candidate);

  return SAFE_ERROR_REASON.test(reason) ? reason : "provider_error";
}

function readProviderStreamError(
  chunk: OpenAI.ChatCompletionChunk,
  choice: OpenAI.ChatCompletionChunk.Choice | undefined,
): string | null {
  return readProviderErrorReason(chunk) ?? readProviderErrorReason(choice);
}

export class OpenRouterDocumentAi implements DocumentAi {
  public constructor(
    private readonly client: OpenAI,
    private readonly options: Readonly<OpenRouterDocumentAiOptions>,
  ) {}

  public async *streamSummary(
    content: string,
    signal: AbortSignal,
  ): AsyncIterable<SummaryStreamEvent> {
    try {
      const capabilities = resolveModelCapabilities(this.options.fastModel);

      const request: OpenRouterSummaryRequest = {
        model: this.options.fastModel,
        messages: [
          { role: "system", content: SUMMARY_INSTRUCTIONS },
          { role: "user", content },
        ],
        max_completion_tokens: this.options.maxOutputTokens,
        temperature: 0,
        stream: true,
        ...(capabilities.reasoning
          ? { reasoning: { effort: this.options.reasoningEffort, exclude: true as const } }
          : {}),
      };

      const stream = await this.client.chat.completions.create(request, { signal });

      let resolvedModel = this.options.fastModel;
      let terminal: "stop" | "refused" | null = null;
      let collectedUsage: ChatCompletionUsageLike | null = null;

      for await (const chunk of stream) {
        resolvedModel = chunk.model || resolvedModel;
        const choice = chunk.choices[0];

        const providerErrorReason = readProviderStreamError(chunk, choice);

        if (providerErrorReason) {
          yield { type: "failed", reason: providerErrorReason };
          return;
        }

        if (choice?.delta?.content) {
          yield { type: "delta", delta: choice.delta.content };
        }

        if (choice?.finish_reason) {
          switch (choice.finish_reason) {
            case "stop":
              terminal = "stop";
              break;

            case "length":
              yield { type: "incomplete", reason: "max_tokens" };
              return;

            case "content_filter":
              terminal = "refused";
              yield { type: "refused" };
              break;

            default:
              yield { type: "failed", reason: choice.finish_reason };
              return;
          }
        }

        if (chunk.usage) {
          collectedUsage = chunk.usage;
        }
      }

      if (terminal === "stop" || terminal === "refused") {
        yield {
          type: "completed",
          model: resolvedModel,
          ...(collectedUsage === null ? {} : { usage: normalizeChatUsage(collectedUsage) }),
        };
      }
    } catch (error) {
      throw mapOpenRouterError(error);
    }
  }

  public async extract(_content: string): Promise<ExtractionResult> {
    // TODO: Structured Output через chat.completions.create(response_format json_schema)
    // буде реалізовано на наступному кроці.
    throw new DocumentAiError(
      "NOT_IMPLEMENTED",
      "Адаптер структурованого JSON ще не реалізовано.",
      501,
    );
  }
}
