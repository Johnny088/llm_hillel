import OpenAI from "openai";
import { SUMMARY_INSTRUCTIONS } from "../config/prompts.js";
import { DocumentAiError } from "../lib/errors.js";
import type { DocumentAi, ExtractionResult, SummaryStreamEvent } from "./document-ai.js";

export interface OpenAiDocumentAiOptions {
  fastModel: string;
  mainModel: string;
  maxOutputTokens: number;
}

function mapOpenAiError(error: unknown): DocumentAiError {
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
      "Перевищено час очікування відповіді OpenAI API.",
      504,
      undefined,
      { cause: error },
    );
  }

  if (error instanceof OpenAI.APIConnectionError) {
    return new DocumentAiError(
      "UPSTREAM_CONNECTION_ERROR",
      "Не вдалося з'єднатися з OpenAI API.",
      502,
      undefined,
      { cause: error },
    );
  }

  if (error instanceof OpenAI.APIError) {
    return new DocumentAiError(
      "UPSTREAM_API_ERROR",
      "OpenAI API не виконав запит.",
      502,
      {
        status: error.status,
        requestId: error.requestID ?? null,
      },
      { cause: error },
    );
  }

  return new DocumentAiError(
    "UPSTREAM_ERROR",
    "Не вдалося виконати запит до моделі.",
    502,
    undefined,
    error instanceof Error ? { cause: error } : undefined,
  );
}

export class OpenAiDocumentAi implements DocumentAi {
  public constructor(
    private readonly client: OpenAI,
    private readonly options: Readonly<OpenAiDocumentAiOptions>,
  ) {}

  public async *streamSummary(
    content: string,
    signal: AbortSignal,
  ): AsyncIterable<SummaryStreamEvent> {
    try {
      const stream = await this.client.responses.create(
        {
          model: this.options.fastModel,
          instructions: SUMMARY_INSTRUCTIONS,
          input: content,
          store: false,
          max_output_tokens: this.options.maxOutputTokens,
          stream: true,
        },
        { signal },
      );

      for await (const event of stream) {
        switch (event.type) {
          case "response.output_text.delta":
            yield { type: "delta", delta: event.delta };
            break;

          case "response.refusal.done":
            yield { type: "refused" };
            break;

          case "response.incomplete":
            yield {
              type: "incomplete",
              reason: event.response.incomplete_details?.reason ?? "unknown",
            };
            return;

          case "response.failed":
            yield {
              type: "failed",
              reason: event.response.error?.code ?? "response_failed",
            };
            return;

          case "error":
            yield {
              type: "failed",
              reason: event.code ?? "stream_error",
            };
            return;

          case "response.completed":
            yield {
              type: "completed",
              model: event.response.model || this.options.fastModel,
              ...(event.response.usage === undefined ? {} : { usage: event.response.usage }),
            };
            return;
        }
      }
    } catch (error) {
      throw mapOpenAiError(error);
    }
  }

  public async extract(_content: string): Promise<ExtractionResult> {
    throw new DocumentAiError(
      "NOT_IMPLEMENTED",
      "Structured Output adapter буде реалізовано на наступному кроці.",
      501,
    );
  }
}
