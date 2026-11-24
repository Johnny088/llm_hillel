# Lesson 04 – домашнє завдання (OpenAI)

**Робочий контракт студента.** Non-Markdown файли канонічного `starter/` байтово тотожні OpenAI `solution/` Lesson 03. Промпт 1 одноразово створює копію через `yarn student:init 04 openai`; повторно ініціалізувати наявну папку не потрібно. Виконуйте вимоги Lesson 04 лише в `my-dev/lesson-04-mcp-built-in-tools/`. Зелені успадковані тести підтверджують попередню основу, а не завершення поточної теми. Повний критерій завершення перевіряє `yarn student:check 04 openai`.

## Мета

Розширити застосунок Lesson 03 через локальний filesystem MCP-клієнт і hosted tool `web_search` у Responses API. Агент має вибирати між читанням дозволеного локального матеріалу та пошуком в інтернеті відповідно до запиту.

## Робоча папка

Запустіть Prompt 1 зі [STUDENTS.md](../STUDENTS.md) і виберіть Lesson 04, OpenAI. Він вже створює `my-dev/lesson-04-mcp-built-in-tools/` через `yarn student:init 04 openai`. Далі продовжуйте роботу в цій папці без повторної ініціалізації. Лише якщо папка відсутня, одноразово виконайте цю команду з кореня репозиторію; вона не перезаписує наявну роботу. Усі зміни робіть лише там. Не редагуйте канонічні `starter/`, `solution/`, спільний `dev/`, попередні заняття чи кореневі конфігурації.

## Обов’язкова поведінка

- Збережіть маршрути `/health`, Document API та currency agent із Lesson 03 через готові імпорти.
- Підключіть `@modelcontextprotocol/server-filesystem` через MCP SDK і `StdioClientTransport` з підтримкою Windows та POSIX.
- Дозвольте серверу бачити лише `my-dev/lesson-04-mcp-built-in-tools/sandbox/`.
- Відфільтруйте raw MCP discovery до read-only `read_text_file`. Не передавайте моделі `list_allowed_directories`, write tools чи будь-які інші знайдені tools. Повторно перевіряйте allowlist безпосередньо перед кожним `client.callTool()`.
- Передавайте hosted пошук OpenAI як `{ type: "web_search" }` у масиві `tools`. Залиште `tool_choice: "auto"`, щоб модель вибирала інструмент за запитом.
- Перевіряйте аргументи function call до MCP-виклику. Повертайте `function_call_output` із початковим `call_id`. Нормалізуйте відмову в доступі та інші помилки MCP без повернення чи логування абсолютних шляхів, аргументів або сирого тексту помилки.
- Для наступного Responses turn передавайте всі output items першої відповіді, а потім локальні function outputs. Виконуйте лише один раунд локальних MCP-викликів; наступний раунд блокуйте без виконання.
- Додайте п’ять eval cases із розподілом очікувань: два локальні читання, два web search і одна відмова. Unit-тести мають використовувати fakes і не надсилати OpenAI API-запитів.

## Критерії готовності

Запустіть команди з кореня репозиторію:

```powershell
yarn prettier --write "my-dev/lesson-04-mcp-built-in-tools/**/*.{md,json,ts,tsx}"
yarn student:check 04 openai
git diff --check -- my-dev/lesson-04-mcp-built-in-tools
```

`yarn student:check 04 openai` має завершитися успішно без `todo`, `skip`, `only` чи failed tests; recorded eval має пройти всі кейси. Переконайтеся через `git status`, що ваші змінені файли належать до папки заняття в `my-dev/`. Eval є записаним replay і не доводить доступність live-моделі чи реального MCP subprocess.

Live-запит до OpenAI необов’язковий і може витрачати платну квоту. Якщо вирішили його виконати, дотримуйтеся окремої інструкції в [student-guide.md](./student-guide.md), використовуйте синтетичний текст і зафіксуйте результат окремо від офлайн-перевірки.

## Як здати

Після офлайн-перевірки запустіть Prompt 2 зі [STUDENTS.md](../STUDENTS.md). Передайте назву гілки, перевірений commit SHA та посилання на `my-dev/lesson-04-mcp-built-in-tools/` у цій гілці. Не створюйте Merge Request до основного репозиторію курсу.

## Довідкові матеріали

- [Інструкція студента](student-guide.md)
- [Карта starter](starter-code-guide.md)
- [Roadmap коду](roadmap-code-guide.md)
- [Сценарій викладача](instructor-guide.md)
