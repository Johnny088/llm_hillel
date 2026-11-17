import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import type { SummaryStreamEvent } from "../src/services/document-ai.js";
import { OpenAiDocumentAi } from "../src/services/openai-document-ai.js";

async function* events(values: readonly unknown[]): AsyncIterable<never> {
  for (const value of values) {
    yield value as never;
  }
}

function createMockClient(options?: { streamEvents?: readonly unknown[]; createError?: Error }): {
  client: OpenAI;
  create: ReturnType<typeof vi.fn>;
} {
  const create = options?.createError
    ? vi.fn().mockRejectedValue(options.createError)
    : vi.fn().mockResolvedValue(events(options?.streamEvents ?? []));

  return {
    client: { responses: { create } } as unknown as OpenAI,
    create,
  };
}

function createAdapter(client: OpenAI): OpenAiDocumentAi {
  return new OpenAiDocumentAi(client, {
    fastModel: "test-fast",
    mainModel: "test-main",
    maxOutputTokens: 800,
  });
}

async function collect(source: AsyncIterable<SummaryStreamEvent>): Promise<SummaryStreamEvent[]> {
  const result: SummaryStreamEvent[] = [];
  for await (const event of source) {
    result.push(event);
  }
  return result;
}

describe("OpenAiDocumentAi streaming checkpoint", () => {
  it("maps typed SDK events and sends the stateless request contract", async () => {
    const usage = {
      input_tokens: 100,
      output_tokens: 20,
      total_tokens: 120,
      input_tokens_details: { cached_tokens: 10, cache_write_tokens: 0 },
    };
    const mock = createMockClient({
      streamEvents: [
        { type: "response.output_text.delta", delta: "Частина" },
        { type: "response.refusal.done", refusal: "Відмова" },
        {
          type: "response.completed",
          response: { model: "resolved-fast", usage },
        },
      ],
    });
    const controller = new AbortController();

    await expect(
      collect(createAdapter(mock.client).streamSummary("Синтетичний документ.", controller.signal)),
    ).resolves.toEqual([
      { type: "delta", delta: "Частина" },
      { type: "refused" },
      { type: "completed", model: "resolved-fast", usage },
    ]);
    expect(mock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "test-fast",
        store: false,
        stream: true,
        max_output_tokens: 800,
      }),
      { signal: controller.signal },
    );
  });

  it("stops after incomplete and ignores later deltas", async () => {
    const mock = createMockClient({
      streamEvents: [
        {
          type: "response.incomplete",
          response: { incomplete_details: { reason: "max_output_tokens" } },
        },
        { type: "response.output_text.delta", delta: "не має надійти" },
      ],
    });

    await expect(
      collect(createAdapter(mock.client).streamSummary("Документ.", new AbortController().signal)),
    ).resolves.toEqual([{ type: "incomplete", reason: "max_output_tokens" }]);
  });

  it("classifies an SDK user abort before generic API errors", async () => {
    const mock = createMockClient({
      createError: new OpenAI.APIUserAbortError(),
    });

    await expect(
      collect(createAdapter(mock.client).streamSummary("Документ.", new AbortController().signal)),
    ).rejects.toMatchObject({ code: "REQUEST_ABORTED", statusCode: 499 });
  });
});
