import type { ResponseUsageLike } from "../lib/metrics.js";
import type { Extraction } from "../schemas/extraction.js";

export type SummaryStreamEvent =
  | { type: "delta"; delta: string }
  | { type: "refused" }
  | { type: "incomplete"; reason: string }
  | { type: "failed"; reason: string }
  | {
      type: "completed";
      model: string;
      usage?: ResponseUsageLike | null;
    };

export interface ExtractionResult {
  data: Extraction;
  model: string;
  usage?: ResponseUsageLike | null;
}

export interface DocumentAi {
  streamSummary(content: string, signal: AbortSignal): AsyncIterable<SummaryStreamEvent>;
  extract(content: string): Promise<ExtractionResult>;
}
