import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { EXTRACTION_INSTRUCTIONS, SUMMARY_INSTRUCTIONS } from "../config/prompts.js";
import { DocumentAiError } from "../lib/errors.js";
import { ExtractionSchema } from "../schemas/extraction.js";
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

  public async extract(content: string): Promise<ExtractionResult> {
    try {
      const response = await this.client.responses.parse({
        model: this.options.mainModel,
        instructions: EXTRACTION_INSTRUCTIONS,
        input: content,
        store: false,
        max_output_tokens: this.options.maxOutputTokens,
        text: {
          format: zodTextFormat(ExtractionSchema, "document_extraction"),
        },
      });

      if (response.status === "failed") {
        throw new DocumentAiError("RESPONSE_FAILED", "Модель не змогла завершити генерацію.", 502, {
          reason: response.error?.code ?? "unknown",
        });
      }

      if (response.status === "incomplete") {
        throw new DocumentAiError("INCOMPLETE_RESPONSE", "Генерацію не було завершено.", 502, {
          reason: response.incomplete_details?.reason ?? "unknown",
        });
      }

      if (response.status !== "completed") {
        throw new DocumentAiError(
          "UNEXPECTED_RESPONSE_STATUS",
          "Отримано неочікуваний стан відповіді.",
          502,
          { status: response.status },
        );
      }

      const refusal = response.output
        .filter((item) => item.type === "message")
        .flatMap((item) => item.content)
        .find((item) => item.type === "refusal");

      if (refusal) {
        throw new DocumentAiError("REQUEST_REFUSED", "Модель відхилила запит.", 422);
      }

      const parsed = ExtractionSchema.safeParse(response.output_parsed);

      if (!parsed.success) {
        throw new DocumentAiError(
          "PARSING_FAILED",
          "Не вдалося отримати типізований результат.",
          502,
        );
      }

      return {
        data: parsed.data,
        model: response.model || this.options.mainModel,
        ...(response.usage === undefined ? {} : { usage: response.usage }),
      };
    } catch (error) {
      throw mapOpenAiError(error);
    }
  }
}
