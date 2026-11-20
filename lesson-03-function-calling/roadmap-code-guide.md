# Roadmap code guide – Lesson 03 OpenAI

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Реалізувати контрольований цикл між Responses API, валідованим currency tool і фінальною відповіддю.

### 💎 Практична цінність застосунку

Межі аргументів, retry та кількості викликів задаються застосунком, а не довіряються текстовому рішенню моделі.

### ⚙️ Що робить застосунок

`ResponsesToolCallingAgent` читає `function_call`, додає відповідний `function_call_output` і повторює model turn до фінального тексту або контрольованої зупинки.

Виконуйте цей план в student workspace **my-dev/lesson-03-function-calling/**, який Prompt 1 створив із Lesson 03 OpenAI starter. Шляхи в колонці File відносні до кореня репозиторію. Обов'язковий контракт задає [homework.md](./homework.md).

Кожен новий production або test file нижче має повний payload, звірений з OpenAI Lesson 03 solution. Переносьте блоки по одному в student workspace в наведеному порядку. Не копіюйте каталог solution цілком, не змінюйте канонічні starter/solution/dev, package.json, tsconfig або попередні уроки. Якщо в my-dev файл уже існує з вашими правками, спершу порівняйте його й збережіть власні зміни.

## 0. Підтвердіть student workspace

- **File:** корінь репозиторію, package.json і папка my-dev/lesson-03-function-calling/.
- **Action:** звірте результат Prompt 1; код не змінюйте.
- **Anchor:** student README має вказувати на branch lesson-03-function-calling, `my-dev/lesson-03-function-calling/` та команди `student:* 03 openai`.
  Канонічний starter містить байтово тотожний non-Markdown snapshot OpenAI solution Lesson 02; вимоги поточного заняття реалізуйте й перевіряйте лише в my-dev/lesson-03-function-calling/.

```powershell
yarn vitest run my-dev/lesson-03-function-calling/tests
```

Якщо папки, гілки або starter source не збігаються, поверніться до STUDENTS.md. Не перезаписуйте наявну роботу starter-копією.

## 1. Додайте контрольовану класифікацію помилок

- **File:** my-dev/lesson-03-function-calling/src/lib/tool-errors.ts.
- **Action:** створіть новий файл і вставте повний payload нижче.
- **Anchor:** файла немає в starter; не створюйте його повторно, якщо він уже є в вашій копії.
- **Check:** після кроку 7 тести мають покрити весь error taxonomy, Retry-After та HTTP status mapping.

```ts
export type ToolErrorCode =
  | "INVALID_TOOL_ARGUMENTS"
  | "UNKNOWN_TOOL"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "UNSUPPORTED_CURRENCY_PAIR"
  | "TOOL_CALL_LIMIT_REACHED"
  | "TOOL_EXECUTION_ERROR";

export class ToolError extends Error {
  public constructor(
    public readonly code: ToolErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ToolError";
  }
}

export function getPublicToolMessage(code: ToolErrorCode): string {
  switch (code) {
    case "INVALID_TOOL_ARGUMENTS":
      return "Передані аргументи не відповідають визначеній схемі.";
    case "UNKNOWN_TOOL":
      return "Запитуваний інструмент не зареєстровано у застосунку.";
    case "UPSTREAM_TIMEOUT":
      return "Час очікування відповіді зовнішнього сервісу вичерпано.";
    case "UPSTREAM_RATE_LIMITED":
      return "Зовнішній сервіс тимчасово обмежив частоту запитів.";
    case "UPSTREAM_UNAVAILABLE":
      return "Зовнішній фінансовий сервіс тимчасово недоступний.";
    case "UNSUPPORTED_CURRENCY_PAIR":
      return "Валютна пара не підтримується навчальним сервісом.";
    case "TOOL_CALL_LIMIT_REACHED":
      return "Перевищено дозволену кількість викликів інструментів.";
    case "TOOL_EXECUTION_ERROR":
      return "Не вдалося виконати інструмент.";
  }
}

const MONTH_INDEX: Readonly<Record<string, number>> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
  Sun: 0,
  Sunday: 0,
  Mon: 1,
  Monday: 1,
  Tue: 2,
  Tuesday: 2,
  Wed: 3,
  Wednesday: 3,
  Thu: 4,
  Thursday: 4,
  Fri: 5,
  Friday: 5,
  Sat: 6,
  Saturday: 6,
};

const IMF_FIXDATE_PATTERN =
  /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/;

const RFC850_DATE_PATTERN =
  /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), (\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2}) (\d{2}):(\d{2}):(\d{2}) GMT$/;

const ASCTIME_DATE_PATTERN =
  /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (?: (\d)|(\d{2})) (\d{2}):(\d{2}):(\d{2}) (\d{4})$/;

function readGroup(match: RegExpExecArray, index: number): string {
  const value = match[index];

  if (value === undefined) {
    throw new TypeError(`Missing HTTP-date capture group ${index}.`);
  }

  return value;
}

function toUtcDateMs(
  weekday: string,
  day: number,
  month: string,
  year: number,
  hour: number,
  minute: number,
  second: number,
): number | undefined {
  const monthIndex = MONTH_INDEX[month];
  const weekdayIndex = WEEKDAY_INDEX[weekday];

  if (
    monthIndex === undefined ||
    weekdayIndex === undefined ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 60
  ) {
    return undefined;
  }

  const isLeapSecond = second === 60;
  const date = new Date(0);

  date.setUTCFullYear(year, monthIndex, day);
  date.setUTCHours(hour, minute, isLeapSecond ? 59 : second, 0);

  const isExactDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === monthIndex &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === (isLeapSecond ? 59 : second) &&
    date.getUTCDay() === weekdayIndex;

  return isExactDate ? date.getTime() + (isLeapSecond ? 1_000 : 0) : undefined;
}

function parseHttpDate(value: string, now: number): number | undefined {
  const imfMatch = IMF_FIXDATE_PATTERN.exec(value);

  if (imfMatch) {
    return toUtcDateMs(
      readGroup(imfMatch, 1),
      Number(readGroup(imfMatch, 2)),
      readGroup(imfMatch, 3),
      Number(readGroup(imfMatch, 4)),
      Number(readGroup(imfMatch, 5)),
      Number(readGroup(imfMatch, 6)),
      Number(readGroup(imfMatch, 7)),
    );
  }

  const rfc850Match = RFC850_DATE_PATTERN.exec(value);

  if (rfc850Match) {
    const currentYear = new Date(now).getUTCFullYear();
    const twoDigitYear = Number(readGroup(rfc850Match, 4));

    let year = Math.floor(currentYear / 100) * 100 + twoDigitYear;

    if (year > currentYear + 50) {
      year -= 100;
    }

    return toUtcDateMs(
      readGroup(rfc850Match, 1),
      Number(readGroup(rfc850Match, 2)),
      readGroup(rfc850Match, 3),
      year,
      Number(readGroup(rfc850Match, 5)),
      Number(readGroup(rfc850Match, 6)),
      Number(readGroup(rfc850Match, 7)),
    );
  }

  const asctimeMatch = ASCTIME_DATE_PATTERN.exec(value);

  if (asctimeMatch) {
    const day = Number(asctimeMatch[3] ?? asctimeMatch[4]);

    return toUtcDateMs(
      readGroup(asctimeMatch, 1),
      day,
      readGroup(asctimeMatch, 2),
      Number(readGroup(asctimeMatch, 8)),
      Number(readGroup(asctimeMatch, 5)),
      Number(readGroup(asctimeMatch, 6)),
      Number(readGroup(asctimeMatch, 7)),
    );
  }

  return undefined;
}

export function parseRetryAfter(
  value: string | null,
  now: number = Date.now(),
): number | undefined {
  const normalized = value?.trim();

  if (!normalized) {
    return undefined;
  }

  if (/^\d+$/.test(normalized)) {
    const seconds = Number(normalized);
    const maxSafeSeconds = Math.floor(Number.MAX_SAFE_INTEGER / 1_000);

    return Number.isSafeInteger(seconds) && seconds <= maxSafeSeconds ? seconds * 1_000 : undefined;
  }

  const dateMs = parseHttpDate(normalized, now);

  return dateMs === undefined ? undefined : Math.max(0, dateMs - now);
}

export function createHttpToolError(response: Response): ToolError {
  const retryAfterMs = parseRetryAfter(response.headers.get("Retry-After"));

  switch (response.status) {
    case 408:
      return new ToolError(
        "UPSTREAM_TIMEOUT",
        "Зовнішній сервіс не відповів вчасно.",
        true,
        retryAfterMs,
      );
    case 429:
      return new ToolError(
        "UPSTREAM_RATE_LIMITED",
        "Зовнішній сервіс обмежив частоту запитів.",
        true,
        retryAfterMs,
      );
    case 500:
    case 502:
    case 503:
    case 504:
      return new ToolError(
        "UPSTREAM_UNAVAILABLE",
        `Зовнішній сервіс повернув HTTP ${response.status}.`,
        true,
        retryAfterMs,
      );
    default:
      return new ToolError(
        "TOOL_EXECUTION_ERROR",
        `Зовнішній сервіс повернув HTTP ${response.status}.`,
        false,
      );
  }
}
```

## 2. Додайте bounded retry

- **File:** my-dev/lesson-03-function-calling/src/lib/retry.ts
- **Action:** Створіть новий файл із повним payload нижче.
- **Anchor:** Файл відсутній в starter.
- **Check:** Після кроку 7 запустіть tests/tool-calling.test.ts; timeout, non-retryable errors, backoff і Retry-After мають пройти.

```ts
import { ToolError } from "./tool-errors.js";
import type { ToolErrorCode } from "./tool-errors.js";

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
}

export interface RetryEvent {
  operationName: string;
  attempt: number;
  delayMs: number;
  code: ToolErrorCode;
}

export interface RetryDependencies {
  sleep?: (delayMs: number) => Promise<void>;
  random?: () => number;
  onRetry?: (event: RetryEvent) => void;
}

export function calculateBackoff(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  random: () => number,
): number {
  const exponentialDelay = baseDelayMs * 2 ** (attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  const jitter = random() * cappedDelay * 0.2;

  return cappedDelay + jitter;
}

export function normalizeRetryError(
  error: unknown,
  operationName: string,
  timeoutMs: number,
): ToolError {
  if (error instanceof ToolError) {
    return error;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return new ToolError(
      "UPSTREAM_TIMEOUT",
      `Операцію "${operationName}" перервано через таймаут (${timeoutMs} ms).`,
      true,
    );
  }

  throw error;
}

export async function executeWithRetry<T>(
  operationName: string,
  operation: (signal: AbortSignal) => Promise<T>,
  options: RetryOptions,
  dependencies: RetryDependencies = {},
): Promise<T> {
  if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1) {
    throw new RangeError("maxAttempts має бути додатним цілим числом.");
  }

  const sleep =
    dependencies.sleep ??
    ((delayMs: number) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  const random = dependencies.random ?? Math.random;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
    let caughtError: unknown;

    try {
      return await operation(controller.signal);
    } catch (error: unknown) {
      caughtError = error;
    } finally {
      clearTimeout(timeoutId);
    }

    const retryError = normalizeRetryError(caughtError, operationName, options.timeoutMs);

    if (!retryError.retryable || attempt === options.maxAttempts) {
      throw retryError;
    }

    const delayMs =
      retryError.retryAfterMs ??
      calculateBackoff(attempt, options.baseDelayMs, options.maxDelayMs, random);

    dependencies.onRetry?.({
      operationName,
      attempt,
      delayMs,
      code: retryError.code,
    });

    await sleep(delayMs);
  }

  throw new ToolError(
    "UPSTREAM_UNAVAILABLE",
    `Операція "${operationName}" перевищила ліміт спроб.`,
    true,
  );
}
```

## 3. Додайте currency tool і безпечне виконання

- **File:** my-dev/lesson-03-function-calling/src/tools/currency.ts
- **Action:** Створіть новий файл із повним payload нижче.
- **Anchor:** Файл відсутній в starter.
- **Check:** Після кроку 7 schema, provider, unknown-tool, invalid-args та success-output tests мають пройти.

```ts
import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type {
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses";
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
    .toUpperCase(),
  to: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "Код валюти повинен містити рівно 3 латинські літери")
    .toUpperCase(),
});

export type ConvertCurrencyArgs = z.infer<typeof ConvertCurrencyArgsSchema>;

export const convertCurrencyTool = zodResponsesFunction({
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
  call: ResponseFunctionToolCall,
  provider: RateProvider,
  retryDependencies: RetryDependencies = {},
): Promise<ResponseInputItem.FunctionCallOutput> {
  if (call.name !== "convert_currency") {
    return createErrorOutput(call.call_id, "UNKNOWN_TOOL", false);
  }

  try {
    let rawArguments: unknown;

    try {
      rawArguments = JSON.parse(call.arguments);
    } catch {
      throw new ToolError(
        "INVALID_TOOL_ARGUMENTS",
        "Аргументи інструмента не є валідним JSON.",
        false,
      );
    }

    const parsedArguments = ConvertCurrencyArgsSchema.safeParse(rawArguments);

    if (!parsedArguments.success) {
      return {
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify({
          status: "error",
          code: "INVALID_TOOL_ARGUMENTS",
          message: getPublicToolMessage("INVALID_TOOL_ARGUMENTS"),
          details: z.flattenError(parsedArguments.error),
          retryable: false,
        }),
      };
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
      type: "function_call_output",
      call_id: call.call_id,
      output: JSON.stringify({
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
      return createErrorOutput(call.call_id, error.code, error.retryable);
    }

    console.error("[Tool Execution Internal Error]", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: "Internal tool execution error",
    });

    return createErrorOutput(call.call_id, "TOOL_EXECUTION_ERROR", false);
  }
}

function createErrorOutput(
  callId: string,
  code: ToolErrorCode,
  retryable: boolean,
): ResponseInputItem.FunctionCallOutput {
  return {
    type: "function_call_output",
    call_id: callId,
    output: JSON.stringify({
      status: "error",
      code,
      message: getPublicToolMessage(code),
      retryable,
    }),
  };
}
```

## 3.1. Додайте підсумовування usage усіх model turns

- **File:** my-dev/lesson-03-function-calling/src/lib/metrics.ts.
- **Action:** вставте нову функцію в кінець наявного файла, зберігши всі успадковані функції.
- **Anchor:** знайдіть єдиний рядок `return Number((Math.min(inputTokens, Math.max(0, cachedTokens)) / inputTokens).toFixed(4));` в `calculateCacheHitRate`. Вставте блок одразу після наступної закривальної `}` цієї функції. Сам anchor вдруге не копіюйте.
- **Check:** `yarn student:build 03 openai` має завершитися з кодом 0; наступний крок зможе імпортувати `sumUsageMetrics`.

```ts
export function sumUsageMetrics(left: UsageMetrics, right: UsageMetrics): UsageMetrics {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    totalTokens: left.totalTokens + right.totalTokens,
    cachedTokens: left.cachedTokens + right.cachedTokens,
    cacheWriteTokens: left.cacheWriteTokens + right.cacheWriteTokens,
  };
}
```

## 4. Додайте Responses client та bounded agent loop

- **File:** my-dev/lesson-03-function-calling/src/services/tool-calling-agent.ts
- **Action:** Створіть новий файл із повним payload нижче.
- **Anchor:** Файл відсутній в starter.
- **Check:** Після кроку 7 reasoning replay, tool limit, usage і request-option tests мають пройти.

```ts
import type OpenAI from "openai";
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems";
import type {
  ResponseFunctionToolCall,
  ResponseInputItem,
  ResponseOutputItem,
} from "openai/resources/responses/responses";
import { extractUsageMetrics, sumUsageMetrics } from "../lib/metrics.js";
import type { ResponseUsageLike, UsageMetrics } from "../lib/metrics.js";
import type { RetryDependencies } from "../lib/retry.js";
import {
  convertCurrencyTool,
  EducationalRateProvider,
  executeCurrencyToolCall,
} from "../tools/currency.js";
import type { RateProvider } from "../tools/currency.js";

export const TOOL_AGENT_INSTRUCTIONS = [
  "Доступний інструмент convert_currency для конвертації валют.",
  "Інструмент викликається лише тоді, коли в запиті явно задано суму, вихідну та цільову валюти.",
  "Якщо бракує валюти або суми, формується коротке уточнювальне запитання без виклику інструмента.",
  "Для запитів, не пов’язаних із конвертацією валют, надається пряма коротка відповідь.",
  "Курс валют не можна вигадувати.",
].join("\n");

export interface ModelTurn {
  output: ResponseOutputItem[];
  outputText: string;
  model: string;
  usage?: ResponseUsageLike | null;
}

export interface ModelResponseRequest {
  input: ResponseInputItem[];
  tools: Array<typeof convertCurrencyTool>;
  toolChoice: "auto";
  parallelToolCalls: false;
}

export interface ModelResponsesClient {
  createResponse(request: ModelResponseRequest): Promise<ModelTurn>;
}

export interface OpenAIResponsesClientOptions {
  modelName: string;
  maxOutputTokens: number;
}

export class OpenAIResponsesClient implements ModelResponsesClient {
  public constructor(
    private readonly client: OpenAI,
    private readonly options: Readonly<OpenAIResponsesClientOptions>,
  ) {}

  public async createResponse(request: ModelResponseRequest): Promise<ModelTurn> {
    const response = await this.client.responses.create({
      model: this.options.modelName,
      instructions: TOOL_AGENT_INSTRUCTIONS,
      input: request.input,
      tools: request.tools,
      tool_choice: request.toolChoice,
      parallel_tool_calls: request.parallelToolCalls,
      store: false,
      max_output_tokens: this.options.maxOutputTokens,
    });

    return {
      output: response.output,
      outputText: response.output_text,
      model: response.model || this.options.modelName,
      ...(response.usage === undefined ? {} : { usage: response.usage }),
    };
  }
}

export interface AgentRunMetrics {
  modelCallCount: number;
  toolCallCount: number;
  retryCount: number;
  totalLatencyMs: number;
}

interface AgentRunBase {
  model: string;
  usage: UsageMetrics;
  metrics: AgentRunMetrics;
}

export type AgentRunResult =
  | (AgentRunBase & {
      status: "success";
      text: string;
    })
  | (AgentRunBase & {
      status: "error";
      code: "EMPTY_MODEL_RESPONSE" | "TOOL_CALL_LIMIT_REACHED";
      message: string;
    });

export interface ToolCallingAgent {
  run(message: string): Promise<AgentRunResult>;
}

export interface ResponsesToolCallingAgentOptions {
  maxToolCalls?: number;
  retryDependencies?: RetryDependencies;
  now?: () => number;
}

export class ResponsesToolCallingAgent implements ToolCallingAgent {
  private readonly maxToolCalls: number;
  private readonly retryDependencies: RetryDependencies;
  private readonly now: () => number;

  public constructor(
    private readonly responsesClient: ModelResponsesClient,
    private readonly provider: RateProvider = new EducationalRateProvider(),
    options: ResponsesToolCallingAgentOptions = {},
  ) {
    this.maxToolCalls = options.maxToolCalls ?? 5;
    this.retryDependencies = options.retryDependencies ?? {};
    this.now = options.now ?? (() => performance.now());

    if (!Number.isInteger(this.maxToolCalls) || this.maxToolCalls < 1) {
      throw new RangeError("maxToolCalls має бути додатним цілим числом.");
    }
  }

  public async run(message: string): Promise<AgentRunResult> {
    const startedAt = this.now();
    const input: ResponseInputItem[] = [{ role: "user", content: message }];
    let model = "unknown";
    let usage = extractUsageMetrics();
    let modelCallCount = 0;
    let toolCallCount = 0;
    let retryCount = 0;

    const retryDependencies: RetryDependencies = {
      ...this.retryDependencies,
      onRetry: (event) => {
        retryCount += 1;
        console.warn("[Tool Retry]", {
          operationName: event.operationName,
          attempt: event.attempt,
          delayMs: Math.round(event.delayMs),
          code: event.code,
        });
        this.retryDependencies.onRetry?.(event);
      },
    };

    while (true) {
      modelCallCount += 1;

      const response = await this.responsesClient.createResponse({
        input,
        tools: [convertCurrencyTool],
        toolChoice: "auto",
        parallelToolCalls: false,
      });

      model = response.model;
      usage = sumUsageMetrics(usage, extractUsageMetrics(response.usage));
      input.push(...toResponseInputItems(response.output));

      const functionCall = response.output.find(
        (item): item is ResponseFunctionToolCall => item.type === "function_call",
      );

      if (!functionCall) {
        const outputText = response.outputText.trim();

        if (outputText === "") {
          return {
            status: "error",
            code: "EMPTY_MODEL_RESPONSE",
            message: "Модель не повернула фінальної відповіді.",
            model,
            usage,
            metrics: createMetrics(modelCallCount, toolCallCount, retryCount, startedAt, this.now),
          };
        }

        return {
          status: "success",
          text: outputText,
          model,
          usage,
          metrics: createMetrics(modelCallCount, toolCallCount, retryCount, startedAt, this.now),
        };
      }

      if (toolCallCount >= this.maxToolCalls) {
        return {
          status: "error",
          code: "TOOL_CALL_LIMIT_REACHED",
          message: "Запит не завершено в межах дозволеної кількості викликів інструментів.",
          model,
          usage,
          metrics: createMetrics(modelCallCount, toolCallCount, retryCount, startedAt, this.now),
        };
      }

      toolCallCount += 1;
      console.log("[Tool Call]", {
        callId: functionCall.call_id,
        toolName: functionCall.name,
        toolCallCount,
      });

      const toolOutput = await executeCurrencyToolCall(
        functionCall,
        this.provider,
        retryDependencies,
      );
      input.push(toolOutput);
    }
  }
}

function createMetrics(
  modelCallCount: number,
  toolCallCount: number,
  retryCount: number,
  startedAt: number,
  now: () => number,
): AgentRunMetrics {
  return {
    modelCallCount,
    toolCallCount,
    retryCount,
    totalLatencyMs: Math.max(0, Math.round(now() - startedAt)),
  };
}
```

## 5. Підключіть agent до HTTP API

- **File:** my-dev/lesson-03-function-calling/src/app.ts
- **Action:** В student copy замініть файл повним payload нижче; Document routes залишаються збереженими.

- **Check:** Після кроку 8 invalid input дає 400, agent route проходить fake-agent integration tests, відсутній runtime дає 503.

```ts
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { calculateCost, MODEL_PRICES, type ModelPricing } from "./config/pricing.js";
import { createApiError, DocumentAiError, type ApiErrorResponse } from "./lib/errors.js";
import { calculateCacheHitRate, extractUsageMetrics } from "./lib/metrics.js";
import { sendSseHeaders, writeSseEvent } from "./lib/sse.js";
import { AgentRequestSchema } from "./schemas/agent-request.js";
import { DocumentRequestSchema } from "./schemas/document-request.js";
import type { Extraction } from "./schemas/extraction.js";
import type { DocumentAi } from "./services/document-ai.js";
import type { AgentRunResult, ToolCallingAgent } from "./services/tool-calling-agent.js";

export interface AppDependencies {
  ai: DocumentAi;
  toolAgent?: ToolCallingAgent;
  now?: () => number;
  prices?: Readonly<Record<string, ModelPricing>>;
}

export interface ExtractionApiResponse {
  data: Extraction;
  usage: ReturnType<typeof extractUsageMetrics>;
  metrics: {
    model: string;
    totalLatencyMs: number;
    cacheHitRate: number;
  } & ReturnType<typeof calculateCost>;
}

type StreamTerminalState = "pending" | "completed" | "incomplete" | "failed" | "refused";

type HttpErrorLike = {
  status?: number;
  type?: string;
};

function isHttpErrorLike(error: unknown): error is HttpErrorLike {
  return typeof error === "object" && error !== null;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  const now = dependencies.now ?? (() => performance.now());
  const prices = dependencies.prices ?? MODEL_PRICES;

  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.post(
    "/api/agent",
    async (
      request: Request,
      response: Response<AgentRunResult | ApiErrorResponse>,
      next: NextFunction,
    ): Promise<void> => {
      const parsedRequest = AgentRequestSchema.safeParse(request.body);

      if (!parsedRequest.success) {
        response
          .status(400)
          .json(
            createApiError(
              "INVALID_INPUT",
              "Невалідний запит.",
              z.flattenError(parsedRequest.error),
            ),
          );
        return;
      }

      if (!dependencies.toolAgent) {
        response
          .status(503)
          .json(createApiError("SERVICE_UNAVAILABLE", "Tool-calling runtime не налаштовано."));
        return;
      }

      try {
        response.json(await dependencies.toolAgent.run(parsedRequest.data.message));
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/api/documents/extract",
    async (
      request: Request,
      response: Response<ExtractionApiResponse | ApiErrorResponse>,
      next: NextFunction,
    ): Promise<void> => {
      const parsedRequest = DocumentRequestSchema.safeParse(request.body);

      if (!parsedRequest.success) {
        response
          .status(400)
          .json(
            createApiError(
              "INVALID_INPUT",
              "Невалідний запит.",
              z.flattenError(parsedRequest.error),
            ),
          );
        return;
      }

      const startedAt = now();

      try {
        const result = await dependencies.ai.extract(parsedRequest.data.content);
        const usage = extractUsageMetrics(result.usage);
        const cacheHitRate = calculateCacheHitRate(usage.inputTokens, usage.cachedTokens);

        response.json({
          data: result.data,
          usage,
          metrics: {
            model: result.model,
            totalLatencyMs: Math.max(0, Math.round(now() - startedAt)),
            cacheHitRate,
            ...calculateCost(result.model, usage, prices),
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/api/documents/summary/stream",
    async (request: Request, response: Response<ApiErrorResponse | void>): Promise<void> => {
      const parsedRequest = DocumentRequestSchema.safeParse(request.body);

      if (!parsedRequest.success) {
        response
          .status(400)
          .json(
            createApiError(
              "INVALID_INPUT",
              "Невалідний запит.",
              z.flattenError(parsedRequest.error),
            ),
          );
        return;
      }

      const controller = new AbortController();
      const abortIfOpen = (): void => {
        if (!response.writableEnded) {
          controller.abort();
        }
      };

      request.once("aborted", abortIfOpen);
      response.once("close", abortIfOpen);

      const startedAt = now();
      let firstDeltaAt: number | null = null;
      let terminalState: StreamTerminalState = "pending";

      sendSseHeaders(response);

      try {
        for await (const event of dependencies.ai.streamSummary(
          parsedRequest.data.content,
          controller.signal,
        )) {
          if (controller.signal.aborted || response.writableEnded) {
            return;
          }

          switch (event.type) {
            case "delta":
              firstDeltaAt ??= now();
              writeSseEvent(response, "delta", { delta: event.delta });
              break;

            case "refused":
              terminalState = "refused";
              break;

            case "incomplete":
              terminalState = "incomplete";
              writeSseEvent(response, "error", {
                code: "INCOMPLETE_RESPONSE",
                message: "Генерацію не було завершено.",
                reason: event.reason,
              });
              break;

            case "failed":
              terminalState = "failed";
              writeSseEvent(response, "error", {
                code: "RESPONSE_FAILED",
                message: "Не вдалося виконати генерацію.",
                reason: event.reason,
              });
              break;

            case "completed": {
              terminalState = terminalState === "refused" ? "refused" : "completed";
              const usage = extractUsageMetrics(event.usage);
              const totalLatencyMs = Math.max(0, Math.round(now() - startedAt));
              const ttftMs =
                firstDeltaAt === null ? null : Math.max(0, Math.round(firstDeltaAt - startedAt));

              writeSseEvent(response, "usage", {
                usage,
                metrics: {
                  model: event.model,
                  ttftMs,
                  totalLatencyMs,
                  cacheHitRate: calculateCacheHitRate(usage.inputTokens, usage.cachedTokens),
                  ...calculateCost(event.model, usage, prices),
                },
              });
              break;
            }
          }

          if (terminalState === "incomplete" || terminalState === "failed") {
            break;
          }
        }

        if (controller.signal.aborted || response.writableEnded) {
          return;
        }

        if (terminalState === "completed") {
          writeSseEvent(response, "done", { status: "completed" });
        } else if (terminalState === "refused") {
          writeSseEvent(response, "error", {
            code: "REQUEST_REFUSED",
            message: "Модель відхилила запит.",
          });
        } else if (terminalState === "pending") {
          writeSseEvent(response, "error", {
            code: "STREAM_ENDED_UNEXPECTEDLY",
            message: "Потік завершився без термінальної події.",
          });
        }

        response.end();
      } catch (error) {
        if (controller.signal.aborted || response.writableEnded) {
          return;
        }

        const mapped =
          error instanceof DocumentAiError
            ? error
            : new DocumentAiError("STREAM_ERROR", "Помилка потокової передачі.", 502);

        writeSseEvent(response, "error", {
          code: mapped.code,
          message: mapped.message,
          ...(mapped.details === undefined ? {} : { details: mapped.details }),
        });
        response.end();
      } finally {
        request.off("aborted", abortIfOpen);
        response.off("close", abortIfOpen);
      }
    },
  );

  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response<ApiErrorResponse>,
      next: NextFunction,
    ): void => {
      if (response.headersSent) {
        next(error);
        return;
      }

      if (error instanceof DocumentAiError) {
        response
          .status(error.statusCode)
          .json(createApiError(error.code, error.message, error.details));
        return;
      }

      if (isHttpErrorLike(error) && error.status === 413) {
        response
          .status(413)
          .json(createApiError("PAYLOAD_TOO_LARGE", "Тіло запиту перевищує дозволений розмір."));
        return;
      }

      if (
        error instanceof SyntaxError &&
        isHttpErrorLike(error) &&
        error.status === 400 &&
        error.type === "entity.parse.failed"
      ) {
        response
          .status(400)
          .json(createApiError("MALFORMED_JSON", "Тіло запиту містить невалідний JSON."));
        return;
      }

      response
        .status(500)
        .json(createApiError("INTERNAL_SERVER_ERROR", "Внутрішня помилка сервера."));
    },
  );

  return app;
}
```

## 6. Зберіть runtime в server.ts

- **File:** my-dev/lesson-03-function-calling/src/server.ts
- **Action:** В student copy замініть файл повним payload нижче.
- **Anchor:** В starter є рядок const app = createApp({ ai });.
- **Check:** Після кроку 8 typecheck підтверджує main model і maxOutputTokens із environment.

```ts
import dotenv from "dotenv";
import OpenAI from "openai";
import { createApp } from "./app.js";
import { loadEnvironment } from "./config/env.js";
import { resolveModel } from "./config/models.js";
import { OpenAiDocumentAi } from "./services/openai-document-ai.js";
import { OpenAIResponsesClient, ResponsesToolCallingAgent } from "./services/tool-calling-agent.js";
import { EducationalRateProvider } from "./tools/currency.js";

dotenv.config({ quiet: true });

function startServer(): void {
  const environment = loadEnvironment(process.env);
  const openai = new OpenAI({
    apiKey: environment.OPENAI_API_KEY,
    timeout: environment.OPENAI_TIMEOUT_MS,
    maxRetries: 1,
  });
  const ai = new OpenAiDocumentAi(openai, {
    fastModel: resolveModel("fast", environment),
    mainModel: resolveModel("main", environment),
    maxOutputTokens: environment.OPENAI_MAX_OUTPUT_TOKENS,
  });
  const responsesClient = new OpenAIResponsesClient(openai, {
    modelName: resolveModel("main", environment),
    maxOutputTokens: environment.OPENAI_MAX_OUTPUT_TOKENS,
  });
  const toolAgent = new ResponsesToolCallingAgent(responsesClient, new EducationalRateProvider());
  const app = createApp({ ai, toolAgent });

  app.listen(environment.PORT, () => {
    console.log(`Document and Tool API працює на http://localhost:${environment.PORT}`);
  });
}

try {
  startServer();
} catch (error) {
  const message = error instanceof Error ? error.message : "Непередбачена помилка конфігурації.";
  console.error(`Не вдалося запустити сервер: ${message}`);
  process.exitCode = 1;
}
```

## 7. Додайте 14 tool-calling regression tests у власну копію

- **File:** my-dev/lesson-03-function-calling/tests/tool-calling.test.ts
- **Action:** Створіть у `my-dev` активний test suite для нового runtime, використовуючи повний payload нижче.
- **Check:** Перевірте всі сценарії цього файлу; успадковані Document API tests залишаються активними, а `student:check` відхиляє `todo`, `skip` та `only`.

```ts
import type OpenAI from "openai";
import type {
  ResponseFunctionToolCall,
  ResponseInputItem,
  ResponseReasoningItem,
} from "openai/resources/responses/responses";
import { afterEach, describe, expect, it, vi } from "vitest";
import { executeWithRetry, calculateBackoff } from "../src/lib/retry.js";
import { createHttpToolError, parseRetryAfter, ToolError } from "../src/lib/tool-errors.js";
import {
  OpenAIResponsesClient,
  ResponsesToolCallingAgent,
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
): ResponseFunctionToolCall {
  return {
    id: `fc_${callId}`,
    type: "function_call",
    status: "completed",
    call_id: callId,
    name,
    arguments: typeof argumentsValue === "string" ? argumentsValue : JSON.stringify(argumentsValue),
  };
}

function parseToolOutput(output: ResponseInputItem.FunctionCallOutput): Record<string, unknown> {
  if (typeof output.output !== "string") {
    throw new TypeError("У тесті очікується текстовий function_call_output.");
  }

  return JSON.parse(output.output) as Record<string, unknown>;
}

function createTextTurn(text: string, usage?: ModelTurn["usage"]): ModelTurn {
  return {
    output: [],
    outputText: text,
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
    output: [createFunctionCall(argumentsValue, callId)],
    outputText: "",
    model: "test-model",
    ...(usage === undefined ? {} : { usage }),
  };
}

class SequenceResponsesClient implements ModelResponsesClient {
  public readonly requests: ModelResponseRequest[] = [];

  public constructor(private readonly turns: ModelTurn[]) {}

  public async createResponse(request: ModelResponseRequest): Promise<ModelTurn> {
    this.requests.push({ ...request, input: [...request.input] });
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
    expect(convertCurrencyTool.strict).toBe(true);
    expect(convertCurrencyTool.parameters).toMatchObject({
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
    const agent = new ResponsesToolCallingAgent(client, new EducationalRateProvider(), {
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

  it("зберігає reasoning output, повертає tool output і підсумовує usage model turns", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const reasoningItem: ResponseReasoningItem = {
      id: "rs_currency",
      type: "reasoning",
      summary: [],
      status: "completed",
    };
    const client = new SequenceResponsesClient([
      {
        output: [
          reasoningItem,
          createFunctionCall({ amount: 10, from: "USD", to: "UAH" }, "call_currency"),
        ],
        outputText: "",
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
    const agent = new ResponsesToolCallingAgent(client, new EducationalRateProvider(), {
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
        toolCallCount: 1,
        retryCount: 0,
      },
    });
    expect(client.requests[0]).toMatchObject({
      toolChoice: "auto",
      parallelToolCalls: false,
    });
    expect(
      client.requests[1]?.input.map((item) => {
        if ("type" in item && typeof item.type === "string") {
          return item.type;
        }

        return "role" in item ? item.role : "unknown";
      }),
    ).toEqual(["user", "reasoning", "function_call", "function_call_output"]);
    expect(client.requests[1]?.input).toContain(reasoningItem);
  });

  it("рахує retryCount окремо від toolCallCount", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const client = new SequenceResponsesClient([
      createToolTurn("call_retry"),
      createTextTurn("Готово."),
    ]);
    const agent = new ResponsesToolCallingAgent(
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
    const agent = new ResponsesToolCallingAgent(client, { getRate }, { now: () => 100 });
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
    const agent = new ResponsesToolCallingAgent(client, { getRate }, { now: () => 100 });
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
    const agent = new ResponsesToolCallingAgent(client, new EducationalRateProvider(), {
      now: () => 100,
    });

    await expect(agent.run("Тест")).resolves.toMatchObject({
      status: "error",
      code: "EMPTY_MODEL_RESPONSE",
    });
  });

  it("передає OpenAI SDK безпечні та обмежені параметри", async () => {
    const create = vi.fn().mockResolvedValue({
      output: [],
      output_text: "Готово.",
      model: "configured-model",
      usage: null,
    });
    const openai = { responses: { create } } as unknown as OpenAI;
    const client = new OpenAIResponsesClient(openai, {
      modelName: "configured-model",
      maxOutputTokens: 800,
    });

    await client.createResponse({
      input: [{ role: "user", content: "Тест" }],
      tools: [convertCurrencyTool],
      toolChoice: "auto",
      parallelToolCalls: false,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "configured-model",
        store: false,
        max_output_tokens: 800,
        tool_choice: "auto",
        parallel_tool_calls: false,
        tools: [convertCurrencyTool],
      }),
    );
  });
});
```

## 8. Додайте HTTP integration tests

- **File:** my-dev/lesson-03-function-calling/tests/agent-route.test.ts
- **Action:** Створіть новий файл із повним payload нижче.
- **Anchor:** Файл відсутній в starter.
- **Check:** Очікуються 3 active tests для 400, 200 та 503 без OpenAI request.

```ts
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { DocumentAi } from "../src/services/document-ai.js";
import type { ToolCallingAgent } from "../src/services/tool-calling-agent.js";

const openServers = new Set<Server>();

afterEach(async () => {
  await Promise.all(
    [...openServers].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        }),
    ),
  );
  openServers.clear();
});

const documentAi: DocumentAi = {
  extract: vi.fn(),
  async *streamSummary() {
    return;
  },
};

async function startServer(toolAgent?: ToolCallingAgent): Promise<string> {
  const app = createApp({
    ai: documentAi,
    ...(toolAgent === undefined ? {} : { toolAgent }),
  });
  const server = await new Promise<Server>((resolve) => {
    const listeningServer = app.listen(0, "127.0.0.1", () => resolve(listeningServer));
  });
  openServers.add(server);
  const address = server.address() as AddressInfo;

  return `http://127.0.0.1:${address.port}`;
}

describe("POST /api/agent", () => {
  it("валідує message до запуску tool-calling runtime", async () => {
    const run = vi.fn<ToolCallingAgent["run"]>();
    const baseUrl = await startServer({ run });
    const response = await fetch(`${baseUrl}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "   " }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "INVALID_INPUT" },
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("передає нормалізоване повідомлення агенту та повертає метрики", async () => {
    const run = vi.fn<ToolCallingAgent["run"]>().mockResolvedValue({
      status: "success",
      text: "100 USD дорівнюють 4 150 UAH.",
      model: "configured-model",
      usage: {
        inputTokens: 20,
        outputTokens: 10,
        totalTokens: 30,
        cachedTokens: 0,
        cacheWriteTokens: 0,
      },
      metrics: {
        modelCallCount: 2,
        toolCallCount: 1,
        retryCount: 0,
        totalLatencyMs: 25,
      },
    });
    const baseUrl = await startServer({ run });
    const response = await fetch(`${baseUrl}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "  Конвертуй 100 USD у UAH  " }),
    });

    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledWith("Конвертуй 100 USD у UAH");
    expect(await response.json()).toMatchObject({
      status: "success",
      metrics: {
        modelCallCount: 2,
        toolCallCount: 1,
      },
    });
  });

  it("повертає 503, якщо runtime не підключено", async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Конвертуй 100 USD у UAH" }),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "SERVICE_UNAVAILABLE" },
    });
  });
});
```

## 9. Перевірте recorded tool eval contract

- **File:** my-dev/lesson-03-function-calling/tests/tool-evals.test.ts
- **Action:** Створіть новий файл із повним payload нижче.
- **Anchor:** На старті файлів tool-calling eval ще немає в копії; створіть cases, recorded results і scorer у `my-dev/lesson-03-function-calling/`.
- **Check:** Очікуються 2 active tests; eval fixtures не змінюйте.

```ts
import { describe, expect, it } from "vitest";
import { recordedToolResults } from "../evals/recorded-tool-results.js";
import { scoreToolCallingCase } from "../evals/tool-calling-scorer.js";
import { toolCallingEvalCases } from "../evals/tool-calling.eval.js";

describe("Lesson 03 tool-calling evals", () => {
  it("містить п’ять обов’язкових і унікальних сценаріїв", () => {
    expect(toolCallingEvalCases).toHaveLength(5);
    expect(new Set(toolCallingEvalCases.map((evalCase) => evalCase.id)).size).toBe(5);
    expect(toolCallingEvalCases.map((evalCase) => evalCase.expectedMode)).toEqual([
      "tool",
      "tool",
      "clarification",
      "tool",
      "direct",
    ]);
  });

  it("проходить deterministic recorded replay", () => {
    const observationsById = new Map(
      recordedToolResults.map((observation) => [observation.id, observation]),
    );
    const scores = toolCallingEvalCases.map((evalCase) => {
      const observation = observationsById.get(evalCase.id);

      if (!observation) {
        throw new Error(`Відсутнє спостереження для ${evalCase.id}.`);
      }

      return scoreToolCallingCase(evalCase, observation);
    });

    expect(scores.every((score) => score.passed)).toBe(true);
  });
});
```

## 10. Фінальна перевірка student-копії

- **File:** корінь репозиторію; змін не вносити.
- **Action:** запустіть test gate, обидва recorded evals, повний check та git hygiene.
- **Anchor:** scripts із суфіксом lesson03:openai мають адресувати my-dev/lesson-03-function-calling.
- **Check:** reference suite має завершитися без `failed`, `todo` і `skipped`; кожен recorded eval має дати очікуваний результат. Запишіть фактичний вивід runner. Це перевірка еталонного рішення, не результат вашої копії в `my-dev/`.

Перед фінальним check нормалізуйте формат і переноси рядків тільки в своїй папці `my-dev/lesson-03-function-calling/`. Після вставки нового блока редактор на Windows може додати CRLF або зайвий порожній рядок; наведений нижче scoped Prettier виправляє це без зміни канонічного starter.

```powershell
yarn prettier --write "my-dev/lesson-03-function-calling/**/*.{md,json,ts,tsx}"
yarn student:test 03 openai
yarn student:eval 03 openai
yarn student:check 03 openai
git diff --check -- my-dev/lesson-03-function-calling
git status --short --branch
```

У `my-dev` успадковані extraction evals залишайте без змін, а tool-calling cases і runner створіть за цим roadmap. Якщо `student:check` зупинився, перевірте відсутню поточну дельту або `todo`, `skip`, `only` у власних tests. Якщо вже реалізований маршрут повертає 501, перевірте dependency injection та server composition. Якщо invalid call дійшов до provider, виконуйте `safeParse()` до `getRate`; якщо з наступного turn зник reasoning, зберігайте всі `response.output` items перед `function_call_output`.

## Live boundary

Unit tests і recorded evals не потребують API key. Live-запит до OpenAI необов'язковий і може бути платним. Для нього потрібні OPENAI_API_KEY та OPENAI_MODEL_FAST/OPENAI_MODEL_MAIN в локальному root .env. Не показуйте ключ і не додавайте .env до Git. Записуйте live status окремо: Result 5/5 з recorded runner не є live-перевіркою.
