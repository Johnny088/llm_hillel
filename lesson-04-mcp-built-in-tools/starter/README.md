# Lesson 04 – канонічна основа

Канонічний `starter/` є навчальним snapshot: набір усіх non-Markdown файлів і їхній вміст байтово тотожні OpenAI `solution/` Lesson 03. Читайте цей код як готову основу попереднього заняття й не змінюйте канонічні `starter/` та `solution/`.

Один раз створіть власну копію командою `yarn student:init 04 openai`. Вона не перезаписує вже наявну роботу. Реалізуйте вимоги Lesson 04, додайте потрібні тести й evals лише в `my-dev/lesson-04-mcp-built-in-tools/`.

## Перевірка власної роботи

Запускайте команди з кореня репозиторію після `student:init`:

```powershell
yarn student:test 04 openai
yarn student:eval 04 openai
yarn student:build 04 openai
yarn student:check 04 openai
```

`student:test` перевіряє unit suite кандидата. Зелений успадкований baseline сам собою не означає завершення нового заняття. `student:eval` запускає offline оцінювання та не підтверджує доступність live-провайдера. Повний критерій завершення перевіряє `student:check`; він вимагає реальної дельти поточного заняття й запускає потрібні перевірки кандидата. Для Lessons 13–15 він також може вимагати окремо налаштовану локальну PostgreSQL.

Детальні вимоги та послідовність роботи: [домашнє завдання](../homework.md), [інструкція студента](../student-guide.md), [roadmap коду](../roadmap-code-guide.md).
