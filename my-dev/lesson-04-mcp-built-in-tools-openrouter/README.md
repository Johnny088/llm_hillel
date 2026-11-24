# Lesson 04 OpenRouter – завершена практика

Застосунок зберігає API заняття 03 і додає локальний файловий Model Context Protocol (MCP) та вебпошук OpenRouter. Маршрут `POST /api/agent/research` приймає JSON із `message` і повертає `status`, `text`, `model`, `usage` та `metrics`. Графічного інтерфейсу немає.

## Перевірка без запитів до моделі

З кореня репозиторію, де лежить `package.json`, виконується:

```powershell
yarn check:my:lesson04:openrouter
```

Очікуються зелені перевірки типів, lint, форматування, тести без failed/todo/skipped, три записані eval-набори по 5/5 та `PASS filesystem MCP`. Completion gate запускає додаткові тести проти фактичного коду цієї папки. Записані відповіді не підтверджують поточну доступність провайдера.

Окремі локальні перевірки:

```powershell
node scripts/run-tsx-entrypoint.mjs my-dev/lesson-04-mcp-built-in-tools-openrouter/evals/run.ts --mode=all
node scripts/run-tsx-entrypoint.mjs my-dev/lesson-04-mcp-built-in-tools-openrouter/evals/run-tool-calling.ts
node scripts/run-tsx-entrypoint.mjs my-dev/lesson-04-mcp-built-in-tools-openrouter/scripts/smoke-filesystem-mcp.ts
```

Перші дві команди відтворюють записані дані. Третя запускає справжній filesystem MCP server через Node.js і stdio, читає синтетичний дозволений файл, перевіряє відмову поза каталогом та для недозволеного інструмента, закриває client і transport та очікує завершення дочірнього процесу. Тимчасові файли прибираються після перевірки.

## Необов’язкова HTTP-демонстрація з моделлю

Потрібен власний `OPENROUTER_API_KEY` у кореневому `.env`. Research-запит викликає модель і може витрачати баланс, навіть коли запит стосується лише локального файла. Цей запуск не входить до перевірки без провайдера.

У першому терміналі з кореня репозиторію запускається:

```powershell
node scripts/run-tsx-entrypoint.mjs my-dev/lesson-04-mcp-built-in-tools-openrouter/src/server.ts
```

Процес продовжує працювати до зупинки. MCP server отримує доступ лише до `sandbox/` цієї робочої папки; параметр runtime `allowedDirectory` задає інший дозволений каталог у контрольованому сценарії. Модель бачить тільки `read_text_file`.

У другому терміналі надсилається:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/agent/research -ContentType 'application/json' -Body '{"message":"Прочитай notes.txt і коротко підсумуй його."}'
```

Очікується відповідь із `status`, текстом і метриками. Текст та числові значення залежать від моделі. `Ctrl+C` у першому терміналі закриває HTTP server і його MCP subprocess. Вебпошук виконується на стороні OpenRouter окремо від локального файлового MCP.

## Походження коду та відновлення

Початкова папка є фізичною копією solution заняття 03. Після виконання roadmap нові модулі, маршрут, тести й eval додаються локально; імпортів готового solution немає. Початковий зелений набір підтверджує лише справність успадкованої основи, а кількість сценаріїв записуйте за фактичним підсумком runner-а.

Подальші дії та точні кроки наведені в [roadmap](./roadmap-code-guide.md), а захист наявної роботи – у [гайді підготовки](./dev-migration-guide.md). Якщо перевірка падає, досліджується перший названий файл або assertion; робоча папка не перезаписується готовим solution.
