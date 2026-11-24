# Lesson 04 – сценарій викладача

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Показати одночасне використання локального filesystem MCP tool та hosted `web_search` із різними межами доступу.

### 💎 Практична цінність застосунку

Allowlist, sandbox directory й повторна перевірка перед локальним викликом обмежують доступ до файлів, а hosted пошук повертає зовнішні джерела окремим каналом.

### ⚙️ Що робить застосунок

`POST /api/agent/research` запускає `McpWebSearchAgent`, отримує доступні локальні tools, дозволяє `read_text_file` та `web_search`, а потім повертає зведену відповідь із sources.

## План демонстрації

1. Відкрийте `solution/sandbox/notes.txt` і покажіть його як synthetic документ, доступний із дозволеної sandbox-папки локального MCP server.
2. Прослідкуйте `LocalMcpClient.listTools()` → `createMcpFunctionTools()` → `executeMcpToolCall()`. До model tool list потрапляє лише `read_text_file`.
3. Перевірте, що executor знову перевіряє tool name та JSON arguments безпосередньо перед `client.callTool()`.
4. Відокремте hosted `web_search` в Responses API від локального filesystem subprocess; в них різні джерела й права.
5. Покажіть контрольовану помилку для шляху поза sandbox і для MCP сервера без потрібного allowlisted tool.

## Питання з очікуваними відповідями

- **Який filesystem tool доступний моделі?** Лише `read_text_file`; discovery, write та інші назви відфільтровуються.
- **Чому schema від моделі недостатньо?** Модельний tool choice не є серверною межею доступу; локальний allowlist перевіряється повторно до виклику.
- **Що доводить recorded eval?** Лише scorer на п’яти збережених observations. Він не запускає MCP subprocess чи live OpenAI запит.
- **Як окремо перевірити transport?** За потреби запустити `yarn smoke:lesson04:mcp:solution`; це локальний smoke для готового solution.

## Підготовка й перевірки

Канонічний starter є байтово тотожним non-Markdown snapshot Lesson 03 solution; він ще не має MCP-додатків Lesson 04. Для демонстрації готового результату прочитайте `solution/src/mcp/filesystem-tools.ts`, `solution/src/mcp/filesystem-client.ts`, `solution/src/services/mcp-web-search-agent.ts` та відповідні tests. З кореня запускайте `yarn test:lesson04:solution`, `yarn eval:lesson04:solution` та `yarn check:lesson04:solution`.

[Карта starter](starter-code-guide.md) · [Roadmap коду](roadmap-code-guide.md) · [Student guide](student-guide.md) · [Homework](homework.md).
