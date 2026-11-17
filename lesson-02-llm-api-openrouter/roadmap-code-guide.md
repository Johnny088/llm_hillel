# Lesson 02 – roadmap від starter до Document API (OpenRouter)

> **Для студентів курсу:** Усі кроки розробки виконуються в вашій робочій папці `my-dev/lesson-02-llm-api-openrouter/` (підготовленій за [STUDENTS.md](../STUDENTS.md)). Канонічні папки `starter/` та `solution/` не змінюються.
>
> **Команди перевірки з кореня репозиторію:**
>
> - `yarn test:my:lesson02:openrouter` – запуск тестів вашої реалізації
> - `yarn eval:my:lesson02:openrouter` – запуск детермінованого offline eval
> - `yarn check:my:lesson02:openrouter` – повний quality gate (типи, лінтер, тести, eval)
> - `yarn dev:my:lesson02:openrouter` – запуск вашого локального Express-сервера

## Development Guide

- Provider: OpenRouter
- Previous baseline: `lesson-01-intro-openrouter/solution`
- Start: `lesson-02-llm-api-openrouter/starter`
- Physical checkpoint: `checkpoints/01-streaming`
- Target: `my-dev/lesson-02-llm-api-openrouter/` (student workspace); canonical `solution/` is reference only
- Transition: conceptual CLI → HTTP API
- Guide version: `v010`
- Updated: `2026-09-05`

> Версія v010 зберігає контракт нової практики 02: одна платна Flash-модель, shared root env і `reasoning_effort=low`. Кроки містять розгортані блоки з повним кодом, послідовними коментарями та нумерованим поясненням логічних блоків. Capability registry і 5 baseline-тестів уже готові в starter та не стають повторним студентським завданням. Версія також містить усі imports, application glue, error middleware, HTTP acceptance-сценарії, scoped formatting і process-only запуск TypeScript entrypoints на Windows. Маршрут змінює шість основних файлів і додає два файли тестів. Розрахунок вартості, TTFT, cache metrics та cancellation показані як додаткове поглиблення. Тести цих розширень потрібні для повного проходження roadmap, але не змінюють межі обов'язкової частини домашнього завдання. Обов'язкові timeout-сценарії перевіряють HTTP 504 і SSE `GATEWAY_TIMEOUT`.

Якщо основний блок показує лише ключовий фрагмент, повну реалізацію потрібно взяти з блоку «Розгорнути» нижче. Скорочений фрагмент сам по собі не замінює повного методу або файла.

---

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Створити надійний і типізований HTTP-сервіс (Document API) на Node.js/TypeScript для обробки текстових документів за допомогою LLM через OpenRouter API. Практика демонструє два ключові патерни інтеграції мовних моделей в backend-застосунок: **структуроване вилучення даних за JSON Schema з локальною валідацією та grounding** і **потокову доставку згенерованого тексту через Server-Sent Events (SSE)**.

### 💎 Практична цінність застосунку

- **Контрольована структура даних (Strict JSON Schema + Zod + Grounding):** Structured Outputs задає очікувану форму успішної відповіді через JSON Schema, а застосунок додатково виконує локальний `JSON.parse`, Zod-валідацію та grounding-перевірку сутностей перед використанням результату. Це дозволяє явно відхиляти невалідний, неповний або незаземлений результат замість сліпо довіряти відповіді моделі.
- **Поступова доставка відповіді (Real-time Streaming via SSE):** Замість очікування повністю сформованого результату клієнт отримує текстові фрагменти (`delta`) в міру їх генерації. Застосунок контролює terminal state потоку та окремо вимірює Time-to-First-Token/fragment (TTFT) і повну latency.
- **Прозорий моніторинг ресурсів та вартості (Usage, Cost & Cache Tracking):** Застосунок збирає доступні token і cache metrics, вимірює latency та використовує provider-reported cost, а за його відсутності – перевірені локальні тарифи. Якщо достовірно визначити вартість неможливо, результат явно позначається як `cost unavailable`, а не підмінюється нульовим значенням.
- **Типізована API-архітектура та observability:** HTTP-рівень відокремлений від AI/provider adapter через інтерфейс `DocumentAi`. Застосунок має `GET /health`, централізовану безпечну обробку помилок, usage/cost/latency metrics та контрольований життєвий цикл streaming-запитів, включно зі скасуванням upstream-запиту після розриву клієнтського з'єднання.
- **Ізольоване тестування без provider calls (Offline-First Testing):** Unit- та HTTP-тести використовують fake `DocumentAi`, mocks OpenAI SDK і локальний ephemeral HTTP-сервер, тому перевіряють application та adapter contracts без реальних викликів OpenRouter, витрачання коштів і залежності від доступності зовнішньої мережі.

### ⚙️ Що робить застосунок

1. **Ініціалізує HTTP-сервіс:** Завантажує та валідує конфігурацію застосунку, створює AI adapter, запускає Express-сервер і надає `GET /health` для перевірки готовності самого HTTP-сервісу.
2. **Вилучає структуровані дані (`POST /api/documents/extract`):** Приймає текст документа, формує запит із strict JSON Schema, перевіряє terminal state відповіді, виконує `JSON.parse`, локальну Zod-валідацію, нормалізацію локацій і grounding сутностей, після чого повертає типізовані дані разом із usage, latency, cache та cost metrics.
3. **Генерує потокове резюме (`POST /api/documents/summary/stream`):** Приймає текст документа та передає клієнту текстові `delta` через Server-Sent Events. Успішний потік завершується послідовністю `delta* → usage → done`, тоді як refusal, incomplete або failure завершуються `error` без події `done`.
4. **Вимірює використання ресурсів:** Нормалізує token usage, враховує cached і cache-write tokens під час формування метрик та оцінки вартості, вимірює TTFT і загальну latency та використовує фактичну модель, повернуту провайдером.
5. **Безпечно керує помилками та життєвим циклом запиту:** Валідує HTTP-вхід через Zod, перетворює SDK/provider failures на стабільні domain/API errors без витоку raw provider body, headers, API key або stack trace та скасовує upstream streaming request, якщо клієнт розриває HTTP-з'єднання.

---

## 1. Навчальний результат

Після завершення в `my-dev/lesson-02-llm-api-openrouter/` має працювати Document API:

```text
POST /api/documents/extract
  → strict JSON data
  → usage + latency + cache metrics + cost state

POST /api/documents/summary/stream
  → SSE delta*
  → usage
  → done лише після completed
  → error без done для refusal, incomplete або failure
```

Практика додає:

- system instructions;
- Structured Output через JSON Schema;
- локальну Zod-валідацію;
- streaming;
- usage, cached tokens і cost tracking;
- application-level model resolver;
- offline tests та eval dataset.

Tools, memory, agent loop і multi-agent orchestration не входять до Lesson 02.

## 2. Незмінні правила нової версії

1. Для локального запуску застосунок читає shared root `.env`; offline-перевірки його не потребують.
2. `dev/.env` в Lesson 01 – історична інструкторська папка; студент Lesson 01 зберігає локальний `.env` в власній `my-dev/lesson-01-intro-openrouter/`.
3. Default model: `~deepseek/deepseek-v4-flash-latest`.
4. `OPENROUTER_MODEL_FAST` і `OPENROUTER_MODEL_MAIN` – лише optional role overrides.
5. Default і рекомендований `OPENROUTER_REASONING_EFFORT` – `low`.
6. Кожна окрема операція використовує одну модель своєї ролі.
7. Невідома ціна повертає `cost unavailable`, а не fake `0`.
8. Unit tests не виконують мережевих запитів.
9. Recorded replay не називається live eval.

## 3. Student delta

Повний roadmap торкається восьми файлів; homework.md визначає вимоги для здачі:

```text
my-dev/lesson-02-llm-api-openrouter/src/config/pricing.ts
my-dev/lesson-02-llm-api-openrouter/src/config/prompts.ts
my-dev/lesson-02-llm-api-openrouter/src/lib/metrics.ts
my-dev/lesson-02-llm-api-openrouter/src/services/openrouter-document-ai.ts
my-dev/lesson-02-llm-api-openrouter/src/app.ts
my-dev/lesson-02-llm-api-openrouter/tests/app.test.ts
my-dev/lesson-02-llm-api-openrouter/tests/config-and-metrics.test.ts
my-dev/lesson-02-llm-api-openrouter/tests/openrouter-document-ai.test.ts
```

Файли `env.ts`, `models.ts`, `model-capabilities.ts`, schemas, SSE helpers і `tests/scaffolding.test.ts` уже є готовою основою.

Instructor solution додатково містить:

- `src/demo.ts`;
- `evals/live-catalog.ts`;
- розширений output `evals/run.ts`;
- розширені adapter, config/metrics та eval unit tests;
- повні README.

Ці додаткові файли не є mandatory student delta.

## 4. Підготовка робочого місця студента

Згідно зі [STUDENTS.md](../STUDENTS.md), робоче місце студента готує **Промпт 1**:

- Створює гілку `lesson-02-llm-api-openrouter`;
- Створює робочу папку `my-dev/lesson-02-llm-api-openrouter/`, копіюючи туди 24 файли зі `starter/`.

Offline-перевірки `check:my` та `eval:my` не потребують кореневого `.env` або API key. Щоб побачити початковий стан тестів:

```shell
yarn vitest run --dir my-dev/lesson-02-llm-api-openrouter/tests
```

Очікується 5 `passed`, 12 `todo`, 0 `failed`; Vitest може також показати один skipped-файл, бо всі тести в ньому поки `todo`. На starter команда `yarn check:my:lesson02:openrouter` навмисно завершується з помилкою через no-TODO gate; це не збій середовища. Запускайте її після реалізації 12 сценаріїв.

Перевірити типи окремо можна командою `yarn typecheck:my:lesson02:openrouter`. Для необов'язкового ручного запуску сервера потрібен локальний `.env`; кроки наведені в [dev-migration-guide.md](./dev-migration-guide.md).

## 5. Карта проходження

```text
Starter: ready infrastructure + 501 routes + 5 active + 12 todo
  ↓
Етап A: verified pricing, prompt example, provider cost
  ↓
Етап B: provider errors і grounding helpers
  ↓
Checkpoint 01: working streaming adapter + SSE route
  ↓
Етап C: strict structured extraction + JSON route
  ↓
Етап D: 12 contract categories + optional tests → offline proof
  ↓
Offline proof → optional minimal live proof
  ↓
Completed dev
```

Якщо йдете за повним roadmap, виконуйте кроки послідовно від кроку 1: наступні кроки використовують результат Етапу A, зокрема `EXTRACTION_EXAMPLE`. Етап A потрібен для повного проходження roadmap; мінімум для здачі визначає [homework.md](./homework.md).

---

# Етап A – ціна, example і provider-reported cost

## Крок 1. Зареєструвати ціну основної моделі

Файл: `my-dev/lesson-02-llm-api-openrouter/src/config/pricing.ts`.

До імпортів додається default model:

```ts
import { DEFAULT_OPENROUTER_MODEL } from "./openrouter.js";
```

Порожній registry замінюється на pinned values поточної практики:

```ts
export const MODEL_PRICES: Readonly<Record<string, ModelPricing>> = {
  [DEFAULT_OPENROUTER_MODEL]: {
    inputCostPerMillion: 0.04998,
    cachedInputCostPerMillion: 0.009996,
    outputCostPerMillion: 0.09996,
  },
};
```

<details>
<summary><b>Розгорнути: детальні пояснення коду</b></summary>

### Той самий код з поясненнями

```ts
// Імпортуємо єдиний default model ID, щоб не дублювати literal-рядок у pricing registry.
import { DEFAULT_OPENROUTER_MODEL } from "./openrouter.js";

// Ключ registry — model ID, а значення — перевірені ціни за один мільйон токенів.
export const MODEL_PRICES: Readonly<Record<string, ModelPricing>> = {
  // Computed key гарантує, що ціна належить саме поточній default-моделі.
  [DEFAULT_OPENROUTER_MODEL]: {
    // Звичайні input tokens оплачуються за основною input-ціною.
    inputCostPerMillion: 0.04998,
    // Cached input має окрему нижчу ціну, яку враховує calculateCost.
    cachedInputCostPerMillion: 0.009996,
    // Output tokens мають власну тарифну ставку.
    outputCostPerMillion: 0.09996,
  },
};
```

### Пояснення коду по логічних блоках

1. `DEFAULT_OPENROUTER_MODEL` – зберігає model ID в одному конфігураційному місці.
2. Computed key `[DEFAULT_OPENROUTER_MODEL]` – пов'язує verified pricing із конкретною моделлю.
3. Три tariff fields – розділяють звичайний input, cached input та output.
4. `Readonly<Record<...>>` – забороняє переприсвоєння записів реєстру під час перевірки типів. Об'єкти цін не заморожуються під час виконання програми.

</details>

Ці числа є catalog facts, а не універсальними константами. Перед новим релізом їх перевіряє public catalog gate. В registry немає безкоштовного профілю і немає `:free` special case.

## Крок 2. Надати пріоритет provider-reported cost

Сигнатура `calculateCost` розширюється:

```ts
export function calculateCost(
  model: string,
  usage: UsageMetrics,
  prices: Readonly<Record<string, ModelPricing>> = MODEL_PRICES,
  providerReportedCostUsd?: number | null,
): CostCalculationResult {
```

На початку функції:

```ts
if (
  typeof providerReportedCostUsd === "number" &&
  Number.isFinite(providerReportedCostUsd) &&
  providerReportedCostUsd >= 0
) {
  return {
    estimatedCostUsd: providerReportedCostUsd,
    pricingAvailable: true,
  };
}
```

<details>
<summary><b>Розгорнути: детальні пояснення коду</b></summary>

### Той самий код з поясненнями

```ts
export function calculateCost(
  model: string,
  usage: UsageMetrics,
  prices: Readonly<Record<string, ModelPricing>> = MODEL_PRICES,
  // Provider-reported cost optional: старі або тестові usage-об'єкти можуть його не мати.
  providerReportedCostUsd?: number | null,
): CostCalculationResult {
  // Приймаємо лише справжнє число, відкидаючи null, NaN, Infinity і від'ємні значення.
  if (
    typeof providerReportedCostUsd === "number" &&
    Number.isFinite(providerReportedCostUsd) &&
    providerReportedCostUsd >= 0
  ) {
    // Дані провайдера мають пріоритет над локальною оцінкою за registry.
    return {
      estimatedCostUsd: providerReportedCostUsd,
      pricingAvailable: true,
    };
  }

  // Якщо валідної provider-суми немає, шукаємо локальний тариф для цієї моделі.
  const pricing = prices[model];

  // Відсутня модель означає "ціна невідома", а не нульову вартість.
  if (!pricing) {
    return {
      estimatedCostUsd: null,
      pricingAvailable: false,
      pricingUnavailableReason: "MODEL_NOT_CONFIGURED",
    };
  }

  // Не оцінюємо cached tokens звичайною input-ціною, якщо окремий тариф невідомий.
  if (usage.cachedTokens > 0 && pricing.cachedInputCostPerMillion === undefined) {
    return {
      estimatedCostUsd: null,
      pricingAvailable: false,
      pricingUnavailableReason: "CACHED_INPUT_PRICE_MISSING",
    };
  }

  // Так само не підміняємо невідому cache-write ціну звичайною input-ціною.
  if (usage.cacheWriteTokens > 0 && pricing.cacheWriteCostPerMillion === undefined) {
    return {
      estimatedCostUsd: null,
      pricingAvailable: false,
      pricingUnavailableReason: "CACHE_WRITE_PRICE_MISSING",
    };
  }

  // Віднімаємо cached і cache-write частини, щоб не порахувати їх двічі.
  const regularInputTokens = Math.max(
    0,
    usage.inputTokens - usage.cachedTokens - usage.cacheWriteTokens,
  );
  const cachedInputPrice = pricing.cachedInputCostPerMillion ?? pricing.inputCostPerMillion;
  const cacheWritePrice = pricing.cacheWriteCostPerMillion ?? pricing.inputCostPerMillion;

  // Кожну категорію токенів множимо на її тариф за один мільйон.
  const estimatedCostUsd =
    (regularInputTokens / 1_000_000) * pricing.inputCostPerMillion +
    (usage.cachedTokens / 1_000_000) * cachedInputPrice +
    (usage.cacheWriteTokens / 1_000_000) * cacheWritePrice +
    (usage.outputTokens / 1_000_000) * pricing.outputCostPerMillion;

  // Успішний локальний розрахунок явно позначає доступність pricing.
  return { estimatedCostUsd, pricingAvailable: true };
}
```

### Пояснення коду по логічних блоках

1. Новий параметр не є обов'язковим, тому не ламає наявні виклики функції.
2. Чотири умови в `if` відсікають нечислові, нескінченні та від'ємні значення.
3. Валідний provider cost повертається одразу як найточніше доступне значення.
4. За відсутності provider cost три guards не дозволяють видати вигадану нульову або неточну ціну.
5. `regularInputTokens` відокремлює звичайний input від cached і cache-write tokens.
6. Фінальна формула окремо рахує чотири категорії токенів за ціною за мільйон.

</details>

Після цього зберігається наявний локальний розрахунок. Якщо provider не повернув cost і model відсутня в registry, результат залишається explicit unavailable.

## Крок 3. Нормалізувати provider cost

Файл: `my-dev/lesson-02-llm-api-openrouter/src/lib/metrics.ts`.

В provider-neutral usage:

```ts
export interface ResponseUsageLike {
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  input_tokens_details?: {
    cached_tokens?: number | null;
    cache_write_tokens?: number | null;
  } | null;
  provider_cost_usd?: number | null;
}
```

В Chat Completions usage:

```ts
export interface ChatCompletionUsageLike {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  prompt_tokens_details?: {
    cached_tokens?: number | null;
    cache_write_tokens?: number | null;
  } | null;
  cost?: number | null;
}
```

`normalizeChatUsage` додає поле лише для скінченного невід'ємного числа:

```ts
...(typeof usage.cost === "number" &&
Number.isFinite(usage.cost) &&
usage.cost >= 0
  ? { provider_cost_usd: usage.cost }
  : {})
```

<details>
<summary><b>Розгорнути: детальні пояснення коду</b></summary>

### Той самий код з поясненнями

```ts
export interface ResponseUsageLike {
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  input_tokens_details?: {
    cached_tokens?: number | null;
    cache_write_tokens?: number | null;
  } | null;
  // Нормалізоване поле переносить provider-reported cost між шарами застосунку.
  provider_cost_usd?: number | null;
}

export interface ChatCompletionUsageLike {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  prompt_tokens_details?: {
    cached_tokens?: number | null;
    cache_write_tokens?: number | null;
  } | null;
  // OpenRouter додає фактичну USD-вартість у поле cost свого usage payload.
  cost?: number | null;
}

export function normalizeChatUsage(
  usage: ChatCompletionUsageLike | null | undefined,
): ResponseUsageLike | null {
  // За відсутності usage немає що нормалізувати.
  if (!usage) {
    return null;
  }

  return {
    // Перейменовуємо Chat Completions token fields у provider-neutral форму.
    input_tokens: usage.prompt_tokens ?? null,
    output_tokens: usage.completion_tokens ?? null,
    total_tokens: usage.total_tokens ?? null,
    input_tokens_details: {
      cached_tokens: usage.prompt_tokens_details?.cached_tokens ?? null,
      cache_write_tokens: usage.prompt_tokens_details?.cache_write_tokens ?? null,
    },
    // Додаємо provider cost лише тоді, коли значення безпечне для розрахунку.
    ...(typeof usage.cost === "number" && Number.isFinite(usage.cost) && usage.cost >= 0
      ? { provider_cost_usd: usage.cost }
      : {}),
  };
}
```

### Пояснення коду по логічних блоках

1. `cost` описує provider-specific input, а `provider_cost_usd` – внутрішній нейтральний контракт.
2. `normalizeChatUsage` зберігає наявне перейменування token fields.
3. Conditional spread не створює поле для невалідного cost.
4. Наступний шар може передати `provider_cost_usd` до `calculateCost`, не знаючи структуру OpenRouter response.

</details>

## Крок 4. Додати один extraction example

Файл: `my-dev/lesson-02-llm-api-openrouter/src/config/prompts.ts`.

Унікальний якір – `export const SUMMARY_INSTRUCTIONS = [`. Після завершення цієї константи додайте `EXTRACTION_EXAMPLE` з блока нижче. Збережіть наявні `EXTRACTION_INSTRUCTIONS` і `SUMMARY_INSTRUCTIONS`; весь файл не замінюється. Після кроку файл має експортувати всі три константи.

```ts
export const EXTRACTION_EXAMPLE = {
  input: "5 травня 2025 року Марія Петренко виступила в Одесі.",
  output: JSON.stringify({
    names: ["Марія Петренко"],
    dates: ["5 травня 2025 року"],
    locations: ["Одесі"],
    summary: "5 травня 2025 року Марія Петренко виступила в Одесі.",
  }),
} as const;
```

<details>
<summary><b>Розгорнути: детальні пояснення коду</b></summary>

### Той самий код з поясненнями

```ts
// Few-shot example показує моделі одну правильну пару input → structured output.
export const EXTRACTION_EXAMPLE = {
  // У вхідному реченні явно присутні дата, ім'я та локація.
  input: "5 травня 2025 року Марія Петренко виступила в Одесі.",
  // Assistant example передається як JSON-рядок, бо chat message content має тип string.
  output: JSON.stringify({
    // Сутності копіюються дослівно, без вигадування нових значень.
    names: ["Марія Петренко"],
    dates: ["5 травня 2025 року"],
    locations: ["Одесі"],
    // Summary також залишається grounded у вихідному реченні.
    summary: "5 травня 2025 року Марія Петренко виступила в Одесі.",
  }),
} as const;
```

### Пояснення коду по логічних блоках

1. `input` – короткий синтетичний документ із перевірюваними сутностями.
2. `JSON.stringify` – перетворює typed object на content assistant message.
3. Масиви демонструють очікувану форму Structured Output.
4. `as const` – фіксує example як незмінну конфігурацію.

</details>

Example демонструє точне копіювання сутностей із input. Він не підмінює JSON Schema або локальну валідацію.

Перевірка етапу:

```shell
yarn prettier --write my-dev/lesson-02-llm-api-openrouter
yarn typecheck:my:lesson02:openrouter
```

На цьому проміжному кроці 12 `todo` ще очікувані. `check:my` поки не запускайте: він правильно зупиняється на no-TODO gate. Поверніться до повного quality gate після кроку 12.

---

# Етап B – безпечний provider adapter

## Крок 5. Зафіксувати adapter options

`my-dev/lesson-02-llm-api-openrouter/src/services/openrouter-document-ai.ts` уже має правильний контракт:

```ts
export interface OpenRouterDocumentAiOptions {
  fastModel: string;
  mainModel: string;
  reasoningEffort: ReasoningEffort;
  maxOutputTokens: number;
}
```

Кожна окрема операція використовує одну модель, налаштовану для її ролі.

`server.ts` уже передає фактичне значення:

```ts
reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
```

<details>
<summary><b>Розгорнути: детальні пояснення коду</b></summary>

### Той самий код з поясненнями

```ts
// Options містять лише дві application roles, effort і спільний output limit.
export interface OpenRouterDocumentAiOptions {
  // fastModel використовується для короткого streaming summary.
  fastModel: string;
  // mainModel використовується для strict structured extraction.
  mainModel: string;
  // Effort приходить із перевіреного environment, а не хардкодиться в adapter.
  reasoningEffort: ReasoningEffort;
  // Один ліміт контролює максимальний output обох provider requests.
  maxOutputTokens: number;
}

const ai = new OpenRouterDocumentAi(openai, {
  // Role resolver враховує optional override або повертає спільну default model.
  fastModel: resolveModel("fast", environment),
  mainModel: resolveModel("main", environment),
  // Передаємо фактичне значення, яке вже пройшло Zod-валідацію env schema.
  reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
  maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
});
```

### Пояснення коду по логічних блоках

1. Options описують лише runtime-конфігурацію, потрібну adapter.
2. Fast і main roles можуть успадкувати одну base model або мати явні overrides.
3. `reasoningEffort` передається з environment, тому тестова fixture може перевірити будь-яке дозволене значення.
4. `reasoningEffort` надходить із перевіреного environment.

</details>

Hardcoded `low` усередині adapter не використовується. Shared env задає `low`, але тестова fixture може перевірити інше допустиме значення.

## Крок 6. Додати типи request

Спочатку весь import-блок `my-dev/lesson-02-llm-api-openrouter/src/services/openrouter-document-ai.ts` замінюється на такий. `OpenAI` імпортується як runtime value, бо error mapper використовує `instanceof OpenAI.APIError`:

```ts
import OpenAI from "openai";
import { resolveModelCapabilities } from "../config/model-capabilities.js";
import {
  EXTRACTION_EXAMPLE,
  EXTRACTION_INSTRUCTIONS,
  SUMMARY_INSTRUCTIONS,
} from "../config/prompts.js";
import type { ReasoningEffort } from "../config/openrouter.js";
import { DocumentAiError } from "../lib/errors.js";
import { normalizeChatUsage, type ChatCompletionUsageLike } from "../lib/metrics.js";
import { EXTRACTION_JSON_SCHEMA, ExtractionSchema } from "../schemas/extraction.js";
import type { DocumentAi, ExtractionResult, SummaryStreamEvent } from "./document-ai.js";
```

Спільний message type:

```ts
export interface OpenRouterChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
```

Summary request:

```ts
export interface OpenRouterSummaryRequest {
  model: string;
  messages: OpenRouterChatMessage[];
  max_completion_tokens: number;
  temperature: number;
  stream: true;
  reasoning?: {
    effort: ReasoningEffort;
    exclude: true;
  };
}
```

Extraction request:

```ts
export interface OpenRouterExtractionRequest {
  model: string;
  messages: OpenRouterChatMessage[];
  max_completion_tokens: number;
  temperature: number;
  response_format: {
    type: "json_schema";
    json_schema: {
      name: "document_extraction";
      strict: true;
      schema: Record<string, unknown>;
    };
  };
  reasoning?: {
    effort: ReasoningEffort;
    exclude: true;
  };
  provider: {
    require_parameters: true;
  };
}
```

<details>
<summary><b>Розгорнути: детальні пояснення коду</b></summary>

### Той самий код з поясненнями

```ts
// Runtime import потрібен для instanceof-перевірок SDK errors у кроці 7.
import OpenAI from "openai";
// Capability registry вирішує, чи можна надсилати reasoning і response_format.
import { resolveModelCapabilities } from "../config/model-capabilities.js";
// Усі system prompts і few-shot example мають одне конфігураційне джерело.
import {
  EXTRACTION_EXAMPLE,
  EXTRACTION_INSTRUCTIONS,
  SUMMARY_INSTRUCTIONS,
} from "../config/prompts.js";
// ReasoningEffort використовується лише як TypeScript type.
import type { ReasoningEffort } from "../config/openrouter.js";
import { DocumentAiError } from "../lib/errors.js";
// Adapter нормалізує provider usage перед поверненням domain event/result.
import { normalizeChatUsage, type ChatCompletionUsageLike } from "../lib/metrics.js";
// Provider schema доповнюється обов'язковою локальною Zod-валідацією.
import { EXTRACTION_JSON_SCHEMA, ExtractionSchema } from "../schemas/extraction.js";
import type { DocumentAi, ExtractionResult, SummaryStreamEvent } from "./document-ai.js";

// Єдиний message type дозволяє system, user та assistant turns.
export interface OpenRouterChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterSummaryRequest {
  // Конкретну модель підставляє application-level role resolver.
  model: string;
  messages: OpenRouterChatMessage[];
  max_completion_tokens: number;
  // Temperature 0 робить короткий підсумок стабільнішим.
  temperature: number;
  // Literal true гарантує streaming response type у SDK.
  stream: true;
  // Reasoning додається лише для моделі з підтвердженою capability.
  reasoning?: {
    effort: ReasoningEffort;
    exclude: true;
  };
}

export interface OpenRouterExtractionRequest {
  model: string;
  messages: OpenRouterChatMessage[];
  max_completion_tokens: number;
  temperature: number;
  response_format: {
    type: "json_schema";
    json_schema: {
      // Literal name синхронізує type із фактичним request contract.
      name: "document_extraction";
      // Strict просить provider дотриматися schema без зайвих полів.
      strict: true;
      // Adapter приймає JSON Schema як provider-neutral object.
      schema: Record<string, unknown>;
    };
  };
  reasoning?: {
    effort: ReasoningEffort;
    exclude: true;
  };
  // OpenRouter обирає лише endpoint із підтримкою переданих параметрів.
  provider: {
    require_parameters: true;
  };
  // Extraction є звичайною завершеною відповіддю, а не stream.
}
```

### Пояснення коду по логічних блоках

1. Повний import-блок одразу додає всі залежності кроків 7–10 і правильний runtime/type поділ для `OpenAI` та `ReasoningEffort`.
2. Спільний `OpenRouterChatMessage` не дублює форму messages між двома requests.
3. `stream: true` відрізняє summary request на рівні TypeScript.
4. `response_format.json_schema` фіксує контракт structured extraction.
5. `provider.require_parameters` вимагає сумісний endpoint.
6. Optional `reasoning` додається лише після capability check.

</details>

## Крок 7. Мапа помилок

Adapter перетворює SDK/provider errors на стабільні `DocumentAiError`:

| Upstream state      | Public code                 | HTTP-like status |
| ------------------- | --------------------------- | ---------------: |
| rate limit / 429    | `UPSTREAM_RATE_LIMITED`     |              429 |
| timeout / 408 / 504 | `GATEWAY_TIMEOUT`           |              504 |
| unavailable / 503   | `UPSTREAM_UNAVAILABLE`      |              503 |
| connection error    | `UPSTREAM_CONNECTION_ERROR` |              502 |
| user abort          | `REQUEST_ABORTED`           |              499 |
| інша API error      | `UPSTREAM_API_ERROR`        |              502 |
| невідома error      | `UPSTREAM_ERROR`            |              502 |

Raw provider body, key або stack не повертаються клієнту.

Окремо обробляються provider errors усередині chunk/response:

- safe reason проходить короткий allowlist;
- unsafe або невідоме значення стає `provider_error`;
- stream видає `failed`;
- completed extraction кидає typed error.

<details>
<summary><b>Розгорнути: реалізація мапи помилок із коментарями</b></summary>

### Код з послідовними поясненнями

```ts
// Описуємо лише поля provider error, які справді читає adapter.
type OpenRouterErrorExtension = {
  code?: string | number;
  message?: string;
  metadata?: {
    error_type?: string;
  };
};

type OpenRouterErrorContainer = {
  error?: OpenRouterErrorExtension;
};

// У public reason дозволяємо лише короткі технічні ідентифікатори, а не raw message.
const SAFE_ERROR_REASON = /^[a-z0-9][a-z0-9_.:-]{0,79}$/i;

function createApiError(error: InstanceType<typeof OpenAI.APIError>): DocumentAiError {
  // Зберігаємо безпечні діагностичні поля без provider body або headers.
  const details = {
    status: error.status,
    requestId: error.requestID ?? null,
  };

  // Rate limit залишається окремим стабільним public code.
  if (error.status === 429) {
    return new DocumentAiError(
      "UPSTREAM_RATE_LIMITED",
      "OpenRouter тимчасово обмежив частоту запитів.",
      429,
      details,
      { cause: error },
    );
  }

  // Обидва upstream timeout statuses нормалізуються до gateway timeout.
  if (error.status === 408 || error.status === 504) {
    return new DocumentAiError(
      "GATEWAY_TIMEOUT",
      "Перевищено час очікування відповіді OpenRouter API.",
      504,
      details,
      { cause: error },
    );
  }

  // Тимчасова недоступність не маскується як внутрішня помилка застосунку.
  if (error.status === 503) {
    return new DocumentAiError(
      "UPSTREAM_UNAVAILABLE",
      "OpenRouter або провайдер моделі тимчасово недоступний.",
      503,
      details,
      { cause: error },
    );
  }

  // Решта SDK API errors отримує нейтральний код без витоку raw response.
  return new DocumentAiError(
    "UPSTREAM_API_ERROR",
    "OpenRouter API не виконав запит.",
    502,
    details,
    { cause: error },
  );
}

function mapOpenRouterError(error: unknown): DocumentAiError {
  // Не перемаповуємо помилку, яку adapter уже зробив domain-safe.
  if (error instanceof DocumentAiError) {
    return error;
  }

  // Abort від клієнта відрізняється від network failure.
  if (error instanceof OpenAI.APIUserAbortError) {
    return new DocumentAiError("REQUEST_ABORTED", "Запит було скасовано.", 499, undefined, {
      cause: error,
    });
  }

  // SDK timeout має той самий domain code, що й HTTP 408/504.
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new DocumentAiError(
      "GATEWAY_TIMEOUT",
      "Перевищено час очікування відповіді OpenRouter API.",
      504,
      undefined,
      { cause: error },
    );
  }

  // Окремо позначаємо неможливість установити з'єднання.
  if (error instanceof OpenAI.APIConnectionError) {
    return new DocumentAiError(
      "UPSTREAM_CONNECTION_ERROR",
      "Не вдалося з'єднатися з OpenRouter API.",
      502,
      undefined,
      { cause: error },
    );
  }

  // HTTP-like SDK errors делегуються status mapper.
  if (error instanceof OpenAI.APIError) {
    return createApiError(error);
  }

  // Невідоме значення отримує безпечний fallback code.
  return new DocumentAiError(
    "UPSTREAM_ERROR",
    "Не вдалося виконати запит до моделі.",
    502,
    undefined,
    error instanceof Error ? { cause: error } : undefined,
  );
}

function readProviderErrorReason(container: unknown): string | null {
  // Provider може вкласти error як у chunk, так і в choice або completion.
  const error = (container as OpenRouterErrorContainer | undefined)?.error;

  if (!error) {
    return null;
  }

  // Metadata error_type точніший; code використовується як запасне джерело.
  const candidate = error.metadata?.error_type ?? error.code;

  if (typeof candidate !== "string" && typeof candidate !== "number") {
    return "provider_error";
  }

  const reason = String(candidate);

  // Небезпечне або надто довге значення ніколи не виходить у public contract.
  return SAFE_ERROR_REASON.test(reason) ? reason : "provider_error";
}

function readProviderStreamError(
  chunk: OpenAI.ChatCompletionChunk,
  choice: OpenAI.ChatCompletionChunk.Choice | undefined,
): string | null {
  // Спочатку перевіряємо chunk, потім перший choice.
  return readProviderErrorReason(chunk) ?? readProviderErrorReason(choice);
}

function readProviderCompletionError(response: unknown, choice: unknown): string | null {
  // Для non-streaming response діє той самий порядок пошуку.
  return readProviderErrorReason(response) ?? readProviderErrorReason(choice);
}

function createProviderResponseError(reason: string): DocumentAiError {
  // Provider-level rate limit може прийти всередині успішного HTTP response.
  if (reason === "rate_limit_exceeded" || reason === "429") {
    return new DocumentAiError(
      "UPSTREAM_RATE_LIMITED",
      "OpenRouter тимчасово обмежив частоту запитів.",
      429,
      { reason },
    );
  }

  if (reason === "timeout") {
    return new DocumentAiError(
      "GATEWAY_TIMEOUT",
      "Перевищено час очікування відповіді OpenRouter API.",
      504,
      { reason },
    );
  }

  if (reason === "provider_overloaded") {
    return new DocumentAiError(
      "UPSTREAM_UNAVAILABLE",
      "OpenRouter або провайдер моделі тимчасово недоступний.",
      503,
      { reason },
    );
  }

  // Refusal має client-visible 422, а не generic 502.
  if (reason === "refusal" || reason === "content_policy_violation") {
    return new DocumentAiError("REQUEST_REFUSED", "Модель відхилила запит.", 422, { reason });
  }

  // Решта terminal failures мають стабільний neutral code.
  return new DocumentAiError("RESPONSE_FAILED", "Модель не змогла завершити генерацію.", 502, {
    reason,
  });
}
```

### Пояснення коду по логічних блоках

1. `SAFE_ERROR_REASON` – не дозволяє raw provider message стати публічним reason.
2. `createApiError` – мапить HTTP statuses SDK на стабільні domain errors.
3. `mapOpenRouterError` – обробляє abort, timeout, connection, API та unknown exceptions.
4. `readProviderErrorReason` – читає error, який OpenRouter повернув усередині response payload.
5. Stream і completion helpers – застосовують однакову політику до різних форм SDK response.
6. `createProviderResponseError` – перетворює safe provider reason на public code/status/message.
7. Raw body, API key, headers і stack не включаються до public response.

</details>

## Крок 8. Grounding helpers

Grounding підтверджує, що елементи масивів `names`, `dates` і `locations` походять із input. Цей helper не перевіряє достовірність тексту `summary`.

Необхідні helpers:

```text
normalizeGroundingText
normalizeLocations
entitiesAreGrounded
```

Правила:

- Unicode normalizes через `NFKC`;
- comparison не залежить від регістру;
- location може втратити початковий прийменник;
- значення не лематизується і не вигадується;
- незаземлена сутність → `UNGROUNDED_EXTRACTION`.

<details>
<summary><b>Розгорнути: grounding helpers із коментарями</b></summary>

### Код з послідовними поясненнями

```ts
function normalizeGroundingText(value: string): string {
  // NFKC прибирає несуттєві Unicode-відмінності, а lower case — різницю регістру.
  return value.normalize("NFKC").toLocaleLowerCase("uk-UA");
}

// Видаляємо лише відомий початковий прийменник перед непорожньою назвою локації.
const LOCATION_PREPOSITION = /^(?:у|в|до|на|з|із|зі|біля|поблизу|in|at|to|from)\s+(?=\S)/iu;

function normalizeLocations(content: string, locations: string[]): string[] {
  // Нормалізуємо документ один раз перед циклом.
  const normalizedContent = normalizeGroundingText(content);
  // Set одночасно зберігає порядок і прибирає дублікати.
  const result = new Set<string>();

  for (const location of locations) {
    // Пробуємо форму без початкового прийменника.
    const withoutPreposition = location.replace(LOCATION_PREPOSITION, "").trim();
    const normalized =
      // Скорочена форма приймається лише тоді, коли дослівно присутня в input.
      withoutPreposition.length > 0 &&
      normalizedContent.includes(normalizeGroundingText(withoutPreposition))
        ? withoutPreposition
        : location;

    result.add(normalized);
  }

  return [...result];
}

function entitiesAreGrounded(
  content: string,
  extraction: Pick<ExtractionResult["data"], "names" | "dates" | "locations">,
): boolean {
  const normalizedContent = normalizeGroundingText(content);

  // Кожне ім'я, дата й локація мають траплятися у вихідному документі.
  return [...extraction.names, ...extraction.dates, ...extraction.locations].every((value) =>
    normalizedContent.includes(normalizeGroundingText(value)),
  );
}
```

### Пояснення коду по логічних блоках

1. `normalizeGroundingText` – створює стабільну форму для Unicode/case comparison.
2. `LOCATION_PREPOSITION` – дозволяє безпечно прибрати лише початковий прийменник.
3. `normalizeLocations` – приймає очищену форму тільки за наявності в input і прибирає дублікати.
4. `entitiesAreGrounded` – вимагає, щоб кожна повернута сутність була частиною вихідного документа.

</details>

Перевірка:

```shell
yarn typecheck:my:lesson02:openrouter
```

На цьому проміжному стані `lint` і `check:my` навмисно ще не запускаються: частина imports та helpers стане використаною лише після реалізації обох методів adapter в кроках 9–10. Перший повний lint gate виконується після кроку 11, коли жодної тимчасово невикористаної функції вже немає.

---

# Checkpoint 01 – streaming

## Крок 9. Реалізувати streamSummary

Файли:

```text
my-dev/lesson-02-llm-api-openrouter/src/services/openrouter-document-ai.ts
my-dev/lesson-02-llm-api-openrouter/src/app.ts
```

### Request

```ts
const capabilities = resolveModelCapabilities(this.options.fastModel);

const request: OpenRouterSummaryRequest = {
  model: this.options.fastModel,
  messages: [
    { role: "system", content: SUMMARY_INSTRUCTIONS },
    { role: "user", content },
  ],
  max_completion_tokens: this.options.maxOutputTokens,
  temperature: 0,
  stream: true,
  ...(capabilities.reasoning
    ? {
        reasoning: {
          effort: this.options.reasoningEffort,
          exclude: true as const,
        },
      }
    : {}),
};
```

Call:

```ts
const stream = await this.client.chat.completions.create(request, { signal });
```

<details>
<summary><b>Розгорнути: повний streamSummary із коментарями</b></summary>

### Той самий код з поясненнями

```ts
public async *streamSummary(
  content: string,
  signal: AbortSignal,
): AsyncIterable<SummaryStreamEvent> {
  try {
    // Читаємо capability саме для fast role model перед побудовою request.
    const capabilities = resolveModelCapabilities(this.options.fastModel);

    const request: OpenRouterSummaryRequest = {
      // Summary використовує fast application role.
      model: this.options.fastModel,
      messages: [
        // System message задає короткий grounded summary.
        { role: "system", content: SUMMARY_INSTRUCTIONS },
        // User message містить документ із validated route input.
        { role: "user", content },
      ],
      max_completion_tokens: this.options.maxOutputTokens,
      // Temperature 0 зменшує випадковість короткої відповіді.
      temperature: 0,
      // Literal true перемикає SDK у streaming mode.
      stream: true,
      // Reasoning надсилається лише для моделі з підтвердженою capability.
      ...(capabilities.reasoning
        ? { reasoning: { effort: this.options.reasoningEffort, exclude: true as const } }
        : {}),
    };

    // AbortSignal пов'язує HTTP disconnect із provider request.
    const stream = await this.client.chat.completions.create(request, { signal });

    // До першого chunk фактична модель дорівнює requested model.
    let resolvedModel = this.options.fastModel;
    // Terminal state не вважається успішним, доки provider явно не повернув stop.
    let terminal: "stop" | "refused" | null = null;
    // Usage часто приходить лише у фінальному chunk.
    let collectedUsage: ChatCompletionUsageLike | null = null;

    for await (const chunk of stream) {
      // Provider може повідомити точну модель у будь-якому chunk.
      resolvedModel = chunk.model || resolvedModel;
      const choice = chunk.choices[0];

      // Перевіряємо помилку і на рівні chunk, і всередині choice.
      const providerErrorReason = readProviderStreamError(chunk, choice);

      if (providerErrorReason) {
        // Failed є terminal event: після нього generator завершується.
        yield { type: "failed", reason: providerErrorReason };
        return;
      }

      if (choice?.delta?.content) {
        // Кожний непорожній content fragment стає domain delta event.
        yield { type: "delta", delta: choice.delta.content };
      }

      if (choice?.finish_reason) {
        switch (choice.finish_reason) {
          case "stop":
            // Stop запам'ятовується; usage може прийти наступним chunk.
            terminal = "stop";
            break;

          case "length":
            // Вичерпаний output limit не є успішним completion.
            yield { type: "incomplete", reason: "max_tokens" };
            return;

          case "content_filter":
            // Refusal надсилається одразу, але completed event ще переносить usage/model.
            terminal = "refused";
            yield { type: "refused" };
            break;

          default:
            // Невідомий finish reason стає контрольованим failed event.
            yield { type: "failed", reason: choice.finish_reason };
            return;
        }
      }

      if (chunk.usage) {
        // Зберігаємо останній доступний usage payload до terminal event.
        collectedUsage = chunk.usage;
      }
    }

    // Generator видає completed лише після явного stop або refusal terminal state.
    if (terminal === "stop" || terminal === "refused") {
      yield {
        type: "completed",
        model: resolvedModel,
        // Не створюємо usage field, якщо provider його не повернув.
        ...(collectedUsage === null ? {} : { usage: normalizeChatUsage(collectedUsage) }),
      };
    }
  } catch (error) {
    // SDK/network exceptions проходять через єдину safe error map.
    throw mapOpenRouterError(error);
  }
}
```

### Пояснення коду по логічних блоках

1. Capability check – вирішує, чи дозволено додавати `reasoning`.
2. Request – задає fast model, system/user messages, limit, temperature і streaming.
3. `AbortSignal` – дає змогу скасувати upstream request після disconnect.
4. Цикл chunks – окремо читає provider error, delta, finish reason та usage.
5. `length` і unknown state завершують generator без `completed`.
6. `stop`/`refused` дозволяють видати фінальний model/usage event.
7. Catch – не випускає raw SDK exception за межі adapter.

</details>

Для невідомої model capability registry повертає conservative profile, тому provider-specific `reasoning` не надсилається.

### Перетворення chunks

| Provider state                       | Domain event                  |
| ------------------------------------ | ----------------------------- |
| `delta.content`                      | `{ type: "delta" }`           |
| `finish_reason: stop`                | запам'ятати terminal success  |
| `finish_reason: length`              | `incomplete` і завершити      |
| `finish_reason: content_filter`      | `refused`                     |
| provider error                       | `failed`                      |
| фінальний usage                      | зберегти до terminal event    |
| stream закінчився після stop/refused | `completed` із model та usage |

Фактичний model ID береться з chunk. `completed` не генерується лише через те, що iterator закінчився без terminal state.

### SSE route

Перед заміною route в `my-dev/lesson-02-llm-api-openrouter/src/app.ts` готується спільна application інфраструктура. Весь import-блок замінюється на такий:

```ts
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { calculateCost, MODEL_PRICES, type ModelPricing } from "./config/pricing.js";
import { createApiError, DocumentAiError, type ApiErrorResponse } from "./lib/errors.js";
import { calculateCacheHitRate, extractUsageMetrics } from "./lib/metrics.js";
import { sendSseHeaders, writeSseEvent } from "./lib/sse.js";
import { DocumentRequestSchema } from "./schemas/document-request.js";
import type { Extraction } from "./schemas/extraction.js";
import type { DocumentAi } from "./services/document-ai.js";
```

Наявний `AppDependencies` замінюється, а response і terminal types додаються одразу після imports:

```ts
export interface AppDependencies {
  ai: DocumentAi;
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
```

Після наявного `isHttpErrorLike` додається safe mapper для stream failures:

```ts
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
```

Заголовок `createApp` замінюється разом із першими локальними значеннями:

```ts
export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  const now = dependencies.now ?? (() => performance.now());
  const prices = dependencies.prices ?? MODEL_PRICES;
```

<details>
<summary><b>Розгорнути: application glue із коментарями</b></summary>

### Той самий код з поясненнями

```ts
import express, { type Express, type NextFunction, type Request, type Response } from "express";
// Pricing registry є default, а ModelPricing потрібен для test seam.
import { calculateCost, MODEL_PRICES, type ModelPricing } from "./config/pricing.js";
// DocumentAiError потрібен і stream catch, і центральному HTTP middleware.
import { createApiError, DocumentAiError, type ApiErrorResponse } from "./lib/errors.js";
import { calculateCacheHitRate, extractUsageMetrics } from "./lib/metrics.js";
import { sendSseHeaders, writeSseEvent } from "./lib/sse.js";
import { DocumentRequestSchema } from "./schemas/document-request.js";
// Extraction описує data у typed JSON response.
import type { Extraction } from "./schemas/extraction.js";
import type { DocumentAi } from "./services/document-ai.js";

export interface AppDependencies {
  // Domain interface замінюється fake implementation у unit tests.
  ai: DocumentAi;
  // Optional clock робить latency assertions детермінованими.
  now?: () => number;
  // Optional registry дозволяє тестувати known і unknown pricing.
  prices?: Readonly<Record<string, ModelPricing>>;
}

export interface ExtractionApiResponse {
  data: Extraction;
  // ReturnType не дублює форму application usage вручну.
  usage: ReturnType<typeof extractUsageMetrics>;
  metrics: {
    model: string;
    totalLatencyMs: number;
    cacheHitRate: number;
  } & ReturnType<typeof calculateCost>;
}

// Pending не є success; done дозволений лише після completed.
type StreamTerminalState = "pending" | "completed" | "incomplete" | "failed" | "refused";

function describeStreamFailure(reason: string): { code: string; message: string } {
  // Provider rate-limit reason отримує стабільний public code.
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

  // Невідоме terminal failure не розкриває raw provider message.
  return { code: "RESPONSE_FAILED", message: "Не вдалося виконати генерацію." };
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  // Production використовує monotonic clock, а tests можуть inject fake time.
  const now = dependencies.now ?? (() => performance.now());
  // Production бере verified registry, а tests можуть передати synthetic price.
  const prices = dependencies.prices ?? MODEL_PRICES;
```

### Пояснення коду по логічних блоках

1. Imports містять кожний symbol, який використовують обидва routes і middleware.
2. `AppDependencies` додає лише два test seams без зміни production behavior.
3. `ExtractionApiResponse` пов'язує HTTP output із фактичними application helper types.
4. `StreamTerminalState` не дозволяє трактувати просте завершення iterator як успіх.
5. `describeStreamFailure` перетворює лише safe reason на стабільний public code/message.
6. `now` і `prices` отримують production defaults один раз на створення app.

</details>

`POST /api/documents/summary/stream`:

1. валідовує input;
2. створює `AbortController`;
3. підписується на HTTP abort/close;
4. надсилає SSE headers;
5. перетворює domain events на `delta`, `usage`, `done` або `error`;
6. додає TTFT, total latency, cache hit rate і cost;
7. знімає listeners в `finally`.

Terminal rule:

```text
completed  → usage → done
refused    → error
incomplete → error
failed     → error
no terminal event → STREAM_ENDED_UNEXPECTEDLY
```

Після `error` подія `done` не надсилається.

<details>
<summary><b>Розгорнути: повний SSE route із коментарями</b></summary>

### Код з послідовними поясненнями

```ts
app.post(
  "/api/documents/summary/stream",
  async (request: Request, response: Response<ApiErrorResponse | void>): Promise<void> => {
    // Route не звертається до adapter, доки body не пройшов Zod validation.
    const parsedRequest = DocumentRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      response
        .status(400)
        .json(createApiError("INVALID_INPUT", "Невалідний запит.", parsedRequest.error.flatten()));
      return;
    }

    // Один controller пов'язує життєвий цикл HTTP response і provider stream.
    const controller = new AbortController();
    const abortIfOpen = (): void => {
      // Після нормального response.end() повторний abort не потрібен.
      if (!response.writableEnded) {
        controller.abort();
      }
    };

    // Обидва сигнали потрібні для різних способів розриву клієнтського з'єднання.
    request.once("aborted", abortIfOpen);
    response.once("close", abortIfOpen);

    // now() є test seam для детермінованих latency assertions.
    const startedAt = now();
    let firstDeltaAt: number | null = null;
    // Pending не можна автоматично перетворювати на done.
    let terminalState: StreamTerminalState = "pending";

    // Headers надсилаються один раз перед першою SSE event.
    sendSseHeaders(response);

    try {
      for await (const event of dependencies.ai.streamSummary(
        parsedRequest.data.content,
        controller.signal,
      )) {
        // Після disconnect нічого більше не записується у response.
        if (controller.signal.aborted || response.writableEnded) {
          return;
        }

        switch (event.type) {
          case "delta":
            // Час першого fragment потрібен для TTFT.
            firstDeltaAt ??= now();
            writeSseEvent(response, "delta", { delta: event.delta });
            break;

          case "refused":
            // Error event буде сформована після completed usage event.
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
            // Safe mapper перетворює provider reason на public code/message.
            const failure = describeStreamFailure(event.reason);
            writeSseEvent(response, "error", {
              ...failure,
              reason: event.reason,
            });
            break;
          }

          case "completed": {
            // Refusal не можна перезаписати наступним completed event.
            terminalState = terminalState === "refused" ? "refused" : "completed";
            const usage = extractUsageMetrics(event.usage);
            const totalLatencyMs = Math.max(0, Math.round(now() - startedAt));
            const ttftMs =
              firstDeltaAt === null ? null : Math.max(0, Math.round(firstDeltaAt - startedAt));

            // Usage event містить і токени, і виміряні metrics.
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

        // Incomplete/failed уже отримали error event; цикл більше не потрібен.
        if (terminalState === "incomplete" || terminalState === "failed") {
          break;
        }
      }

      if (controller.signal.aborted || response.writableEnded) {
        return;
      }

      if (terminalState === "completed") {
        // Done дозволений лише після явного completed state.
        writeSseEvent(response, "done", { status: "completed" });
      } else if (terminalState === "refused") {
        writeSseEvent(response, "error", {
          code: "REQUEST_REFUSED",
          message: "Модель відхилила запит.",
        });
      } else if (terminalState === "pending") {
        // Iterator без terminal event є protocol error, а не success.
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

      // Відомі domain errors зберігають code; невідомі стають STREAM_ERROR.
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
      // Listener cleanup виконується за success, error і раннього return.
      request.off("aborted", abortIfOpen);
      response.off("close", abortIfOpen);
    }
  },
);
```

### Пояснення коду по логічних блоках

1. Input gate – повертає HTTP 400 до запуску provider adapter.
2. Abort controller – скасовує upstream stream після client disconnect.
3. Timing state – вимірює TTFT і total latency через testable `now()`.
4. Event switch – перетворює domain events на named SSE events.
5. Terminal state – забороняє `done` після incomplete, failed або refusal.
6. Catch – надсилає safe SSE error без raw provider details.
7. Finally – завжди видаляє тимчасові event listeners.

</details>

### Перевірка checkpoint

Reference snapshot:

```shell
yarn test:lesson02:openrouter:checkpoints
```

Очікується 12/12 tests для фізичного checkpoint.

Обов'язкова проміжна перевірка типів:

```shell
yarn typecheck:my:lesson02:openrouter
```

До кроку 12 `check:my` навмисно завершується з кодом 1 через 12 `todo`; повторіть його після реалізації тестів.

Необов'язковий HTTP smoke запускається лише якщо ви налаштували локальний кореневий `.env` за [dev-migration-guide.md](./dev-migration-guide.md):

```shell
yarn dev:my:lesson02:openrouter
```

В другому терміналі health перевіряється без provider call:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
```

Очікується `status: ok`. Запит виконується в другому терміналі, поки сервер із `my-dev/` працює в першому.

Після HTTP 200 сервер зупиняється через `Ctrl+C`; port 3000 має звільнитися.

---

# Етап C – Structured Output

## Крок 10. Реалізувати extract

Файл: `my-dev/lesson-02-llm-api-openrouter/src/services/openrouter-document-ai.ts`.

### Request

```ts
const capabilities = resolveModelCapabilities(this.options.mainModel);

const request: OpenRouterExtractionRequest = {
  model: this.options.mainModel,
  messages: [
    { role: "system", content: EXTRACTION_INSTRUCTIONS },
    { role: "user", content: EXTRACTION_EXAMPLE.input },
    { role: "assistant", content: EXTRACTION_EXAMPLE.output },
    { role: "user", content },
  ],
  max_completion_tokens: this.options.maxOutputTokens,
  temperature: 0,
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "document_extraction",
      strict: true,
      schema: EXTRACTION_JSON_SCHEMA,
    },
  },
  provider: {
    require_parameters: true,
  },
  ...(capabilities.reasoning
    ? {
        reasoning: {
          effort: this.options.reasoningEffort,
          exclude: true as const,
        },
      }
    : {}),
};
```

`provider.require_parameters` вимагає підтримку Structured Output.

### Response pipeline

```text
provider response
  → provider error check
  → finish_reason / refusal check
  → message.content exists
  → JSON.parse
  → ExtractionSchema.safeParse
  → normalizeLocations
  → entitiesAreGrounded
  → { data, model, usage }
```

Окремі typed errors потрібні для:

- refusal;
- length/incomplete;
- відсутнього content;
- invalid JSON;
- schema mismatch;
- ungrounded entities;
- unsupported response format;
- provider error.

<details>
<summary><b>Розгорнути: повний extract із коментарями</b></summary>

### Той самий код з поясненнями

```ts
public async extract(content: string): Promise<ExtractionResult> {
  // Structured extraction використовує main application role.
  const capabilities = resolveModelCapabilities(this.options.mainModel);

  // Невідома або непідтверджена модель не отримує response_format request.
  if (!capabilities.responseFormat) {
    throw new DocumentAiError(
      "STRUCTURED_OUTPUT_UNSUPPORTED",
      "Модель не підтверджена для Structured Output через OpenRouter.",
      502,
      { model: this.options.mainModel },
    );
  }

  try {
    const request: OpenRouterExtractionRequest = {
      model: this.options.mainModel,
      messages: [
        // System instructions задають правила exact extraction і grounding.
        { role: "system", content: EXTRACTION_INSTRUCTIONS },
        // User/assistant example показує одну правильну structured pair.
        { role: "user", content: EXTRACTION_EXAMPLE.input },
        { role: "assistant", content: EXTRACTION_EXAMPLE.output },
        // Останній user message містить фактичний документ.
        { role: "user", content },
      ],
      max_completion_tokens: this.options.maxOutputTokens,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "document_extraction",
          // Strict забороняє provider додавати поля поза schema.
          strict: true,
          schema: EXTRACTION_JSON_SCHEMA,
        },
      },
      // OpenRouter повинен вибрати endpoint із підтримкою переданих parameters.
      provider: { require_parameters: true },
      // Reasoning додається лише після capability check.
      ...(capabilities.reasoning
        ? { reasoning: { effort: this.options.reasoningEffort, exclude: true as const } }
        : {}),
    };

    // Extraction очікує одну завершену Chat Completion.
    const response = await this.client.chat.completions.create(request);
    const choice = response.choices[0];

    // Provider-level error може бути вкладений у HTTP-success response.
    const providerErrorReason = readProviderCompletionError(response, choice);

    if (providerErrorReason) {
      throw createProviderResponseError(providerErrorReason);
    }

    // Відсутній choice є контрольованою upstream failure.
    if (!choice) {
      throw new DocumentAiError(
        "RESPONSE_FAILED",
        "Модель не повернула результат генерації.",
        502,
      );
    }

    // Вичерпаний output limit означає незавершений JSON.
    if (choice.finish_reason === "length") {
      throw new DocumentAiError("INCOMPLETE_RESPONSE", "Генерацію не було завершено.", 502, {
        reason: "max_tokens",
      });
    }

    // Content filter або explicit refusal мають окремий safe status.
    if (choice.finish_reason === "content_filter" || choice?.message?.refusal) {
      throw new DocumentAiError("REQUEST_REFUSED", "Модель відхилила запит.", 422);
    }

    // Лише stop вважається успішним terminal state extraction.
    if (choice.finish_reason !== "stop") {
      throw new DocumentAiError(
        "RESPONSE_FAILED",
        "Модель завершила генерацію в неочікуваному стані.",
        502,
        { reason: choice.finish_reason ?? "missing_finish_reason" },
      );
    }

    // Відсутній content далі гарантовано не пройде JSON.parse.
    const responseText = choice?.message?.content ?? "";

    let parsedValue: unknown;

    try {
      // Provider schema не замінює локальне JSON parsing.
      parsedValue = JSON.parse(responseText);
    } catch {
      throw new DocumentAiError(
        "PARSING_FAILED",
        "Не вдалося отримати типізований результат.",
        502,
      );
    }

    // Zod повторно перевіряє типи, required fields і additional properties.
    const parsed = ExtractionSchema.safeParse(parsedValue);

    if (!parsed.success) {
      throw new DocumentAiError(
        "PARSING_FAILED",
        "Не вдалося отримати типізований результат.",
        502,
      );
    }

    // Прибираємо допустимі початкові прийменники локацій без вигадування значень.
    const normalizedData = {
      ...parsed.data,
      locations: normalizeLocations(content, parsed.data.locations),
    };

    // Усі names, dates і locations мають бути grounded у вихідному content.
    if (!entitiesAreGrounded(content, normalizedData)) {
      throw new DocumentAiError(
        "UNGROUNDED_EXTRACTION",
        "Структурований результат містить сутність, якої немає у вхідному тексті.",
        502,
      );
    }

    return {
      data: normalizedData,
      // Зберігаємо provider model або requested main model, якщо першого немає.
      model: response.model || this.options.mainModel,
      // Usage normalizes лише за його наявності.
      ...(response.usage === undefined ? {} : { usage: normalizeChatUsage(response.usage) }),
    };
  } catch (error) {
    // Усі SDK і domain failures проходять єдину safe map.
    throw mapOpenRouterError(error);
  }
}
```

### Пояснення коду по логічних блоках

1. Capability gate – не надсилає непідтверджений `response_format`.
2. Request – поєднує instructions, example, document, schema та provider requirements.
3. Terminal checks – окремо обробляють provider error, missing choice, length, refusal та unknown finish reason.
4. `JSON.parse` – перевіряє синтаксис returned content.
5. `ExtractionSchema.safeParse` – перевіряє локальний typed contract.
6. Location normalization і grounding – не дозволяють вигадані сутності.
7. Result – повертає data, фактичну model і normalized usage.
8. Catch – гарантує safe domain error на межі adapter.

</details>

## Крок 11. Реалізувати extraction route

Файл: `my-dev/lesson-02-llm-api-openrouter/src/app.ts`.

`AppDependencies`, `ExtractionApiResponse`, `now` і `prices` уже додані в спільному integration block кроку 9. В кроці 11 вони не дублюються.

Маршрут:

```text
validated content
  → startedAt
  → ai.extract(content)
  → extractUsageMetrics
  → totalLatencyMs
  → cacheHitRate
  → calculateCost(model, usage, prices, provider_cost_usd)
  → HTTP 200
```

Форма успіху:

```ts
{
  data: result.data,
  usage,
  metrics: {
    model: result.model,
    totalLatencyMs,
    cacheHitRate,
    ...calculateCost(
      result.model,
      usage,
      prices,
      result.usage?.provider_cost_usd,
    ),
  },
}
```

`DocumentAiError` мапиться на його safe code/message/status. Невідома error повертає нейтральний 500 без upstream details.

В наявному фінальному `app.use` після перевірки `response.headersSent` і перед обробкою HTTP 413 додається domain-error branch:

```ts
if (error instanceof DocumentAiError) {
  response.status(error.statusCode).json(createApiError(error.code, error.message));
  return;
}
```

<details>
<summary><b>Розгорнути: повний extraction route із коментарями</b></summary>

### Той самий код з поясненнями

```ts
app.post(
  "/api/documents/extract",
  async (
    request: Request,
    response: Response<ExtractionApiResponse | ApiErrorResponse>,
    next: NextFunction,
  ): Promise<void> => {
    // Body проходить validation до будь-якого provider call.
    const parsedRequest = DocumentRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      response
        .status(400)
        .json(createApiError("INVALID_INPUT", "Невалідний запит.", parsedRequest.error.flatten()));
      return;
    }

    // Вимірювання починається безпосередньо перед domain operation.
    const startedAt = now();

    try {
      // Route залежить від DocumentAi interface, а не від OpenRouter SDK.
      const result = await dependencies.ai.extract(parsedRequest.data.content);
      // Provider usage перетворюється на стабільні application metrics.
      const usage = extractUsageMetrics(result.usage);
      const cacheHitRate = calculateCacheHitRate(usage.inputTokens, usage.cachedTokens);

      response.json({
        data: result.data,
        usage,
        metrics: {
          model: result.model,
          // Math.max захищає контракт від від'ємного значення тестового clock.
          totalLatencyMs: Math.max(0, Math.round(now() - startedAt)),
          cacheHitRate,
          // Provider-reported cost має пріоритет; registry залишається fallback estimate.
          ...calculateCost(result.model, usage, prices, result.usage?.provider_cost_usd),
        },
      });
    } catch (error) {
      // Central Express middleware формує safe JSON error contract.
      next(error);
    }
  },
);
```

В центральному error middleware:

```ts
// Typed domain error зберігає safe status, code і message від adapter.
if (error instanceof DocumentAiError) {
  // Details навмисно не повертаються у public response.
  response.status(error.statusCode).json(createApiError(error.code, error.message));
  return;
}
```

### Пояснення коду по логічних блоках

1. Dependency seams – дозволяють тестувати route без мережі й реального часу.
2. Request validation – не допускає невалідний body до `ai.extract`.
3. Domain call – повертає extraction result незалежно від provider SDK.
4. Usage і cache metrics – нормалізуються в application layer.
5. Cost – використовує provider-reported USD або verified registry.
6. Error forwarding – передає failure централізованому safe middleware.
7. Domain-error branch – повертає стабільний status/code/message без provider details, stack або key.

</details>

Перевірка:

```shell
yarn prettier --write my-dev/lesson-02-llm-api-openrouter
yarn typecheck:my:lesson02:openrouter
```

12 `todo` залишаються до кроку 12, тому повний `check:my` на цьому проміжному етапі очікувано зупиниться на no-TODO gate.

---

# Етап D – активні HTTP tests

## Крок 12. Перетворити 12 todo-категорій на active tests

Файли: `my-dev/lesson-02-llm-api-openrouter/tests/app.test.ts`, `my-dev/lesson-02-llm-api-openrouter/tests/config-and-metrics.test.ts` і `my-dev/lesson-02-llm-api-openrouter/tests/openrouter-document-ai.test.ts`.

Окрема todo-категорія може розкладатися на кілька коротких tests. Усі 12 потрібних категорій мають бути покриті активними offline-тестами. Один сценарій можна перевірити кількома тестами; homework не вимагає фіксованої загальної кількості тестів.

HTTP tests використовують fake `DocumentAi` і локальний ephemeral HTTP port. Adapter tests підміняють метод `chat.completions.create` локальним mock. Реальний OpenRouter API в unit tests не викликається.

Обов'язкові сценарії:

1. `GET /health` → 200;
2. blank content → 400;
3. unknown field → 400;
4. malformed JSON → `MALFORMED_JSON`;
5. oversized body → `PAYLOAD_TOO_LARGE`;
6. streaming request contract і usage з фінального chunk;
7. `stop`, `length`, `content_filter`;
8. extraction data + usage + metrics;
9. strict `response_format: json_schema`;
10. SSE `delta → usage → done`;
11. немає `done` після incomplete, failed або refusal;
12. Timeout повертає HTTP 504 або SSE `GATEWAY_TIMEOUT`.

Додатковий сценарій перевіряє скасування upstream stream після HTTP disconnect.

Сценарії timeout розгортаються в два окремі tests: один перевіряє HTTP 504 для extraction, другий – named SSE error без `done`.

<details>
<summary><b>Розгорнути: HTTP test harness із коментарями</b></summary>

### Той самий код з поясненнями

```ts
// Server потрібен, щоб коректно типізувати локальний HTTP instance у helper.
import type { Server } from "node:http";
// AddressInfo дає доступ до випадкового порту, який ОС призначить тесту.
import type { AddressInfo } from "node:net";
// once очікує подію listening без ручного event listener.
import { once } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createApp, type AppDependencies } from "../src/app.js";
import { DocumentAiError } from "../src/lib/errors.js";
import type {
  DocumentAi,
  ExtractionResult,
  SummaryStreamEvent,
} from "../src/services/document-ai.js";

// Фікстура успішного extraction не звертається до provider.
const successfulExtraction: ExtractionResult = {
  data: {
    names: ["Олена Коваль"],
    dates: ["14 липня"],
    locations: ["Львова"],
    summary: "Олена Коваль приїхала до Львова 14 липня.",
  },
  model: "test-main",
  usage: {
    input_tokens: 1_000,
    output_tokens: 500,
    total_tokens: 1_500,
    input_tokens_details: {
      cached_tokens: 200,
      cache_write_tokens: 100,
    },
  },
};

// Послідовність подій імітує два text chunks та фінальний usage chunk.
const successfulStream: SummaryStreamEvent[] = [
  { type: "delta", delta: "Короткий " },
  { type: "delta", delta: "підсумок." },
  {
    type: "completed",
    model: "test-fast",
    usage: {
      input_tokens: 100,
      output_tokens: 20,
      total_tokens: 120,
      input_tokens_details: {
        cached_tokens: 25,
        cache_write_tokens: 0,
      },
    },
  },
];

// Factory дозволяє кожному тесту замінити лише потрібну поведінку adapter.
function createFakeAi(options?: {
  extraction?: () => Promise<ExtractionResult>;
  stream?: readonly SummaryStreamEvent[];
  streamError?: Error;
}): DocumentAi {
  return {
    // За замовчуванням extraction завершується підготовленою фікстурою.
    extract: options?.extraction ?? (async () => successfulExtraction),
    streamSummary: async function* () {
      // Окремий error option моделює exception до завершення stream.
      if (options?.streamError) {
        throw options.streamError;
      }

      // Async generator віддає events у тому самому порядку, що й provider adapter.
      for (const event of options?.stream ?? successfulStream) {
        yield event;
      }
    },
  };
}

async function startTestServer(
  dependencies: AppDependencies,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  // Порт 0 просить ОС обрати вільний ephemeral port і уникає конфліктів між tests.
  const server: Server = createApp(dependencies).listen(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      // Закриваємо активні connections, щоб Vitest не залишив open handles.
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    },
  };
}

// Малий helper прибирає повторення POST headers і JSON.stringify у кожному test.
async function postJson(baseUrl: string, path: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
```

### Пояснення коду по логічних блоках

1. `successfulExtraction` і `successfulStream` – детерміновані provider-free fixtures.
2. `createFakeAi` – dependency injection: route отримує контрольований fake замість OpenRouter adapter.
3. `listen(0)` – запускає справжній локальний HTTP server без фіксованого порту.
4. `close()` в `finally` – гарантує cleanup навіть після failed assertion.
5. `postJson` – залишає в тестах лише дані конкретного сценарію.

</details>

<details>
<summary><b>Розгорнути: ключові HTTP assertions із коментарями</b></summary>

### Той самий код з поясненнями

```ts
describe("document API", () => {
  // Перевіряємо найпростішу ознаку готовності застосунку.
  it("exposes a health endpoint", async () => {
    const server = await startTestServer({ ai: createFakeAi() });

    try {
      const response = await fetch(`${server.baseUrl}/health`);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ status: "ok" });
    } finally {
      await server.close();
    }
  });

  // Валідація має зупинити порожній content ще до виклику AI dependency.
  it("rejects invalid input before calling the extraction service", async () => {
    const extract = vi.fn(async () => successfulExtraction);
    const server = await startTestServer({
      ai: createFakeAi({ extraction: extract }),
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/extract", {
        content: "   ",
      });

      expect(response.status).toBe(400);
      expect(extract).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "INVALID_INPUT" },
      });
    } finally {
      await server.close();
    }
  });

  // Strict request schema має відхилити extra field на HTTP boundary.
  it("rejects unknown fields with HTTP 400", async () => {
    const extract = vi.fn(async () => successfulExtraction);
    const server = await startTestServer({
      ai: createFakeAi({ extraction: extract }),
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/extract", {
        content: "Документ.",
        extra: true,
      });

      expect(response.status).toBe(400);
      expect(extract).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "INVALID_INPUT" },
      });
    } finally {
      await server.close();
    }
  });

  // Невалідний JSON перевіряє окремий public error contract parser middleware.
  it("returns a stable error for malformed JSON", async () => {
    const server = await startTestServer({ ai: createFakeAi() });

    try {
      const response = await fetch(`${server.baseUrl}/api/documents/extract`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"content":"test",}',
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "MALFORMED_JSON",
          message: "Тіло запиту містить невалідний JSON.",
        },
      });
    } finally {
      await server.close();
    }
  });

  // Express body limit має зупинити oversized payload до AI dependency.
  it("rejects an oversized JSON body before model invocation", async () => {
    const extract = vi.fn(async () => successfulExtraction);
    const server = await startTestServer({
      ai: createFakeAi({ extraction: extract }),
    });

    try {
      const response = await fetch(`${server.baseUrl}/api/documents/extract`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "x".repeat(40 * 1024) }),
      });

      expect(response.status).toBe(413);
      expect(extract).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "Тіло запиту перевищує дозволений розмір.",
        },
      });
    } finally {
      await server.close();
    }
  });

  // Успішний route повертає data, нормалізований usage і виміряні metrics разом.
  it("returns typed extraction data, usage and measured cost", async () => {
    const times = [100, 145];
    const server = await startTestServer({
      ai: createFakeAi(),
      // Детермінований clock робить latency assertion стабільним.
      now: () => times.shift() ?? 145,
      prices: {
        "test-main": {
          inputCostPerMillion: 10,
          cachedInputCostPerMillion: 1,
          cacheWriteCostPerMillion: 12.5,
          outputCostPerMillion: 20,
        },
      },
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/extract", {
        content: "14 липня Олена Коваль приїхала до Львова.",
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        data: successfulExtraction.data,
        usage: {
          inputTokens: 1_000,
          outputTokens: 500,
          cachedTokens: 200,
          cacheWriteTokens: 100,
        },
        metrics: {
          model: "test-main",
          totalLatencyMs: 45,
          cacheHitRate: 0.2,
          pricingAvailable: true,
        },
      });
    } finally {
      await server.close();
    }
  });

  // Happy path має зберегти порядок named SSE events: delta, usage, done.
  it("streams named delta, usage and done events", async () => {
    const times = [100, 125, 180];
    const server = await startTestServer({
      ai: createFakeAi(),
      now: () => times.shift() ?? 180,
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/summary/stream", {
        content: "Синтетичний документ.",
      });
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/event-stream");
      expect(body).toContain('event: delta\ndata: {"delta":"Короткий "}\n\n');
      expect(body).toContain('"ttftMs":25');
      expect(body).toContain('"totalLatencyMs":80');
      expect(body).toContain('"cacheHitRate":0.25');
      expect(body).toContain('event: done\ndata: {"status":"completed"}\n\n');
    } finally {
      await server.close();
    }
  });

  // Incomplete generation завершується error event і ніколи не маскується як done.
  it("emits an SSE error and no done event for incomplete generation", async () => {
    const server = await startTestServer({
      ai: createFakeAi({
        stream: [
          { type: "delta", delta: "Початок" },
          { type: "incomplete", reason: "max_tokens" },
        ],
      }),
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/summary/stream", {
        content: "Синтетичний документ.",
      });
      const body = await response.text();

      expect(body).toContain('"code":"INCOMPLETE_RESPONSE"');
      expect(body).toContain('"reason":"max_tokens"');
      expect(body).not.toContain("event: done");
    } finally {
      await server.close();
    }
  });

  // Failed domain event має стати safe SSE error без done.
  it("emits an SSE error and no done event for failed generation", async () => {
    const server = await startTestServer({
      ai: createFakeAi({
        stream: [{ type: "failed", reason: "rate_limit_exceeded" }],
      }),
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/summary/stream", {
        content: "Синтетичний документ.",
      });
      const body = await response.text();

      expect(body).toContain('"code":"UPSTREAM_RATE_LIMITED"');
      expect(body).toContain('"reason":"rate_limit_exceeded"');
      expect(body).not.toContain("event: done");
    } finally {
      await server.close();
    }
  });

  // Refusal може мати completed usage, але terminal HTTP event усе одно є error.
  it("emits an SSE refusal and no done event", async () => {
    const server = await startTestServer({
      ai: createFakeAi({
        stream: [
          { type: "refused" },
          {
            type: "completed",
            model: "test-fast",
            usage: {
              input_tokens: 20,
              output_tokens: 0,
              total_tokens: 20,
            },
          },
        ],
      }),
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/summary/stream", {
        content: "Синтетичний документ.",
      });
      const body = await response.text();

      expect(body).toContain('"code":"REQUEST_REFUSED"');
      expect(body).not.toContain("event: done");
    } finally {
      await server.close();
    }
  });

  // Extraction timeout має повертати стабільний HTTP 504 без raw provider details.
  it("returns HTTP 504 for an extraction timeout", async () => {
    const server = await startTestServer({
      ai: createFakeAi({
        extraction: async () => {
          throw new DocumentAiError(
            "GATEWAY_TIMEOUT",
            "Перевищено час очікування відповіді OpenRouter API.",
            504,
          );
        },
      }),
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/extract", {
        content: "Синтетичний документ.",
      });

      expect(response.status).toBe(504);
      await expect(response.text()).resolves.toContain('"code":"GATEWAY_TIMEOUT"');
    } finally {
      await server.close();
    }
  });

  // Stream timeout має бути named SSE error і не повинен завершитися done.
  it("emits SSE GATEWAY_TIMEOUT without done for a stream timeout", async () => {
    const server = await startTestServer({
      ai: createFakeAi({
        streamError: new DocumentAiError(
          "GATEWAY_TIMEOUT",
          "Перевищено час очікування відповіді OpenRouter API.",
          504,
        ),
      }),
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/summary/stream", {
        content: "Синтетичний документ.",
      });
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(body).toContain('"code":"GATEWAY_TIMEOUT"');
      expect(body).not.toContain("event: done");
    } finally {
      await server.close();
    }
  });

  // Розрив клієнтського connection повинен передати abort у довгий upstream stream.
  it("aborts the upstream stream after the HTTP client disconnects", async () => {
    let upstreamSignal: AbortSignal | undefined;
    let markStreamStarted: (() => void) | undefined;
    const streamStarted = new Promise<void>((resolve) => {
      markStreamStarted = resolve;
    });
    const ai: DocumentAi = {
      extract: async () => successfulExtraction,
      streamSummary: async function* (_content, signal) {
        upstreamSignal = signal;
        markStreamStarted?.();
        yield { type: "delta", delta: "Початок" };
        await new Promise<void>((resolve) => {
          if (signal.aborted) {
            resolve();
            return;
          }

          signal.addEventListener("abort", () => resolve(), { once: true });
        });
      },
    };
    const server = await startTestServer({ ai });
    const clientController = new AbortController();

    try {
      const response = await fetch(`${server.baseUrl}/api/documents/summary/stream`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "Синтетичний документ." }),
        signal: clientController.signal,
      });
      const reader = response.body?.getReader();

      expect(response.status).toBe(200);
      expect(reader).toBeDefined();
      await streamStarted;
      await reader?.read();
      // Імітуємо закриття вкладки або мережевого з'єднання з боку клієнта.
      clientController.abort();

      await vi.waitFor(() => expect(upstreamSignal?.aborted).toBe(true));
    } finally {
      clientController.abort();
      await server.close();
    }
  });
});
```

### Пояснення коду по логічних блоках

1. Кожен test має структуру arrange → request → assertions → cleanup.
2. `expect(extract).not.toHaveBeenCalled()` доводить, що invalid input не дійшов до моделі.
3. Окремі HTTP tests доводять strict unknown-field validation і 32 KB body limit, а не лише перевіряють Zod schema напряму.
4. Injected `now` прибирає залежність latency metrics від швидкості комп'ютера.
5. SSE assertions перевіряють і назву event, і JSON payload, і порядок terminal behavior.
6. Negative assertions для `done` окремо захищають incomplete, failed і refusal states від false success.
7. Останній test перевіряє весь cancellation chain від HTTP client до переданого adapter `AbortSignal`.

</details>

<details>
<summary><b>Розгорнути: request-level assertions із коментарями</b></summary>

### Той самий код з поясненнями

#### `config-and-metrics.test.ts`

```ts
import { expect, it } from "vitest";
import { DocumentRequestSchema, MAX_DOCUMENT_CHARACTERS } from "../src/schemas/document-request.js";

// Unknown field перевіряється без HTTP: strict Zod schema має відхилити extra.
it("trims content, rejects unknown fields and enforces the size limit", () => {
  // Валідний content очищується від зовнішніх пробілів.
  expect(DocumentRequestSchema.parse({ content: "  Документ  " })).toEqual({
    content: "Документ",
  });
  // Поле extra не входить до contract, тому safeParse повертає success: false.
  expect(DocumentRequestSchema.safeParse({ content: "Документ", extra: true }).success).toBe(false);
  // Значення на один символ більше за limit також відхиляється.
  expect(
    DocumentRequestSchema.safeParse({
      content: "x".repeat(MAX_DOCUMENT_CHARACTERS + 1),
    }).success,
  ).toBe(false);
});
```

#### `openrouter-document-ai.test.ts`

```ts
import type OpenAI from "openai";
import { expect, it, vi } from "vitest";
import type { SummaryStreamEvent } from "../src/services/document-ai.js";
import { OpenRouterDocumentAi } from "../src/services/openrouter-document-ai.js";

// Async generator перетворює масив synthetic chunks на SDK-подібний stream.
async function* events(values: readonly unknown[]): AsyncIterable<never> {
  for (const value of values) {
    yield value as never;
  }
}

// Helper будує мінімальний OpenRouter streaming chunk для конкретного scenario.
function streamChunk(
  options: {
    model?: string;
    content?: string | null;
    finishReason?: string | null;
    usage?: unknown;
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
    ...(options.usage === undefined ? {} : { usage: options.usage }),
  };
}

// Raw fixture повторює назви token fields із Chat Completions API.
const rawChatUsage = {
  prompt_tokens: 100,
  completion_tokens: 20,
  total_tokens: 120,
  prompt_tokens_details: {
    cached_tokens: 10,
    cache_write_tokens: 0,
  },
};

// Expected fixture фіксує provider-neutral форму після normalizeChatUsage.
const normalizedChatUsage = {
  input_tokens: 100,
  output_tokens: 20,
  total_tokens: 120,
  input_tokens_details: {
    cached_tokens: 10,
    cache_write_tokens: 0,
  },
};

const parsedData = {
  names: ["Олена Коваль"],
  dates: ["14 липня"],
  locations: ["Львова"],
  summary: "Олена Коваль приїхала до Львова 14 липня.",
};

// Factory створює mock SDK client і зберігає vi.fn для assertions аргументів.
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

// Зареєстрована model fixture дозволяє перевірити Structured Output і reasoning.
const REGISTERED_MAIN_MODEL = "~deepseek/deepseek-v4-flash-latest";

function createAdapter(client: OpenAI): OpenRouterDocumentAi {
  return new OpenRouterDocumentAi(client, {
    fastModel: "test-fast",
    mainModel: REGISTERED_MAIN_MODEL,
    reasoningEffort: "low",
    maxOutputTokens: 800,
  });
}

// collect перетворює AsyncIterable events на звичайний масив для deep equality.
async function collect(source: AsyncIterable<SummaryStreamEvent>): Promise<SummaryStreamEvent[]> {
  const result: SummaryStreamEvent[] = [];

  for await (const event of source) {
    result.push(event);
  }

  return result;
}

it("maps streaming chunks and sends the Chat Completions request contract", async () => {
  // Три chunks моделюють текст, terminal finish reason і фінальний usage.
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

  // Domain events зберігають обидва delta та usage з останнього chunk.
  expect(result).toEqual([
    { type: "delta", delta: "Частина" },
    { type: "delta", delta: " друга" },
    { type: "completed", model: "resolved-fast", usage: normalizedChatUsage },
  ]);
  // Окремо перевіряємо фактичні аргументи mock SDK method.
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
    // Той самий AbortSignal має дійти до SDK request options.
    { signal: controller.signal },
  );
  const request = mock.create.mock.calls[0]?.[0] as Record<string, unknown>;
  expect(request.stream_options).toBeUndefined();
});

it("emits incomplete for the length finish state", async () => {
  const mock = createMockClient({
    streamEvents: [streamChunk({ content: "Текст", finishReason: "length" })],
  });

  // Finish reason length перетворюється на typed incomplete event.
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

  // content_filter стає refusal, але фінальний usage chunk усе одно нормалізується.
  await expect(
    collect(createAdapter(mock.client).streamSummary("Документ.", new AbortController().signal)),
  ).resolves.toEqual([
    { type: "delta", delta: "Текст" },
    { type: "refused" },
    { type: "completed", model: "test-fast", usage: normalizedChatUsage },
  ]);
});

// Непорожній текст може не містити сутностей певної категорії або всіх трьох.
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

  // Спочатку доводимо, що response перетворився на очікуваний domain result.
  await expect(
    createAdapter(mock.client).extract("14 липня Олена Коваль приїхала до Львова."),
  ).resolves.toEqual({
    data: parsedData,
    model: "resolved-main",
    usage: normalizedChatUsage,
  });

  // Потім перевіряємо strict request contract, переданий до provider SDK.
  const request = mock.create.mock.calls[0]?.[0] as Record<string, unknown>;
  expect(request.response_format).toMatchObject({
    type: "json_schema",
    json_schema: { name: "document_extraction", strict: true },
  });
  expect(
    (request.response_format as { json_schema: { schema: unknown } }).json_schema.schema,
  ).toBeDefined();
  expect(request.reasoning).toEqual({ effort: "low", exclude: true });
  expect(request.provider).toEqual({ require_parameters: true });
});
```

### Пояснення коду по логічних блоках

1. Schema assertion окремо доводить `strict()` contract для unknown fields.
2. `toHaveBeenCalledWith` перевіряє фактичний SDK request, чого не може зробити fake `DocumentAi` в route test.
3. `length` і `content_filter` перевіряють перетворення provider finish reasons в domain events.
4. Structured-output assertions фіксують strict schema, reasoning effort і `require_parameters`.
5. Assertions перевіряють точні request fields для структурованого extraction.

</details>

Крім цих сценаріїв зберігаються 5 active tests із `my-dev/lesson-02-llm-api-openrouter/tests/scaffolding.test.ts`. Їх не переносять в `todo` і не видаляють.

### No-TODO proof

```powershell
yarn prettier --write my-dev/lesson-02-llm-api-openrouter
if ($LASTEXITCODE -ne 0) { throw "Форматування my-dev/lesson-02-llm-api-openrouter не пройшло." }
node scripts/assert-no-test-todos.ts my-dev/lesson-02-llm-api-openrouter/tests
if ($LASTEXITCODE -ne 0) { throw "У my-dev/lesson-02-llm-api-openrouter/tests залишилися незавершені тести." }
yarn check:my:lesson02:openrouter
if ($LASTEXITCODE -ne 0) { throw "Повна перевірка my-dev не пройшла." }
```

Очікується:

- 0 todo;
- 0 skipped;
- 0 failed;
- Кількість `passed` залежить від поділу сценаріїв на тести; homework не задає фіксованої кількості.
- typecheck, lint і format passed.

Підтримуваний в репозиторії Node.js 24 виконує `assert-no-test-todos.ts` напряму. Для canonical starter потрібні exit 1 і повідомлення про 12 TODO; для завершеної реалізації – exit 0 та повідомлення `active tests only`. Порожній output не є підтвердженням виконаної перевірки.

---

# Етап E – eval і live-межа

## Offline eval

`my-dev/lesson-02-llm-api-openrouter/evals/run.ts` читає recorded results і не звертається до provider:

```shell
node scripts/run-tsx-entrypoint.mjs my-dev/lesson-02-llm-api-openrouter/evals/run.ts
```

Очікується:

```text
Result: 5/5
Success rate: 100.0%
```

Цей результат перевіряє dataset і scorer, але не доводить поведінку живої моделі. Scorer перевіряє масиви сутностей, а для summary – лише тип, непорожність, довжину та ключові факти, тому вигадане ім'я в summary зараз не відхиляється. `5/5` слід називати доказом recorded replay, а не повною перевіркою всього домашнього завдання.

## Public catalog

Еталонний solution має окремий public catalog gate:

```shell
node scripts/run-tsx-entrypoint.mjs lesson-02-llm-api-openrouter/solution/evals/live-catalog.ts
```

Gate не виконує inference і перевіряє:

- model ID;
- prompt, cached-input і output pricing;
- Structured Output capability;
- reasoning capability;
- підтримувані reasoning efforts.

## Необов'язкова локальна HTTP-перевірка

Для цього smoke потрібен локальний кореневий `.env`; кроки наведено в [dev-migration-guide.md](./dev-migration-guide.md). Запустіть сервер і health check лише якщо хочете перевірити HTTP вручну:

```shell
yarn dev:my:lesson02:openrouter
```

В другому терміналі, поки сервер працює, виконайте:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
```

`/health` не викликає модель і не витрачає баланс. Після перевірки зупиніть сервер через `Ctrl+C`.

## Live provider – opt-in

Перевірка живого адаптера необов'язкова. Використовуйте synthetic input і власний локальний credential. Повний live eval робить 5 платних extraction calls:

```shell
node scripts/run-tsx-entrypoint.mjs my-dev/lesson-02-llm-api-openrouter/evals/run.ts --live
```

Live OpenRouter не підтверджує OpenAI variant.

---

# Фінальна перевірка

## Final student check в my-dev

```powershell
yarn prettier --write my-dev/lesson-02-llm-api-openrouter
if ($LASTEXITCODE -ne 0) { throw "Форматування my-dev/lesson-02-llm-api-openrouter не пройшло." }
node scripts/assert-no-test-todos.ts my-dev/lesson-02-llm-api-openrouter/tests
if ($LASTEXITCODE -ne 0) { throw "У my-dev/lesson-02-llm-api-openrouter/tests залишилися незавершені тести." }
yarn check:my:lesson02:openrouter
if ($LASTEXITCODE -ne 0) { throw "Повна перевірка my-dev не пройшла." }
git status
if ($LASTEXITCODE -ne 0) { throw "Не вдалося прочитати стан git." }
node scripts/run-tsx-entrypoint.mjs my-dev/lesson-02-llm-api-openrouter/evals/run.ts
if ($LASTEXITCODE -ne 0) { throw "Offline eval не пройшов." }
```

За бажанням, якщо ви запускали сервер для ручної HTTP-перевірки:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
```

Запит запускається в другому терміналі, поки сервер із `my-dev/` працює в першому. Очікується `status: ok`; після цього зупиніть сервер через `Ctrl+C`. Port 3000 не повинен залишатися зайнятим.

## Reference snapshots для викладача

> Студентам цей розділ можна пропустити. Команди нижче перевіряють канонічні `starter/`, `checkpoints/` і `solution/`, а не вашу папку `my-dev/`; вони не входять до здачі.

```shell
yarn test:lesson02:openrouter
yarn test:lesson02:openrouter:checkpoints
yarn test:lesson02:openrouter:solution
node scripts/run-tsx-entrypoint.mjs lesson-02-llm-api-openrouter/solution/evals/run.ts
yarn build:lesson02:openrouter
```

Очікуваний canonical evidence:

| Target                | Result            |
| --------------------- | ----------------- |
| starter               | 5 passed, 12 todo |
| checkpoint            | 12/12 passed      |
| solution              | 58/58 passed      |
| offline solution eval | 5/5               |
| build                 | exit 0            |

`check:lesson02:openrouter:solution` запускає Lesson 02 lint, format, typecheck, solution/checkpoint tests, offline eval і build. Global structural audit лишається окремою перевіркою курсу.

## Оновіть README студентської роботи

В `my-dev/lesson-02-llm-api-openrouter/README.md` відредагуйте точні наявні розділи:

1. Замініть H1 `# Lesson 02 (OpenRouter) — starter` на `# Lesson 02 (OpenRouter)` і замініть вступний статус на короткий опис завершеної студентської реалізації.
2. В `## Як спочатку побачити готовий результат` опишіть `yarn demo:lesson02:openrouter:solution` лише як необов'язкову канонічну live-демонстрацію, що потребує ключа й виконує provider-виклики. Замініть речення про продовження роботи в `starter` на вказівку працювати в власній `my-dev/lesson-02-llm-api-openrouter/`.
3. В `## Де запускати команди` замініть блок канонічних `dev:lesson02:openrouter` / `dev:lesson02:openrouter:solution` команд на команди student route: `yarn test:my:lesson02:openrouter`, `yarn check:my:lesson02:openrouter`, `yarn eval:my:lesson02:openrouter` і, лише для ручного запуску, `yarn dev:my:lesson02:openrouter`.
4. Під `## Що вже працює` замініть 501, незавершені тести й TODO твердження на фактичні готові маршрути та обов'язкові обмеження.
5. Перейменуйте `## Запуск сервера (starter)` на `## Запуск сервера` і замініть канонічну команду на `yarn dev:my:lesson02:openrouter`.
6. Замініть заголовок `## Як перевірити незавершені маршрути` на `## Приклади відповідей` і замініть весь його вміст фактичними успішним extraction JSON та помилковим JSON для невалідного запиту за `src/app.ts`, схемами й тестами.
7. Оновіть `## Тести, eval і перевірка` командами `yarn check:my:lesson02:openrouter` та `yarn eval:my:lesson02:openrouter`, зазначивши 5/5 лише для offline eval і відсутність TODO після проходження gate.
8. Замініть весь вміст від `## Чим starter відрізняється від solution` до (не включно) заголовка `## Вартість, квоти й приватність` на `## Відомі обмеження` з обмеженнями саме завершеної реалізації. Не змінюйте канонічний `starter/README.md`, не копіюйте `solution/README.md`, інструкторські демо-інструкції, ключі або вхідні документи.

Перевірка має підтвердити, що команди відповідають `package.json`, приклади – фактичним схемам і тестам, а обмеження – homework. Очікується README без старих starter/501/TODO тверджень і з узгодженими прикладами. Якщо приклад не збігається, потрібно виправити README або реалізацію, потім повторити `yarn check:my:lesson02:openrouter` і `yarn eval:my:lesson02:openrouter`.

## Definition of Done

`homework.md` є джерелом обов'язкових вимог. Для студентської здачі:

- [ ] Виконано всі обов'язкові сценарії homework; 12 стартових `it.todo` замінено активними тестами без мережевих викликів.
- [ ] Окремий offline adapter test викликає `OpenRouterDocumentAi.extract()` із підміненою відповіддю `chat.completions.create` і перевіряє, що непорожній документ без імен, дат і локацій дає `names: []`, `dates: []`, `locations: []` та непорожній `summary`.
- [ ] `yarn check:my:lesson02:openrouter` завершується з кодом 0.
- [ ] `yarn eval:my:lesson02:openrouter` дає offline результат 5/5.
- [ ] README містить команди запуску, приклади success/error response та відомі обмеження.
- [ ] `my-dev/lesson-02-llm-api-openrouter/final-project-ideas.md` містить 2–3 теми з проблемою, цільовим користувачем, результатом агента, джерелами даних і ризиками.
- [ ] `.env`, ключі, tokens і повні вхідні документи не потрапляють до Git.
- [ ] Live-статус вказується окремо лише якщо live-перевірка запускалася; запускати її необов'язково.

Ціна моделі, cache metrics, TTFT, скасування upstream та live-перевірки каталогу – необов'язкове поглиблення за [homework.md](./homework.md). Не додавайте їх до обов'язкового обсягу.

## Типові помилки

| Симптом                       | Причина                         | Виправлення                                      |
| ----------------------------- | ------------------------------- | ------------------------------------------------ |
| Provider повернув помилку     | контрольований upstream failure | перевірити публічний error contract              |
| Adapter ігнорує env effort    | hardcoded `low`                 | передавати `reasoningEffort` з environment       |
| Unknown model має cost `0`    | fake free fallback              | повернути pricing unavailable                    |
| `done` після `error`          | terminal state не збережений    | надсилати `done` лише після completed            |
| Unit test звернувся до мережі | SDK не замінено fake adapter    | тестувати через `DocumentAi`                     |
| Vitest проходить з TODO       | Vitest дозволяє `todo`          | `check:my` зупиняється з кодом 1 на no-TODO gate |
| Recorded eval названо live    | runner використав fixtures      | явно позначити deterministic replay              |
