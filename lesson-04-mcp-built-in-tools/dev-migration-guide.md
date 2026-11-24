# Lesson 04 – довідка про успадкування від Lesson 03 (OpenAI)

Lesson 04 є архітектурним розширенням Lesson 03. Це не міграція спільної папки `dev/`.

## Підготовка робочої папки

У [STUDENTS.md](../STUDENTS.md) запустіть Prompt 1 і виберіть Lesson 04, OpenAI. Він створює або відновлює гілку заняття та готує `my-dev/lesson-04-mcp-built-in-tools/` з канонічного `lesson-04-mcp-built-in-tools/starter/`. Залиште попередню гілку й робочу папку без змін. Не копіюйте файли попереднього студентського завдання до нового workspace вручну.

Усі зміни для цього завдання робіть у `my-dev/lesson-04-mcp-built-in-tools/`. Кореневі `package.json`, `tsconfig.lesson-04.my-openai.json`, student scripts та eval script уже адресують цю папку. Команди запускайте з кореня репозиторію. Спільний workflow міграції `dev/` для цієї студентської роботи не використовується.

## Що успадковується

Non-Markdown файли канонічного starter є байтово тотожним snapshot Lesson 03 solution. Успадкований код і його наявні імпорти залишаються без змін; новий MCP runtime створюйте лише в `my-dev/lesson-04-mcp-built-in-tools/`:

| Цільовий файл `my-dev`        | Роль після реалізації                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `src/app.ts`                  | Успадковує Express app Lesson 03; додайте research route у студентській копії.           |
| `src/server.ts`               | Перевикористовує завантаження environment, OpenAI client, Document AI та currency agent. |
| `src/evals/mcp-tools.eval.ts` | Створіть eval cases, використовуючи типи попередньої основи.                             |
| тести                         | Перевикористовують типи `DocumentAi`, `ModelTurn` і tool-calling з Lesson 03.            |

Імпорти вказують на `lesson-03-function-calling/solution/` навмисно. Вони мають правильну відносну глибину і в канонічній Lesson 04 папці, і в `my-dev/lesson-04-mcp-built-in-tools/`. Залиште їх на місці. Не дублюйте Lesson 03 реалізацію у `my-dev/` і не редагуйте Lesson 03 solution.

## Шлях до sandbox

MCP runtime має бачити лише копію sandbox у студентській папці:

```ts
const sandboxPath = resolve("my-dev", "lesson-04-mcp-built-in-tools", "sandbox");
```

Не використовуйте шлях до canonical solution sandbox і не відкривайте для сервера корінь репозиторію. `sandbox/notes.txt` містить безпечні дані для читання. `.env`, домашній каталог та інші файли мають бути за межами дозволеної директорії.

`src/runtime.ts` поєднує успадковані сервіси Lesson 03 із новим MCP client і research agent. `src/app.ts` додає маршрут, зберігаючи попередні endpoints. `src/server.ts` закриває MCP client під час зупинки HTTP-сервера. Повний код і адаптація шляху є в [roadmap](./roadmap-code-guide.md).

## Environment і команди

Застосунок читає кореневий `.env` через environment schema Lesson 03. Для live-запуску сервера потрібні `OPENAI_API_KEY`, `OPENAI_MODEL_FAST` і `OPENAI_MODEL_MAIN` навіть до надсилання research-запиту. Залишайте секрети локальними й untracked.

Офлайн-команди студента не потребують `.env` і не викликають OpenAI:

```powershell
yarn student:test 04 openai
yarn student:eval 04 openai
yarn student:build 04 openai
yarn student:check 04 openai
```

`student:test` може пройти на успадкованому baseline; завершення Lesson 04 підтверджує лише `student:check` після реалізації дельти.
