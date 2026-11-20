# Lesson 03 (OpenAI) — homework

**Робочий контракт студента.** Non-Markdown файли канонічного `starter/` байтово тотожні OpenAI `solution/` Lesson 02. Один раз створіть копію командою `yarn student:init 03 openai`; вона не перезаписує наявну роботу. Виконуйте вимоги Lesson 03 лише в `my-dev/lesson-03-function-calling/`. Зелені успадковані тести підтверджують попередню основу, а не завершення поточної теми. Повний критерій завершення перевіряє `yarn student:check 03 openai`.

Матеріали лекції № 03 пояснюють Function Calling через OpenAI Responses API.
Цей файл фіксує точний implementation contract для OpenAI-варіанта практики.

Канонічним технічним фундаментом є завершений
`lesson-02-llm-api/solution/`. Поточний `starter/` уже містить працездатні
маршрути Structured Output і Streaming, їхні тести, environment-конфігурацію,
usage metrics та offline evals. Повторна реалізація Lesson 02 не входить до
завдання.

Для студентської роботи Промпт 1 зі [STUDENTS.md](../STUDENTS.md) копіює
`starter/` у `my-dev/lesson-03-function-calling/`. Реалізуйте завдання й
перевіряйте результат лише в цій робочій папці. `solution/` є довідковою
реалізацією поточної теми. Канонічний starter містить лише байтово тотожну
non-Markdown основу Lesson 02; нові файли й тести Lesson 03 створюйте в `my-dev/`.
Точні вимоги наведені в цьому файлі та [roadmap](roadmap-code-guide.md).

## Результат

До наявного Backend API додається `POST /api/agent`. Маршрут запускає
обмежений tool-calling runtime з одним strict-інструментом
`convert_currency`, безпечно виконує локальну функцію та повертає фінальний
текст, сумарний token usage і runtime-метрики.

## Основна частина (обов’язково)

1. Описати `convert_currency` однією Zod 4 schema та
   `zodResponsesFunction`; згенерований tool повинен мати `strict: true`,
   `additionalProperties: false` і повний масив `required`.
2. Приймати лише додатну суму та трилітерні латинські коди валют,
   нормалізовані через `trim()` і `toUpperCase()`.
3. Повторно перевіряти аргументи через `safeParse()` до виклику
   `RateProvider`; невідомий tool name не повинен запускати provider.
4. Повертати стабільні коди `INVALID_TOOL_ARGUMENTS`, `UNKNOWN_TOOL`,
   `UNSUPPORTED_CURRENCY_PAIR`, `UPSTREAM_TIMEOUT`,
   `UPSTREAM_RATE_LIMITED`, `UPSTREAM_UNAVAILABLE` і
   `TOOL_EXECUTION_ERROR` без raw errors або stack traces.
5. Обмежити внутрішній retry трьома спробами. Повторювати лише network error,
   timeout та HTTP `408`, `429`, `500`, `502`, `503`, `504`.
6. Надавати валідному `Retry-After` пріоритет над Exponential Backoff із
   jitter; помилки валідації, бізнес-обмеження та програмні дефекти не
   повторювати.
7. Викликати `responses.create()` через наявний OpenAI client без hardcoded
   model ID. Model ID і `max_output_tokens` беруться з конфігурації Lesson 02.
8. На кожному model turn передавати `tools`, `tool_choice: "auto"`,
   `parallel_tool_calls: false`, `store: false` і налаштований
   `max_output_tokens`.
9. Додавати назад усі придатні output items, включно з reasoning items, а
   результат інструмента повертати як `function_call_output` з тим самим
   `call_id`.
10. Повторювати model turn до фінального тексту або контрольованої terminal
    error; порожню відповідь мапити на `EMPTY_MODEL_RESPONSE`.
11. Обмежити кількість виконаних інструментів п’ятьма. Після п’ятого tool
    output фінальна відповідь дозволена, а шостий function call блокується до
    виконання з кодом `TOOL_CALL_LIMIT_REACHED`.
12. Підсумовувати usage всіх model turns і рахувати `modelCallCount`,
    `toolCallCount`, `retryCount` та `totalLatencyMs` окремо.
13. Підключити runtime до `POST /api/agent`: невалідний `message` повертає
    HTTP 400, валідний запускає агент.
14. Додайте в `my-dev/` активні offline-тести для нового runtime й перевірте
    успадковані Document API тести без змін.
    п’ять підготовлених eval cases.

## Поглиблення (необов’язково)

- `HttpRateProvider` із runtime-валідацією відповіді стороннього сервісу;
- один мінімальний ручний live smoke test після явного рішення про бюджет.

`solution/` демонструє обидва поглиблення, але Definition of Done визначається
обов’язковою частиною. Recorded replay не є live-перевіркою.

## Acceptance scenarios

| Рівень      | Сценарій                        | Очікуваний результат                            |
| ----------- | ------------------------------- | ----------------------------------------------- |
| Core        | Порожній `message`              | HTTP 400 `INVALID_INPUT`                        |
| Core        | `my-dev` до реалізації маршруту | Current-lesson route ще не створено             |
| Core        | Успішна конвертація             | `status: "success"`, `text`, `usage`, metrics   |
| Core        | Запит без потреби в інструменті | прямий текст, `toolCallCount: 0`                |
| Core        | Невалідні аргументи             | `INVALID_TOOL_ARGUMENTS`, provider не викликано |
| Core        | Невідомий tool name             | `UNKNOWN_TOOL`, provider не викликано           |
| Core        | Transient upstream error        | bounded retry та окремий `retryCount`           |
| Core        | П’ять виконаних tool calls      | фінальна відповідь у межах ліміту               |
| Core        | Шостий function call            | `TOOL_CALL_LIMIT_REACHED` до виконання          |
| Core        | Порожня фінальна відповідь      | `EMPTY_MODEL_RESPONSE`                          |
| Поглиблення | Реальний OpenAI smoke           | HTTP 200 із фактичної provider-відповіді        |

## Definition of Done

- `yarn student:test 03 openai` запускає успадковані unit-тести; зелений
  результат сам по собі не підтверджує виконання вимог Lesson 03;
- `yarn student:check 03 openai` завершується з кодом 0, а маршрут у
  `my-dev/lesson-03-function-calling/` більше не повертає `NOT_IMPLEMENTED`;
- `yarn student:eval 03 openai` проходить усі записані offline cases;
- попередні Document API tests залишаються активними й проходять;
- HTTP route, strict schema, reasoning replay, retry, error masking, ліміт і
  метрики мають regression coverage;
- `.env`, API keys, `node_modules` і приватні provider-відповіді не потрапляють
  до Git;
- model IDs не дублюються literal-рядками у маршрутах або runtime;
- канонічні `starter/` і `solution/` не змінюються під час студентської роботи.

## Здавання

Перед здаванням роботи виконуються:

```bash
yarn student:check 03 openai
git status
```

Для здачі роботи студент надає:

1. Посилання на доступний викладачу репозиторій.
2. Назву branch із виконаною роботою.
3. Commit SHA конкретної версії, що здається, або пряме посилання на цей
   commit.

Для приватного репозиторію викладачу надається read-доступ. До матеріалів здачі
додаються результати перевірок і один синтетичний HTTP-приклад для
`/api/agent`. Live-результат додається лише тоді, коли виконувався реальний
provider-запит. `.env`, API keys, tokens та інші secrets не додаються до Git.

Створювати Merge Request або Pull Request до головного репозиторію курсу для
здачі роботи не потрібно.

## Довідкові матеріали

- [Інструкція студента](student-guide.md)
- [Карта starter](starter-code-guide.md)
- [Roadmap коду](roadmap-code-guide.md)
- [Сценарій викладача](instructor-guide.md)
