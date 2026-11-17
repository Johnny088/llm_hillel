# Практична робота — Lesson 02 (OpenRouter)

## Типізований Document API через OpenRouter

Новий starter концептуально продовжує завершений
`lesson-01-intro-openrouter/solution/`: CLI перетворюється на HTTP API. Новий
package не створюється: використовуються спільні залежності, lockfile, lint,
format, typecheck і test runner кореневого репозиторію.

**API (Application Programming Interface)** — програмний інтерфейс застосунку.
**SSE (Server-Sent Events)** — формат іменованих подій у тривалому
HTTP-з'єднанні. **Structured Output** — JSON-відповідь, форму якої обмежує
JSON Schema на боці моделі та повторно перевіряє локальна Zod-схема.

## Результат

Реалізуються два маршрути:

1. `POST /api/documents/summary/stream` — потоковий підсумок через іменовані SSE-події.
2. `POST /api/documents/extract` — структурований JSON із полями `names`,
   `dates`, `locations`, `summary` через `response_format: json_schema`.

## Основна частина (обов'язково)

1. Реалізувати OpenRouter adapter без hardcoded model IDs
   (OpenAI SDK + `baseURL: https://openrouter.ai/api/v1`).
2. Передати `stream: true` і `max_completion_tokens` в streaming-запит та прочитати usage
   з фінального chunk; `response_format: json_schema` — у extraction. Параметр
   `stream_options.include_usage` не використовується, оскільки OpenRouter
   позначає його застарілим і повертає usage автоматично.
   Для extraction додати `provider.require_parameters: true`, щоб OpenRouter не
   обрав endpoint без підтримки Structured Output.
3. Для коротких summary та extraction встановити `temperature: 0`, reasoning
   effort `low` і `exclude: true`. Низький рівень залишає більшу частину
   вихідного ліміту під результат, зменшує latency та витрати.
4. Реалізувати typed streaming events, named SSE-події та однозначні terminal
   states без `done` після помилки.
5. Після structured response виконати обов'язковий локальний `JSON.parse` і
   `ExtractionSchema.safeParse`.
6. Окремо обробити refusal, incomplete, timeout і parsed-result failure.
7. Повернути `model`, input/output/total tokens і загальну latency.
8. Замінити всі starter `it.todo` (12) тестами без мережевих викликів.
9. Перевірити п'ять підготовлених offline eval cases; scorer для `summary` не
   повинен залежати від exact string match.

## Поглиблення (необов'язково)

- скасувати upstream stream після закриття клієнтського з'єднання;
- додати TTFT (Time to First Token, час до першого фрагмента), cache metrics і
  явний стан недоступної ціни;
- зареєструвати ціну моделі у `MODEL_PRICES` тільки після перевірки через
  публічний каталог OpenRouter;
- виконати live-перевірку публічного каталогу без inference-запитів
  (`yarn eval:lesson02:openrouter:solution:catalog`).

`solution/` демонструє і основну частину, і поглиблення. Для базового Definition
of Done достатньо основної частини.

## Acceptance scenarios

| Рівень      | Сценарій                         | Очікуваний результат               |
| ----------- | -------------------------------- | ---------------------------------- |
| Core        | Порожній або відсутній `content` | HTTP 400 `INVALID_INPUT`           |
| Core        | Завеликий JSON body              | HTTP 413 `PAYLOAD_TOO_LARGE`       |
| Core        | Невалідний JSON                  | HTTP 400 `MALFORMED_JSON`          |
| Core        | Успішна екстракція               | `data`, `usage`, `metrics`         |
| Core        | Відсутня сутність                | відповідний масив `[]`             |
| Core        | Incomplete generation            | контрольована помилка без `done`   |
| Core        | Refusal                          | HTTP 422 або SSE `REQUEST_REFUSED` |
| Core        | Timeout                          | HTTP 504 або SSE `GATEWAY_TIMEOUT` |
| Поглиблення | Закриття SSE-клієнта             | upstream request скасовано         |
| Поглиблення | Невідома ціна моделі             | `estimatedCostUsd: null`           |

Сценарій відсутньої сутності перевіряється окремим offline adapter test. Він викликає `OpenRouterDocumentAi.extract()` із підміненою відповіддю `chat.completions.create` та підтверджує, що для непорожнього документа без імен, дат і локацій адаптер повертає три масиви `[]` і непорожній `summary`. Це перевірка локального adapter contract без provider calls.

## Definition of Done

- `yarn test:my:lesson02:openrouter` не містить `todo` і перевіряє власну реалізацію;
- suite містить offline adapter test для відсутніх сутностей із непорожнім `summary`;
- `yarn check:my:lesson02:openrouter` завершується з кодом 0 для студентської папки;
- `yarn eval:my:lesson02:openrouter` виконує всі п'ять підготовлених offline eval cases на записаних даних;
- offline eval не є доказом роботи адаптера або доступності live-провайдера;
- `.env`, API keys, `node_modules` і повні вхідні документи не потрапляють до
  Git;
- README містить команди, приклади success/error response і відомі обмеження;
- у маршрутах немає literal model IDs;
- solution не змінюється під час виконання student starter;
- непідтверджені параметри (`reasoning`, `response_format`) не надсилаються
  моделі без реєстрації в `MODEL_CAPABILITIES`.

## Контрольна точка фінального проєкту

Додається файл із 2–3 можливими темами. Для кожної теми фіксуються проблема,
цільовий користувач, очікуваний результат агента, джерела даних і ризики.

## Здавання

Перед здаванням роботи виконуються:

```bash
yarn check:my:lesson02:openrouter
yarn eval:my:lesson02:openrouter
git status
```

Для здачі роботи студент надає:

1. Посилання на доступний викладачу репозиторій.
2. Назву branch із виконаною роботою.
3. Commit SHA конкретної версії, що здається, або пряме посилання на цей
   commit.

Для приватного репозиторію викладачу надається read-доступ. До матеріалів здачі
додаються результати перевірок і один приклад синтетичного HTTP-запиту.
Результати необов'язкового live eval додаються лише тоді, коли він запускався.
`.env`, API keys, tokens та інші secrets не додаються до Git.

Створювати Merge Request або Pull Request до головного репозиторію курсу для
здачі роботи не потрібно.
