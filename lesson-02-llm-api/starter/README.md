# Lesson 02 — завдання для студента

Мета — перетворити CLI з Lesson 01 на локальний HTTP API з двома маршрутами:
структурованим вилученням даних і потоковим підсумком.

## Спочатку подивитися готовий результат

```powershell
# Команди виконуються з кореня репозиторію, де розташований package.json.
yarn demo:lesson02:solution
```

Команда показує кожний запит і відповідь реальної моделі та сама зупиняє
тимчасовий сервер. Підготовка `.env` і пояснення результату наведені в
[кореневому README практики](../README.md).

## Що вже працює в starter

- `GET /health` повертає `{"status":"ok"}`;
- Zod перевіряє environment і HTTP input;
- готові схеми запиту, Structured Output, помилок, usage і SSE;
- незавершені AI-маршрути контрольовано повертають `501 NOT_IMPLEMENTED`;
- `tests/scaffolding.test.ts` містить 5 активних baseline-тестів готової
  конфігурації, схем і метрик;
- `tests/app.test.ts` містить 12 тестів-завдань `it.todo`.

Команда `yarn test:lesson02` у незміненому starter виконує `5` активних тестів
і окремо показує `12 todo`. `todo` не зараховуються як пройдені acceptance-тести.

Для перевірки стартового сервера потрібні два вікна PowerShell.

У першому:

```powershell
# Команди виконуються з кореня репозиторію, де розташований package.json.
yarn dev:lesson02
```

Вікно залишається зайнятим сервером. У другому:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Очікування — `status` дорівнює `ok`. Це ще не підтверджує реалізацію AI-маршрутів.
Сервер зупиняється в першому вікні через `Ctrl+C`.

## Послідовність роботи

1. Реалізувати `OpenAiDocumentAi.streamSummary()` з `stream: true` і
   `store: false`.
2. Реалізувати SSE-маршрут із подіями `delta`, `usage`, `done`, `error`.
3. Переконатися, що після refusal, incomplete або failed не надсилається
   `done`.
4. Звірити проміжний стан із `../checkpoints/01-streaming/`.
5. Реалізувати `OpenAiDocumentAi.extract()` через `responses.parse()` і
   `zodTextFormat()`.
6. Реалізувати extraction route з `data`, `usage` і `metrics`.
7. Замінити всі 12 `it.todo` повноцінними тестами без реального API.
8. Запустити фінальну перевірку starter.

```powershell
yarn check:lesson02
```

Команда навмисно завершується помилкою, доки лишився хоча б один `it.todo`.
Після реалізації вона також запускає 5 offline eval cases.

## Після завершення

1. Запустити `yarn check:lesson02`.
2. Запустити власний сервер через `yarn dev:lesson02`.
3. Повторити ручні HTTP-запити з [README готового рішення](../solution/README.md).
4. Заповнити щонайменше два варіанти у `final-project-ideas.md`.

Реальні API-запити виконуються лише після локальних тестів і можуть бути
платними. Для практики використовуються синтетичні або відкриті дані без
персональних секретів.

## Пов’язані навчальні інструкції

[Інструкція студента](../student-guide.md) · [Карта starter](../starter-code-guide.md) · [Roadmap коду](../roadmap-code-guide.md) · [Сценарій викладача](../instructor-guide.md)
