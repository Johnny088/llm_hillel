import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import type { SummaryStreamEvent } from "../src/services/document-ai.js";
import { OpenRouterDocumentAi } from "../src/services/openrouter-document-ai.js";

async function* events(values: readonly unknown[]): AsyncIterable<never> {
  for (const value of values) {
    yield value as never;
  }
}

function streamChunk(
  options: {
    model?: string;
    content?: string | null;
    finishReason?: string | null;
    usage?: unknown;
    providerErrorType?: string;
  } = {},
): unknown {
  return {
    id: "chatcmpl-test",
    model: options.model ?? "test-fast",
    choices: [
      {
        index: 0,
        delta: { role: "assistant", content: options.content ?? null },
        finish_reason: options.finishReason ?? null,
      },
    ],
    ...(options.providerErrorType === undefined
      ? {}
      : {
          error: {
            code: 429,
            metadata: { error_type: options.providerErrorType },
          },
        }),
    ...(options.usage === undefined ? {} : { usage: options.usage }),
  };
}

const rawChatUsage = {
  prompt_tokens: 100,
  completion_tokens: 20,
  total_tokens: 120,
  prompt_tokens_details: { cached_tokens: 10, cache_write_tokens: 0 },
};

const normalizedChatUsage = {
  input_tokens: 100,
  output_tokens: 20,
  total_tokens: 120,
  input_tokens_details: { cached_tokens: 10, cache_write_tokens: 0 },
};

function createMockClient(options?: { streamEvents?: readonly unknown[]; createError?: Error }): {
  client: OpenAI;
  create: ReturnType<typeof vi.fn>;
} {
  const create = options?.createError
    ? vi.fn().mockRejectedValue(options.createError)
    : vi.fn().mockResolvedValue(events(options?.streamEvents ?? []));

  return {
    client: { chat: { completions: { create } } } as unknown as OpenAI,
    create,
  };
}

function createAdapter(client: OpenAI): OpenRouterDocumentAi {
  return new OpenRouterDocumentAi(client, {
    fastModel: "test-fast",
    mainModel: "test-main",
    reasoningEffort: "low",
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

describe("OpenRouterDocumentAi streaming checkpoint", () => {
  it("maps streaming chunks and sends the streaming request contract", async () => {
    const mock = createMockClient({
      streamEvents: [
        streamChunk({ content: "Частина" }),
        streamChunk({ model: "resolved-fast", content: " друга", finishReason: "stop" }),
        streamChunk({ model: "resolved-fast", usage: rawChatUsage }),
      ],
    });
    const controller = new AbortController();

    await expect(
      collect(createAdapter(mock.client).streamSummary("Синтетичний документ.", controller.signal)),
    ).resolves.toEqual([
      { type: "delta", delta: "Частина" },
      { type: "delta", delta: " друга" },
      { type: "completed", model: "resolved-fast", usage: normalizedChatUsage },
    ]);
    expect(mock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "test-fast",
        stream: true,
        max_completion_tokens: 800,
        temperature: 0,
        messages: [
          { role: "system", content: expect.stringContaining("підсумок") },
          { role: "user", content: "Синтетичний документ." },
        ],
      }),
      { signal: controller.signal },
    );
    const request = mock.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(request).toHaveProperty("max_completion_tokens");
    expect(request).not.toHaveProperty("max_tokens");
    expect(request.models).toBeUndefined();
    expect(request.stream_options).toBeUndefined();
  });

  it("uses the configured hidden reasoning effort for the registered summary model", async () => {
    const mock = createMockClient({
      streamEvents: [
        streamChunk({ content: "Текст", finishReason: "stop" }),
        streamChunk({ usage: rawChatUsage }),
      ],
    });
    const adapter = new OpenRouterDocumentAi(mock.client, {
      fastModel: "~deepseek/deepseek-v4-flash-latest",
      mainModel: "test-main",
      reasoningEffort: "high",
      maxOutputTokens: 800,
    });

    await collect(adapter.streamSummary("Документ.", new AbortController().signal));

    const request = mock.create.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(request).toHaveProperty("max_completion_tokens");

    expect(request).not.toHaveProperty("max_tokens");
    expect(request.reasoning).toEqual({ effort: "high", exclude: true });
  });

  it("stops after incomplete and ignores later deltas", async () => {
    const mock = createMockClient({
      streamEvents: [
        streamChunk({ content: "Початок", finishReason: "length" }),
        streamChunk({ content: "не має надійти" }),
      ],
    });

    await expect(
      collect(createAdapter(mock.client).streamSummary("Документ.", new AbortController().signal)),
    ).resolves.toEqual([
      { type: "delta", delta: "Початок" },
      { type: "incomplete", reason: "max_tokens" },
    ]);
  });

  it("maps SDK timeout errors without exposing their full object", async () => {
    const mock = createMockClient({ createError: new OpenAI.APIConnectionTimeoutError() });

    await expect(
      collect(createAdapter(mock.client).streamSummary("Документ.", new AbortController().signal)),
    ).rejects.toMatchObject({
      code: "GATEWAY_TIMEOUT",
      statusCode: 504,
    });
  });

  it("maps a top-level OpenRouter streaming error", async () => {
    const mock = createMockClient({
      streamEvents: [streamChunk({ providerErrorType: "rate_limit_exceeded" })],
    });

    await expect(
      collect(createAdapter(mock.client).streamSummary("Документ.", new AbortController().signal)),
    ).resolves.toEqual([{ type: "failed", reason: "rate_limit_exceeded" }]);
  });
});
