# Lesson 03 – канонічна основа

Канонічний `starter/` є навчальним snapshot: набір усіх non-Markdown файлів і їхній вміст байтово тотожні OpenAI `solution/` Lesson 02. Читайте цей код як готову основу попереднього заняття й не змінюйте канонічні `starter/` та `solution/`.

Один раз створіть власну копію командою `yarn student:init 03 openai`. Вона не перезаписує вже наявну роботу. Реалізуйте вимоги Lesson 03, додайте потрібні тести й evals лише в `my-dev/lesson-03-function-calling/`.

## Перевірка власної роботи

Запускайте команди з кореня репозиторію після `student:init`:

```powershell
yarn student:test 03 openai
yarn student:eval 03 openai
yarn student:build 03 openai
yarn student:check 03 openai
```

`student:test` перевіряє unit suite кандидата. Зелений успадкований baseline сам собою не означає завершення нового заняття. `student:eval` запускає offline оцінювання та не підтверджує доступність live-провайдера. Повний критерій завершення перевіряє `student:check`; він вимагає реальної дельти поточного заняття й запускає потрібні перевірки кандидата. Для Lessons 13–15 він також може вимагати окремо налаштовану локальну PostgreSQL.

Детальні вимоги та послідовність роботи: [домашнє завдання](../homework.md), [інструкція студента](../student-guide.md), [roadmap коду](../roadmap-code-guide.md).
