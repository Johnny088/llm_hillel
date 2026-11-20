# Dev migration guide – Lesson 03 OpenAI

Ця довідка пояснює, як код Lesson 03 спирається на попередню практику. Вона не переносить вашу стару роботу в нову гілку. Для кожного заняття Prompt 1 створює окрему student branch від актуального main і копіює тільки вибраний starter у відповідну папку my-dev.

## Походження starter

Канонічний ланцюжок коду такий:

```text
lesson-02-llm-api/solution
          ↓ створення курсового snapshot
lesson-03-function-calling/starter
          ↓ Prompt 1 копіює в студентську робочу папку
my-dev/lesson-03-function-calling
```

Non-Markdown файли Lesson 03 starter байтово тотожні Lesson 02 solution. Успадковані Document API routes вже працюють; додатково переносити попередню студентську папку або змінювати маршрути не потрібно. Function Calling код створюється лише в `my-dev/lesson-03-function-calling/`.

## Що зберігається

Залиште наявні частини без змін, якщо homework.md не вимагає іншого:

| Успадкований шар                  | Що він уже забезпечує                                            |
| --------------------------------- | ---------------------------------------------------------------- |
| OpenAI adapter та DocumentAi      | Structured Output і streaming через Responses API                |
| config/env.ts та config/models.ts | перевірку середовища й централізоване вибирання fast/main model  |
| schemas і lib/metrics.ts          | перевірені HTTP-входи, usage metrics, обчислення вартості        |
| app.ts Document routes            | POST /api/documents/extract і POST /api/documents/summary/stream |
| app.test.ts та evals              | regression tests і записані extraction cases                     |

Код Lesson 03 додає новий маршрут і окремий runtime. Не переписуйте OpenAI adapter заради tool calling і не змінюйте контракти двох успадкованих маршрутів.

## Новий шар Lesson 03

У вашій копії додайте:

1. strict Zod schema та Responses tool definition для convert_currency;
2. локальний RateProvider, повторну safeParse валідацію аргументів і безпечні tool outputs;
3. доменні tool errors та bounded retry із timeout, jitter і підтримкою Retry-After;
4. Responses loop, який зберігає всі output items, повертає function_call_output із відповідним call_id та рахує usage і runtime metrics;
5. підключення агента до POST /api/agent і активні offline regression tests.

Перевірте точні кроки й якорі у [roadmap-code-guide.md](./roadmap-code-guide.md). Обов'язкові сценарії задає [homework.md](./homework.md).

## OpenAI Responses API – поля цього треку

У цьому треку SDK викликає responses.create(). Історія подається як input, запит функції повертається як function_call, ідентифікатором слугує call_id, а результат передається як function_call_output. Обмеження відповіді має назву max_output_tokens. Tool calling запитує tool_choice: auto, забороняє паралельні виклики через parallel_tool_calls: false і використовує store: false.

Ці поля не можна механічно замінювати полями Chat Completions з OpenRouter-гайдів. Зокрема messages, tool_calls[], tool_call_id, max_completion_tokens та reasoning_details належать іншому API-контракту.

## Перевірка переходу

Після Prompt 1 перевірте, що student README показує:

- гілку lesson-03-function-calling;
- папку my-dev/lesson-03-function-calling;
- джерело копії lesson-03-function-calling/starter;
- команди `yarn student:init 03 openai`, `student:test`, `student:eval`, `student:build`, `student:dev` і `student:check`.

Працюйте тільки в my-dev/lesson-03-function-calling. Offline тести й recorded evals не потребують OpenAI key. Ключ у локальному root .env потрібен лише для запуску сервера та реального запиту; не додавайте його до Git.

Не використовуйте dev-manager, dev:next, стару student branch, OpenRouter solution чи канонічну solution як джерело файлів. Це інший навчальний workflow і він може змінити базу роботи.
