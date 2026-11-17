# Lesson 02 (OpenRouter) – гайд зі стартової версії

> **Для студентів курсу:** Робоче місце готує **Промпт 1** зі [STUDENTS.md](../STUDENTS.md) в папці `my-dev/lesson-02-llm-api-openrouter/`. Усі шляхи файлів нижче стосуються вашої папки `my-dev`. Канонічні `starter/` та `dev/` залишаються недоторканими.

> Призначення: пояснити готовий scaffold, новий навчальний delta та межі завдання без копіювання повного solution. Джерело істини – поточний каталог `lesson-02-llm-api-openrouter/starter`. Оновлено 2026-09-05.

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Розібратися, які модулі Document API вже готові після переходу з CLI, а які потрібно реалізувати для Lesson 02, не переписуючи основу попереднього заняття.

### 💎 Практична цінність застосунку

HTTP-клієнт може передати документ на структуроване вилучення даних або отримувати його підсумок поступово. Це знайомить із двома поширеними backend-контрактами для мовних моделей: перевіреним JSON і SSE-потоком.

### ⚙️ Що робить застосунок

Starter запускає Express API, перевіряє `/health` і відхиляє невалідні запити. Два маршрути для мовної моделі поки повертають контрольований `501`; після виконання завдання вони оброблятимуть extraction і streaming. Пам'яті та циклу AI-агента тут немає.

## 1. Результат практики

CLI з Lesson 01 перетворюється на довготривалий Document API:

```text
POST /api/documents/extract
  → JSON { data, usage, metrics }

POST /api/documents/summary/stream
  → SSE: delta → usage → done
  → SSE: error без done для невдалого terminal state
```

**HTTP API** – серверний інтерфейс, до якого надсилаються HTTP-запити. **Structured Output** – JSON, форма якого обмежена JSON Schema і додатково перевіряється локально через Zod. **SSE (Server-Sent Events)** – текстовий формат послідовних подій в межах одного HTTP-з'єднання.

Практика ще не створює AI-агента: немає пам'яті, tools або agent loop. Один документ породжує одну структуровану відповідь або один потік підсумку.

## 2. Спадковість Lesson 01 → Lesson 02

Перехід є концептуальним:

- SDK, provider configuration, model selection, usage і error discipline переходять як уже вивчені принципи;
- CLI-файли не копіюються, бо нова форма застосунку – Express API;
- HTTP scaffold, схеми, model resolver і базові тести вже готові;
- повторно реалізовувати Lesson 01 не потрібно.

Previous baseline: `lesson-01-intro-openrouter/solution`. Current starter: `lesson-02-llm-api-openrouter/starter`.

## 3. Конфігурація моделі

Lesson 02 читає спільний кореневий `.env` для локального запуску; offline-тести та eval працюють без ключа. В Lesson 01 студент зберігає локальний `.env` в власній `my-dev/lesson-01-intro-openrouter/` лише для ручних або live-запитів; `dev/.env` належить історичному інструкторському стенду.

```dotenv
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=~deepseek/deepseek-v4-flash-latest
OPENROUTER_MODEL_FAST=
OPENROUTER_MODEL_MAIN=
OPENROUTER_REASONING_EFFORT=low
OPENROUTER_TIMEOUT_MS=30000
OPENROUTER_MAX_OUTPUT_TOKENS=1600
PORT=3000
```

Контракт нової версії:

- одна платна Flash-модель використовується для `fast` і `main`;
- role overrides залишаються опційними;
- `reasoning effort` за замовчуванням і в shared env – `low`;
- кожне завдання використовує явно налаштовану модель відповідної ролі.

## 4. Файли starter

Канонічний starter містить 24 навчальні файли.

```text
starter/
├── README.md
├── final-project-ideas.md
├── src/
│   ├── server.ts
│   ├── app.ts
│   ├── config/
│   │   ├── env.ts
│   │   ├── model-capabilities.ts
│   │   ├── models.ts
│   │   ├── openrouter.ts
│   │   ├── pricing.ts
│   │   └── prompts.ts
│   ├── lib/
│   │   ├── errors.ts
│   │   ├── metrics.ts
│   │   └── sse.ts
│   ├── schemas/
│   │   ├── document-request.ts
│   │   └── extraction.ts
│   └── services/
│       ├── document-ai.ts
│       └── openrouter-document-ai.ts
├── tests/
│   ├── scaffolding.test.ts
│   └── app.test.ts
└── evals/
    ├── README.md
    ├── extraction.eval.ts
    ├── recorded-results.ts
    ├── run.ts
    └── scorer.ts
```

Ключовий розподіл відповідальності:

```text
server.ts                       конфігурація → SDK → adapter → listen
app.ts                          HTTP validation, JSON/SSE contract, metrics
services/document-ai.ts         provider-neutral domain interface
services/openrouter-document-ai.ts
                                OpenRouter request/response adapter
config/model-capabilities.ts    capability registry
tests/scaffolding.test.ts       5 активних перевірок готової основи
tests/app.test.ts               12 current-lesson сценаріїв
```

**Adapter** – клас-перекладач між provider SDK і внутрішнім інтерфейсом `DocumentAi`. Через нього HTTP-шар і unit tests не залежать від деталей SDK.

## 5. Що вже готово

Starter не є порожньою заготовкою. До student delta не входять:

- пошук і завантаження кореневого `.env`;
- Zod-валідація environment без виведення значень;
- default model `~deepseek/deepseek-v4-flash-latest`;
- central model resolver для `fast` і `main`;
- `OPENROUTER_REASONING_EFFORT=low`;
- capability registry для Structured Output і reasoning;
- conservative capabilities для невідомої моделі;
- strict document та extraction schemas;
- usage/cache normalization;
- SSE writer;
- typed `DocumentAiError` і публічний API error envelope;
- `GET /health`;
- input validation, malformed JSON і payload-size errors;
- 5 active scaffolding tests;
- 5-case deterministic recorded eval dataset.

Готова основа не перетворюється на нові TODO.

## 6. Що реалізується

Обсяг здачі визначає [homework.md](./homework.md), а не фіксована кількість змінених файлів. Основна реалізація охоплює:

- `src/services/openrouter-document-ai.ts` – OpenRouter adapter для streaming і Structured Output;
- `src/app.ts` – extraction та SSE routes, валідацію і безпечні помилки;
- `tests/app.test.ts` – 12 стартових сценаріїв, замінених на активні offline-тести;
- `final-project-ideas.md` в `my-dev/lesson-02-llm-api-openrouter/` – 2–3 теми за контрольною точкою homework;
- README з командами, прикладами та обмеженнями за homework.

В повному roadmap виконуйте кроки послідовно від кроку 1: наступні кроки використовують результати Етапу A, зокрема `EXTRACTION_EXAMPLE`. Перевірена ціна, cost reporting, few-shot example, TTFT/cache/cancellation і допоміжні adapter/config tests є поглибленнями; вимоги для здачі визначає [homework.md](./homework.md).

## 7. Точний starter state

`tests/scaffolding.test.ts`:

- 5 active;
- 0 failed;
- перевіряє env/model defaults, capability registry, schemas, usage/cache і generic cost behavior.

`tests/app.test.ts`:

- 12 `it.todo`;
- описує лише нові сценарії Lesson 02.

`src/app.ts`:

- `GET /health` → HTTP 200;
- invalid input обробляється до model call;
- два LLM routes → контрольований HTTP 501 після валідного input.

`src/services/openrouter-document-ai.ts`:

- має типізовані options `fastModel`, `mainModel`, `reasoningEffort` і `maxOutputTokens`;
- `streamSummary` та `extract` кидають `NOT_IMPLEMENTED`.

Початковий test result:

```text
5 passed
12 todo
0 failed
```

Це коректний canonical starter, але ще не завершене завдання.

## 8. Provider request contract

### Streaming

Цільова форма request:

```ts
const capabilities = resolveModelCapabilities(this.options.fastModel);

const request = {
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

Usage читається з фінального streaming chunk. `stream_options.include_usage` не потрібний.

`reasoning.exclude: true` приховує текст міркувань в відповіді. Ці токени продовжують враховуватися в вихідному ліміті та вартості.

### Structured extraction

Цільова форма request:

```ts
const capabilities = resolveModelCapabilities(this.options.mainModel);

const request = {
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
  provider: { require_parameters: true },
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

`provider.require_parameters` вимагає endpoint із підтримкою потрібних параметрів.

Після provider response обов'язкові:

1. перевірка terminal state;
2. локальний `JSON.parse`;
3. `ExtractionSchema.safeParse`;
4. перевірка, що сутності в масивах `names`, `dates`, `locations` походять із вхідного тексту;
5. повернення фактичного model ID та usage.

## 9. HTTP contract

### Extraction

```text
POST /api/documents/extract
content → DocumentAi.extract()
        → data
        → usage normalization
        → latency + cache hit rate + cost
        → HTTP 200 JSON
```

Невідома або неповна ціна не підмінюється нулем:

```json
{
  "estimatedCostUsd": null,
  "pricingAvailable": false,
  "pricingUnavailableReason": "MODEL_NOT_CONFIGURED"
}
```

Якщо OpenRouter повернув точний `usage.cost`, provider-reported value має пріоритет над локальною оцінкою.

### Streaming

```text
POST /api/documents/summary/stream
delta* → usage → done
refused | incomplete | failed → error, без done
HTTP disconnect → AbortController → upstream abort
```

`done` надсилається лише після підтвердженого terminal state `completed`. Скасування після disconnect показує додаткове розширення.

## 10. Фізичний checkpoint

В репозиторії існує один накопичувальний snapshot:

```text
lesson-02-llm-api-openrouter/checkpoints/01-streaming
```

В ньому вже готові adapter streaming і SSE route, а extraction ще повертає `501 NOT_IMPLEMENTED`. Це реальний checkpoint практики; вигадувати додаткові checkpoint-директорії не потрібно.

Перевірка:

```shell
yarn test:lesson02:openrouter:checkpoints
```

Очікується 12/12 active tests.

## 11. Команди

Студент працює виключно в робочій папці `my-dev/lesson-02-llm-api-openrouter/`, яку підготував **Промпт 1** зі `STUDENTS.md`. Наведені команди запускаються з кореня репозиторію, де лежить `package.json`. Сервер працює до `Ctrl+C`; перевірку `/health` можна виконати в другому терміналі.

| Мета                                                   | Команда для студента (`my-dev`)                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Комплексна перевірка (typecheck, lint, format і tests) | `yarn check:my:lesson02:openrouter`                                                      |
| Запустити лише Vitest-тести робочої папки              | `yarn test:my:lesson02:openrouter`                                                       |
| Запустити локальний сервер Express                     | `yarn dev:my:lesson02:openrouter`                                                        |
| Перевірити `/health` в другому терміналі               | `Invoke-RestMethod http://127.0.0.1:3000/health` або `curl http://127.0.0.1:3000/health` |

Канонічні snapshots (для довідки та самоперевірки):

| Мета                           | Команда                                          |
| ------------------------------ | ------------------------------------------------ |
| Початковий starter             | `yarn test:lesson02:openrouter`                  |
| Physical checkpoint            | `yarn test:lesson02:openrouter:checkpoints`      |
| Готовий solution               | `yarn test:lesson02:openrouter:solution`         |
| Offline recorded eval solution | `yarn eval:lesson02:openrouter:solution`         |
| Build solution                 | `yarn build:lesson02:openrouter`                 |
| Public model catalog           | `yarn eval:lesson02:openrouter:solution:catalog` |
| Мінімальний готовий live smoke | `yarn demo:lesson02:openrouter:solution`         |

Recorded eval не є live provider verification. Live-команди запускаються лише свідомо з synthetic input і чинним credential.

## 12. Критерій завершення student work

Завершена робоча папка `my-dev/lesson-02-llm-api-openrouter/` має:

- зберегти 5 готових baseline-тестів;
- замінити всі 12 `it.todo` активними tests;
- додати offline adapter test, який викликає `OpenRouterDocumentAi.extract()` із підміненою відповіддю `chat.completions.create` та перевіряє три `[]` і непорожній `summary` для непорожнього документа без імен, дат і локацій;
- мати 0 `todo`, `skip` і failed;
- повертати working extraction JSON і SSE;
- працювати з моделями для двох задокументованих ролей;
- надсилати reasoning лише для capability-verified model;
- використовувати `low` зі shared env;
- не робити real provider calls в unit tests;
- проходити no-TODO gate і `yarn check:my:lesson02:openrouter`.

No-TODO gate для робочої папки:

```powershell
node scripts/assert-no-test-todos.ts my-dev/lesson-02-llm-api-openrouter/tests
if ($LASTEXITCODE -ne 0) { throw "У my-dev/lesson-02-llm-api-openrouter/tests залишилися незавершені тести." }
yarn check:my:lesson02:openrouter
if ($LASTEXITCODE -ne 0) { throw "Перевірка студентської реалізації не пройшла." }
```

Цей TypeScript-файл запускається напряму підтримуваним в репозиторії Node.js 24. Для початкового starter gate має повернути exit 1 і повідомити про 12 TODO. Для завершеної реалізації потрібні exit 0 і повідомлення `active tests only`.

Поточний `evals/scorer.ts` перевіряє сутності в масивах, а для `summary` – тип, непорожність, довжину та ключові факти. Він поки не відхиляє вигадані сутності всередині `summary`. Тому replay `5/5` не підтверджує повне виконання вимоги домашнього завдання щодо достовірності підсумку. Цей дефект canonical scorer потребує окремого виправлення; до нього повний acceptance практики не підтверджений.

## 13. Порядок читання коду

1. `src/services/document-ai.ts` – внутрішній контракт.
2. `src/config/env.ts`, `models.ts`, `model-capabilities.ts` – конфігурація.
3. `src/schemas/*` – input і output boundaries.
4. `src/server.ts` – composition root.
5. `src/services/openrouter-document-ai.ts` – provider adapter.
6. `src/app.ts` – HTTP orchestration.
7. `tests/scaffolding.test.ts` – готовий baseline.
8. `tests/app.test.ts` – current lesson acceptance.
9. `evals/*` – оцінка якості, окрема від unit tests.
