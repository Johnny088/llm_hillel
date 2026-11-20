# Lesson 03 (OpenRouter) – roadmap реалізації Tool-Calling Agent

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Додати до успадкованого сервісу Lesson 02 контрольований tool-calling маршрут `POST /api/agent`. Модель формує декларативний виклик `convert_currency`, а TypeScript application boundary перевіряє аргументи, виконує тільки allowlisted функцію та повертає результат моделі.

### 💎 Практична цінність застосунку

Практика вчить безпечно під'єднувати локальні функції до OpenRouter Chat Completions. Strict schema, обмежений цикл, matching `tool_call_id`, керований retry та offline tests роблять межу між рішенням моделі й дією застосунку видимою та перевірюваною.

### ⚙️ Що робить застосунок

`POST /api/agent` приймає повідомлення, надсилає одній налаштованій моделі опис `convert_currency`, виконує валідований виклик локально та повертає фінальний текст, usage і runtime metrics. Успадковані `/health`, extraction та summary-stream routes зберігаються.

## Початок роботи та межі

1. Створіть чисту student branch. Якщо `my-dev/lesson-03-function-calling-openrouter/` уже існує, не запускайте overwrite copy. Перевірте її стан, збережіть потрібну роботу або оберіть новий чистий branch і destination.
2. Одноразово виконайте `yarn student:init 03 openrouter`, щоб створити `my-dev/lesson-03-function-calling-openrouter/` з canonical starter. Не запускайте init повторно поверх наявної роботи. `starter/` і `solution/` лишаються read-only.
3. Starter є точним Lesson 02 solution baseline. Успадковані 25 source/test/eval файлів і решта Markdown/data-файлів ідентичні, крім `starter/README.md` і `starter/evals/README.md`, які адаптовані до Lesson 03.
4. Новий tool request передає налаштовану `model`, `messages`, `tools`, `tool_choice: "auto"`, `max_completion_tokens`, `temperature: 0` і `provider.require_parameters: true`. Не додавайте `parallel_tool_calls`.
5. `src/lib/metrics.ts` успадковано без `sumUsageMetrics`; додайте helper в S04. В серверному wiring збережіть Lesson 02 document client contract.
6. Unit, route і recorded eval перевірки працюють без `.env`, ключа та мережі. Live OpenRouter запит не входить до Definition of Done.

## Маніфест кроків

| ID      | Дія                                                              | Ціль                                                       | Перевірка                       |
| ------- | ---------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------- |
| S01     | CREATE `src/schemas/agent-request.ts`                            | Перевіряти HTTP input до виклику моделі                    | typecheck                       |
| S02–S03 | CREATE помилки й retry                                           | Безпечна межа помилок і обмежені повтори                   | typecheck                       |
| S04     | APPEND `src/lib/metrics.ts`                                      | Додавати usage між model turns                             | inherited tests                 |
| S05     | CREATE `src/tools/currency.ts`                                   | Валідований allowlist інструментів                         | typecheck                       |
| S05a    | APPEND `export` до `mapOpenRouterError` в успадкованому сервісі  | Надати новому adapter спільний mapper помилок              | typecheck і inherited tests     |
| S06–S07 | Спершу CREATE, потім APPEND `src/services/tool-calling-agent.ts` | Adapter окремо від bounded loop                            | проміжний і фінальний typecheck |
| S08–S09 | REPLACE `src/app.ts` та `src/server.ts`                          | Зберегти успадковані routes і підключити `POST /api/agent` | typecheck і route tests         |
| S10–S11 | CREATE tool та route tests                                       | Перевірити runtime й HTTP без мережі                       | targeted Vitest                 |
| S12–S15 | CREATE eval cases, observations, scorer і runner                 | Відтворювані сценарії та offline runner                    | recorded replay                 |
| S16     | CREATE `tests/tool-evals.test.ts`                                | Перевіряти eval data та scoring                            | targeted Vitest і replay        |
| S17–S18 | REPLACE README / APPEND project checkpoint                       | Пояснити перевірену поведінку й перенести досвід           | format check і фінальний gate   |
| S19     | REPLACE `evals/README.md`                                        | Вказати student-specific recorded runners і live межі      | звірка команд із `package.json` |

Кроки йдуть за залежностями: спершу створюються модулі, потім підключаються routes, tests та evals. Для `CREATE` цільовий шлях має бути відсутнім; для `APPEND` використовуйте наведений унікальний anchor. Існує один невеликий visibility change в успадкованому service, два повні `REPLACE` для app/server і один usage-helper `APPEND`; код кожного блока застосовуйте тільки до його шляху.

## Створення schema і tool runtime

### S01. Створити request schema

**Навіщо:** відхилити порожнє або надто довге повідомлення до виклику моделі.

**Точна дія:** CREATE: цього файла немає в starter `my-dev/lesson-03-function-calling-openrouter/src/schemas/agent-request.ts`. Не записуйте в canonical snapshot.

**Код цього кроку:**

```ts
import { z } from "zod";

export const MAX_AGENT_MESSAGE_CHARACTERS = 4_000;

export const AgentRequestSchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(1, "Поле message не може бути порожнім.")
      .max(
        MAX_AGENT_MESSAGE_CHARACTERS,
        `Поле message не може перевищувати ${MAX_AGENT_MESSAGE_CHARACTERS} символів.`,
      ),
  })
  .strict();

export type AgentRequest = z.infer<typeof AgentRequestSchema>;
```

**Перевірка:** `yarn typecheck:my:lesson03:openrouter`. Виконайте її після створення всіх залежностей цього блока. Очікується exit code 0 для завершеного етапу; якщо шлях або контракт не збігається, збережіть уже прийняті кроки: звірте шлях та anchor цього блока, виправте саме його й повторіть наведену перевірку.

### S02. Створити tool error boundary

**Навіщо:** повертати стабільні публічні помилки й окремо визначати тимчасові помилки для retry.

**Точна дія:** CREATE: цього файла немає в starter `my-dev/lesson-03-function-calling-openrouter/src/lib/tool-errors.ts`. Не записуйте в canonical snapshot.

**Код цього кроку:**

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

**Перевірка:** `yarn typecheck:my:lesson03:openrouter`. Виконайте її після створення всіх залежностей цього блока. Очікується exit code 0 для завершеного етапу; якщо шлях або контракт не збігається, збережіть уже прийняті кроки: звірте шлях та anchor цього блока, виправте саме його й повторіть наведену перевірку.

### S03. Створити bounded retry

**Навіщо:** обмежити тривалість кожної спроби та повторювати тільки тимчасову помилку з урахуванням Retry-After.

**Точна дія:** CREATE: цього файла немає в starter `my-dev/lesson-03-function-calling-openrouter/src/lib/retry.ts`. Не записуйте в canonical snapshot.

**Код цього кроку:**

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

**Перевірка:** `yarn typecheck:my:lesson03:openrouter`. Виконайте її після створення всіх залежностей цього блока. Очікується exit code 0 для завершеного етапу; якщо шлях або контракт не збігається, збережіть уже прийняті кроки: звірте шлях та anchor цього блока, виправте саме його й повторіть наведену перевірку.

### S04. Append usage aggregation

**Навіщо:** agent виконує кілька model turns, тому підсумовує usage кожної відповіді, а не зберігає лише останнє значення.

**Точна дія:** APPEND в `my-dev/lesson-03-function-calling-openrouter/src/lib/metrics.ts` після унікального кінцевого блока `calculateCacheHitRate`, що завершується рядками:

```ts
  return Number((Math.min(inputTokens, Math.max(0, cachedTokens)) / inputTokens).toFixed(4));
}
```

Додайте після нього:

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

**Перевірка:** `rg -n "export function sumUsageMetrics" my-dev/lesson-03-function-calling-openrouter/src/lib/metrics.ts`, потім `yarn test:my:lesson03:openrouter`. Очікується один export helper і проходження успадкованих тестів. Якщо export уже існує, не додавайте дублікат: звірте, чи `metrics.ts` відповідає точному Lesson 02 starter.

### S05. Створити currency tool

**Навіщо:** дати моделі лише один описаний інструмент і залишити виконання allowlist-функції під контролем TypeScript.

**Точна дія:** CREATE: цього файла немає в starter `my-dev/lesson-03-function-calling-openrouter/src/tools/currency.ts`. Не записуйте в canonical snapshot.

**Код цього кроку:**

```ts
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
```

**Перевірка:** `yarn typecheck:my:lesson03:openrouter`. Виконайте її після створення всіх залежностей цього блока. Очікується exit code 0 для завершеного етапу; якщо шлях або контракт не збігається, збережіть уже прийняті кроки: звірте шлях та anchor цього блока, виправте саме його й повторіть наведену перевірку.

### S05a. Відкрити спільний error mapper

**Навіщо:** новий Chat Completions adapter використовує ту саму нормалізацію OpenRouter помилок, що й успадкований Document API. В Lesson 02 функція локальна для модуля, тому спочатку відкрийте її як named export; реалізацію не змінюйте.

**Точна дія:** в student копії змініть лише оголошення `mapOpenRouterError` в `my-dev/lesson-03-function-calling-openrouter/src/services/openrouter-document-ai.ts`. Замініть його збережений рядок:

```ts
function mapOpenRouterError(error: unknown): DocumentAiError {
```

на:

```ts
export function mapOpenRouterError(error: unknown): DocumentAiError {
```

**Перевірка:** `yarn typecheck:my:lesson03:openrouter` і `yarn test:my:lesson03:openrouter`. Очікується compile без помилки export та проходження успадкованих document tests. Якщо signature не збігається, не замінюйте функцію цілком; звірте точну L02 копію та змініть лише видимість declaration.

### S06. Створити OpenRouter adapter

**Навіщо:** спершу ізолювати OpenRouter межу від циклу агента. Цей етап створює типи model boundary та adapter одного Chat Completions request.

**Точна дія:** CREATE my-dev/lesson-03-function-calling-openrouter/src/services/tool-calling-agent.ts. Поки що вставте лише adapter payload:

```ts
import type OpenAI from "openai";
import type {
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { resolveModelCapabilities } from "../config/model-capabilities.js";
import { DEFAULT_REASONING_EFFORT, type ReasoningEffort } from "../config/openrouter.js";
import { DocumentAiError } from "../lib/errors.js";
import { normalizeChatUsage } from "../lib/metrics.js";
import type { ResponseUsageLike } from "../lib/metrics.js";
import { mapOpenRouterError } from "./openrouter-document-ai.js";

export const TOOL_AGENT_INSTRUCTIONS = [
  "Доступний інструмент convert_currency для конвертації валют.",
  "Інструмент викликається лише тоді, коли в запиті явно задано суму, вихідну та цільову валюти.",
  "Коди валют завжди передаються у 3-літерному верхньому регістрі ISO 4217 (наприклад: USD, EUR, UAH).",
  "Якщо бракує валюти або суми, формується коротке уточнювальне запитання без виклику інструмента.",
  "Для запитів, не пов’язаних із конвертацією валют, надається пряма коротка відповідь.",
  "Курс валют не можна вигадувати.",
].join("\n");

export interface ModelTurn {
  outputText: string;
  toolCalls: ChatCompletionMessageFunctionToolCall[];
  model: string;
  usage?: ResponseUsageLike | null;
  reasoning?: string;
  reasoningDetails?: unknown[];
}

export interface ModelResponseRequest {
  messages: ChatCompletionMessageParam[];
  tools: ChatCompletionTool[];
  toolChoice: "auto";
}

export interface ModelResponsesClient {
  createResponse(request: ModelResponseRequest): Promise<ModelTurn>;
}

export interface OpenAIChatCompletionsClientOptions {
  modelName: string;
  /** Retained for Lesson 04 shared typing; this Lesson 03 client never routes to it. */
  maxOutputTokens: number;
  reasoningEffort?: ReasoningEffort;
}

interface OpenRouterToolRequest {
  model: string;
  messages: ChatCompletionMessageParam[];
  tools: ChatCompletionTool[];
  tool_choice: "auto";
  max_completion_tokens: number;
  temperature: number;
  provider: { require_parameters: true };
  reasoning?: { effort: ReasoningEffort; exclude: false };
  stream?: false;
}

export class OpenAIChatCompletionsClient implements ModelResponsesClient {
  public constructor(
    private readonly client: OpenAI,
    private readonly options: Readonly<OpenAIChatCompletionsClientOptions>,
  ) {}

  public async createResponse(request: ModelResponseRequest): Promise<ModelTurn> {
    const capabilities = resolveModelCapabilities(this.options.modelName);

    try {
      const openRouterRequest: OpenRouterToolRequest = {
        model: this.options.modelName,
        messages: [{ role: "system", content: TOOL_AGENT_INSTRUCTIONS }, ...request.messages],
        tools: request.tools,
        tool_choice: request.toolChoice,
        max_completion_tokens: this.options.maxOutputTokens,
        temperature: 0,
        provider: { require_parameters: true },
        ...(capabilities.reasoning
          ? {
              reasoning: {
                effort: this.options.reasoningEffort ?? DEFAULT_REASONING_EFFORT,
                exclude: false as const,
              },
            }
          : {}),
      };
      const response = await this.client.chat.completions.create(openRouterRequest);
      const choice = response.choices[0];

      if (!choice) {
        throw new DocumentAiError(
          "RESPONSE_FAILED",
          "Модель не повернула результат генерації.",
          502,
        );
      }

      if (choice.finish_reason === "length") {
        throw new DocumentAiError("INCOMPLETE_RESPONSE", "Генерацію не було завершено.", 502, {
          reason: "max_tokens",
        });
      }

      if (choice.finish_reason === "content_filter" || choice.message.refusal) {
        throw new DocumentAiError("REQUEST_REFUSED", "Модель відхилила запит.", 422);
      }

      const toolCalls = (choice.message.tool_calls ?? []).filter(
        (call): call is ChatCompletionMessageFunctionToolCall => call.type === "function",
      );
      const openRouterMessage = choice.message as typeof choice.message & {
        reasoning?: unknown;
        reasoning_details?: unknown;
      };
      const reasoning =
        typeof openRouterMessage.reasoning === "string" ? openRouterMessage.reasoning : undefined;
      const reasoningDetails = Array.isArray(openRouterMessage.reasoning_details)
        ? openRouterMessage.reasoning_details
        : undefined;

      return {
        outputText: choice.message.content ?? "",
        toolCalls,
        model: response.model || this.options.modelName,
        ...(response.usage === undefined ? {} : { usage: normalizeChatUsage(response.usage) }),
        ...(reasoning === undefined ? {} : { reasoning }),
        ...(reasoningDetails === undefined ? {} : { reasoningDetails }),
      };
    } catch (error) {
      throw mapOpenRouterError(error);
    }
  }
}
```

**Перевірка:** yarn typecheck:my:lesson03:openrouter. На цьому checkpoint module є самодостатнім adapter; unit tests agent loop ще не створені. Якщо помилка згадує відсутній loop import, перевірте, що в S06 залишився лише adapter prefix.

### S07. Додати bounded agent loop

**Навіщо:** додати історію повідомлень, послідовне виконання tools і ліміт turns, не змінюючи request mapping з S06.

**Точна дія:** в тому самому файлі вставте наведені imports перед унікальним першим рядком `import type OpenAI from "openai";`, а потім додайте loop після кінцевої `}` класу `OpenAIChatCompletionsClient`. Унікальний anchor перед вставкою закінчується так:

```ts
    } catch (error) {
      throw mapOpenRouterError(error);
    }
  }
}
```

**Imports:**

```ts
import { extractUsageMetrics, sumUsageMetrics } from "../lib/metrics.js";
import type { UsageMetrics } from "../lib/metrics.js";
import type { RetryDependencies } from "../lib/retry.js";
import {
  convertCurrencyTool,
  EducationalRateProvider,
  executeCurrencyToolCall,
} from "../tools/currency.js";
import type { RateProvider } from "../tools/currency.js";
import type { ChatCompletionToolMessageParam } from "openai/resources/chat/completions";
```

**Append payload:**

```ts
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

export interface ChatCompletionsToolCallingAgentOptions {
  maxToolCalls?: number;
  retryDependencies?: RetryDependencies;
  now?: () => number;
  onToolCall?: (event: Readonly<ToolCallTrace>) => void;
  onToolOutput?: (output: Readonly<ChatCompletionToolMessageParam>) => void;
}

export interface ToolCallTrace {
  callId: string;
  toolName: string;
  arguments: string;
  toolCallCount: number;
}

export class ChatCompletionsToolCallingAgent implements ToolCallingAgent {
  private readonly maxToolCalls: number;
  private readonly retryDependencies: RetryDependencies;
  private readonly now: () => number;
  private readonly onToolCall: ChatCompletionsToolCallingAgentOptions["onToolCall"];
  private readonly onToolOutput: ChatCompletionsToolCallingAgentOptions["onToolOutput"];

  public constructor(
    private readonly responsesClient: ModelResponsesClient,
    private readonly provider: RateProvider = new EducationalRateProvider(),
    options: ChatCompletionsToolCallingAgentOptions = {},
  ) {
    this.maxToolCalls = options.maxToolCalls ?? 5;
    this.retryDependencies = options.retryDependencies ?? {};
    this.now = options.now ?? (() => performance.now());
    this.onToolCall = options.onToolCall;
    this.onToolOutput = options.onToolOutput;

    if (!Number.isInteger(this.maxToolCalls) || this.maxToolCalls < 1) {
      throw new RangeError("maxToolCalls має бути додатним цілим числом.");
    }
  }

  public async run(message: string): Promise<AgentRunResult> {
    const startedAt = this.now();
    const messages: ChatCompletionMessageParam[] = [{ role: "user", content: message }];
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

      const turn = await this.responsesClient.createResponse({
        messages,
        tools: [convertCurrencyTool],
        toolChoice: "auto",
      });

      model = turn.model;
      usage = sumUsageMetrics(usage, extractUsageMetrics(turn.usage));

      if (turn.toolCalls.length === 0) {
        const outputText = turn.outputText.trim();

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

      messages.push({
        role: "assistant",
        ...(turn.outputText.length > 0 ? { content: turn.outputText } : { content: null }),
        tool_calls: turn.toolCalls,
        ...(turn.reasoning === undefined ? {} : { reasoning: turn.reasoning }),
        ...(turn.reasoningDetails === undefined
          ? {}
          : { reasoning_details: turn.reasoningDetails }),
      } as ChatCompletionMessageParam);

      for (const functionCall of turn.toolCalls) {
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
        this.onToolCall?.({
          callId: functionCall.id,
          toolName: functionCall.function.name,
          arguments: functionCall.function.arguments,
          toolCallCount,
        });

        const toolOutput = await executeCurrencyToolCall(
          functionCall,
          this.provider,
          retryDependencies,
        );
        this.onToolOutput?.(toolOutput);
        messages.push(toolOutput);
      }
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

Options adapter містять налаштовану модель, ліміт output і необов'язковий effort.

**Перевірка:** `yarn typecheck:my:lesson03:openrouter`. Очікується exit code 0 після вставки циклу та imports. Якщо виникла помилка, перевірте спочатку саме нові imports і доданий блок; adapter S06 залиште без змін, коли помилка стосується циклу.

### S08. Підключити HTTP route

**Навіщо:** зберегти успадковані document routes і підключити `POST /api/agent` через інжектований agent.

**Точна дія:** REPLACE: повністю замініть лише успадкований файл `my-dev/lesson-03-function-calling-openrouter/src/app.ts`. Не записуйте в canonical snapshot.

**Код цього кроку:**

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

function describeStreamFailure(reason: string): { code: string; message: string } {
  if (reason === "rate_limit_exceeded" || reason === "429") {
    return {
      code: "UPSTREAM_RATE_LIMITED",
      message: "OpenRouter тимчасово обмежив частоту запитів.",
    };
  }

  if (reason === "timeout") {
    return {
      code: "GATEWAY_TIMEOUT",
      message: "Перевищено час очікування відповіді OpenRouter API.",
    };
  }

  if (reason === "provider_overloaded") {
    return {
      code: "UPSTREAM_UNAVAILABLE",
      message: "OpenRouter або провайдер моделі тимчасово недоступний.",
    };
  }

  if (reason === "refusal" || reason === "content_policy_violation") {
    return { code: "REQUEST_REFUSED", message: "Модель відхилила запит." };
  }

  return { code: "RESPONSE_FAILED", message: "Не вдалося виконати генерацію." };
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
            ...calculateCost(result.model, usage, prices, result.usage?.provider_cost_usd),
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

            case "failed": {
              terminalState = "failed";
              const failure = describeStreamFailure(event.reason);
              writeSseEvent(response, "error", {
                ...failure,
                reason: event.reason,
              });
              break;
            }

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
                  ...calculateCost(event.model, usage, prices, event.usage?.provider_cost_usd),
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
        response.status(error.statusCode).json(createApiError(error.code, error.message));
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

**Перевірка:** `yarn typecheck:my:lesson03:openrouter`. Виконайте її після створення всіх залежностей цього блока. Очікується exit code 0 для завершеного етапу; якщо шлях або контракт не збігається, збережіть уже прийняті кроки: звірте шлях та anchor цього блока, виправте саме його й повторіть наведену перевірку.

### S09. Підключити сервер

**Навіщо:** підключити agent до OpenRouter клієнта, зберігши Lesson 02 env contract і Document API.

**Точна дія:** REPLACE тільки my-dev/lesson-03-function-calling-openrouter/src/server.ts повним payload. Він відповідає успадкованому `env.ts`: використовує dotenv.config({ quiet: true }), константу OPENROUTER_BASE_URL та неіснуючі в Lesson 02 attribution fields не читає.

```ts
import dotenv from "dotenv";
import OpenAI from "openai";
import { createApp } from "./app.js";
import { loadEnvironment } from "./config/env.js";
import { resolveModel } from "./config/models.js";
import { OPENROUTER_BASE_URL } from "./config/openrouter.js";
import { OpenRouterDocumentAi } from "./services/openrouter-document-ai.js";
import {
  ChatCompletionsToolCallingAgent,
  OpenAIChatCompletionsClient,
} from "./services/tool-calling-agent.js";
import { EducationalRateProvider } from "./tools/currency.js";

dotenv.config({ quiet: true });

function startServer(): void {
  const environment = loadEnvironment(process.env);
  const openai = new OpenAI({
    apiKey: environment.OPENROUTER_API_KEY,
    baseURL: OPENROUTER_BASE_URL,
    timeout: environment.OPENROUTER_TIMEOUT_MS,
    maxRetries: 0,
  });
  const ai = new OpenRouterDocumentAi(openai, {
    fastModel: resolveModel("fast", environment),
    mainModel: resolveModel("main", environment),

    maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
    reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
  });
  const chatClient = new OpenAIChatCompletionsClient(openai, {
    modelName: resolveModel("main", environment),
    maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
    reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
  });
  const toolAgent = new ChatCompletionsToolCallingAgent(chatClient, new EducationalRateProvider());
  const app = createApp({ ai, toolAgent });

  app.listen(environment.PORT, (error?: Error) => {
    if (error) {
      const listenError = error as NodeJS.ErrnoException;

      if (listenError.code === "EADDRINUSE") {
        console.error(
          `Не вдалося запустити сервер: порт ${environment.PORT} уже зайнятий іншим процесом.`,
        );
      } else {
        console.error(`Не вдалося запустити сервер: ${listenError.message}`);
      }

      process.exitCode = 1;
      return;
    }

    const fastModel = resolveModel("fast", environment);
    const mainModel = resolveModel("main", environment);
    console.log(
      [
        "=================================================================",
        "  🚀 Document & Tool Calling API (Lesson 03 — OpenRouter)",
        "=================================================================",
        `  ● Сервер:         http://localhost:${environment.PORT}`,
        `  ● Health Check:   http://localhost:${environment.PORT}/health`,
        `  ● Doc Моделі:     ${fastModel} (fast) / ${mainModel} (main)`,
        `  ● Tool Модель:    ${mainModel}`,
        `  ● Reasoning:      ${environment.OPENROUTER_REASONING_EFFORT}`,
        "-----------------------------------------------------------------",
        "  💡 Як перевірити роботу (виконайте в іншому терміналі):",
        "",
        "  [PowerShell]:",
        `    Invoke-RestMethod -Uri http://localhost:${environment.PORT}/api/agent -Method Post -ContentType "application/json" -Body '{"message":"Конвертуй 250 USD у UAH"}' | ConvertTo-Json -Depth 5`,
        "",
        "  [curl]:",
        `    curl.exe -X POST http://localhost:${environment.PORT}/api/agent -H "Content-Type: application/json" -d "{\\"message\\":\\"Конвертуй 250 USD у UAH\\"}"`,
        "-----------------------------------------------------------------",
        "  ✨ Або запустіть готову демонстрацію: yarn demo:lesson03:openrouter:solution",
        "  🛑 Для зупинки сервера: Ctrl+C",
        "=================================================================",
      ].join("\n"),
    );
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

**Перевірка:** yarn typecheck:my:lesson03:openrouter. Переконайтеся, що успадковані document routes залишаються в createApp.

### S10. Створити tool та agent tests

**Навіщо:** зафіксувати активними offline tests форму запиту, валідацію, межі виконання, retry і metrics.

**Точна дія:** CREATE: цього файла немає в starter `my-dev/lesson-03-function-calling-openrouter/tests/tool-calling.test.ts`. Не записуйте в canonical snapshot.

**Код цього кроку:**

```ts
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
```

**Перевірка:** `yarn vitest run my-dev/lesson-03-function-calling-openrouter/tests/tool-calling.test.ts`. Виконайте її після створення всіх залежностей цього блока. Очікується exit code 0 для завершеного етапу; якщо шлях або контракт не збігається, збережіть уже прийняті кроки: звірте шлях та anchor цього блока, виправте саме його й повторіть наведену перевірку.

### S11. Створити route tests

**Навіщо:** перевірити HTTP validation, нормалізацію input, response metrics і поведінку без підключеного agent.

**Точна дія:** CREATE: цього файла немає в starter `my-dev/lesson-03-function-calling-openrouter/tests/agent-route.test.ts`. Не записуйте в canonical snapshot.

**Код цього кроку:**

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

**Перевірка:** `yarn vitest run my-dev/lesson-03-function-calling-openrouter/tests/agent-route.test.ts`. Виконайте її після створення всіх залежностей цього блока. Очікується exit code 0 для завершеного етапу; якщо шлях або контракт не збігається, збережіть уже прийняті кроки: звірте шлях та anchor цього блока, виправте саме його й повторіть наведену перевірку.

### S12. Створити tool eval cases

**Навіщо:** охопити п’ять відтворюваних сценаріїв: tool call, друга пара валют, уточнення, безпечна помилка та пряма відповідь.

**Точна дія:** CREATE: цього файла немає в starter `my-dev/lesson-03-function-calling-openrouter/evals/tool-calling.eval.ts`. Не записуйте в canonical snapshot.

**Код цього кроку:**

```ts
export type ExpectedResponseMode = "tool" | "clarification" | "direct";

export interface EvalCase<TExpected = unknown> {
  id: string;
  input: string;
  expectedMode: ExpectedResponseMode;
  expectedTool?: string;
  expected?: TExpected;
  tags?: string[];
}

export interface ToolCallExpectation {
  args?: Record<string, unknown>;
  expectedStatus?: "success" | "error";
  expectedErrorCode?: string;
}

export const toolCallingEvalCases: Array<EvalCase<ToolCallExpectation>> = [
  {
    id: "currency-happy-path",
    input: "Конвертуй 250 USD у UAH",
    expectedMode: "tool",
    expectedTool: "convert_currency",
    expected: {
      args: { amount: 250, from: "USD", to: "UAH" },
      expectedStatus: "success",
    },
    tags: ["happy-path"],
  },
  {
    id: "currency-normalization",
    input: "100 eur to uah",
    expectedMode: "tool",
    expectedTool: "convert_currency",
    expected: {
      args: { amount: 100, from: "EUR", to: "UAH" },
      expectedStatus: "success",
    },
    tags: ["normalization"],
  },
  {
    id: "currency-clarification",
    input: "Переведи 500 євро",
    expectedMode: "clarification",
    tags: ["missing-argument"],
  },
  {
    id: "currency-unsupported-pair",
    input: "Конвертуй 1000 JPY у KZT",
    expectedMode: "tool",
    expectedTool: "convert_currency",
    expected: {
      args: { amount: 1_000, from: "JPY", to: "KZT" },
      expectedStatus: "error",
      expectedErrorCode: "UNSUPPORTED_CURRENCY_PAIR",
    },
    tags: ["controlled-error"],
  },
  {
    id: "currency-no-tool-needed",
    input: "Яка столиця Франції?",
    expectedMode: "direct",
    tags: ["routing"],
  },
];
```

**Перевірка:** `rg -n "toolCallingEvalCases" my-dev/lesson-03-function-calling-openrouter/evals/tool-calling.eval.ts`. Виконайте її після створення всіх залежностей цього блока. Очікується exit code 0 для завершеного етапу; якщо шлях або контракт не збігається, збережіть уже прийняті кроки: звірте шлях та anchor цього блока, виправте саме його й повторіть наведену перевірку.

### S13. Створити recorded observations

**Навіщо:** зберегти локальне очікуване спостереження для кожного eval case, щоб replay не звертався до мережі.

**Точна дія:** CREATE: цього файла немає в starter `my-dev/lesson-03-function-calling-openrouter/evals/recorded-tool-results.ts`. Не записуйте в canonical snapshot.

**Код цього кроку:**

```ts
import type { ExpectedResponseMode } from "./tool-calling.eval.js";

export interface ToolCallingObservation {
  id: string;
  observedMode: ExpectedResponseMode;
  observedTool?: string;
  observedArgs?: Record<string, unknown>;
  observedStatus?: "success" | "error";
  observedErrorCode?: string;
  latencyMs: number;
  modelCallCount: number;
  toolCallCount: number;
  retryCount: number;
  inputTokens: number;
  outputTokens: number;
  model?: string;
  responseText?: string;
}

export const recordedToolResults: ToolCallingObservation[] = [
  {
    id: "currency-happy-path",
    observedMode: "tool",
    observedTool: "convert_currency",
    observedArgs: { amount: 250, from: "USD", to: "UAH" },
    observedStatus: "success",
    latencyMs: 410,
    modelCallCount: 2,
    toolCallCount: 1,
    retryCount: 0,
    inputTokens: 220,
    outputTokens: 48,
  },
  {
    id: "currency-normalization",
    observedMode: "tool",
    observedTool: "convert_currency",
    observedArgs: { amount: 100, from: "eur", to: "uah" },
    observedStatus: "success",
    latencyMs: 395,
    modelCallCount: 2,
    toolCallCount: 1,
    retryCount: 0,
    inputTokens: 214,
    outputTokens: 45,
  },
  {
    id: "currency-clarification",
    observedMode: "clarification",
    latencyMs: 180,
    modelCallCount: 1,
    toolCallCount: 0,
    retryCount: 0,
    inputTokens: 145,
    outputTokens: 18,
  },
  {
    id: "currency-unsupported-pair",
    observedMode: "tool",
    observedTool: "convert_currency",
    observedArgs: { amount: 1_000, from: "JPY", to: "KZT" },
    observedStatus: "error",
    observedErrorCode: "UNSUPPORTED_CURRENCY_PAIR",
    latencyMs: 430,
    modelCallCount: 2,
    toolCallCount: 1,
    retryCount: 0,
    inputTokens: 232,
    outputTokens: 55,
  },
  {
    id: "currency-no-tool-needed",
    observedMode: "direct",
    latencyMs: 165,
    modelCallCount: 1,
    toolCallCount: 0,
    retryCount: 0,
    inputTokens: 142,
    outputTokens: 12,
  },
];
```

**Перевірка:** `rg -n "recordedToolResults" my-dev/lesson-03-function-calling-openrouter/evals/recorded-tool-results.ts`. Виконайте її після створення всіх залежностей цього блока. Очікується exit code 0 для завершеного етапу; якщо шлях або контракт не збігається, збережіть уже прийняті кроки: звірте шлях та anchor цього блока, виправте саме його й повторіть наведену перевірку.

### S14. Створити eval scorer

**Навіщо:** окремо оцінювати коректний tool use, уточнення та пряму відповідь.

**Точна дія:** CREATE: цього файла немає в starter `my-dev/lesson-03-function-calling-openrouter/evals/tool-calling-scorer.ts`. Не записуйте в canonical snapshot.

**Код цього кроку:**

```ts
import type { ToolCallingObservation } from "./recorded-tool-results.js";
import type { EvalCase, ExpectedResponseMode, ToolCallExpectation } from "./tool-calling.eval.js";

export interface EvalScore {
  id: string;
  passed: boolean;
  reasons: string[];
}

export function classifyTextResponse(text: string): ExpectedResponseMode {
  const normalized = text.toLocaleLowerCase("uk-UA");
  const asksForCurrency =
    /[?？]|(?:у|в) яку валюту|(?:у|в) какую валюту|цільов\p{L}* валют|целев\p{L}* валют|уточн\p{L}*.*валют|вкаж\p{L}*.*валют|укаж\p{L}*.*валют/iu.test(
      normalized,
    );

  return asksForCurrency ? "clarification" : "direct";
}

export function scoreToolCallingCase(
  evalCase: EvalCase<ToolCallExpectation>,
  observation: ToolCallingObservation,
): EvalScore {
  const reasons: string[] = [];

  if (observation.observedMode !== evalCase.expectedMode) {
    reasons.push(`Очікувався mode=${evalCase.expectedMode}, отримано ${observation.observedMode}.`);
  }

  if (evalCase.expectedTool !== observation.observedTool) {
    reasons.push(
      `Очікувався tool=${evalCase.expectedTool ?? "none"}, отримано ${
        observation.observedTool ?? "none"
      }.`,
    );
  }

  const expectation = evalCase.expected;

  if (expectation?.args) {
    for (const [key, value] of Object.entries(expectation.args)) {
      const observed = observation.observedArgs?.[key];
      const matches =
        (key === "from" || key === "to") &&
        typeof value === "string" &&
        typeof observed === "string"
          ? observed.trim().toUpperCase() === value.trim().toUpperCase()
          : observed === value;

      if (!matches) {
        reasons.push(`Аргумент ${key} не збігається з очікуваним значенням.`);
      }
    }
  }

  if (
    expectation?.expectedStatus !== undefined &&
    observation.observedStatus !== expectation.expectedStatus
  ) {
    reasons.push(
      `Очікувався status=${expectation.expectedStatus}, отримано ${
        observation.observedStatus ?? "none"
      }.`,
    );
  }

  if (
    expectation?.expectedErrorCode !== undefined &&
    observation.observedErrorCode !== expectation.expectedErrorCode
  ) {
    reasons.push(
      `Очікувався errorCode=${expectation.expectedErrorCode}, отримано ${
        observation.observedErrorCode ?? "none"
      }.`,
    );
  }

  return {
    id: evalCase.id,
    passed: reasons.length === 0,
    reasons,
  };
}
```

**Перевірка:** `rg -n "scoreToolCallingCase" my-dev/lesson-03-function-calling-openrouter/evals/tool-calling-scorer.ts`. Виконайте її після створення всіх залежностей цього блока. Очікується exit code 0 для завершеного етапу; якщо шлях або контракт не збігається, збережіть уже прийняті кроки: звірте шлях та anchor цього блока, виправте саме його й повторіть наведену перевірку.

### S15. Створити recorded eval runner

**Навіщо:** запускати recorded observations офлайн за замовчуванням; live inference залишити окремим явним opt-in прапорцем.

**Точна дія:** CREATE my-dev/lesson-03-function-calling-openrouter/evals/run-tool-calling.ts з повним payload. Успадкований src/config/env.ts не має loadRepositoryEnvFile, OPENROUTER_BASE_URL чи attribution settings: новий runner має викликати dotenv.config тільки для live режиму й брати базову адресу з src/config/openrouter.ts.

```ts
import dotenv from "dotenv";
import OpenAI from "openai";
import { loadEnvironment } from "../src/config/env.js";
import { resolveModel } from "../src/config/models.js";
import { OPENROUTER_BASE_URL } from "../src/config/openrouter.js";
import {
  ChatCompletionsToolCallingAgent,
  OpenAIChatCompletionsClient,
} from "../src/services/tool-calling-agent.js";
import type { ToolCallTrace } from "../src/services/tool-calling-agent.js";
import { EducationalRateProvider } from "../src/tools/currency.js";
import { recordedToolResults } from "./recorded-tool-results.js";
import type { ToolCallingObservation } from "./recorded-tool-results.js";
import { classifyTextResponse, scoreToolCallingCase } from "./tool-calling-scorer.js";
import { toolCallingEvalCases } from "./tool-calling.eval.js";
import type { EvalCase, ToolCallExpectation } from "./tool-calling.eval.js";

type ToolOutputPayload = {
  status?: unknown;
  code?: unknown;
};

function parseObject(value: string | undefined): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function createLiveRunner(): (
  evalCase: EvalCase<ToolCallExpectation>,
) => Promise<ToolCallingObservation> {
  const environment = loadEnvironment(process.env);
  const primaryModel = resolveModel("main", environment);
  const openai = new OpenAI({
    apiKey: environment.OPENROUTER_API_KEY,
    baseURL: OPENROUTER_BASE_URL,
    timeout: environment.OPENROUTER_TIMEOUT_MS,
    maxRetries: 0,
  });

  return async (evalCase) => {
    const toolCalls: ToolCallTrace[] = [];
    const toolOutputs: string[] = [];
    const chatClient = new OpenAIChatCompletionsClient(openai, {
      modelName: primaryModel,
      maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
      reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
    });
    const agent = new ChatCompletionsToolCallingAgent(chatClient, new EducationalRateProvider(), {
      onToolCall: (event) => toolCalls.push({ ...event }),
      onToolOutput: (output) => {
        if (typeof output.content === "string") {
          toolOutputs.push(output.content);
        }
      },
    });
    const result = await agent.run(evalCase.input);
    const firstToolCall = toolCalls[0];
    const observedArgs = parseObject(firstToolCall?.arguments);
    const toolPayload = parseObject(toolOutputs[0]) as ToolOutputPayload | undefined;
    const responseText = result.status === "success" ? result.text : result.message;
    const observedMode = firstToolCall === undefined ? classifyTextResponse(responseText) : "tool";

    return {
      id: evalCase.id,
      observedMode,
      ...(firstToolCall === undefined
        ? {}
        : {
            observedTool: firstToolCall.toolName,
          }),
      ...(observedArgs === undefined ? {} : { observedArgs }),
      ...(toolPayload?.status === "success" || toolPayload?.status === "error"
        ? { observedStatus: toolPayload.status }
        : {}),
      ...(typeof toolPayload?.code === "string" ? { observedErrorCode: toolPayload.code } : {}),
      latencyMs: result.metrics.totalLatencyMs,
      modelCallCount: result.metrics.modelCallCount,
      toolCallCount: result.metrics.toolCallCount,
      retryCount: result.metrics.retryCount,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      model: result.model,
      responseText,
    };
  };
}

function printLiveObservation(observation: ToolCallingObservation): void {
  const modeLabel =
    observation.observedMode === "tool"
      ? "⚙️  Tool Call"
      : observation.observedMode === "clarification"
        ? "❓ Clarification"
        : "💬 Direct Answer";

  console.log("  🤖 Отримано від моделі:");
  console.log(`     • Режим:      ${modeLabel}`);
  console.log(`     • Модель:     ${observation.model ?? "не вказано"}`);
  console.log(
    `     • Метрики:    model=${observation.modelCallCount}, tool=${observation.toolCallCount}, retry=${observation.retryCount} | ⏱️ ${(observation.latencyMs / 1_000).toFixed(1)} с | 🎫 ${observation.inputTokens + observation.outputTokens} токенів`,
  );
  console.log(`     • Інструмент: ${observation.observedTool ?? "не викликався"}`);

  if (observation.observedArgs) {
    console.log(`     • Аргументи:  ${JSON.stringify(observation.observedArgs)}`);
  }
  if (observation.observedStatus) {
    console.log(
      `     • Tool стан:  ${observation.observedStatus === "success" ? "✔ success" : "✖ error"}`,
    );
  }
  if (observation.observedErrorCode) {
    console.log(`     • Tool error: ⚠️ ${observation.observedErrorCode}`);
  }

  if (observation.responseText && observation.responseText.trim()) {
    console.log("     • Відповідь:");
    const lines = observation.responseText.trim().split("\n");
    for (const line of lines) {
      console.log(`       │ ${line}`);
    }
  } else {
    console.log("     • Відповідь:  (не отримано)");
  }
}

function formatFailure(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String((error as { code?: unknown }).code ?? "MODEL_REQUEST_FAILED");
    const message = error instanceof Error ? error.message : "Запит не виконано.";

    return `${code} — ${message}`;
  }

  return error instanceof Error ? `${error.name} — ${error.message}` : "Невідома помилка.";
}

async function main(): Promise<void> {
  const live = process.argv.includes("--live");

  if (live) {
    dotenv.config({ quiet: true });
  }

  const liveRunner = live ? createLiveRunner() : undefined;
  const recordedById = new Map(
    recordedToolResults.map((observation) => [observation.id, observation]),
  );
  const observations: ToolCallingObservation[] = [];
  let passed = 0;

  if (live) {
    const environment = loadEnvironment(process.env);
    const primaryModel = resolveModel("main", environment);

    console.log("=================================================================");
    console.log("  🧪 LIVE EVAL SUITE: LESSON 03 (Tool Calling OpenRouter)");
    console.log("=================================================================");
    console.log(`  ● Основна модель:  ${primaryModel}`);
    console.log(`  ● Reasoning:       ${environment.OPENROUTER_REASONING_EFFORT}`);
    console.log("  ● Режим:           Живий запуск (Live OpenRouter API)");
    console.log("=================================================================");
  } else {
    console.log("=================================================================");
    console.log("  🧪 OFFLINE EVAL SUITE: LESSON 03 (Deterministic Replay)");
    console.log("=================================================================");
  }

  for (const [index, evalCase] of toolCallingEvalCases.entries()) {
    if (live) {
      console.log(`\n-----------------------------------------------------------------`);
      console.log(`  [${index + 1}/${toolCallingEvalCases.length}] 🎯 Тест: ${evalCase.id}`);
      console.log(`-----------------------------------------------------------------`);
      console.log(`  📥 Запит: "${evalCase.input}"`);
      console.log("  ⏳ Очікування відповіді моделі OpenRouter...\n");
    }

    try {
      const observation = live ? await liveRunner!(evalCase) : recordedById.get(evalCase.id);

      if (!observation) {
        throw new Error("Відсутнє записане спостереження.");
      }

      observations.push(observation);
      const score = scoreToolCallingCase(evalCase, observation);
      const details = score.reasons.length === 0 ? "" : ` — ${score.reasons.join(" ")}`;

      if (live) {
        printLiveObservation(observation);
      }

      console.log(score.passed ? `\n  ✔  PASS ${score.id}` : `\n  ✖  FAIL ${score.id}${details}`);
      if (score.passed) {
        passed += 1;
      }
    } catch (error) {
      console.log(`\n  ✖  FAIL ${evalCase.id} — ⚠️ ${formatFailure(error)}`);
    }
  }

  const total = toolCallingEvalCases.length;
  const successRate = total === 0 ? 0 : (passed / total) * 100;
  const averageLatencyMs =
    observations.length === 0
      ? 0
      : observations.reduce((sum, observation) => sum + observation.latencyMs, 0) /
        observations.length;
  const totals = observations.reduce(
    (accumulator, observation) => ({
      modelCallCount: accumulator.modelCallCount + observation.modelCallCount,
      toolCallCount: accumulator.toolCallCount + observation.toolCallCount,
      retryCount: accumulator.retryCount + observation.retryCount,
      inputTokens: accumulator.inputTokens + observation.inputTokens,
      outputTokens: accumulator.outputTokens + observation.outputTokens,
    }),
    {
      modelCallCount: 0,
      toolCallCount: 0,
      retryCount: 0,
      inputTokens: 0,
      outputTokens: 0,
    },
  );

  console.log("\n=================================================================");
  console.log("  📊 ПІДСУМОК ОЦІНЮВАННЯ (EVAL REPORT)");
  console.log("=================================================================");
  console.log(
    `  • Результат:             ${passed}/${total} ${passed === total ? "✔ (усі пройдено)" : "✖ (є помилки)"}`,
  );
  console.log(`  • Успішність:            ${successRate.toFixed(1)}%`);
  console.log(`  • Середня затримка:      ${Math.round(averageLatencyMs)} мс`);
  console.log(`  • Викликів моделей:      ${totals.modelCallCount}`);
  console.log(`  • Викликів інструментів: ${totals.toolCallCount}`);
  console.log(`  • Повторних спроб:       ${totals.retryCount}`);
  console.log(
    `  • Використано токенів:   ${totals.inputTokens + totals.outputTokens} (${totals.inputTokens} вхід + ${totals.outputTokens} вихід)`,
  );
  console.log("=================================================================\n");

  console.log(`Result: ${passed}/${total}`);
  console.log(`Success rate: ${successRate.toFixed(1)}%`);
  console.log(`Average latency: ${Math.round(averageLatencyMs)}ms`);
  console.log(
    `Calls: model=${totals.modelCallCount}, tool=${totals.toolCallCount}, retry=${totals.retryCount}`,
  );
  console.log(
    `Token usage: input=${totals.inputTokens}, output=${totals.outputTokens}, total=${totals.inputTokens + totals.outputTokens}`,
  );

  if (passed !== total) {
    process.exitCode = 1;
  }
}

void main();
```

**Перевірка:** yarn eval:my:lesson03:openrouter:tool-calling. Runner має показати Result: 5/5 без .env та мережі. Live режим не запускайте як частину цього check.

### S16. Створити eval tests

**Навіщо:** перевірити унікальність case IDs, повноту observations, режими scorer і повний recorded replay.

**Точна дія:** CREATE: цього файла немає в starter `my-dev/lesson-03-function-calling-openrouter/tests/tool-evals.test.ts`. Не записуйте в canonical snapshot.

**Код цього кроку:**

```ts
import { describe, expect, it } from "vitest";
import { recordedToolResults } from "../evals/recorded-tool-results.js";
import { classifyTextResponse, scoreToolCallingCase } from "../evals/tool-calling-scorer.js";
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

  it("відрізняє уточнення від прямої відповіді без tool call", () => {
    expect(classifyTextResponse("Уточніть, будь ласка, у яку валюту конвертувати?")).toBe(
      "clarification",
    );
    expect(classifyTextResponse("Париж — столиця Франції.")).toBe("direct");
  });
});
```

**Перевірка:** `yarn vitest run my-dev/lesson-03-function-calling-openrouter/tests/tool-evals.test.ts`. Виконайте її після створення всіх залежностей цього блока. Очікується exit code 0 для завершеного етапу; якщо шлях або контракт не збігається, збережіть уже прийняті кроки: звірте шлях та anchor цього блока, виправте саме його й повторіть наведену перевірку.

## README студентської копії

### S17. Оновити README

**Навіщо:** залишити в README інструкції, які відповідають уже реалізованим routes та offline checks.

**Дія:** повністю замініть `my-dev/lesson-03-function-calling-openrouter/README.md`:

````markdown
# Lesson 03 (OpenRouter) – Tool Calling

Практика додає `POST /api/agent` до успадкованого сервісу Lesson 02. Модель може запросити `convert_currency`; сервер валідує аргументи, виконує локальну функцію та передає результат назад моделі.

## Маршрути

- `GET /health` перевіряє сервер.
- `POST /api/documents/extract` та `POST /api/documents/summary/stream` успадковані з Lesson 02.
- `POST /api/agent` приймає JSON з непорожнім `message` і повертає status, text, фактичну model, usage та runtime metrics.

## Offline перевірки

Запускайте з кореня репозиторію:

```powershell
yarn test:my:lesson03:openrouter
yarn eval:my:lesson03:openrouter
yarn eval:my:lesson03:openrouter:tool-calling
yarn check:my:lesson03:openrouter
```

Tool request використовує налаштовану модель. Recorded evals працюють з локальними fixtures і не звертаються до мережі. `check:my` охоплює typecheck, lint, format, student tests, обидва recorded evals та semantic completion gate, який перевіряє фактичний student source.

## Межі

Курси `EducationalRateProvider` є синтетичними навчальними значеннями. Live request потребує власного локального `.env`, може витратити баланс OpenRouter і не входить до обов'язкової acceptance.
````

Перевірте командою `yarn format:check:my:lesson03:openrouter` після форматування папки.

### S18. Доповнити `final-project-ideas.md`

**Навіщо:** записати конкретну ідею фінального проєкту з урахуванням успадкованого списку, не втрачаючи попередні теми.

**Дія:** допишіть в кінець `my-dev/lesson-03-function-calling-openrouter/final-project-ideas.md` після останньої успадкованої теми:

```markdown
## Контрольна точка Lesson 03: агент із безпечними tools

- **Проблема:** повторювані локальні обчислення потребують перевірюваних функцій, а не текстових здогадів моделі.
- **Користувач:** оператор сервісу або розробник внутрішнього помічника.
- **Очікуваний результат:** модель обирає allowlisted tool, сервер перевіряє аргументи, виконує функцію та повертає результат з метриками.
- **Можливе розширення:** після окремої оцінки ризику підключити обмежений read-only адаптер.
- **Ризики:** prompt injection, неправильні аргументи, чутливі дані у зовнішньому запиті та неконтрольовані повтори.
```

Переконайтеся, що наявні ідеї збережені, а новий checkpoint доданий лише один раз.

### S19. Оновити eval README

**Навіщо:** успадкований `evals/README.md` уже посилається на canonical Lesson 03 starter extraction command, але пояснює лише extraction cases. Після створення tool eval runner його треба замінити інструкціями, які запускають обидва Lesson 03 offline suites в student copy.

**Точна дія:** замініть тільки `my-dev/lesson-03-function-calling-openrouter/evals/README.md` таким текстом:

````markdown
# Записані evals Lesson 03

Команди запускайте з кореня репозиторію.

```powershell
yarn eval:my:lesson03:openrouter
yarn eval:my:lesson03:openrouter:tool-calling
```

Перша команда відтворює успадковані extraction cases. Друга запускає п'ять записаних tool-calling observations. Обидві використовують локальні fixtures і не звертаються до OpenRouter. Запишіть фактичний результат і `failed/todo/skipped` з поточного виводу.

Жива генерація є необов'язковою та відокремлена від offline acceptance. Для неї потрібен локальний `.env`; запит може витратити баланс провайдера:

```powershell
yarn eval:my:lesson03:openrouter --live
yarn eval:my:lesson03:openrouter:tool-calling --live
```

Записуйте live results окремо. Recorded replay не підтверджує поточну доступність провайдера чи поведінку живої моделі.
````

**Перевірка:** `yarn format:check:my:lesson03:openrouter`. В README мають бути обидва student-specific offline commands, окремі optional live commands і явне розділення offline/live evidence.

## Завершення

1. `yarn verify:my:lesson03:openrouter` перевіряє semantic completion gate і має відхилити незмінену копію. Після реалізації очікується PASS.
2. Запустіть `yarn check:my:lesson03:openrouter`. Alias охоплює typecheck, lint, format, inherited та student tests, обидва recorded evals і completion gate з solution acceptance tests проти фактичної студентської копії.
3. Обидва recorded runners очікуються `Result: 5/5`. Зафіксуйте актуальні `passed`, `failed`, `todo`, `skipped` з виводу, не використовуйте старі кількості.
4. Перевірте `git diff --check -- my-dev/lesson-03-function-calling-openrouter` і `git status --short`. Зміни мають бути тільки в student folder.
5. Live server/demo не запускаються для offline acceptance. Якщо ви окремо зробили live запит, зафіксуйте його окремо, зупиніть сервер і не виводьте secret.

## Definition of Done

- [ ] Створено всі 12 нових L03 module/test/eval files plus usage helper; `src/app.ts` і `src/server.ts` підключають маршрут.
- [ ] Успадковані document routes і тести залишилися працездатними.
- [ ] Tool request має `model`, `messages` і `tools`, без `parallel_tool_calls`.
- [ ] Невідомі tools і невалідні аргументи не запускають provider; tool outputs мають matching `tool_call_id`.
- [ ] Loop обмежує tool calls; retry не повторює non-retryable validation errors.
- [ ] Unit, route та eval tests активні; фактичний output має нуль failed/todo/skipped.
- [ ] Обидва recorded evals пройшли; це не live provider proof.
- [ ] `yarn check:my:lesson03:openrouter` проходить на student folder.
- [ ] README оновлений, inherited project ideas збережені.

## Звіт

```text
Student path: my-dev/lesson-03-function-calling-openrouter
Offline check: PASS / FAIL
Tests: passed=... failed=... todo=... skipped=...
Extraction replay: ...
Tool replay: ...
Live provider: not run / окремий фактичний результат
Protected paths: starter, solution, dev unchanged
```
