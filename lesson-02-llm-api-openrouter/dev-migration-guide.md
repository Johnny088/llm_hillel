# Lesson 02 – перехід та міграція до нового starter OpenRouter

- Provider: OpenRouter
- Джерело: завершена практика Lesson 01 у `my-dev/lesson-01-intro-openrouter/`
- Призначення: робоча папка `my-dev/lesson-02-llm-api-openrouter/` (на основі `starter/`)
- Спосіб переходу: концептуальний, CLI → Express HTTP API
- Updated: `2026-09-26`
- Guide version: `v005 (student edition)`

> Lesson 02 — окрема практика: замість CLI студент створює Express HTTP API. **Промпт 1** зі [STUDENTS.md](../STUDENTS.md) готує нову гілку та копіює starter у `my-dev/lesson-02-llm-api-openrouter/`. Він не переносить код Lesson 01; перехід від CLI до HTTP є концептуальним.

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Підготувати окрему робочу папку Lesson 02 на основі canonical starter і зрозуміти, як CLI з Lesson 01 переходить у довготривалий HTTP API.

### 💎 Практична цінність застосунку

Ізольована папка `my-dev/` зберігає роботу попереднього заняття та дає безпечний простір для нового коду. Перевірка `/health` підтверджує, що Express-сервер працює, без виклику моделі.

### ⚙️ Що робить застосунок

Підготовлений Lesson 02 starter запускає `/health`, перевіряє форму HTTP-запитів і повертає контрольований `501` для ще не реалізованих extraction та summary-маршрутів. Міграція готує цей стан у `my-dev/`; вона не переносить CLI-файли з Lesson 01.

---

## 🚀 Як міграція відбувається для студента (за STUDENTS.md)

**Промпт 1** зі [STUDENTS.md](../STUDENTS.md) готує нову студентську гілку та папку `my-dev/` на основі канонічного starter.
Він не переносить розробку з попереднього заняття. Студенту не потрібно вручну копіювати файли чи запускати системні скрипти викладача (`dev:next`, `dev:solution` або `dev-manager.ts`).

### Процес переходу студента від Lesson 01 до Lesson 02:

1. **Завершення Lesson 01:**
   - Ваша робота за перше заняття надійно зафіксована у студентській гілці `lesson-01-intro-openrouter` (папка `my-dev/lesson-01-intro-openrouter/`).
2. **Створення гілки та робочого простору Lesson 02:**
   - Відкрийте корінь вашого fork і запустіть **Промпт 1** зі [STUDENTS.md](../STUDENTS.md).
   - Вкажіть номер заняття `02` та трек `OpenRouter`.
   - AI-агент автоматично:
     - перевірить чистоту робочого дерева;
     - оновить локальний `main` до актуального стану курсу;
     - створить нову чисту гілку `lesson-02-llm-api-openrouter` від `main` (не змішуючи код із попереднім заняттям);
     - створить папку `my-dev/lesson-02-llm-api-openrouter/` і скопіює туди 24 файли зі `starter/`;
     - налаштує студентські команди перевірки (`*:my:lesson02:openrouter`).
3. **Перевірка підготовленого starter (діагностика):**

   ```bash
   yarn vitest run --dir my-dev/lesson-02-llm-api-openrouter/tests
   ```

   Очікується 5 passed, 12 todo, 0 failed; Vitest може показати один skipped-файл, бо всі його тести поки todo. Повний `yarn check:my:lesson02:openrouter` на starter навмисно завершується з кодом 1 через no-TODO gate. Запускайте його після реалізації всіх 12 тестів.

4. **Налаштуйте `.env` лише для необов'язкового запуску сервера:**
   Offline-перевірки та eval працюють без API key. Щоб запустити сервер вручну, виконайте `yarn env:init` у корені та локально додайте `OPENROUTER_API_KEY` до `.env`. Не надсилайте ключ у чат і не комітьте файл.
5. **Розробка за покроковим планом:**
   - Відкрийте [roadmap-code-guide.md](./roadmap-code-guide.md) і крок за кроком виконуйте роботу в `my-dev/lesson-02-llm-api-openrouter/`.

---

## Межа безпечного переходу

Для студента робота над кожним заняттям надійно ізольована:

- Заняття 01: гілка `lesson-01-intro-openrouter`, папка `my-dev/lesson-01-intro-openrouter/`
- Заняття 02: гілка `lesson-02-llm-api-openrouter`, папка `my-dev/lesson-02-llm-api-openrouter/`

Нова гілка для Lesson 02 створюється агентом безпосередньо від актуальної бази курсу `main`. Це гарантує:

- історія та код Lesson 01 залишаються у власній гілці й не впливають на Lesson 02;
- робота починається з чистого, перевіреного викладачами стартового коду;
- домашні роботи не зливаються в `main` і не створюють конфліктів при оновленні матеріалів курсу.

---

## Чому попередній код не копіюється буквально

Lesson 01 і Lesson 02 мають кардинально різну форму застосунку:

- Lesson 01 — одноразова консольна програма (CLI);
- Lesson 02 — довготривалий Express-сервер з HTTP-маршрутами;
- до нового заняття переходять уже засвоєні концепції: робота з SDK, валідація конфігурації, вибір моделей, метрики usage та безпечна обробка помилок;
- starter Lesson 02 уже містить готову Express-інфраструктуру, типізовані Zod-схеми, визначення можливостей моделей та базові тести.

Це **концептуальний перехід CLI → HTTP API**, а не фізичне перенесення файлів із попереднього заняття.

### Основна частина та додаткове поглиблення

Обов'язкові вимоги визначає [homework.md](./homework.md), а не кількість файлів у roadmap. Основна реалізація зосереджується на OpenRouter adapter `src/services/openrouter-document-ai.ts`, HTTP routes `src/app.ts` та 12 offline-сценаріях у `tests/app.test.ts`. Окремий offline adapter test має викликати `OpenRouterDocumentAi.extract()` із підміненою відповіддю `chat.completions.create` та підтвердити допустимість порожніх масивів сутностей для непорожнього документа. Також заповніть `final-project-ideas.md` у своїй папці `my-dev/lesson-02-llm-api-openrouter/` і оновіть README за homework.

Roadmap додатково показує необов'язкові зміни для реєстрації перевіреної ціни та cost reporting (`src/config/pricing.ts`, `src/lib/metrics.ts`), few-shot прикладу (`src/config/prompts.ts`) і додаткових розширених adapter/config tests. Обов'язковий adapter test для відсутніх сутностей залишається core-вимогою з `homework.md`; інші додаткові adapter/config tests можна залишити як поглиблення.

## Необов'язковий `.env` для локального запуску

Для `yarn check:my:lesson02:openrouter` та offline eval API-ключ і файл `.env` не потрібні. Ці перевірки не звертаються до OpenRouter.

Якщо хочете вручну запустити Express-сервер або свідомо виконати live-перевірку, створіть спільний кореневий `.env`:

```bash
yarn env:init
```

Додайте `OPENROUTER_API_KEY` локально. Не надсилайте ключ агенту й не додавайте `.env` до Git. `env:init` не перезаписує наявний файл. Live-запити до моделі необов'язкові й можуть витрачати баланс.

## Перевірка початкового стану starter у my-dev

Після того, як **Промпт 1** налаштував робочу папку `my-dev/lesson-02-llm-api-openrouter/`, виконайте базові перевірки для підтвердження готовності середовища.

### 1. Перевірка starter без TODO gate

Щоб побачити базовий стан підготовленого starter, запустіть Vitest напряму:

```bash
yarn vitest run --dir my-dev/lesson-02-llm-api-openrouter/tests
```

Очікується 5 `passed`, 12 `todo` і 0 `failed`. Це лише зріз початкового стану. `yarn check:my:lesson02:openrouter` на цьому етапі навмисно завершується з помилкою: його no-TODO gate блокує незавершені навчальні тести. Після реалізації всіх 12 сценаріїв запустіть повну перевірку за критеріями `homework.md`.

Перевірити типи окремо можна командою:

```bash
yarn typecheck:my:lesson02:openrouter
```

### Ручна HTTP-перевірка (за бажанням)

Для запуску сервера потрібен локальний кореневий `.env`; його створення описане вище. `/health` не викликає провайдера, але ручні extraction-запити можуть це робити.

### 2. Запуск локального Express-сервера

У першому терміналі виконайте:

```bash
yarn dev:my:lesson02:openrouter
```

Сервер виведе інформаційний банер:

```text
Основна модель (summary): ~deepseek/deepseek-v4-flash-latest
Основна модель (extraction): ~deepseek/deepseek-v4-flash-latest
```

Сервер працює на порту 3000 і очікує запитів (зупинити можна комбінацією `Ctrl+C`).

### 3. Health-перевірка без звернення до провайдера

У другому вікні термінала виконайте:

PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
```

Bash / cURL:

```bash
curl http://127.0.0.1:3000/health
```

Очікується відповідь: `{"status":"ok"}` з HTTP-кодом 200. Цей маршрут не викликає зовнішнє API й не витрачає баланс.

### 4. Перевірка стартових 501-заглушок

Поки сервер працює, надішліть тестові запити до двох робочих endpoint:

PowerShell:

```powershell
$body = @{ content = "Тестовий текст для перевірки заглушки." } | ConvertTo-Json -Compress

foreach ($path in @("/api/documents/extract", "/api/documents/summary/stream")) {
  $res = Invoke-WebRequest -Uri ("http://127.0.0.1:3000" + $path) -Method Post -ContentType "application/json" -Body $body -SkipHttpErrorCheck
  Write-Output "$path -> HTTP $([int]$res.StatusCode)"
}
```

Обидва маршрути повинні повернути HTTP 501 `NOT_IMPLEMENTED`. Це свідчить про те, що валідація вхідних даних пройшла успішно, а навчальні маршрути очікують вашої реалізації!

Зупиніть тестовий сервер комбінацією `Ctrl+C` у першому терміналі.

---

## 🏁 Критерій завершення student work

Критерії приймання визначає [homework.md](./homework.md). Для здачі перевірте з кореня репозиторію:

```powershell
yarn check:my:lesson02:openrouter
if ($LASTEXITCODE -ne 0) { throw 'Повна перевірка студентської папки не пройшла.' }
yarn eval:my:lesson02:openrouter
if ($LASTEXITCODE -ne 0) { throw 'Offline eval не пройшов.' }
git status --short
```

Потрібно виконати всі обов'язкові сценарії з `homework.md`, замінити 12 стартових `it.todo` активними тестами, додати окремий offline adapter test для відсутніх сутностей, отримати успішні `check:my` та offline eval 5/5, оновити README й не додавати `.env`, ключі або повні вхідні документи до Git. Ціна моделі, cache metrics, TTFT, upstream cancellation і live-перевірки належать до поглиблення, якщо `homework.md` не вказує інакше.

Для здачі запустіть **Промпт 2** зі [STUDENTS.md](../STUDENTS.md) і надайте результати перевірок. Live-перевірка не є обов'язковою.

## Наступний крок

Спочатку звірте обсяг роботи й критерії здачі з [homework.md](./homework.md), потім виконуйте [roadmap-code-guide.md](./roadmap-code-guide.md) у `my-dev/`. [starter-code-guide.md](./starter-code-guide.md) — довідка за потреби; цей файл пояснює лише перехід між заняттями.
