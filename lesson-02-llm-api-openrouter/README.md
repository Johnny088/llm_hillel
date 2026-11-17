# Lesson 02 (OpenRouter) — LLM API через OpenRouter

> **Студентам курсу:** Почніть із [INSTRUCTION.md](../INSTRUCTION.md) – головної точки входу. Далі дотримуйтеся маршруту та правил [STUDENTS.md](../STUDENTS.md) для підготовки гілки, `my-dev/lesson-02-llm-api-openrouter/` і здачі. Для цієї практики дивіться [student-guide.md](./student-guide.md) та [homework.md](./homework.md). Команди `*:my:lesson02:openrouter` перевіряють студентську папку; канонічні `*:lesson02:openrouter` запускають starter або solution курсу.

Альтернативне продовження `lesson-01-intro-openrouter/`. Практика розширює CLI
до типізованого HTTP API, функціонально повторюючи оригінальний
`lesson-02-llm-api` через OpenRouter Chat Completions. Для обох ролей за
замовчуванням використовується платна `~deepseek/deepseek-v4-flash-latest`.
Спільні Node.js, Yarn, TypeScript, OpenAI SDK, Zod, ESLint, Prettier і Vitest
налаштовуються один раз у корені репозиторію.

## Як одразу побачити результат

### 1. Відкрити PowerShell у корені клонованого репозиторію

Потрібний каталог містить файли `package.json` і `.env.example`.

### 2. Перевірити ключ OpenRouter

У кореневому файлі `.env` має бути задано:

```dotenv
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=~deepseek/deepseek-v4-flash-latest
OPENROUTER_REASONING_EFFORT=low
OPENROUTER_MAX_OUTPUT_TOKENS=1600
```

Якщо файл `.env` ще не створено:

```powershell
yarn install --immutable
Copy-Item .env.example .env
notepad .env
```

### 3. Запустити готову демонстрацію

```powershell
Remove-Item Env:OPENROUTER_MODEL,Env:OPENROUTER_MODEL_FAST,Env:OPENROUTER_MODEL_MAIN,Env:OPENROUTER_REASONING_EFFORT,Env:OPENROUTER_MAX_OUTPUT_TOKENS -ErrorAction SilentlyContinue
yarn demo:lesson02:openrouter:solution
```

Очищення model-змінних прибирає тимчасові override з попередніх запусків;
після цього команда читає актуальну конфігурацію з кореневого `.env`.

Окремо запускати сервер або відкривати друге вікно PowerShell не потрібно.
Команда показує:

- який текст надіслано;
- що повернув маршрут `/health`;
- які імена, дати й місця знайшла реальна модель;
- який підсумок згенерувала модель;
- результат потокового запиту;
- налаштовану й фактичну модель, час, токени та вартість;
- фінальний висновок про працездатність проєкту.

Успішний запуск завершується рядком:

```text
=== ПІДСУМОК: УСІ 3 ПЕРЕВІРКИ ПРОЙДЕНО, ПРОЄКТ ПРАЦЮЄ ===
```

Повний приклад термінального звіту та ручна перевірка через два вікна PowerShell
наведені в [`solution/README.md`](./solution/README.md#найпростіша-перевірка-одна-команда).

**LLM (Large Language Model)** — велика мовна модель. **CLI (Command-Line
Interface)** — інтерфейс командного рядка. **HTTP API (Application Programming
Interface)** — програмний інтерфейс, доступний через HTTP-запити. **SDK
(Software Development Kit)** — бібліотека з готовими типами та методами для
роботи з API. **JSON (JavaScript Object Notation)** — текстовий формат
структурованих даних.

**Structured Output** змушує сумісну модель повернути JSON за заданою схемою.
Для DeepSeek V4 Flash запит використовує строгий `json_schema`; отримані дані
додатково перевіряє локальна Zod-схема.
**SSE (Server-Sent Events)** — формат тривалого HTTP-з'єднання, у якому сервер
послідовно надсилає клієнту іменовані події.

## Результат

Модуль додає два контракти:

- `POST /api/documents/extract` — структурований JSON через строгий
  `response_format: json_schema` + обов'язковий локальний `JSON.parse` і
  `ExtractionSchema.safeParse`;
- `POST /api/documents/summary/stream` — іменовані SSE-події `delta`, `usage`,
  `done`, `error` поверх `choices[].delta.content`.

## Структура

```text
lesson-02-llm-api-openrouter/
├── starter/
│   ├── src/
│   ├── tests/
│   ├── evals/
│   └── final-project-ideas.md
├── checkpoints/
│   └── 01-streaming/
├── solution/
│   ├── src/
│   ├── tests/
│   ├── evals/
│   └── final-project-ideas.md
└── homework.md
```

- `starter/` компілюється, запускає `/health`, валідує HTTP input і містить
  контрольовані `NOT_IMPLEMENTED` відповіді для нових маршрутів.
- `solution/` містить завершену реалізацію, unit та HTTP integration тести.
- `checkpoints/01-streaming/` фіксує робочий стан до реалізації структурованого JSON.
- `starter/evals/` і `solution/evals/` містять п'ять стабільних кейсів, scorer,
  deterministic recorded replay та окремий live runner.

## Який варіант використовується

Для демонстрації повністю готової практики використовується `solution`:

```powershell
yarn demo:lesson02:openrouter:solution
```

Команда `yarn dev:lesson02:openrouter` без суфікса запускає навчальний
`starter`. У ньому маршрути мовної моделі навмисно не реалізовані та повертають
HTTP `501 NOT_IMPLEMENTED`.

Команда `demo:...:solution` тимчасово запускає готовий API, виконує всю перевірку
і сама зупиняє API. Команда `dev:...:solution` запускає довготривалий сервер для
ручного надсилання HTTP-запитів. Це різні сценарії.

## Тести канонічного starter/solution та автоматична перевірка (для викладача)

> **Студентам:** підготуйте власну гілку й `my-dev/lesson-02-llm-api-openrouter/` через Промпт 1 зі [STUDENTS.md](../STUDENTS.md). Офлайн-перевірки у своїй гілці: `yarn test:my:lesson02:openrouter`, `yarn eval:my:lesson02:openrouter` і `yarn check:my:lesson02:openrouter`. Необов'язковий ручний запуск сервера: `yarn dev:my:lesson02:openrouter`; перед ним налаштуйте кореневий `.env` з `OPENROUTER_API_KEY`. Запит до сервера звертається до провайдера. Команди нижче перевіряють канонічний `starter/` або `solution/`, а не вашу папку.

Перевірка готового канонічного рішення:

```bash
yarn test:lesson02:openrouter:solution
yarn eval:lesson02:openrouter:solution
yarn test:lesson02:openrouter:checkpoints
yarn check:lesson02:openrouter:solution
```

Starter вважається завершеним, коли всі 12 `it.todo` замінено тестами, а
`yarn check:lesson02:openrouter` завершується без помилок.

## Міграція канонічної робочої папки dev до уроку 02 (для викладача)

> **Студентам:** не запускайте команди `dev:*` у цьому розділі. Для своєї гілки використовуйте Промпт 1 зі [STUDENTS.md](../STUDENTS.md) і команди `*:my:lesson02:openrouter`.

Папка `dev/` — робочий стенд одного заняття. Після уроку 01 вона містить
готовий solution-01 (CLI), який не може стати starter-02: урок 02 — інший
застосунок (HTTP-сервер) із навмисними заглушками (TODO, `501`, `12 it.todo`) та
5 активними baseline-тестами готового scaffold.
Менеджер замінює код і тести свіжим starter-02. Від Lesson 02 усі практики
читають лише кореневий `.env`; локальні `dev/.env` і `dev/.env.example`
видаляються тільки після перевірки, що в кореневому `.env` є
`OPENROUTER_API_KEY`.

PowerShell, з кореня репозиторію:

```powershell
yarn dev:status
yarn dev:solution
yarn dev:next
yarn dev:status
```

`dev:solution` спочатку завершує Lesson 01, а `dev:next` безпечно переводить
робочий стенд на starter Lesson 02. Після переходу `dev:status` має показати
`Lesson 02`, `stage: starter`, джерело змінних — кореневий `.env`, а локальні
env-файли — відсутні.

Перевірка starter (два термінали, порядок важливий). У першому запустіть
`yarn tsx dev/src/server.ts`: команда не повертає запрошення — це нормально,
сервер працює і виводить банер «Document API запущено на порту 3000».
У другому терміналі, поки перший працює, виконайте
`Invoke-RestMethod http://localhost:3000/health` — очікується `status: ok`.
Тільки після цього зупиніть сервер у першому терміналі (`Ctrl+C`).
Далі: `yarn tsc -p tsconfig.dev.json --noEmit` — без помилок; `yarn vitest run --dir dev/tests` — `5 passed` і
`12 todo`. Повна публічна процедура переходу наведена в цьому розділі.

## Моделі, вартість і приватність

- `OPENROUTER_MODEL` слугує базовою моделлю для обох ролей; окремі
  `OPENROUTER_MODEL_FAST` і `OPENROUTER_MODEL_MAIN` дозволяють розділити
  streaming та структурований JSON.
- Значення за замовчуванням — `~deepseek/deepseek-v4-flash-latest`. Це платна
  модель: перед live-запуском перевірте актуальну ціну та баланс в OpenRouter.
- Повтори з боку SDK вимкнені (`maxRetries: 0`); прихованого переходу на іншу
  модель немає. `response_format` надсилається лише підтвердженим моделям, а
  `provider.require_parameters` відсіює несумісні endpoints.
- Reasoning для коротких extraction і summary бере підтримуваний рівень із
  `OPENROUTER_REASONING_EFFORT` (рекомендоване значення — `low`), а його текст
  виключено з відповіді. Низький рівень залишає більшу частину token budget під
  результат і зменшує latency та витрати.
- Жоден сторонній endpoint не призначений для персональних, закритих або
  конфіденційних документів без належної політики обробки даних.
