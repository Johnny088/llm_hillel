import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import { DocumentAiError } from "../src/lib/errors.js";
import type { SummaryStreamEvent } from "../src/services/document-ai.js";
import { OpenAiDocumentAi } from "../src/services/openai-document-ai.js";

async function* events(values: readonly unknown[]): AsyncIterable<never> {
  for (const value of values) {
    yield value as never;
  }
}

function createMockClient(options?: {
  streamEvents?: readonly unknown[];
  parsedResponse?: unknown;
  createError?: Error;
  parseError?: Error;
}): {
  client: OpenAI;
  create: ReturnType<typeof vi.fn>;
  parse: ReturnType<typeof vi.fn>;
} {
  const create = options?.createError
    ? vi.fn().mockRejectedValue(options.createError)
    : vi.fn().mockResolvedValue(events(options?.streamEvents ?? []));
  const parse = options?.parseError
    ? vi.fn().mockRejectedValue(options.parseError)
    : vi.fn().mockResolvedValue(options?.parsedResponse);

  return {
    client: { responses: { create, parse } } as unknown as OpenAI,
    create,
    parse,
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

const parsedData = {
  names: ["Олена Коваль"],
  dates: ["14 липня"],
  locations: ["Львова"],
  summary: "Олена Коваль приїхала до Львова 14 липня.",
};

describe("OpenAiDocumentAi streaming", () => {
  it("maps typed SDK events and sends the stateless request contract", async () => {
    const usage = {
      input_tokens: 100,
      output_tokens: 20,
      total_tokens: 120,
      input_tokens_details: {
        cached_tokens: 10,
        cache_write_tokens: 0,
      },
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

    const result = await collect(
      createAdapter(mock.client).streamSummary("Синтетичний документ.", controller.signal),
    );

    expect(result).toEqual([
      { type: "delta", delta: "Частина" },
      { type: "refused" },
      { type: "completed", model: "resolved-fast", usage },
    ]);
    expect(mock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "test-fast",
        input: "Синтетичний документ.",
        store: false,
        stream: true,
        max_output_tokens: 800,
      }),
      { signal: controller.signal },
    );
  });

  it("terminates normalized streaming on incomplete and failed events", async () => {
    const incomplete = createMockClient({
      streamEvents: [
        {
          type: "response.incomplete",
          response: { incomplete_details: { reason: "max_output_tokens" } },
        },
        { type: "response.output_text.delta", delta: "не має надійти" },
      ],
    });

    await expect(
      collect(
        createAdapter(incomplete.client).streamSummary("Документ.", new AbortController().signal),
      ),
    ).resolves.toEqual([{ type: "incomplete", reason: "max_output_tokens" }]);

    const failed = createMockClient({
      streamEvents: [
        {
          type: "response.failed",
          response: { error: { code: "server_error" } },
        },
      ],
    });

    await expect(
      collect(
        createAdapter(failed.client).streamSummary("Документ.", new AbortController().signal),
      ),
    ).resolves.toEqual([{ type: "failed", reason: "server_error" }]);
  });
});

describe("OpenAiDocumentAi structured output", () => {
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
      parsedResponse: {
        status: "completed",
        output: [],
        output_parsed: data,
        model: "resolved-main",
      },
    });

    await expect(createAdapter(mock.client).extract(content)).resolves.toMatchObject({
      data,
      model: "resolved-main",
    });
    expect(mock.parse).toHaveBeenCalledOnce();
  });

  it("parses and validates a completed structured response", async () => {
    const usage = {
      input_tokens: 100,
      output_tokens: 20,
      total_tokens: 120,
      input_tokens_details: {
        cached_tokens: 0,
        cache_write_tokens: 0,
      },
    };
    const mock = createMockClient({
      parsedResponse: {
        status: "completed",
        output: [],
        output_parsed: parsedData,
        model: "resolved-main",
        usage,
      },
    });

    await expect(createAdapter(mock.client).extract("Документ.")).resolves.toEqual({
      data: parsedData,
      model: "resolved-main",
      usage,
    });
    expect(mock.parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "test-main",
        input: "Документ.",
        store: false,
        max_output_tokens: 800,
        text: { format: expect.any(Object) },
      }),
    );
  });

  it("rejects refusal, incomplete and failed response states", async () => {
    const refused = createMockClient({
      parsedResponse: {
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "refusal", refusal: "Відмова" }],
          },
        ],
        output_parsed: parsedData,
        model: "test-main",
      },
    });

    await expect(createAdapter(refused.client).extract("Документ.")).rejects.toMatchObject({
      code: "REQUEST_REFUSED",
      statusCode: 422,
    });

    const incomplete = createMockClient({
      parsedResponse: {
        status: "incomplete",
        output: [],
        incomplete_details: { reason: "max_output_tokens" },
      },
    });

    await expect(createAdapter(incomplete.client).extract("Документ.")).rejects.toMatchObject({
      code: "INCOMPLETE_RESPONSE",
      details: { reason: "max_output_tokens" },
    });

    const failed = createMockClient({
      parsedResponse: {
        status: "failed",
        output: [],
        error: { code: "server_error" },
      },
    });

    await expect(createAdapter(failed.client).extract("Документ.")).rejects.toMatchObject({
      code: "RESPONSE_FAILED",
      details: { reason: "server_error" },
    });
  });

  it("rejects a missing or schema-invalid parsed result", async () => {
    const mock = createMockClient({
      parsedResponse: {
        status: "completed",
        output: [],
        output_parsed: { names: [], dates: [], summary: "Без locations." },
        model: "test-main",
      },
    });

    await expect(createAdapter(mock.client).extract("Документ.")).rejects.toMatchObject({
      code: "PARSING_FAILED",
      statusCode: 502,
    });
  });

  it("maps an SDK user abort before the generic API error branch", async () => {
    const mock = createMockClient({
      parseError: new OpenAI.APIUserAbortError(),
    });

    await expect(createAdapter(mock.client).extract("Документ.")).rejects.toMatchObject({
      code: "REQUEST_ABORTED",
      statusCode: 499,
    });
  });
  it("maps SDK timeout errors without exposing their full object", async () => {
    const mock = createMockClient({
      parseError: new OpenAI.APIConnectionTimeoutError(),
    });

    await expect(createAdapter(mock.client).extract("Документ.")).rejects.toEqual(
      expect.objectContaining({
        name: "DocumentAiError",
        code: "GATEWAY_TIMEOUT",
        statusCode: 504,
      }),
    );
  });

  it("preserves already-classified errors", async () => {
    const classified = new DocumentAiError("REQUEST_REFUSED", "Модель відхилила запит.", 422);
    const mock = createMockClient({ parseError: classified });

    await expect(createAdapter(mock.client).extract("Документ.")).rejects.toBe(classified);
  });
});
