# Статус `yarn.lock`

`yarn.lock` є фінальним lockfile для `packageManager: yarn@4.17.1` із кореневого
`package.json`. Він містить транзитивні резолюції та checksums і придатний для
відтворюваного встановлення через `yarn install --immutable`.

## Оновлення для Lesson 15 — 9 серпня 2026 року

- Додано окрему директорію `lesson-15-final-project-workshop` без зміни набору
  runtime-залежностей.
- `starter/` є snapshot завершеної Lesson 14 solution, а `solution/` містить
  фінальний Release Candidate з власними `LESSON15_*` variables і портами.
- Загальні dependency resolutions залишаються спільними для репозиторію; це не
  змінює навчальний scope Lesson 14.
- `corepack yarn install --immutable` завершився без зміни lockfile, а registry
  audit повернув `No audit suggestions`.
- Lesson 14 solution має 26/26 tests; Lesson 15 starter — 26/26; Lesson 15
  solution — 29/29. Обидва DB-backed integration paths дали 1/1.
- Lesson 14 baseline, Lesson 15 starter і Lesson 15 solution evals дали 1/1;
  production builds обох версій завершилися успішно.

## Оновлення для Lesson 14 — 8 серпня 2026 року

- Додано React 19, Vite 8, `react-markdown`, `jose`, Express, Testing Library,
  JSDOM і супровідні типи для браузерного UI, авторизації та SSE API.
- `corepack yarn install --immutable` завершився успішно та не змінив lockfile.
- Повний `corepack yarn check:lesson14:solution` підтвердив структуру лекцій
  01–16 і практик 01–14, lint, форматування, strict typecheck та production
  build клієнта.
- Lesson 14 має 26 успішних unit/component тестів, 1 DB-backed integration test
  і 1/1 offline eval; регресійні набори Lessons 12–13 також пройшли.
- Інтеграція перевіряє реальний PostgreSQL, cookie-авторизацію, agent/tool loop,
  багаточастинний POST-stream, SSE parser, збереження історії та ownership.
- Платний live-запуск OpenAI API не виконувався, оскільки локальний `.env` і
  `OPENAI_API_KEY` відсутні. Інтеграційний сценарій використовує
  детерміновану streaming-модель через справжній LangChain agent runtime.

## Оновлення для Lesson 13 — 8 серпня 2026 року

- Додано `pg@8.22.0`, `pgvector@0.3.0` і `@types/pg@8.21.0` для PostgreSQL
  data layer та vector values.
- `corepack yarn install` оновив lockfile, після чого
  `corepack yarn install --immutable` завершився успішно без змін.
- Node.js 24.19.0 і Yarn 4.17.1 відповідають вимогам репозиторію.
- Structure audit, lint, format check, strict typecheck, Lesson 12 regression,
  Lesson 13 starter/unit tests та build завершилися успішно.
- Після ввімкнення Docker Desktop міграція застосувалася до PostgreSQL 17.10 із
  `pgvector` 0.8.5; у живій схемі підтверджено `embedding vector(1536)` і п'ять
  записів із фактично збереженими embeddings.
- DB-backed integration tests завершилися з результатом 9/9, solution eval —
  5/5, а повний `corepack yarn check:lesson13:solution` пройшов успішно.
- Платний live seed/demo через OpenAI API не запускався, оскільки локальний
  `.env` і `OPENAI_API_KEY` відсутні. Перевірки data layer використовували
  детермінований embedding provider, але виконували реальні SQL-запити,
  транзакції та vector distance у PostgreSQL/pgvector.

Під час фінального аудиту лекції № 11 1 серпня 2026 року підтверджено:

- Node.js 24.16.0 і Yarn 4.17.1 відповідають зафіксованим вимогам;
- `yarn install --immutable` успішно завершився та не змінив lockfile;
- нові runtime-залежності не додавалися: Lesson 11 повторно використовує
  встановлені `openai`, `zod`, `vitest`, TypeScript і LangGraph-модулі;
- `audit:structure` підтвердив Lectures 01–16, практичні Lessons 01–11, MOC,
  навігацію, обидва стани `starter/solution` і відсутність `todo` у solution;
- lint, Prettier format check і strict TypeScript typecheck завершилися без
  помилок;
- повний `yarn build` успішно зібрав Lessons 01–11;
- повна solution-матриця дала 233 успішні тести; окремо Lesson 10 зберіг
  19/19, а Lesson 11 дав 25/25;
- starter-матриця завершилася без failures; навчальні `todo` залишилися лише у
  незавершених starter checkpoints;
- `yarn eval:lesson11` перевірив 12 runtime-валідованих кейсів, з них 4
  free-text rubric cases і 2 негативні HITL-сценарії;
- `yarn eval:lesson11:solution:offline` двічі запустив той самий dataset
  fingerprint `40b2f7969da53429` через реальний `ContentReviewService`: обидві
  fixture-конфігурації дали 12 passed, 0 failed, 0 errored;
- offline report коректно показав provider usage, cache metrics, cost і budget
  як `unavailable`, оскільки зовнішня модель не викликалася;
- LangGraph smoke пройшов маршрут
  `generator → reviewer → humanApproval → generator → reviewer → END` із двома
  спробами та результатом `approved`;
- однокомандний `yarn check:lesson11:solution` успішно виконав structure, lint,
  format, typecheck, регресійні тести Lessons 10–11, offline eval, smoke і build.

Lesson 11 eval entrypoints спочатку компілюються, а потім запускаються через
`node`. Це усуває залежність цих команд від відомої системної помилки Windows
`uv_os_get_passwd ... ENOMEM` у CLI `tsx`, яка раніше виникала в цьому runner.

Платний live-запуск OpenAI API не виконувався: локальний `.env` і
`OPENAI_API_KEY` відсутні. Unit/integration tests, offline eval і smoke не
зверталися до model API. Live baseline навмисно не підмінено recorded fixtures
або вигаданими token/cost значеннями.

## Після навмисної зміни залежностей

```bash
corepack enable
corepack yarn install
corepack yarn check:solution
corepack yarn install --immutable
git diff -- package.json yarn.lock
```

Оновлені `package.json` і `yarn.lock` переглядаються та комітяться разом.
Редагувати lockfile вручну не потрібно.
