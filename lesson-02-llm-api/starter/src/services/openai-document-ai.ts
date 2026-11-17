import type OpenAI from "openai";
import { DocumentAiError } from "../lib/errors.js";
import type { DocumentAi, ExtractionResult, SummaryStreamEvent } from "./document-ai.js";

export interface OpenAiDocumentAiOptions {
  fastModel: string;
  mainModel: string;
  maxOutputTokens: number;
}

export class OpenAiDocumentAi implements DocumentAi {
  public constructor(
    private readonly client: OpenAI,
    private readonly options: Readonly<OpenAiDocumentAiOptions>,
  ) {}

  public async *streamSummary(
    _content: string,
    _signal: AbortSignal,
  ): AsyncIterable<SummaryStreamEvent> {
    void this.client;
    void this.options;

    // TODO 1: викличте responses.create зі stream: true та store: false.
    // TODO 2: перетворіть typed SDK events на SummaryStreamEvent.
    // TODO 3: завершіть генератор після completed, incomplete, failed або error.
    throw new DocumentAiError("NOT_IMPLEMENTED", "Streaming adapter ще не реалізовано.", 501);
  }

  public async extract(_content: string): Promise<ExtractionResult> {
    void this.client;
    void this.options;

    // TODO 1: використайте responses.parse і zodTextFormat(ExtractionSchema, ...).
    // TODO 2: обробіть failed, incomplete, refusal та відсутній parsed result.
    // TODO 3: поверніть data, model і usage без hardcoded model ID.
    throw new DocumentAiError(
      "NOT_IMPLEMENTED",
      "Structured Output adapter ще не реалізовано.",
      501,
    );
  }
}
