import OpenAI from "openai";
import { resolveModelCapabilities } from "../config/model-capabilities.js";
import {
  EXTRACTION_EXAMPLE,
  EXTRACTION_INSTRUCTIONS,
  SUMMARY_INSTRUCTIONS,
} from "../config/prompts.js";
import type { ReasoningEffort } from "../config/openrouter.js";
import { DocumentAiError } from "../lib/errors.js";
import { normalizeChatUsage, type ChatCompletionUsageLike } from "../lib/metrics.js";
import { EXTRACTION_JSON_SCHEMA, ExtractionSchema } from "../schemas/extraction.js";
import type { DocumentAi, ExtractionResult, SummaryStreamEvent } from "./document-ai.js";

export interface OpenRouterDocumentAiOptions {
  fastModel: string;
  mainModel: string;
  reasoningEffort: ReasoningEffort;
  maxOutputTokens: number;
}

export interface OpenRouterChatMessage {
  role: "system" | "user" | "assistant";
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

export interface OpenRouterExtractionRequest {
  model: string;
  messages: OpenRouterChatMessage[];
  max_completion_tokens: number;
  temperature: number;
  response_format: {
    type: "json_schema";
    json_schema: {
      name: "document_extraction";
      strict: true;
      schema: Record<string, unknown>;
    };
  };
  reasoning?: { effort: ReasoningEffort; exclude: true };
  provider: { require_parameters: true };
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

export function mapOpenRouterError(error: unknown): DocumentAiError {
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

function readProviderCompletionError(response: unknown, choice: unknown): string | null {
  return readProviderErrorReason(response) ?? readProviderErrorReason(choice);
}

function createProviderResponseError(reason: string): DocumentAiError {
  if (reason === "rate_limit_exceeded" || reason === "429") {
    return new DocumentAiError(
      "UPSTREAM_RATE_LIMITED",
      "OpenRouter тимчасово обмежив частоту запитів.",
      429,
      { reason },
    );
  }

  if (reason === "timeout") {
    return new DocumentAiError(
      "GATEWAY_TIMEOUT",
      "Перевищено час очікування відповіді OpenRouter API.",
      504,
      { reason },
    );
  }

  if (reason === "provider_overloaded") {
    return new DocumentAiError(
      "UPSTREAM_UNAVAILABLE",
      "OpenRouter або провайдер моделі тимчасово недоступний.",
      503,
      { reason },
    );
  }

  if (reason === "refusal" || reason === "content_policy_violation") {
    return new DocumentAiError("REQUEST_REFUSED", "Модель відхилила запит.", 422, { reason });
  }

  return new DocumentAiError("RESPONSE_FAILED", "Модель не змогла завершити генерацію.", 502, {
    reason,
  });
}

function normalizeGroundingText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("uk-UA");
}

const LOCATION_PREPOSITION = /^(?:у|в|до|на|з|із|зі|біля|поблизу|in|at|to|from)\s+(?=\S)/iu;

function normalizeLocations(content: string, locations: string[]): string[] {
  const normalizedContent = normalizeGroundingText(content);
  const result = new Set<string>();

  for (const location of locations) {
    const withoutPreposition = location.replace(LOCATION_PREPOSITION, "").trim();
    const normalized =
      withoutPreposition.length > 0 &&
      normalizedContent.includes(normalizeGroundingText(withoutPreposition))
        ? withoutPreposition
        : location;

    result.add(normalized);
  }

  return [...result];
}

function entitiesAreGrounded(
  content: string,
  extraction: Pick<ExtractionResult["data"], "names" | "dates" | "locations">,
): boolean {
  const normalizedContent = normalizeGroundingText(content);

  return [...extraction.names, ...extraction.dates, ...extraction.locations].every((value) =>
    normalizedContent.includes(normalizeGroundingText(value)),
  );
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

  public async extract(content: string): Promise<ExtractionResult> {
    const capabilities = resolveModelCapabilities(this.options.mainModel);

    if (!capabilities.responseFormat) {
      throw new DocumentAiError(
        "STRUCTURED_OUTPUT_UNSUPPORTED",
        "Модель не підтверджена для Structured Output через OpenRouter.",
        502,
        { model: this.options.mainModel },
      );
    }

    try {
      const request: OpenRouterExtractionRequest = {
        model: this.options.mainModel,
        messages: [
          { role: "system", content: EXTRACTION_INSTRUCTIONS },
          { role: "user", content: EXTRACTION_EXAMPLE.input },
          { role: "assistant", content: EXTRACTION_EXAMPLE.output },
          { role: "user", content },
        ],
        max_completion_tokens: this.options.maxOutputTokens,
        temperature: 0,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "document_extraction",
            strict: true,
            schema: EXTRACTION_JSON_SCHEMA,
          },
        },
        provider: { require_parameters: true },
        ...(capabilities.reasoning
          ? { reasoning: { effort: this.options.reasoningEffort, exclude: true as const } }
          : {}),
      };

      const response = await this.client.chat.completions.create(request);
      const choice = response.choices[0];

      const providerErrorReason = readProviderCompletionError(response, choice);

      if (providerErrorReason) {
        throw createProviderResponseError(providerErrorReason);
      }

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

      if (choice?.finish_reason === "content_filter" || choice?.message?.refusal) {
        throw new DocumentAiError("REQUEST_REFUSED", "Модель відхилила запит.", 422);
      }

      if (choice.finish_reason !== "stop") {
        throw new DocumentAiError(
          "RESPONSE_FAILED",
          "Модель завершила генерацію в неочікуваному стані.",
          502,
          { reason: choice.finish_reason ?? "missing_finish_reason" },
        );
      }

      const responseText = choice?.message?.content ?? "";

      let parsedValue: unknown;

      try {
        parsedValue = JSON.parse(responseText);
      } catch {
        throw new DocumentAiError(
          "PARSING_FAILED",
          "Не вдалося отримати типізований результат.",
          502,
        );
      }

      const parsed = ExtractionSchema.safeParse(parsedValue);

      if (!parsed.success) {
        throw new DocumentAiError(
          "PARSING_FAILED",
          "Не вдалося отримати типізований результат.",
          502,
        );
      }

      const normalizedData = {
        ...parsed.data,
        locations: normalizeLocations(content, parsed.data.locations),
      };

      if (!entitiesAreGrounded(content, normalizedData)) {
        throw new DocumentAiError(
          "UNGROUNDED_EXTRACTION",
          "Структурований результат містить сутність, якої немає у вхідному тексті.",
          502,
        );
      }

      return {
        data: normalizedData,
        model: response.model || this.options.mainModel,
        ...(response.usage === undefined ? {} : { usage: normalizeChatUsage(response.usage) }),
      };
    } catch (error) {
      throw mapOpenRouterError(error);
    }
  }
}
