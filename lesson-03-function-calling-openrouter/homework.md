# Lesson 03 (OpenRouter) – домашнє завдання

## Мета й межа практики

Додати виклик інструмента до завершеного застосунку Lesson 02. Модель повертає назву функції та JSON-аргументи; сервер валідує дані, виконує лише зареєстрований інструмент і повертає його результат моделі для фінальної відповіді.

Канонічний `starter/` починається з фізично успадкованого `lesson-02-llm-api-openrouter/solution`. Усі 25 source, test і eval файлів збігаються байт у байт, як і всі інші успадковані Markdown/data файли, окрім двох документованих винятків: `starter/README.md` називає Lesson 03, а `starter/evals/README.md` адаптує лише посилання/команди extraction eval до Lesson 03 target. Структурної міграції немає. Попередні `/health`, document extraction, summary streaming, їхні тести та extraction eval залишаються робочими.

Початкова копія не містить нового маршруту, tool-calling коду, тестів чи eval. Студент додає їх крок за кроком лише у власній папці `my-dev/lesson-03-function-calling-openrouter/`. Успадковані тести перевіряють базу Lesson 02, а окремий completion gate має відхилити незмінений starter. Відсутність TODO у базі не означає, що Lesson 03 завершено.

## Зв'язок із лекцією

Лекція показує tool calling у термінах OpenAI Responses API. OpenRouter реалізація використовує сумісний Chat Completions API. Семантика однакова, але поля запиту й історія повідомлень мають іншу форму:

| Поняття               | Responses API у лекції | OpenRouter у практиці                     |
| --------------------- | ---------------------- | ----------------------------------------- |
| Виклик API            | `responses.create()`   | `chat.completions.create()`               |
| Опис функції          | `zodResponsesFunction` | `zodFunction` та JSON Schema              |
| Розмова               | `input` і output items | масив `messages`                          |
| Виклик моделі         | `function_call`        | `assistant.tool_calls[]`                  |
| Ідентифікатор         | `call_id`              | `tool_calls[].id`                         |
| Результат інструмента | `function_call_output` | `{ role: "tool", tool_call_id, content }` |
| Обмеження відповіді   | `max_output_tokens`    | `max_completion_tokens`                   |

Не копіюйте Responses API поля в OpenRouter request. Один запит використовує одну налаштовану модель; автоматичного переходу на іншу модель немає. Не надсилайте `parallel_tool_calls`: код виконує отримані виклики послідовно. `reasoning_details`, якщо провайдер їх повернув, зберігаються в assistant turn для наступного запиту й не потрапляють до HTTP-відповіді.

## Обов'язковий результат

Успішний `POST /api/agent` виконує керований цикл:

1. Валідовує непорожнє поле `message` і додає system instruction.
2. Надсилає `tools`, `tool_choice: "auto"`, `temperature: 0`, `max_completion_tokens` та `provider.require_parameters: true` до налаштованої OpenRouter моделі.
3. Перевіряє назву функції й JSON-аргументи через Zod до будь-якого локального виконання.
4. Виконує лише `convert_currency` із навчальними фіксованими курсами; це не актуальні ринкові котирування.
5. Додає повний assistant turn і результат із відповідним `tool_call_id` до `messages`, після чого продовжує діалог.
6. Завершує цикл текстом або безпечною контрольованою помилкою. П'ятий інструмент може виконатися; шостий відхиляється до виконання.
7. Повертає безпечний error code та потрібні usage/metrics. Provider body, ключ, stack trace і внутрішній reasoning не повертаються клієнту.

Потрібно створити: `src/schemas/agent-request.ts`, `src/tools/currency.ts`, `src/lib/tool-errors.ts`, `src/lib/retry.ts`, `src/services/tool-calling-agent.ts`, активні `tests/tool-calling.test.ts`, `tests/agent-route.test.ts`, `tests/tool-evals.test.ts` і чотири tool-calling eval files. Також потрібно відкрити inherited `mapOpenRouterError` як named export, доповнити `src/app.ts` і `src/server.ts`, додати відсутній `sumUsageMetrics` у `src/lib/metrics.ts` за окремим APPEND кроком та оновити `README.md` і `evals/README.md` під student-specific commands. У roadmap для кожного файла наведено точний шлях, дію створення або унікальний якір, код, перевірку, очікуваний результат і спосіб виправити саме поточний крок, зберігаючи вже перевірені зміни.

## Критерії приймання

Обов'язкові локальні сценарії перевіряють:

- порожній або невалідний запит повертає HTTP 400 `INVALID_INPUT`;
- успішна конвертація повертає текст, модель, usage і metrics;
- модель може відповісти текстом без виклику інструмента;
- аргументи проходять строгий schema validation до executor;
- невідома функція, невалідний JSON, помилка провайдера й порожня відповідь мають стабільні безпечні коди;
- послідовний tool loop завершується, а шостий виклик не виконується;
- assistant tool-call turn та відповідні tool result повідомлення зберігають API-контракт;
- offline eval проходить на записаних фікстурах без мережі.

У unit, route та eval tests мають бути синтетичні відповіді й локальні залежності. Live OpenRouter запит не є вимогою Definition of Done. Recorded eval і локальний HTTP smoke не доводять live-доступність моделі.

## Definition of Done

- Реалізація й нові перевірки знаходяться тільки в `my-dev/lesson-03-function-calling-openrouter/`.
- `yarn student:test 03 openrouter` завершується без failed, todo чи skipped tests.
- `yarn student:check 03 openrouter` відхиляє незмінений destination; після реалізації проходить scoped gates та solution acceptance tests на fixture копії фактичного student source.
- `yarn student:eval 03 openrouter` проходить потрібні offline evals.
- Перевірки звертаються до фактичного студентського source-коду й не імпортують готовий solution замість нього.
- Успадковані файли Lesson 02 залишаються без змін.
- `.env`, ключі, `node_modules` і повні вхідні документи не додаються до Git.

## Студентський маршрут і здача

В Промпті 1 зі [STUDENTS.md](../STUDENTS.md) підготуйте окрему чисту гілку `lesson-03-function-calling-openrouter` від актуального `main`. Промпт 1 вже запускає `yarn student:init 03 openrouter` і створює `my-dev/lesson-03-function-calling-openrouter/` з canonical starter. Після цього робота продовжується в створеній папці без повторної ініціалізації. Лише якщо папка відсутня, одноразово виконайте цю команду з кореня репозиторію; вона відмовляється перезаписувати наявну роботу. `starter/` та `solution/` залишаються незмінними canonical snapshots. Приватний викладацький маршрут через спільну папку `dev/` не є студентським сценарієм.

Перед здачею виконайте:

```powershell
yarn student:test 03 openrouter
yarn student:eval 03 openrouter
yarn student:check 03 openrouter
git status --short
```

Надайте посилання на репозиторій, назву гілки, commit SHA та результати offline перевірок. Не додавайте секрети. Live-запит зазначайте окремо лише тоді, коли він був добровільно запущений.
