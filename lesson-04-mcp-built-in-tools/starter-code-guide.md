# Lesson 04 – огляд starter (OpenAI)

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Створити в `my-dev` локальний MCP filesystem transport і hosted пошук поверх успадкованої Lesson 03 основи.

### 💎 Практична цінність застосунку

Канонічний starter є байтово тотожним non-Markdown snapshot Lesson 03 solution. Health, Document API та currency agent вже працюють; нового research route в starter немає.

### ⚙️ Що робить застосунок

`LocalMcpClient` запускає filesystem server в sandbox, а `McpWebSearchAgent` передає моделі лише allowlisted local tool та hosted `web_search`.

Один раз виконайте `yarn student:init 04 openai`; команда копіює starter до `my-dev/lesson-04-mcp-built-in-tools/` і не перезаписує наявну роботу. Поточну тему реалізуйте лише в цій робочій копії.

## Що вже працює

- `src/app.ts` успадковує Express app Lesson 03. Додайте в студентській копії `POST /api/agent/research`; невалідний ввід має повертати HTTP 400.
- `src/server.ts` завантажує root environment і створює Lesson 03 Document AI та currency agent. MCP client ще не запускається.
- Health, Document API та currency routes Lesson 03 успадковуються через імпорти й мають залишитися працездатними.
- `sandbox/notes.txt` – додайте безпечний приклад локального файла в студентську копію; runtime має обмежити filesystem server цією sandbox-папкою.
- `evals/` – додайте п’ять типізованих кейсів, записані observations, scorer і offline runner у студентську копію. Зберігайте case ID та observations узгодженими.

## Початкові тести

`student:test` запускає успадкований unit baseline. Поточні MCP tests та evals створюються лише в `my-dev/lesson-04-mcp-built-in-tools/`; `student:check` вимагає реалізовану дельту й відсутність `todo`, `skip` та `only`.

## Карта файлів

| Шлях в вашій `my-dev` папці            | Призначення                                                              |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `src/app.ts`                           | Успадкований app Lesson 03; додайте research route.                      |
| `src/server.ts`                        | Готові OpenAI, environment, Document AI та currency wiring.              |
| `src/mcp/filesystem-client.ts`         | Нове stdio-з’єднання з filesystem MCP server.                            |
| `src/mcp/filesystem-tools.ts`          | Allowlist для моделі, перевірка аргументів та безпечні function outputs. |
| `src/services/mcp-web-search-agent.ts` | Responses API tools, hosted пошук та обмежений локальний tool round.     |
| `src/runtime.ts`                       | Composition і закриття MCP ресурсу.                                      |
| `tests/app.test.ts`                    | Перевірки успадкованих routes та research request.                       |
| `tests/filesystem-tools.test.ts`       | Створіть активні adapter tests у студентській копії.                     |
| `tests/mcp-web-search-agent.test.ts`   | Створіть активні agent tests у студентській копії.                       |
| `tests/evals.test.ts` та `evals/*`     | Додайте п’ять кейсів, recorded replay та scorer у студентській копії.    |
| `sandbox/notes.txt`                    | Додайте безпечний локальний тестовий файл у студентській копії.          |

## Контракти, які треба зберегти

1. Модель бачить function tool `read_text_file` та hosted `{ type: "web_search" }`, а не сирий список MCP tools.
2. Adapter повторно перевіряє назву перед MCP викликом і не повертає сирий текст відмови, в якому може бути абсолютний шлях.
3. Кожен локальний function call отримує `function_call_output` із тим самим `call_id`.
4. Наступний Responses запит містить усі output items першої відповіді перед локальними outputs. Навчальний runtime виконує лише один local-tool раунд.
5. Unit-тести використовують fakes для Responses client і MCP client. Вони не викликають OpenAI й не запускають реальний MCP server.

Якщо незрозумілі успадковані імпорти, дивіться [довідку про успадкування](./dev-migration-guide.md). Повні payload-и реалізації наведено в [roadmap](./roadmap-code-guide.md), а команди студента – в [student-guide.md](./student-guide.md).
