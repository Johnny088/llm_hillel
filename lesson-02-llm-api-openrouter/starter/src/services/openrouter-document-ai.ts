import type OpenAI from "openai";
import type { ReasoningEffort } from "../config/openrouter.js";
import { DocumentAiError } from "../lib/errors.js";
import type { DocumentAi, ExtractionResult, SummaryStreamEvent } from "./document-ai.js";

export interface OpenRouterDocumentAiOptions {
  fastModel: string;
  mainModel: string;
  reasoningEffort: ReasoningEffort;
  maxOutputTokens: number;
}

export class OpenRouterDocumentAi implements DocumentAi {
  public constructor(
    private readonly client: OpenAI,
    private readonly options: Readonly<OpenRouterDocumentAiOptions>,
  ) {}

  public async *streamSummary(
    _content: string,
    _signal: AbortSignal,
  ): AsyncIterable<SummaryStreamEvent> {
    void this.client;
    void this.options;

    // TODO 1: викличте chat.completions.create зі stream: true, temperature: 0
    // і налаштованим reasoning effort + exclude true;
    // OpenRouter додає usage у фінальний chunk.
    // TODO 2: перетворіть choices[].delta.content у SummaryStreamEvent.
    // TODO 3: завершіть генератор після stop, length або content_filter.
    throw new DocumentAiError("NOT_IMPLEMENTED", "Streaming adapter ще не реалізовано.", 501);
  }

  public async extract(_content: string): Promise<ExtractionResult> {
    void this.client;
    void this.options;

    // TODO 1: викличте chat.completions.create з response_format json_schema,
    // provider.require_parameters, temperature: 0 і налаштованим reasoning effort + exclude true.
    // TODO 2: виконайте локальний JSON.parse і ExtractionSchema.safeParse.
    // TODO 3: обробіть length, content_filter/refusal та відсутній parsed result.
    throw new DocumentAiError(
      "NOT_IMPLEMENTED",
      "Адаптер структурованого JSON ще не реалізовано.",
      501,
    );
  }
}
