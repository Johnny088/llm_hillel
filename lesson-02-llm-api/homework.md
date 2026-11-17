# Практична робота — Lesson 02

## Типізований Document API

Новий starter концептуально продовжує завершений `lesson-01-intro/solution/`:
CLI перетворюється на HTTP API. Новий package не створюється:
використовуються спільні залежності, lockfile, lint, format, typecheck і test
runner кореневого репозиторію.

## Результат

Реалізуються два маршрути:

1. `POST /api/documents/summary/stream` — streaming summary через named SSE.
2. `POST /api/documents/extract` — Structured Output із полями `names`,
   `dates`, `locations`, `summary`.

## Основна частина (обов'язково)

1. Реалізувати OpenAI adapter без hardcoded model IDs.
2. Передати `store: false` і `max_output_tokens` в обох запитах.
3. Реалізувати typed streaming events, named SSE-події та однозначні terminal
   states без `done` після помилки.
4. Реалізувати `responses.parse()` із `zodTextFormat()`.
5. Окремо обробити refusal, incomplete, failed, timeout і parsed-result
   failure.
6. Повернути `model`, input/output/total tokens і загальну latency.
7. Замінити всі starter `it.todo` тестами без мережевих викликів.
8. Перевірити п'ять підготовлених offline eval cases; scorer для `summary` не
   повинен залежати від exact string match.

## Поглиблення (необов'язково)

- скасувати upstream stream після закриття клієнтського з'єднання;
- додати TTFT, cache metrics і явний стан недоступної ціни;
- додати власний синтетичний eval case;
- виконати контрольований live smoke test після явного рішення про бюджет.

`solution/` демонструє і основну частину, і поглиблення. Для базового Definition
of Done достатньо основної частини.

## Acceptance scenarios

| Рівень      | Сценарій                         | Очікуваний результат               |
| ----------- | -------------------------------- | ---------------------------------- |
| Core        | Порожній або відсутній `content` | HTTP 400 `INVALID_INPUT`           |
| Core        | Завеликий JSON body              | HTTP 413 `PAYLOAD_TOO_LARGE`       |
| Core        | Невалідний JSON                  | HTTP 400 `MALFORMED_JSON`          |
| Core        | Успішна екстракція               | `data`, `usage`, `metrics`         |
| Core        | Відсутня сутність                | відповідний масив `[]`             |
| Core        | Incomplete generation            | контрольована помилка без `done`   |
| Core        | Refusal                          | HTTP 422 або SSE `REQUEST_REFUSED` |
| Core        | Timeout                          | HTTP 504 або SSE `GATEWAY_TIMEOUT` |
| Поглиблення | Закриття SSE-клієнта             | upstream request скасовано         |
| Поглиблення | Невідома ціна моделі             | `estimatedCostUsd: null`           |

## Definition of Done

- `yarn test:my:lesson02:openai` не містить `todo` і перевіряє власну реалізацію;
- `yarn check:my:lesson02:openai` завершується з кодом 0 для студентської папки;
- `yarn eval:my:lesson02:openai` виконує всі п'ять підготовлених offline eval cases на записаних даних;
- offline eval не є доказом роботи адаптера або доступності live-провайдера;
- `.env`, API keys, `node_modules` і повні вхідні документи не потрапляють до
  Git;
- README містить команди, приклади success/error response і відомі обмеження;
- у маршрутах немає literal model IDs;
- solution не змінюється під час виконання student starter.

## Контрольна точка фінального проєкту

Додається файл із 2–3 можливими темами. Для кожної теми фіксуються проблема,
цільовий користувач, очікуваний результат агента, джерела даних і ризики.

## Здавання

Перед здаванням роботи виконуються:

```bash
yarn check:my:lesson02:openai
yarn eval:my:lesson02:openai
git status
```

Для здачі роботи студент надає:

1. Посилання на доступний викладачу репозиторій.
2. Назву branch із виконаною роботою.
3. Commit SHA конкретної версії, що здається, або пряме посилання на цей
   commit.

Для приватного репозиторію викладачу надається read-доступ. До матеріалів здачі
додаються результати перевірок і один приклад синтетичного HTTP-запиту.
Результати необов'язкового live eval додаються лише тоді, коли він запускався.
`.env`, API keys, tokens та інші secrets не додаються до Git.

Створювати Merge Request або Pull Request до головного репозиторію курсу для
здачі роботи не потрібно.

## Довідкові матеріали

- [Інструкція студента](student-guide.md)
- [Карта starter](starter-code-guide.md)
- [Roadmap коду](roadmap-code-guide.md)
- [Сценарій викладача](instructor-guide.md)
