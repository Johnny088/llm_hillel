# Starter code guide – Lesson 03 OpenAI

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Додати currency function calling поверх готового Document API Lesson 02.

### 💎 Практична цінність застосунку

Starter уже містить успадковані HTTP-маршрути, схеми, adapter і usage; реалізується лише нова дельта агента та його інструмента.

### ⚙️ Що робить застосунок

Модель отримує опис `convert_currency`; застосунок перевіряє `amount`, `from` і `to`, а тоді передає виклик `RateProvider` або повертає структуровану помилку.

Ця довідка описує базовий код і цільові файли в `my-dev/lesson-03-function-calling/`. Один раз створіть робочу копію командою `yarn student:init 03 openai`; вона не перезаписує вже наявну роботу.

## Що вже є

Starter продовжує завершений OpenAI Document API з Lesson 02. Успадковані маршрути extraction і streaming, конфігурація клієнта та моделей, Zod-схеми, usage metrics, error mapping і записані extraction evals. Повторно реалізовувати або редагувати цей код для Lesson 03 не потрібно.

Канонічний starter є точним non-Markdown snapshot Lesson 02 solution, тому нового маршруту `POST /api/agent` у ньому немає. Створіть його в `my-dev/lesson-03-function-calling/`: невалідне або порожнє `message` має відхилятися з HTTP 400 до запуску агента, а валідне повідомлення передається реалізованому Responses tool-calling runtime.

У таблиці наведені цільові файли студентської копії, а не файли поточної теми в канонічному starter.

## Карта файлів

| Шлях у `my-dev` після `student:init`    | Призначення                                                 |
| --------------------------------------- | ----------------------------------------------------------- |
| src/app.ts                              | Успадковані маршрути; додайте HTTP-маршрут агента           |
| src/server.ts                           | Успадкований OpenAI client і composition сервера            |
| src/schemas/agent-request.ts            | Створіть схему й нормалізацію message для нового маршруту   |
| src/services/document-ai.ts             | Успадкований інтерфейс Document API, залиште сумісним       |
| src/config/env.ts, src/config/models.ts | Успадкована OpenAI-конфігурація та централізований model ID |
| src/lib/metrics.ts                      | Успадкована нормалізація та підсумовування usage            |
| tests/tool-calling.test.ts              | Додайте активні сценарії нового runtime                     |
| evals/tool-calling.eval.ts              | Цільові сценарії оцінювання Lesson 03                       |
| evals/recorded-tool-results.ts          | Записані результати для офлайн-перевірки scorer             |
| evals/run-tool-calling.ts               | Runner для recorded режиму та окремого opt-in live режиму   |

Перевірте фактичні шляхи в my-dev README. Не додавайте студентський код до канонічних starter чи solution.

## Вимоги до нового runtime

- Zod 4 схема нормалізує trim/uppercase для трилітерних ASCII-кодів, вимагає додатну суму і відхиляє зайві поля. Згенерований Responses tool має strict=true, additionalProperties=false та всі обов'язкові поля в required.
- Provider не викликається для некоректних аргументів або невідомої назви tool. Непідтримувана пара має стабільну неповторювану помилку.
- Retry повторює лише тимчасові мережеві помилки, timeout та визначені HTTP статуси. Валідний Retry-After має пріоритет над локальним exponential backoff із jitter.
- Внутрішні тексти й stack traces не виходять через HTTP або tool output.
- Responses loop зберігає reasoning output, передає function_call_output із тим самим call_id та окремо рахує model, tool і retry counters.
- П'ятий tool output можна завершити фінальною відповіддю, а шостий виклик блокується до provider execution.
- HTTP-маршрут перевіряє message до запуску runtime.

`homework.md` перелічує повний error taxonomy та acceptance cases. Скористайтеся цією довідкою як картою, а `roadmap-code-guide.md` – як покроковим планом реалізації. Точний код попередньої основи доступний у `starter/` і `solution/` Lesson 02.

## Offline та локальна перевірка

З кореня репозиторію перевірте успадковану основу та поточну роботу:

```powershell
yarn student:test 03 openai
yarn student:eval 03 openai
yarn student:build 03 openai
yarn student:check 03 openai
```

`student:test` може бути зеленим до початку Lesson 03, бо запускає успадковані unit-тести. Завершення підтверджує лише `student:check`, який вимагає реалізовану дельту, активні тести без `todo`, `skip` та `only`, eval і build. Новий маршрут перевіряйте в `my-dev` після реалізації.
