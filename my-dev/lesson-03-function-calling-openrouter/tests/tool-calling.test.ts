import type OpenAI from "openai";
import type {
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";
import { afterEach, describe, expect, it, vi } from "vitest";
import { executeWithRetry, calculateBackoff } from "../src/lib/retry.js";
import { createHttpToolError, parseRetryAfter, ToolError } from "../src/lib/tool-errors.js";
import {
  ChatCompletionsToolCallingAgent,
  OpenAIChatCompletionsClient,
} from "../src/services/tool-calling-agent.js";
import type {
  ModelResponseRequest,
  ModelResponsesClient,
  ModelTurn,
} from "../src/services/tool-calling-agent.js";
import {
  ConvertCurrencyArgsSchema,
  convertCurrencyTool,
  EducationalRateProvider,
  executeCurrencyToolCall,
  HttpRateProvider,
  ScriptedRateProvider,
} from "../src/tools/currency.js";
import type { RateProvider } from "../src/tools/currency.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function createFunctionCall(
  argumentsValue: unknown,
  callId: string = "call_1",
  name: string = "convert_currency",
): ChatCompletionMessageFunctionToolCall {
  return {
    id: callId,
    type: "function",
    function: {
      name,
      arguments:
        typeof argumentsValue === "string" ? argumentsValue : JSON.stringify(argumentsValue),
    },
  };
}

function parseToolOutput(output: ChatCompletionToolMessageParam): Record<string, unknown> {
  if (typeof output.content !== "string") {
    throw new TypeError("У тесті очікується текстовий tool output.");
  }

  return JSON.parse(output.content) as Record<string, unknown>;
}

function createTextTurn(text: string, usage?: ModelTurn["usage"]): ModelTurn {
  return {
    outputText: text,
    toolCalls: [],
    model: "test-model",
    ...(usage === undefined ? {} : { usage }),
  };
}

function createToolTurn(
  callId: string,
  argumentsValue: unknown = { amount: 10, from: "USD", to: "UAH" },
  usage?: ModelTurn["usage"],
): ModelTurn {
  return {
    outputText: "",
    toolCalls: [createFunctionCall(argumentsValue, callId)],
    model: "test-model",
    ...(usage === undefined ? {} : { usage }),
  };
}

class SequenceResponsesClient implements ModelResponsesClient {
  public readonly requests: ModelResponseRequest[] = [];

  public constructor(private readonly turns: ModelTurn[]) {}

  public async createResponse(request: ModelResponseRequest): Promise<ModelTurn> {
    this.requests.push({ ...request, messages: [...request.messages] });
    const turn = this.turns.shift();

    if (!turn) {
      throw new Error("Неочікуваний model call у тесті.");
    }

    return turn;
  }
}

describe("strict currency tool", () => {
  it("нормалізує коди валют і відхиляє зайві поля", () => {
    expect(
      ConvertCurrencyArgsSchema.parse({
        amount: 1,
        from: " usd ",
        to: "uah",
      }),
    ).toEqual({
      amount: 1,
      from: "USD",
      to: "UAH",
    });

    expect(
      ConvertCurrencyArgsSchema.safeParse({
        amount: 1,
        from: "12A",
        to: "UAH",
      }).success,
    ).toBe(false);

    expect(
      ConvertCurrencyArgsSchema.safeParse({
        amount: 1,
        from: "###",
        to: "###",
      }).success,
    ).toBe(false);

    expect(
      ConvertCurrencyArgsSchema.safeParse({
        amount: 1,
        from: "€€€",
        to: "UAH",
      }).success,
    ).toBe(false);

    expect(
      ConvertCurrencyArgsSchema.safeParse({
        amount: 1,
        from: "US",
        to: "UAH",
      }).success,
    ).toBe(false);

    expect(
      ConvertCurrencyArgsSchema.safeParse({
        amount: 1,
        from: "USDD",
        to: "UAH",
      }).success,
    ).toBe(false);

    expect(
      ConvertCurrencyArgsSchema.safeParse({
        amount: 1,
        from: "USD",
        to: "UAH",
        unknown: true,
      }).success,
    ).toBe(false);
  });

  it("генерує strict-сумісну JSON Schema з повним required", () => {
    expect(convertCurrencyTool.type).toBe("function");

    if (convertCurrencyTool.type !== "function") {
      throw new Error("Очікується function tool.");
    }

    expect(convertCurrencyTool.function.strict).toBe(true);
    expect(convertCurrencyTool.function.parameters).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["amount", "from", "to"],
    });
  });

  it("не запускає provider для невалідних аргументів", async () => {
    const getRate = vi.fn<RateProvider["getRate"]>();
    const output = await executeCurrencyToolCall(
      createFunctionCall({ amount: -1, from: "USD", to: "UAH" }),
      { getRate },
    );

    expect(parseToolOutput(output)).toMatchObject({
      status: "error",
      code: "INVALID_TOOL_ARGUMENTS",
      retryable: false,
    });
    expect(getRate).not.toHaveBeenCalled();
  });

  it("повертає UNKNOWN_TOOL без виконання provider", async () => {
    const getRate = vi.fn<RateProvider["getRate"]>();
    const output = await executeCurrencyToolCall(
      createFunctionCall({}, "call_unknown", "delete_everything"),
      { getRate },
    );

    expect(parseToolOutput(output)).toMatchObject({
      status: "error",
      code: "UNKNOWN_TOOL",
      retryable: false,
    });
    expect(getRate).not.toHaveBeenCalled();
  });

  it("повертає контрольовану помилку для непідтримуваної пари", async () => {
    const output = await executeCurrencyToolCall(
      createFunctionCall({ amount: 1_000, from: "JPY", to: "KZT" }),
      new EducationalRateProvider(),
    );

    expect(parseToolOutput(output)).toMatchObject({
      status: "error",
      code: "UNSUPPORTED_CURRENCY_PAIR",
      retryable: false,
    });
  });

  it("маскує невідому програмну помилку й не повторює її", async () => {
    const internalLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const getRate = vi
      .fn<RateProvider["getRate"]>()
      .mockRejectedValue(new Error("secret-provider-message"));
    const output = await executeCurrencyToolCall(
      createFunctionCall({ amount: 10, from: "USD", to: "UAH" }),
      { getRate },
      { sleep: vi.fn() },
    );
    const serializedOutput = JSON.stringify(parseToolOutput(output));

    expect(serializedOutput).not.toContain("secret-provider-message");
    expect(serializedOutput).toContain("TOOL_EXECUTION_ERROR");
    expect(getRate).toHaveBeenCalledTimes(1);
    expect(internalLog).toHaveBeenCalledWith("[Tool Execution Internal Error]", {
      name: "Error",
      message: "Internal tool execution error",
    });
  });

  it("валідує JSON-відповідь HTTP provider", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ value: 41.5 }), { status: 200 }));
    const provider = new HttpRateProvider("https://rates.example", fetchImplementation);

    await expect(
      provider.getRate("USD", "UAH", new AbortController().signal),
    ).rejects.toMatchObject({
      code: "TOOL_EXECUTION_ERROR",
      retryable: false,
    });
  });
});

describe("bounded retry", () => {
  it("повторює transient-помилку й окремо фіксує retry event", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const onRetry = vi.fn();
    const output = await executeCurrencyToolCall(
      createFunctionCall({ amount: 10, from: "USD", to: "UAH" }),
      new ScriptedRateProvider(new EducationalRateProvider()),
      { sleep, random: () => 0, onRetry },
    );

    expect(parseToolOutput(output)).toMatchObject({
      status: "success",
      data: {
        convertedAmount: 415,
      },
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(200);
  });

  it("не повторює non-retryable ToolError", async () => {
    const operation = vi
      .fn<(signal: AbortSignal) => Promise<number>>()
      .mockRejectedValue(new ToolError("UNSUPPORTED_CURRENCY_PAIR", "Непідтримувана пара.", false));
    const sleep = vi.fn();

    await expect(
      executeWithRetry(
        "convert",
        operation,
        { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1_000, timeoutMs: 100 },
        { sleep },
      ),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_CURRENCY_PAIR" });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("надає Retry-After пріоритет над локальним backoff", async () => {
    let attempt = 0;
    const sleep = vi.fn().mockResolvedValue(undefined);
    const random = vi.fn(() => 0.5);
    const result = await executeWithRetry(
      "rates",
      async () => {
        attempt += 1;

        if (attempt === 1) {
          throw new ToolError("UPSTREAM_RATE_LIMITED", "Rate limited.", true, 1_500);
        }

        return 41.5;
      },
      { maxAttempts: 2, baseDelayMs: 100, maxDelayMs: 1_000, timeoutMs: 100 },
      { sleep, random },
    );

    expect(result).toBe(41.5);
    expect(sleep).toHaveBeenCalledWith(1_500);
    expect(random).not.toHaveBeenCalled();
  });

  it("обмежує exponential delay і додає jitter", () => {
    expect(calculateBackoff(4, 100, 500, () => 0.5)).toBe(550);
  });

  it("перетворює AbortError на UPSTREAM_TIMEOUT", async () => {
    await expect(
      executeWithRetry(
        "slow-provider",
        (signal) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener(
              "abort",
              () => {
                const error = new Error("aborted");
                error.name = "AbortError";
                reject(error);
              },
              { once: true },
            );
          }),
        { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1, timeoutMs: 5 },
      ),
    ).rejects.toMatchObject({
      code: "UPSTREAM_TIMEOUT",
      retryable: true,
    });
  });

  it("парсить delay-seconds і всі три HTTP-date форми Retry-After та класифікує HTTP 429", () => {
    const now = Date.parse("Sun, 06 Nov 1994 08:48:37 GMT");

    expect(parseRetryAfter("120", now)).toBe(120_000);
    expect(parseRetryAfter("Sun, 06 Nov 1994 08:49:37 GMT", now)).toBe(60_000);
    expect(parseRetryAfter("Sunday, 06-Nov-94 08:49:37 GMT", now)).toBe(60_000);
    expect(parseRetryAfter("Sun Nov  6 08:49:37 1994", now)).toBe(60_000);
    expect(parseRetryAfter("Sun, 06 Nov 1994 08:48:60 GMT", now)).toBe(23_000);
    expect(parseRetryAfter("1.5", now)).toBeUndefined();
    expect(parseRetryAfter("1e2", now)).toBeUndefined();
    expect(parseRetryAfter("+5", now)).toBeUndefined();
    expect(parseRetryAfter("0x10", now)).toBeUndefined();
    expect(parseRetryAfter("January 5, 2026", now)).toBeUndefined();
    expect(parseRetryAfter("Mon, 31 Feb 2026 10:00:00 GMT", now)).toBeUndefined();
    expect(parseRetryAfter("Mon, 06 Nov 1994 08:49:37 GMT", now)).toBeUndefined();
    expect(parseRetryAfter("Sun, 06 Nov 1994 24:00:00 GMT", now)).toBeUndefined();
    expect(parseRetryAfter("", now)).toBeUndefined();
    expect(parseRetryAfter(null, now)).toBeUndefined();
    expect(parseRetryAfter("99999999999999999999", now)).toBeUndefined();
    expect(
      createHttpToolError(
        new Response(null, {
          status: 429,
          headers: { "Retry-After": "120" },
        }),
      ),
    ).toMatchObject({
      code: "UPSTREAM_RATE_LIMITED",
      retryable: true,
      retryAfterMs: 120_000,
    });
  });
});

describe("bounded tool-calling runtime", () => {
  it("повертає пряму відповідь без виклику інструмента", async () => {
    const client = new SequenceResponsesClient([createTextTurn("Париж.")]);
    const agent = new ChatCompletionsToolCallingAgent(client, new EducationalRateProvider(), {
      now: () => 100,
    });
    const result = await agent.run("Яка столиця Франції?");

    expect(result).toMatchObject({
      status: "success",
      text: "Париж.",
      metrics: {
        modelCallCount: 1,
        toolCallCount: 0,
        retryCount: 0,
      },
    });
  });

  it("послідовно повертає всі tool outputs та підсумовує usage всіх model turns", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const client = new SequenceResponsesClient([
      {
        outputText: "",
        toolCalls: [
          createFunctionCall({ amount: 250, from: "USD", to: "UAH" }, "call_usd"),
          createFunctionCall({ amount: 100, from: "EUR", to: "UAH" }, "call_eur"),
        ],
        model: "test-model",
        usage: {
          input_tokens: 10,
          output_tokens: 2,
          total_tokens: 12,
        },
      },
      createTextTurn("250 USD дорівнюють 10 375 UAH.", {
        input_tokens: 20,
        output_tokens: 5,
        total_tokens: 25,
      }),
    ]);
    const agent = new ChatCompletionsToolCallingAgent(client, new EducationalRateProvider(), {
      now: () => 100,
    });
    const result = await agent.run("Конвертуй 250 USD у UAH");

    expect(result).toMatchObject({
      status: "success",
      usage: {
        inputTokens: 30,
        outputTokens: 7,
        totalTokens: 37,
      },
      metrics: {
        modelCallCount: 2,
        toolCallCount: 2,
        retryCount: 0,
      },
    });
    expect(client.requests[0]).toMatchObject({
      toolChoice: "auto",
    });
    const secondRequestMessages = client.requests[1]?.messages.map((message) => message.role);

    expect(secondRequestMessages).toEqual(["user", "assistant", "tool", "tool"]);
    expect(client.requests[1]?.messages.slice(2)).toMatchObject([
      { role: "tool", tool_call_id: "call_usd" },
      { role: "tool", tool_call_id: "call_eur" },
    ]);
  });

  it("передає reasoning_details наступному model turn без розкриття в результаті", async () => {
    const reasoningDetails = [
      {
        type: "reasoning.encrypted",
        data: "opaque-reasoning-data",
        id: "reasoning-1",
        format: "openrouter-v1",
      },
    ];
    const client = new SequenceResponsesClient([
      {
        ...createToolTurn("call_reasoning"),
        reasoningDetails,
      },
      createTextTurn("10 USD дорівнюють 415 UAH."),
    ]);
    const agent = new ChatCompletionsToolCallingAgent(client, new EducationalRateProvider(), {
      now: () => 100,
    });
    const result = await agent.run("Конвертуй 10 USD у UAH");
    const assistantMessage = client.requests[1]?.messages[1] as unknown as {
      reasoning_details?: unknown[];
    };

    expect(assistantMessage.reasoning_details).toEqual(reasoningDetails);
    expect(result).not.toHaveProperty("reasoningDetails");
  });

  it("рахує retryCount окремо від toolCallCount", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const client = new SequenceResponsesClient([
      createToolTurn("call_retry"),
      createTextTurn("Готово."),
    ]);
    const agent = new ChatCompletionsToolCallingAgent(
      client,
      new ScriptedRateProvider(new EducationalRateProvider()),
      {
        retryDependencies: { sleep: vi.fn(), random: () => 0 },
        now: () => 100,
      },
    );
    const result = await agent.run("Конвертуй 10 USD у UAH");

    expect(result.metrics).toMatchObject({
      modelCallCount: 2,
      toolCallCount: 1,
      retryCount: 1,
    });
  });

  it("дозволяє фінальну відповідь після п’ятого tool output", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const client = new SequenceResponsesClient([
      ...Array.from({ length: 5 }, (_, index) => createToolTurn(`call_${index + 1}`)),
      createTextTurn("Фінальна відповідь після п’яти викликів."),
    ]);
    const getRate = vi.fn<RateProvider["getRate"]>().mockResolvedValue(2);
    const agent = new ChatCompletionsToolCallingAgent(client, { getRate }, { now: () => 100 });
    const result = await agent.run("Виконай послідовність.");

    expect(result).toMatchObject({
      status: "success",
      metrics: {
        modelCallCount: 6,
        toolCallCount: 5,
      },
    });
    expect(getRate).toHaveBeenCalledTimes(5);
  });

  it("блокує шостий function call до виконання інструмента", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const client = new SequenceResponsesClient(
      Array.from({ length: 6 }, (_, index) => createToolTurn(`call_${index + 1}`)),
    );
    const getRate = vi.fn<RateProvider["getRate"]>().mockResolvedValue(2);
    const agent = new ChatCompletionsToolCallingAgent(client, { getRate }, { now: () => 100 });
    const result = await agent.run("Виконай забагато викликів.");

    expect(result).toMatchObject({
      status: "error",
      code: "TOOL_CALL_LIMIT_REACHED",
      metrics: {
        modelCallCount: 6,
        toolCallCount: 5,
      },
    });
    expect(getRate).toHaveBeenCalledTimes(5);
  });

  it("повертає контрольовану помилку для порожньої model response", async () => {
    const client = new SequenceResponsesClient([createTextTurn("   ")]);
    const agent = new ChatCompletionsToolCallingAgent(client, new EducationalRateProvider(), {
      now: () => 100,
    });

    await expect(agent.run("Тест")).resolves.toMatchObject({
      status: "error",
      code: "EMPTY_MODEL_RESPONSE",
    });
  });

  it("передає OpenAI SDK безпечні та обмежені параметри", async () => {
    const create = vi.fn().mockResolvedValue({
      model: "configured-model",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: { role: "assistant", content: "Готово.", refusal: null },
        },
      ],
      usage: null,
    });
    const openai = { chat: { completions: { create } } } as unknown as OpenAI;
    const client = new OpenAIChatCompletionsClient(openai, {
      modelName: "configured-model",
      maxOutputTokens: 800,
    });

    await client.createResponse({
      messages: [{ role: "user", content: "Тест" }],
      tools: [convertCurrencyTool],
      toolChoice: "auto",
    });

    const request = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(request).toMatchObject({
      model: "configured-model",
      max_completion_tokens: 800,
      temperature: 0,
      tool_choice: "auto",
      provider: { require_parameters: true },
      tools: [convertCurrencyTool],
      messages: [
        { role: "system", content: expect.stringContaining("convert_currency") },
        { role: "user", content: "Тест" },
      ],
    });
    expect(request.reasoning).toBeUndefined();
    expect(request.parallel_tool_calls).toBeUndefined();
  });

  it("зберігає reasoning details у відповіді tool-calling", async () => {
    const reasoningDetails = [
      {
        type: "reasoning.encrypted",
        data: "opaque-reasoning-data",
        id: "reasoning-1",
        format: "openrouter-v1",
      },
    ];
    const create = vi.fn().mockResolvedValue({
      model: "~deepseek/deepseek-v4-flash-latest",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: "Готово.",
            refusal: null,
            reasoning_details: reasoningDetails,
          },
        },
      ],
      usage: null,
    });
    const openai = { chat: { completions: { create } } } as unknown as OpenAI;
    const client = new OpenAIChatCompletionsClient(openai, {
      modelName: "~deepseek/deepseek-v4-flash-latest",
      maxOutputTokens: 800,
    });

    const turn = await client.createResponse({
      messages: [{ role: "user", content: "Тест" }],
      tools: [convertCurrencyTool],
      toolChoice: "auto",
    });

    const request = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(request.reasoning).toEqual({ effort: "low", exclude: false });
    expect(request.parallel_tool_calls).toBeUndefined();
    expect(request.provider).toEqual({ require_parameters: true });
    expect(turn.reasoningDetails).toEqual(reasoningDetails);
  });

  it("мапить incomplete generation на типізовану помилку", async () => {
    const create = vi.fn().mockResolvedValue({
      model: "test-main",
      choices: [
        {
          index: 0,
          finish_reason: "length",
          message: { role: "assistant", content: "Частина", refusal: null },
        },
      ],
      usage: null,
    });
    const openai = { chat: { completions: { create } } } as unknown as OpenAI;
    const client = new OpenAIChatCompletionsClient(openai, {
      modelName: "test-main",
      maxOutputTokens: 800,
    });

    await expect(
      client.createResponse({
        messages: [{ role: "user", content: "Тест" }],
        tools: [convertCurrencyTool],
        toolChoice: "auto",
      }),
    ).rejects.toMatchObject({
      code: "INCOMPLETE_RESPONSE",
      statusCode: 502,
    });
  });

  it("мапить refusal на типізовану помилку", async () => {
    const create = vi.fn().mockResolvedValue({
      model: "test-main",
      choices: [
        {
          index: 0,
          finish_reason: "content_filter",
          message: { role: "assistant", content: "Відмова", refusal: "Відмова" },
        },
      ],
      usage: null,
    });
    const openai = { chat: { completions: { create } } } as unknown as OpenAI;
    const client = new OpenAIChatCompletionsClient(openai, {
      modelName: "test-main",
      maxOutputTokens: 800,
    });

    await expect(
      client.createResponse({
        messages: [{ role: "user", content: "Тест" }],
        tools: [convertCurrencyTool],
        toolChoice: "auto",
      }),
    ).rejects.toMatchObject({
      code: "REQUEST_REFUSED",
      statusCode: 422,
    });
  });
});
