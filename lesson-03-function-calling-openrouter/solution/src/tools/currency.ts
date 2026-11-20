import { zodFunction } from "openai/helpers/zod";
import type {
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";
import { z } from "zod";
import { executeWithRetry } from "../lib/retry.js";
import type { RetryDependencies } from "../lib/retry.js";
import { createHttpToolError, getPublicToolMessage, ToolError } from "../lib/tool-errors.js";
import type { ToolErrorCode } from "../lib/tool-errors.js";

export const ConvertCurrencyArgsSchema = z.strictObject({
  amount: z.number().positive("Сума повинна бути більшою за 0"),
  from: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "Код валюти повинен містити рівно 3 латинські літери")
    .toUpperCase()
    .describe("3-літерний ISO-код вихідної валюти (наприклад: USD, EUR, UAH)"),
  to: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "Код валюти повинен містити рівно 3 латинські літери")
    .toUpperCase()
    .describe("3-літерний ISO-код цільової валюти (наприклад: USD, EUR, UAH)"),
});

export type ConvertCurrencyArgs = z.infer<typeof ConvertCurrencyArgsSchema>;

export const convertCurrencyTool: ChatCompletionTool = zodFunction({
  name: "convert_currency",
  description:
    "Конвертує суму між двома валютами. Викликається лише за наявності суми, вихідної та цільової валют. Курс не можна вигадувати.",
  parameters: ConvertCurrencyArgsSchema,
});

export interface RateProvider {
  getRate(from: string, to: string, signal: AbortSignal): Promise<number>;
}

export class EducationalRateProvider implements RateProvider {
  private readonly rates: Readonly<Record<string, number>> = {
    USD_UAH: 41.5,
    EUR_UAH: 45.2,
    EUR_USD: 1.09,
    USD_EUR: 0.9173,
    UAH_USD: 0.0241,
  };

  public async getRate(from: string, to: string, _signal: AbortSignal): Promise<number> {
    if (from === to) {
      return 1;
    }

    const rate = this.rates[`${from}_${to}`];

    if (rate === undefined) {
      throw new ToolError(
        "UNSUPPORTED_CURRENCY_PAIR",
        `Валютна пара ${from}/${to} не підтримується навчальним сервісом.`,
        false,
      );
    }

    return rate;
  }
}

export class ScriptedRateProvider implements RateProvider {
  private attempt = 0;

  public constructor(private readonly baseProvider: RateProvider) {}

  public async getRate(from: string, to: string, signal: AbortSignal): Promise<number> {
    this.attempt += 1;

    if (this.attempt === 1) {
      throw new ToolError(
        "UPSTREAM_UNAVAILABLE",
        "Навчальна тимчасова помилка зовнішнього сервісу.",
        true,
      );
    }

    return this.baseProvider.getRate(from, to, signal);
  }
}

const RateResponseSchema = z.strictObject({
  rate: z.number().positive(),
});

export type FetchImplementation = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

export class HttpRateProvider implements RateProvider {
  private readonly baseUrl: URL;

  public constructor(
    baseUrl: string,
    private readonly fetchImplementation: FetchImplementation = fetch,
  ) {
    this.baseUrl = new URL(baseUrl);
  }

  public async getRate(from: string, to: string, signal: AbortSignal): Promise<number> {
    const url = new URL("/rate", this.baseUrl);
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);

    let response: Response;

    try {
      response = await this.fetchImplementation(url, { signal });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }

      throw new ToolError(
        "UPSTREAM_UNAVAILABLE",
        "Не вдалося встановити з’єднання із зовнішнім сервісом.",
        true,
      );
    }

    if (!response.ok) {
      throw createHttpToolError(response);
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new ToolError(
        "TOOL_EXECUTION_ERROR",
        "Зовнішній сервіс повернув невалідний JSON.",
        false,
      );
    }

    const parsedPayload = RateResponseSchema.safeParse(payload);

    if (!parsedPayload.success) {
      throw new ToolError(
        "TOOL_EXECUTION_ERROR",
        "Відповідь зовнішнього сервісу не відповідає контракту.",
        false,
      );
    }

    return parsedPayload.data.rate;
  }
}

export async function executeCurrencyToolCall(
  call: ChatCompletionMessageToolCall,
  provider: RateProvider,
  retryDependencies: RetryDependencies = {},
): Promise<ChatCompletionToolMessageParam> {
  if (call.type !== "function" || call.function.name !== "convert_currency") {
    return createErrorOutput(call.id, "UNKNOWN_TOOL", false);
  }

  try {
    let rawArguments: unknown;

    try {
      rawArguments = JSON.parse(call.function.arguments);
    } catch {
      throw new ToolError(
        "INVALID_TOOL_ARGUMENTS",
        "Аргументи інструмента не є валідним JSON.",
        false,
      );
    }

    const parsedArguments = ConvertCurrencyArgsSchema.safeParse(rawArguments);

    if (!parsedArguments.success) {
      return createErrorOutput(call.id, "INVALID_TOOL_ARGUMENTS", false, {
        details: z.flattenError(parsedArguments.error),
      });
    }

    const { amount, from, to } = parsedArguments.data;
    const rate = await executeWithRetry(
      `convert_currency(${from}→${to})`,
      (signal) => provider.getRate(from, to, signal),
      {
        maxAttempts: 3,
        baseDelayMs: 200,
        maxDelayMs: 2_000,
        timeoutMs: 5_000,
      },
      retryDependencies,
    );

    return {
      role: "tool",
      tool_call_id: call.id,
      content: JSON.stringify({
        status: "success",
        data: {
          amount,
          from,
          to,
          rate,
          convertedAmount: Number((amount * rate).toFixed(2)),
        },
      }),
    };
  } catch (error: unknown) {
    if (error instanceof ToolError) {
      return createErrorOutput(call.id, error.code, error.retryable);
    }

    console.error("[Tool Execution Internal Error]", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: "Internal tool execution error",
    });

    return createErrorOutput(call.id, "TOOL_EXECUTION_ERROR", false);
  }
}

function createErrorOutput(
  callId: string,
  code: ToolErrorCode,
  retryable: boolean,
  extra: { details?: unknown } = {},
): ChatCompletionToolMessageParam {
  return {
    role: "tool",
    tool_call_id: callId,
    content: JSON.stringify({
      status: "error",
      code,
      message: getPublicToolMessage(code),
      retryable,
      ...(extra.details === undefined ? {} : { details: extra.details }),
    }),
  };
}
