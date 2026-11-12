# Lesson 01 — OpenRouter Starter: гайд знайомства з проєктом

> **Для студентів курсу:** Робоче місце готує **Промпт 1** зі [STUDENTS.md](../STUDENTS.md) у папці `my-dev/lesson-01-intro-openrouter/`. Усі файли `src/...` та `tests/...` нижче редагуються у вашій папці `my-dev`. Канонічні `starter/`, `solution/` та викладацька папка `dev/` не змінюються.

> Мета файла — коротко провести студентів по `starter/`: які файли, за що відповідають і що саме треба реалізувати. Це **не рішення**: у коді навмисно стоять `TODO`-заглушки.

## 1. Що будує практика

Найпростіший застосунок командного рядка (CLI, Command-Line Interface): текст із термінала надсилається до великої мовної моделі (LLM, Large Language Model) через OpenRouter, а відповідь повертається в термінал.

```text
користувач → запит → LLM → відповідь
```

Це ще **не AI-агент**: немає пам'яті, інструментів і agent loop — циклу самостійних кроків. Один прохід означає один запит і одну відповідь.

## 2. Файли starter та їхні ролі

```text
starter/
├── README.md            інструкція до практики
├── src/index.ts         точка входу: збирає частини в один сценарій
├── src/cli.ts           навчальна логіка: тут усі TODO студента
└── tests/cli.test.ts    20 вимог до поведінки в вигляді it.todo()
```

Розподіл відповідальності — головна ментальна модель заняття:

```text
index.ts    = orchestration  (керування порядком виконання)
cli.ts      = testable logic (як саме це працює)
cli.test.ts = контракт       (що вважається правильною роботою)
```

Построкові пояснення кожного файла заховані в спойлери-акордеони наприкінці гайду, щоб не перевантажувати основний потік. Вони розгортаються лише для відповіді на додаткові запитання.

## 3. Маршрут програми одним поглядом

```text
.env                → loadEnvironment()     валідація конфігурації через Zod
process.argv        → readUserInput()       запит користувача
environment + input → requestAnswer()       збірка запиту й виклик моделі
                        ChatClient → OpenAI SDK → OpenRouter
                     ← AnswerResult { text, model } → console.log
```

## 4. Що вже готово, а що реалізує студент

**Готово у `cli.ts`:** константи моделей, Zod-схема environment, типи (`Environment`, `ChatClient`, `AnswerResult`), клас `UserFacingError`, безпечний `formatError()`.

**Реалізує студент (порядок зафіксовано в TODO):**

1. `loadEnvironment()` — Zod `safeParse`; у помилці лише назви полів, ніколи їхні значення;
2. `readUserInput()` — об'єднати аргументи, `trim()`, відхилити порожній запит;
3. `formatApiFailure()` — timeout / network / загальний HTTP 429 / HTTP status без витоку provider body;
4. `requestAnswer()` — збірка `ChatRequest` (system + user, reasoning, max_completion_tokens), один виклик `client.create`, trim відповіді та фактична модель;
5. Замінити всі 20 `it.todo` повноцінними unit-тестами.

**Чому тести працюватимуть без API:** `requestAnswer` залежить від маленького інтерфейсу `ChatClient`, тому в тестах підставляється mock — контрольована тестова заміна клієнта без інтернету й реального запиту.

## 5. Де starter зупиняється

Перший запуск незміненого starter падає одразу — це очікувана поведінка:

```text
❌ Не вдалося виконати запит: TODO: потрібно реалізувати loadEnvironment(env).
```

Перше завдання студента — саме ця функція, далі за списком із розділу 4.

## 6. Підготовка вашої папки

Запустіть **Промпт 1** зі [STUDENTS.md](../STUDENTS.md), оберіть Lesson `01` та OpenRouter і працюйте у створеній папці `my-dev/lesson-01-intro-openrouter/`. Редагуйте там копію файлів зі starter. Не змінюйте canonical `starter/` і `solution/` або викладацьку папку `dev/`.

Стартовий код містить 20 `it.todo`. Це навмисні заглушки, які поступово замінюються тестами. Переглянути початковий результат можна так:

```powershell
yarn vitest run my-dev/lesson-01-intro-openrouter/tests
```

Для незміненого starter очікуються `0 passed, 20 todo`. Команда `yarn test:my:lesson01:openrouter` також є строгим TODO gate, тому до реалізації всіх тестів вона завершується помилкою.

## 7. Команди

Запускайте їх із кореня вашого fork:

| Коли                                           | Команда                                                   |
| ---------------------------------------------- | --------------------------------------------------------- |
| Перевірка типів під час кодування              | `yarn typecheck:my:lesson01:openrouter`                   |
| Проміжний запуск тестів                        | `yarn vitest run my-dev/lesson-01-intro-openrouter/tests` |
| Strict TODO gate і unit-тести після завершення | `yarn test:my:lesson01:openrouter`                        |
| Повний offline gate після завершення           | `yarn check:my:lesson01:openrouter`                       |
| Ручний запуск після offline checks             | `yarn dev:my:lesson01:openrouter "запит"`                 |

Локальні unit-тести використовують mock і не потребують API. Ручний запуск потребує ключа й мережі. Усі практики читають спільний кореневий `./.env`; зовнішні змінні середовища мають пріоритет. Якщо файла ще немає, створіть його з кореня репозиторію командою `yarn env:init`, яка не перезаписує наявний файл. Введіть `OPENROUTER_API_KEY` лише в цей кореневий файл. Не друкуйте та не додавайте ключ до Git.

```powershell
yarn env:init
notepad .env
```

## 8. Головне після знайомства

1. `index.ts` — orchestration; `cli.ts` — логіка; `tests/cli.test.ts` — контракт.
2. Значення з `process.env` спершу проходять валідацію схемою.
3. Помилки показуємо безпечно: без ключів, заголовків і provider body.
4. OpenAI SDK тут — лише HTTP-клієнт для OpenRouter (перевизначений `baseURL`).
5. Реальний API у тестах не використовується — для цього існує `ChatClient` + mock.

---

# Додаток: детальні пояснення коду (спойлери)

Опціональний розділ. Основний гайд вище самодостатній; ці акордеони розгортаються, тільки якщо студенти запитують «а що саме робить ось цей рядок».

<details> <summary><b>src/index.ts — повний код з построковими коментарями</b></summary>

```ts
// Імпортуємо офіційний OpenAI SDK.
// У цій практиці він використовується не для OpenAI напряму,
// а як HTTP-клієнт для OpenRouter, тому що OpenRouter має
// OpenAI-compatible API.
import OpenAI from "openai";

// Імпортуємо нашу власну логіку з cli.ts.
import {
  // Перетворює будь-яку помилку на безпечний текст для користувача.
  formatError,

  // Читає й валідує process.env.
  loadEnvironment,

  // Завантажує лише спільний кореневий .env; process.env має пріоритет.
  loadRootEnvironment,

  // Перетворює CLI-аргументи на один user prompt.
  readUserInput,

  // Формує LLM-запит і повертає нормалізовану відповідь.
  requestAnswer,

  // Базовий URL OpenRouter API для налаштування клієнта.
  OPENROUTER_BASE_URL,

  // Лише TypeScript-тип контракту API-клієнта.
  // type-import не потрапляє у runtime JavaScript.
  type ChatClient,
} from "./cli.js";

// Під час запуску завантажується лише спільний кореневий .env.
// loadRootEnvironment() визначає корінь за package.json,
// ігнорує practice-local .env і об'єднує дані з пріоритетом process.env.

// Головна async-функція застосунку.
// Promise<void>: асинхронна, але корисного значення не повертає.
async function main(): Promise<void> {
  // Усі environment variables передаємо у loadEnvironment().
  const environment = loadEnvironment(loadRootEnvironment(import.meta.url));

  // process.argv: [0] — шлях до Node.js, [1] — шлях до скрипта,
  // slice(2) залишає лише аргументи користувача.
  const input = readUserInput(process.argv.slice(2));

  console.log("\n📤 Надіслано:");
  console.log(input);
  console.log(`🎯 Основна модель: ${environment.OPENROUTER_MODEL}`);

  console.log("⏳ Очікування відповіді OpenRouter...");

  // Створюємо екземпляр OpenAI SDK.
  // Поки що це лише конфігурація; сам запит ще не виконується.
  const openai = new OpenAI({
    // Ключ із валідованого environment — ніколи не хардкодимо.
    apiKey: environment.OPENROUTER_API_KEY,

    // Перенаправляємо SDK на OpenRouter endpoint.
    baseURL: OPENROUTER_BASE_URL,

    // Чекаємо відповідь максимум 30 секунд (30_000 мс).
    timeout: 30_000,

    // Один контрольований виклик на кожен явний запуск.  });
  // TODO (фінальна перевірка): після реалізації cli.ts виконати контрольований
  // smoke-запит і підтвердити, що adapter повертає лише текст та фактичну модель.

  // Адаптер ChatClient поверх SDK: бізнес-логіка не знає весь OpenAI SDK.
  const client: ChatClient = {
    create: async (request) => {
      // Реальний HTTP-запит; через baseURL піде в OpenRouter.
      const response = await openai.chat.completions.create(request);

      return {
        // content першого choice;
        // ?. захист від відсутнього елемента, ?? "" — від undefined.
        text: response.choices[0]?.message?.content ?? "",

        // ID моделі, яка фактично виконала запит.
        model: response.model,
      };
    },
  };

  const answer = await requestAnswer(client, environment, input);

  console.log("\n📝 Відповідь:");
  console.log(answer.text);
  console.log(`\n🤖 Фактична модель: ${answer.model}`);


}

// void: resolved value Promise тут не використовується.
void main().catch((error: unknown) => {
  // Будь-яку помилку перетворюємо на безпечний user-facing текст.
  console.error(`❌ Не вдалося виконати запит: ${formatError(error)}`);

  // Ненульовий exit code для ОС/CI/shell.
  process.exitCode = 1;
});
```

</details>

<details> <summary><b>src/cli.ts — повний код з построковими коментарями</b></summary>

```ts
// OpenAI SDK потрібен тут для розпізнавання типів помилок API-клієнта.
import OpenAI from "openai";

// Zod — runtime-валідація: значення з .env приходять лише під час запуску.
import { z } from "zod";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_OPENROUTER_MODEL = "~deepseek/deepseek-v4-flash-latest";

// as const → readonly tuple з дозволеними значеннями.
export const OPENROUTER_REASONING_EFFORTS = ["max", "high", "low"] as const;
export const DEFAULT_REASONING_EFFORT = "low";
export const DEFAULT_MAX_TOKENS = 1_600;

export const environmentSchema = z.object({
  // Обов'язковий: рядок, trim, непорожній.
  OPENROUTER_API_KEY: z.string().trim().min(1),

  // Необов'язковий з дефолтом.
  OPENROUTER_MODEL: z.string().trim().min(1).default(DEFAULT_OPENROUTER_MODEL),

  // Лише значення з дозволеного списку; дефолт low.
  OPENROUTER_REASONING_EFFORT: z
    .enum(OPENROUTER_REASONING_EFFORTS)
    .default(DEFAULT_REASONING_EFFORT),
  OPENROUTER_MAX_OUTPUT_TOKENS: z.coerce
    .number()
    .int()
    .min(1)
    .max(32_000)
    .default(DEFAULT_MAX_TOKENS),
});

// TypeScript-тип автоматично виводиться зі схеми.
export type Environment = z.infer<typeof environmentSchema>;

// Помилка, яку безпечно показувати користувачу.
export class UserFacingError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

// === НАВЧАЛЬНЕ ЗАВДАННЯ 1 ===============================================
export function loadEnvironment(_env: Readonly<Record<string, string | undefined>>): Environment {
  // TODO 1: використати environmentSchema.safeParse(_env)
  //   (не кидає exception, повертає success/data або success/error).
  // TODO 2: якщо невалідно — безпечне повідомлення
  //   лише з назвами проблемних полів, без їхніх значень.

  // Заглушка starter: програма навмисно завершується тут.
  throw new UserFacingError("TODO: потрібно реалізувати loadEnvironment(env).");
}

// === НАВЧАЛЬНЕ ЗАВДАННЯ 2 ===============================================
export function readUserInput(_args: readonly string[]): string {
  // Треба: join(" ") + trim() + відхилення порожнього результату.
  throw new UserFacingError("TODO: потрібно реалізувати readUserInput(args).");
}

// Безпечне представлення API-помилки: без raw body, key і headers.
export type SafeApiFailure = {
  name: string;
  status?: number;
  request_id?: string | null;
};

// === НАВЧАЛЬНЕ ЗАВДАННЯ 3 ===============================================
export function formatApiFailure(_error: SafeApiFailure): string {
  // Треба окремо обробити: timeout, network error,
  // загальне HTTP 429, звичайний статус, статус відсутній.
  throw new UserFacingError("TODO: потрібно реалізувати formatApiFailure(error).");
}

// Спільний formatter будь-якої невідомої помилки (уже готовий).
export function formatError(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    // Raw error не показуємо: SafeApiFailure лише з дозволених полів.
    return formatApiFailure({
      name: error.constructor.name,
      ...(typeof error.status === "number" ? { status: error.status } : {}),
      ...(error.requestID ? { request_id: error.requestID } : {}),
    });
  }

  // UserFacingError уже має безпечний message.
  if (error instanceof UserFacingError) {
    return error.message;
  }

  // Непередбачене: raw message і stack не показуємо.
  return "Сталася непередбачена помилка. Спробу можна повторити або повідомити викладача.";
}

export type ChatMessage = { role: "system"; content: string } | { role: "user"; content: string };
export type ReasoningEffort = (typeof OPENROUTER_REASONING_EFFORTS)[number];

export type ChatRequest = {
  model: string;
  maxRetries: 0;
  messages: ChatMessage[];
  reasoning: { enabled: boolean; effort: ReasoningEffort };
  max_completion_tokens: number;
};

// Абстракція між бізнес-логікою та конкретним SDK.
export interface ChatClient {
  create(request: ChatRequest): Promise<{ text: string; model?: string }>;
}

export interface AnswerResult {
  text: string;
  model: string;
}

// === НАВЧАЛЬНЕ ЗАВДАННЯ 5 (головне) =====================================
export async function requestAnswer(
  _client: ChatClient,
  _environment: Environment,
  _input: string,
): Promise<AnswerResult> {
  // TODO: один виклик client.create з model, messages, reasoning і max_completion_tokens.
  // trim response.text, відхилити порожнє значення й повернути фактичну model.

  throw new UserFacingError("TODO: потрібно реалізувати requestAnswer(...).");
}
```

</details>

<details> <summary><b>tests/cli.test.ts — список it.todo з поясненнями вимог</b></summary>

`it.todo()` = вимога до поведінки сформульована, але тест ще не написаний. Студент замінює кожен рядок повноцінним тестом.

```ts
import { describe, it } from "vitest";

describe("CLI helpers — завдання студента (OpenRouter)", () => {
  // loadEnvironment(): конфігурація без ключа має відхилятись.
  it.todo("відхиляє відсутній OPENROUTER_API_KEY");

  // Дефолти: основна модель і effort.
  it.todo("підставляє основну модель та effort за замовчуванням");

  // effort поза ["medium", "low"] відхиляється валідацією.
  it.todo("відхиляє рівень мислення, якого немає в метаданих моделі");

  // readUserInput(): кілька аргументів → один рядок через пробіл.
  it.todo("об'єднує аргументи CLI");

  // [] або пробільний рядок → помилка з підказкою команди запуску.
  it.todo("відхиляє порожній CLI input");

  // 401 → лише безпечні поля (HTTP status + request_id), без provider body.
  it.todo("безпечно форматує HTTP 401");

  // Мережевий збій → коротке зрозуміле повідомлення.
  it.todo("безпечно форматує network error");

  // Timeout окремий від загального network error.
  it.todo("безпечно форматує timeout");

  // Немає status → лише безпечна назва класу помилки.
  it.todo("форматує невідомий статус лише за ім'ям помилки");

  // HTTP 429 → безпечний статус і request_id без provider payload.
  it.todo("форматує generic HTTP 429 без provider payload");

  // formatError() розпізнає реальні екземпляри помилок OpenAI SDK:
  it.todo("розпізнає реальний AuthenticationError через formatError");
  it.todo("розпізнає реальний APIConnectionError через formatError");
  it.todo("розпізнає реальний APIConnectionTimeoutError через formatError");
  it.todo("безпечно форматує HTTP 429 через formatError");

  // UserFacingError проходить без маскування; інше маскується.
  it.todo("пропускає повідомлення UserFacingError через formatError");
  it.todo("безпечно маскує непередбачену помилку через formatError");

  // requestAnswer() через mock ChatClient:
  it.todo("повертає текст і фактичну модель відповіді через mock");
  it.todo("підставляє дефолтні model, effort і max_completion_tokens в запит");
  it.todo("відхиляє порожній text через mock");

  // Перевірка погодженого model config та shared root env example.
  it.todo("перевіряє синхронізацію з конфігурацією кореневого .env.example");
});
```

</details>
