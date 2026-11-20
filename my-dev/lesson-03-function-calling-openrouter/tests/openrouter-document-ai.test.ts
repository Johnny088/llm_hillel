import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import { DocumentAiError } from "../src/lib/errors.js";
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
    providerErrorCode?: string | number;
    providerErrorType?: string;
    providerErrorLocation?: "chunk" | "choice";
  } = {},
): unknown {
  const providerError =
    options.providerErrorCode === undefined && options.providerErrorType === undefined
      ? undefined
      : {
          ...(options.providerErrorCode === undefined ? {} : { code: options.providerErrorCode }),
          ...(options.providerErrorType === undefined
            ? {}
            : { metadata: { error_type: options.providerErrorType } }),
        };

  return {
    id: "chatcmpl-test",
    model: options.model ?? "test-fast",
    choices: [
      {
        index: 0,
        delta: { role: "assistant", content: options.content ?? null },
        finish_reason: options.finishReason ?? null,
        ...(providerError !== undefined && options.providerErrorLocation === "choice"
          ? { error: providerError }
          : {}),
      },
    ],
    ...(providerError !== undefined && options.providerErrorLocation !== "choice"
      ? { error: providerError }
      : {}),
    ...(options.usage === undefined ? {} : { usage: options.usage }),
  };
}

const rawChatUsage = {
  prompt_tokens: 100,
  completion_tokens: 20,
  total_tokens: 120,
  prompt_tokens_details: {
    cached_tokens: 10,
    cache_write_tokens: 0,
  },
};

const normalizedChatUsage = {
  input_tokens: 100,
  output_tokens: 20,
  total_tokens: 120,
  input_tokens_details: {
    cached_tokens: 10,
    cache_write_tokens: 0,
  },
};

function createMockClient(options?: {
  streamEvents?: readonly unknown[];
  completion?: unknown;
  createError?: Error;
}): {
  client: OpenAI;
  create: ReturnType<typeof vi.fn>;
} {
  const create = options?.createError
    ? vi.fn().mockRejectedValue(options.createError)
    : vi.fn().mockResolvedValueOnce(options?.completion ?? events(options?.streamEvents ?? []));

  return {
    client: {
      chat: { completions: { create } },
    } as unknown as OpenAI,
    create,
  };
}

const REGISTERED_MAIN_MODEL = "~deepseek/deepseek-v4-flash-latest";

function createAdapter(client: OpenAI): OpenRouterDocumentAi {
  return new OpenRouterDocumentAi(client, {
    fastModel: "test-fast",
    mainModel: REGISTERED_MAIN_MODEL,
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

const parsedData = {
  names: ["Олена Коваль"],
  dates: ["14 липня"],
  locations: ["Львова"],
  summary: "Олена Коваль приїхала до Львова 14 липня.",
};

describe("OpenRouterDocumentAi streaming", () => {
  it("maps streaming chunks and sends the Chat Completions request contract", async () => {
    const mock = createMockClient({
      streamEvents: [
        streamChunk({ content: "Частина" }),
        streamChunk({ model: "resolved-fast", content: " друга", finishReason: "stop" }),
        streamChunk({ model: "resolved-fast", usage: rawChatUsage }),
      ],
    });
    const controller = new AbortController();

    const result = await collect(
      createAdapter(mock.client).streamSummary("Синтетичний документ.", controller.signal),
    );

    expect(result).toEqual([
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

  it("does not send provider-specific reasoning params for unverified models", async () => {
    const mock = createMockClient({
      streamEvents: [
        streamChunk({ content: "Текст", finishReason: "stop" }),
        streamChunk({ usage: rawChatUsage }),
      ],
    });
    const adapter = createAdapter(mock.client);

    await collect(adapter.streamSummary("Документ.", new AbortController().signal));

    const request = mock.create.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(request).toHaveProperty("max_completion_tokens");

    expect(request).not.toHaveProperty("max_tokens");
    expect(request.reasoning).toBeUndefined();
  });

  it("uses the configured hidden reasoning effort for a registered summary model", async () => {
    const mock = createMockClient({
      streamEvents: [
        streamChunk({ content: "Текст", finishReason: "stop" }),
        streamChunk({ usage: rawChatUsage }),
      ],
    });
    const adapter = new OpenRouterDocumentAi(mock.client, {
      fastModel: REGISTERED_MAIN_MODEL,
      mainModel: REGISTERED_MAIN_MODEL,
      reasoningEffort: "high",
      maxOutputTokens: 800,
    });

    await collect(adapter.streamSummary("Документ.", new AbortController().signal));

    const request = mock.create.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(request).toHaveProperty("max_completion_tokens");

    expect(request).not.toHaveProperty("max_tokens");
    expect(request.reasoning).toEqual({ effort: "high", exclude: true });
  });

  it("reads a canonical provider error from the top-level streaming chunk", async () => {
    const mock = createMockClient({
      streamEvents: [
        streamChunk({
          providerErrorCode: 429,
          providerErrorType: "rate_limit_exceeded",
        }),
      ],
    });

    await expect(
      collect(createAdapter(mock.client).streamSummary("Документ.", new AbortController().signal)),
    ).resolves.toEqual([{ type: "failed", reason: "rate_limit_exceeded" }]);
  });

  it("emits incomplete for the length finish state", async () => {
    const mock = createMockClient({
      streamEvents: [streamChunk({ content: "Текст", finishReason: "length" })],
    });

    await expect(
      collect(createAdapter(mock.client).streamSummary("Документ.", new AbortController().signal)),
    ).resolves.toEqual([
      { type: "delta", delta: "Текст" },
      { type: "incomplete", reason: "max_tokens" },
    ]);
  });

  it("emits refused for the content_filter finish state and still reports usage", async () => {
    const mock = createMockClient({
      streamEvents: [
        streamChunk({ content: "Текст", finishReason: "content_filter" }),
        streamChunk({ usage: rawChatUsage }),
      ],
    });

    await expect(
      collect(createAdapter(mock.client).streamSummary("Документ.", new AbortController().signal)),
    ).resolves.toEqual([
      { type: "delta", delta: "Текст" },
      { type: "refused" },
      { type: "completed", model: "test-fast", usage: normalizedChatUsage },
    ]);
  });

  it("does not emit a completed event when the stream just ends", async () => {
    const mock = createMockClient({
      streamEvents: [streamChunk({ content: "Текст" })],
    });

    await expect(
      collect(createAdapter(mock.client).streamSummary("Документ.", new AbortController().signal)),
    ).resolves.toEqual([{ type: "delta", delta: "Текст" }]);
  });

  it("maps SDK timeout errors without exposing their full object", async () => {
    const mock = createMockClient({
      createError: new OpenAI.APIConnectionTimeoutError(),
    });

    await expect(
      collect(createAdapter(mock.client).streamSummary("Документ.", new AbortController().signal)),
    ).rejects.toEqual(
      expect.objectContaining({
        name: "DocumentAiError",
        code: "GATEWAY_TIMEOUT",
        statusCode: 504,
      }),
    );
  });

  it("maps an SDK rate limit to a stable public classification", async () => {
    const rateLimitError = OpenAI.APIError.generate(
      429,
      {
        error: {
          code: 429,
          message: "private provider message",
          metadata: { error_type: "rate_limit_exceeded" },
        },
      },
      undefined,
      new Headers(),
    );
    const mock = createMockClient({ createError: rateLimitError });

    await expect(
      collect(createAdapter(mock.client).streamSummary("Документ.", new AbortController().signal)),
    ).rejects.toMatchObject({
      code: "UPSTREAM_RATE_LIMITED",
      statusCode: 429,
      message: "OpenRouter тимчасово обмежив частоту запитів.",
    });
  });
});

describe("OpenRouterDocumentAi structured output", () => {
  it.each([
    {
      label: "absent names",
      content: "14 липня подія відбулася у Львові.",
      data: {
        names: [],
        dates: ["14 липня"],
        locations: ["Львові"],
        summary: "14 липня подія відбулася у Львові.",
      },
    },
    {
      label: "absent dates",
      content: "Олена Коваль приїхала до Львова.",
      data: {
        names: ["Олена Коваль"],
        dates: [],
        locations: ["Львова"],
        summary: "Олена Коваль приїхала до Львова.",
      },
    },
    {
      label: "absent locations",
      content: "14 липня Олена Коваль виступила онлайн.",
      data: {
        names: ["Олена Коваль"],
        dates: ["14 липня"],
        locations: [],
        summary: "14 липня Олена Коваль виступила онлайн.",
      },
    },
    {
      label: "all entities absent",
      content: "Документ повідомляє про зміну умов без імен, дат і назв місць.",
      data: {
        names: [],
        dates: [],
        locations: [],
        summary: "Документ повідомляє про зміну умов.",
      },
    },
  ])("accepts valid extraction with $label", async ({ content, data }) => {
    const mock = createMockClient({
      completion: {
        model: "resolved-main",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: JSON.stringify(data) },
            finish_reason: "stop",
          },
        ],
      },
    });

    await expect(createAdapter(mock.client).extract(content)).resolves.toMatchObject({
      data,
      model: "resolved-main",
    });
    expect(mock.create).toHaveBeenCalledOnce();
  });

  it("parses and validates a completed structured response", async () => {
    const mock = createMockClient({
      completion: {
        model: "resolved-main",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: JSON.stringify(parsedData) },
            finish_reason: "stop",
          },
        ],
        usage: rawChatUsage,
      },
    });

    await expect(
      createAdapter(mock.client).extract("14 липня Олена Коваль приїхала до Львова."),
    ).resolves.toEqual({
      data: parsedData,
      model: "resolved-main",
      usage: normalizedChatUsage,
    });

    const request = mock.create.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(request).toHaveProperty("max_completion_tokens");

    expect(request).not.toHaveProperty("max_tokens");
    expect(request).toMatchObject({
      model: REGISTERED_MAIN_MODEL,
      max_completion_tokens: 800,
      temperature: 0,
      messages: [
        { role: "system", content: expect.stringContaining("JSON-об'єкт") },
        { role: "user", content: expect.stringContaining("Одесі") },
        { role: "assistant", content: expect.stringContaining('"locations":["Одесі"]') },
        { role: "user", content: "14 липня Олена Коваль приїхала до Львова." },
      ],
    });
    expect(request.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "document_extraction", strict: true },
    });
    expect(
      (request.response_format as { json_schema: { schema: unknown } }).json_schema.schema,
    ).toBeDefined();
    expect(request.reasoning).toEqual({ effort: "low", exclude: true });
    expect(request.models).toBeUndefined();
    expect(request.provider).toEqual({ require_parameters: true });
  });

  it("maps a provider error embedded in a completed response", async () => {
    const mock = createMockClient({
      completion: {
        model: "test-main",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "" },
            finish_reason: "error",
            error: {
              code: 429,
              metadata: { error_type: "rate_limit_exceeded" },
            },
          },
        ],
      },
    });

    await expect(createAdapter(mock.client).extract("Документ.")).rejects.toMatchObject({
      code: "UPSTREAM_RATE_LIMITED",
      statusCode: 429,
    });
  });

  it("rejects structural refusal", async () => {
    const mock = createMockClient({
      completion: {
        model: "test-main",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Відмова", refusal: "Відмова" },
            finish_reason: "content_filter",
          },
        ],
      },
    });

    await expect(createAdapter(mock.client).extract("Документ.")).rejects.toMatchObject({
      code: "REQUEST_REFUSED",
      statusCode: 422,
    });
  });

  it("rejects an incomplete response", async () => {
    const mock = createMockClient({
      completion: {
        model: "test-main",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Частина" },
            finish_reason: "length",
          },
        ],
      },
    });

    await expect(createAdapter(mock.client).extract("Документ.")).rejects.toMatchObject({
      code: "INCOMPLETE_RESPONSE",
      statusCode: 502,
    });
  });

  it("rejects invalid JSON in the response text", async () => {
    const mock = createMockClient({
      completion: {
        model: "test-main",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "не JSON" },
            finish_reason: "stop",
          },
        ],
      },
    });

    await expect(createAdapter(mock.client).extract("Документ.")).rejects.toMatchObject({
      code: "PARSING_FAILED",
      statusCode: 502,
    });
  });

  it("rejects a schema-invalid structured result", async () => {
    const mock = createMockClient({
      completion: {
        model: "test-main",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: JSON.stringify({ names: [], dates: [], summary: "Без locations." }),
            },
            finish_reason: "stop",
          },
        ],
      },
    });

    await expect(createAdapter(mock.client).extract("Документ.")).rejects.toMatchObject({
      code: "PARSING_FAILED",
      statusCode: 502,
    });
  });

  it("rejects entities that were normalized instead of copied from the input", async () => {
    const mock = createMockClient({
      completion: {
        model: "test-main",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: JSON.stringify({
                names: [],
                dates: [],
                locations: ["Львів"],
                summary: "Подія відбулася у Львові.",
              }),
            },
            finish_reason: "stop",
          },
        ],
      },
    });

    await expect(
      createAdapter(mock.client).extract("Подія відбулася у Львові."),
    ).rejects.toMatchObject({
      code: "UNGROUNDED_EXTRACTION",
      statusCode: 502,
    });
  });

  it("removes a leading preposition from a grounded location phrase", async () => {
    const mock = createMockClient({
      completion: {
        model: "resolved-main",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: JSON.stringify({
                names: ["Олена Коваль"],
                dates: ["14 липня 2026 року"],
                locations: ["у Львові"],
                summary: "14 липня 2026 року Олена Коваль представила демонстрацію у Львові.",
              }),
            },
            finish_reason: "stop",
          },
        ],
        usage: rawChatUsage,
      },
    });

    await expect(
      createAdapter(mock.client).extract(
        "14 липня 2026 року Олена Коваль представила демонстрацію у Львові.",
      ),
    ).resolves.toMatchObject({
      data: {
        names: ["Олена Коваль"],
        dates: ["14 липня 2026 року"],
        locations: ["Львові"],
      },
    });
  });

  it("rejects an unexpected non-terminal finish reason", async () => {
    const mock = createMockClient({
      completion: {
        model: "test-main",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: JSON.stringify(parsedData) },
            finish_reason: "tool_calls",
          },
        ],
      },
    });

    await expect(createAdapter(mock.client).extract("Документ.")).rejects.toMatchObject({
      code: "RESPONSE_FAILED",
      statusCode: 502,
    });
  });

  it("maps SDK user abort before the generic API error branch", async () => {
    const mock = createMockClient({ createError: new OpenAI.APIUserAbortError() });

    await expect(createAdapter(mock.client).extract("Документ.")).rejects.toMatchObject({
      code: "REQUEST_ABORTED",
      statusCode: 499,
    });
  });

  it("preserves already-classified errors", async () => {
    const classified = new DocumentAiError("REQUEST_REFUSED", "Модель відхилила запит.", 422);
    const mock = createMockClient({ createError: classified });

    await expect(createAdapter(mock.client).extract("Документ.")).rejects.toBe(classified);
  });

  it("reports a typed error when response_format is unsupported", async () => {
    const mock = createMockClient();
    const adapter = new OpenRouterDocumentAi(mock.client, {
      fastModel: "test-fast",
      mainModel: "unknown-model-without-capabilities",
      reasoningEffort: "low",
      maxOutputTokens: 800,
    });

    await expect(adapter.extract("Документ.")).rejects.toMatchObject({
      code: "STRUCTURED_OUTPUT_UNSUPPORTED",
      statusCode: 502,
    });
    expect(mock.create).not.toHaveBeenCalled();
  });
});
