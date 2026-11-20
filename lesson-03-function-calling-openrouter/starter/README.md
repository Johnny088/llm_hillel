# Lesson 03 (OpenRouter) – starter

Це початкова основа практики. Успадкована функціональність Lesson 02 уже працює, а функція виклику інструментів Lesson 03 ще не реалізована.

## Що є в основі

Starter містить точну копію 25 source/test/eval файлів з `lesson-02-llm-api-openrouter/solution`, включно з API, тестами й extraction eval. Усі інші успадковані Markdown/data файли збігаються байт у байт. Є два необхідні документальні винятки: цей README описує нове заняття, а `evals/README.md` указує на Lesson 03 extraction commands та шляхи, щоб команди запускали саме starter 03. Жоден з винятків не додає функціональності Lesson 03.

Успадковані маршрути `/health`, `/api/documents/extract` і `/api/documents/summary/stream` можна запускати та перевіряти як у Lesson 02. Зелений успадкований test run означає, що база справна; він не доводить завершення Lesson 03.

## Як подивитися готове рішення

З кореня репозиторію, де лежить `package.json`, запускається демонстрація готового solution:

```powershell
yarn demo:lesson03:openrouter:solution
```

Ця команда потребує власного локального `.env` і справді звертається до OpenRouter. Вона є демонстрацією, а не обов'язковою offline-перевіркою. Детальні умови наведені у [README практики](../README.md).

## Що реалізувати

У власній копії `my-dev/lesson-03-function-calling-openrouter/` послідовно створіть request schema, опис і безпечне виконання `convert_currency`, обмежений цикл Chat Completions, HTTP-маршрут `POST /api/agent`, активні unit та route tests і deterministic offline eval. Кожен новий файл, точка вставки в успадкований файл і команда перевірки описані у [roadmap](../roadmap-code-guide.md).

## Перевірки початкової бази й завершення

Початкові тести перевіряють лише успадкований Lesson 02:

```powershell
yarn test:lesson03:openrouter
yarn eval:lesson03:openrouter
yarn verify:lesson03:openrouter
```

Inherited `test` та `eval` перевіряють тільки основу Lesson 02. `yarn verify:lesson03:openrouter` очікувано відхиляє незавершений canonical starter, бо в ньому ще немає маршруту та активних перевірок Lesson 03. Після проходження roadmap фінальні команди запускаються для студентської копії з кореня репозиторію:

```powershell
yarn verify:my:lesson03:openrouter
yarn check:my:lesson03:openrouter
yarn eval:my:lesson03:openrouter
yarn eval:my:lesson03:openrouter:tool-calling
```

Recorded eval використовує локальні фікстури й не робить запитів до провайдера. Live-запит не потрібен для завершення практики.
