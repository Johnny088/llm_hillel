# Посібник студента – Lesson 04: MCP та вбудовані інструменти (OpenAI)

**Робочий контракт студента.** Non-Markdown файли канонічного `starter/` байтово тотожні OpenAI `solution/` Lesson 03. Промпт 1 одноразово створює копію через `yarn student:init 04 openai`; повторно ініціалізувати наявну папку не потрібно. Виконуйте вимоги Lesson 04 лише в `my-dev/lesson-04-mcp-built-in-tools/`. Зелені успадковані тести підтверджують попередню основу, а не завершення поточної теми. Повний критерій завершення перевіряє `yarn student:check 04 openai`.

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Додати дослідження локальних текстових джерел і web search через обмежений набір інструментів.

### 💎 Практична цінність застосунку

MCP transport не дає автоматичного доступу до всієї машини: root directory і allowlist обмежують допустиме читання.

### ⚙️ Що робить застосунок

Маршрут research з’єднує локальний `read_text_file` і hosted `web_search`, збирає citations і повертає контрольовану відповідь.

Цей маршрут веде від підготовки робочої папки до перевірки і здачі. [homework.md](./homework.md) визначає обов’язковий результат.

## 1. Підготуйте робоче місце

Запустіть Prompt 1 зі [STUDENTS.md](../STUDENTS.md) і виберіть Lesson 04, OpenAI. Він вже створює `my-dev/lesson-04-mcp-built-in-tools/` через `yarn student:init 04 openai`. Далі продовжуйте роботу в цій папці без повторної ініціалізації. Лише якщо папка відсутня, одноразово виконайте цю команду з кореня репозиторію; вона не перезаписує наявну роботу. Дотримуйтеся гілки й стану Git, які підтвердив Prompt 1. Працюйте лише в своїй `my-dev/` папці.

## 2. Прочитайте вимоги й виконайте roadmap

Канонічний `starter/` є байтово тотожним non-Markdown snapshot Lesson 03 solution. Успадковані Document API та currency agent залишаються активними; filesystem MCP transport, hosted search і research route створіть лише в `my-dev/lesson-04-mcp-built-in-tools/`.

## 3. Запустіть офлайн-перевірки

З кореня репозиторію доступні готові команди для цієї `my-dev/` папки:

```powershell
yarn student:test 04 openai
yarn student:eval 04 openai
yarn student:build 04 openai
yarn student:check 04 openai
```

`student:test` запускає unit suite кандидата; успадкований зелений baseline не доводить завершення Lesson 04. `student:check` додатково перевіряє поточну дельту, типи, lint, форматування, активні тести, recorded eval та build. Offline replay не перевіряє live OpenAI чи реальний MCP transport. Необов’язковий локальний MCP smoke описано в [roadmap](./roadmap-code-guide.md).

## 4. Підготуйте здачу

Запустіть Prompt 2 зі [STUDENTS.md](../STUDENTS.md). Передайте гілку, commit SHA та посилання саме на папку `my-dev/lesson-04-mcp-built-in-tools/`. Перед здачею повторіть `yarn student:check 04 openai` і перевірте `git status`.

## Необов’язкові live-перевірки

Реальний локальний MCP smoke не викликає OpenAI, але запускає filesystem subprocess. Щоб виконати його, додайте необов’язковий P10 зі roadmap і з кореня репозиторію запустіть:

```powershell
node scripts/run-tsx-entrypoint.mjs my-dev/lesson-04-mcp-built-in-tools/scripts/smoke-filesystem-mcp.ts
```

Live-запит до OpenAI не є частиною критеріїв готовності. Якщо хочете його запустити, створіть локальний кореневий `.env` із `.env.example` та задайте `OPENAI_API_KEY`, `OPENAI_MODEL_FAST` і `OPENAI_MODEL_MAIN`. Не додавайте ключ до Git. Запуск сервера:

```powershell
yarn student:dev 04 openai
```

В іншому терміналі надішліть синтетичний запит, який може витратити квоту:

```powershell
$body = @{ message = "Прочитай notes.txt у sandbox-папці" } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri http://localhost:3000/api/agent/research -Method Post -ContentType "application/json; charset=utf-8" -Body $body
```

Зупиніть сервер через `Ctrl+C`. Запишіть результат окремо. Якщо live-запуск пропущено, вкажіть `NOT RUN`.
