# AI Agents for Developers — practical repository

Цей пакет містить послідовні практичні модулі курсу. Кожна наступна лекція
розширює той самий репозиторій, спільну конфігурацію та перевірки.

> 👨‍🎓 **Студентам курсу:** Почніть з [INSTRUCTION.md](./INSTRUCTION.md) – це головна точка входу. Далі дотримуйтеся маршруту у [STUDENTS.md](./STUDENTS.md) для підготовки гілки, робочої папки та здачі.

## Модулі

Нижче наведено структуру повної програми source-репозиторію. Копія для конкретної когорти може містити лише ті заняття, які вже опубліковані для неї. Обирайте заняття й трек лише за папками, наявними у вашій копії.

```text
lesson-01-intro/
├── starter/
├── solution/
├── checkpoints/
└── homework.md

lesson-02-llm-api/

lesson-02-llm-api-openrouter/
├── starter/
├── solution/
├── checkpoints/
└── homework.md

lesson-03-function-calling/
├── starter/
├── solution/
└── homework.md

lesson-03-function-calling-openrouter/
├── starter/
├── solution/
└── homework.md

lesson-04-mcp-built-in-tools/
├── starter/
├── solution/
└── homework.md

lesson-05-memory/
├── starter/
├── solution/
└── homework.md

lesson-05-memory-openrouter/
├── starter/
├── solution/
└── homework.md

lesson-06-rag/
├── data/
├── starter/
├── solution/
└── homework.md

lesson-06-rag-openrouter/
├── data/
├── starter/
├── solution/
└── homework.md

lesson-07-agent-loop/
├── evals/
├── starter/
├── solution/
└── homework.md

lesson-07-agent-loop-openrouter/
├── evals/
├── starter/
├── solution/
└── homework.md

lesson-08-multi-agent-workflow/
├── evals/
├── starter/
├── solution/
└── homework.md

lesson-08-multi-agent-workflow-openrouter/
├── evals/
├── starter/
├── solution/
└── homework.md

lesson-09-openai-agents-sdk/
├── starter/
├── solution/
└── homework.md

lesson-09-openai-agents-sdk-openrouter/
├── evals/
├── starter/
├── solution/
└── homework.md

lesson-10-langgraph/
├── starter/
├── solution/
└── homework.md

lesson-10-langgraph-openrouter/
├── starter/
├── solution/
└── homework.md

lesson-11-evals-observability/
├── evals/
├── starter/
├── solution/
└── homework.md

lesson-11-evals-observability-openrouter/
├── evals/
├── starter/
├── solution/
├── checkpoints/
└── homework.md

lesson-12-security/
├── starter/
├── solution/
├── threat-model.md
└── homework.md

lesson-12-security-openrouter/
├── starter/
├── solution/
├── evals/
├── checkpoints/
├── threat-model.md
└── homework.md

lesson-13-databases/
├── db/
├── starter/
├── solution/
├── docker-compose.yml
└── homework.md

lesson-13-databases-openrouter/
├── db/
├── starter/
├── solution/
├── evals/
├── docker-compose.yml
└── homework.md

lesson-14-react-sse/
├── db/
├── starter/
├── solution/
└── homework.md

lesson-14-react-sse-openrouter/
├── db/
├── evals/
├── starter/
├── solution/
└── homework.md

lesson-15-final-project-workshop/
├── db/
├── starter/      # snapshot завершеної Lesson 14 solution
├── solution/     # фінальний Release Candidate
└── homework.md
```

- [Lesson 01 — OpenAI](lesson-01-intro/) — одноразовий CLI-запит через
  Responses API з покроковим запуском і видимим результатом у PowerShell.
- [Lesson 01 — OpenRouter](lesson-01-intro-openrouter/) — OpenAI-сумісний
  приклад із DeepSeek V4 Flash, окремими `starter`, `solution`, тестами та
  production build.
- [Lesson 02 — OpenAI](lesson-02-llm-api/) — Express Backend API, Structured
  Outputs, streaming, usage metrics, eval dataset і однокомандна демонстрація.
- [Lesson 02 — OpenRouter](lesson-02-llm-api-openrouter/) — OpenAI-сумісний
  варіант Lesson 02 (Chat Completions через OpenRouter,
  `response_format: json_schema`, повний API, тести, evals, checkpoint).
- [Lesson 03 – OpenRouter](lesson-03-function-calling-openrouter/) –
  OpenAI-сумісний варіант Lesson 03: Chat Completions `tools`/`tool_calls`,
  strict-інструмент `convert_currency` через `zodFunction`, керований agent
  loop, bounded retry і локальний tool-call limit.
  Starter успадковує актуальний solution Lesson 02. Його зелені тести
  підтверджують початкову базу; завершеність Lesson 03 перевіряється окремо
  проти нової реалізації у студентській папці.
- Lesson 03 — інкрементальне додавання `POST /api/agent`, strict function tool,
  Zod-валідації, timeout/retry і локального tool-call limit.
- Lesson 04 — extension-шар поверх solution лекції № 03: локальний filesystem
  MCP через `stdio`, read-only allowlist, built-in `web_search` і
  `POST /api/agent/research`.
  OpenRouter starter фізично успадковує актуальний solution Lesson 03.
  Нові MCP-файли, research-маршрут і перевірки створюються за roadmap у
  `my-dev/lesson-04-mcp-built-in-tools-openrouter/`. Зелені успадковані тести
  підтверджують базу; `check:my:lesson04:openrouter` перевіряє завершення заняття.
- Lesson 05 — extension-шар поверх лекції № 04: `previous_response_id`,
  Conversations API, reset локальної сесії та server-side compaction через
  `context_management`; solution також містить завершення ДЗ з
  `save_user_fact` і JSON-backed long-term memory.
- Lesson 06 — extension-шар поверх solution лекції № 05: retrieval над готовим
  індексом, similarity threshold, code-level refusal, grounded Responses turn
  і citation metadata.
- [Lesson 06 — OpenRouter](lesson-06-rag-openrouter/) — безкоштовна
  OpenAI-сумісна альтернатива Lesson 06: retrieval через косинусну схожість,
  code-level refusal, grounded Chat Completions turn із citation validation
  поверх Conversation Manager Lesson 05 OpenRouter.
- Lesson 07 — розширення завершеної практики № 06 керованим Agent Loop:
  виклик моделі, перевірений пошук як інструмент, обмеження кроків,
  скасування та локальні evals.
- [Lesson 07 — OpenRouter](lesson-07-agent-loop-openrouter/) — фізично успадковує
  завершену Lesson 06 OpenRouter основу та додає контрольований Agent Loop через
  Responses API, пошуковий інструмент, локальні evals і HTTP smoke/demo.
- Lesson 08 — extension-шар поверх solution лекції № 07: детермінований
  Supervisor, паралельні research-кроки, послідовний Writer, URL citations,
  worker metrics і offline evals.
- [Lesson 08 — OpenRouter](lesson-08-multi-agent-workflow-openrouter/) — пряме
  продовження Lesson 07 OpenRouter: той самий Report Workflow через Responses
  API server tool `openrouter:web_search`, успадкований DeepSeek V4 Flash,
  canonical starter gates, offline/live evals і HTTP demo.
- Lesson 09 — extension-шар поверх solution лекції № 08: OpenAI Agents SDK,
  sessions, контрольований handoff, input guardrail, human approval перед
  публікацією та tracing без sensitive payloads.
- [Lesson 09 – OpenRouter](lesson-09-openai-agents-sdk-openrouter/) – пряме
  продовження Lesson 08 OpenRouter: шар оркестрації OpenAI Agents SDK,
  `OpenAIResponsesModel`, `MemorySession`, контрольований handoff, вхідний
  guardrail для API ключів, human approval перед публікацією та безпечне
  трасування без відкритих payload.
- Lesson 10 — ізольований LangGraph workflow у тому самому репозиторії:
  рекомендований `StateSchema`, Generator–Reviewer nodes, conditional routing,
  `MemorySaver`, Human-in-the-loop, бізнес-ліміт повторів і `recursionLimit`.
- [Lesson 10 – OpenRouter](lesson-10-langgraph-openrouter/) – режим C,
  гібридне продовження Lesson 09 OpenRouter: попередній app/runtime
  імпортуються архітектурно, а StateGraph delta адаптовано з OpenAI Lesson 10.
  Canonical model line – DeepSeek V4 Flash Latest, model-list fallback вимкнено.
- Lesson 11 — eval/test extension-шар над Content Review workflow лекції № 10:
  12 runtime-валідованих кейсів, deterministic graders, структурований
  LLM-as-a-Judge, моки модельної межі, status/error taxonomy, observability і
  порівняння двох конфігурацій на однаковому dataset fingerprint.
- [Lesson 11 – OpenRouter](lesson-11-evals-observability-openrouter/) – режим C
  над готовим Content Review workflow Lesson 10 OpenRouter. Варіант зберігає
  той самий датасет і педагогічну дельту, використовує strict Structured Output
  через Responses API, фактичні usage/cost metadata та успадкований DeepSeek V4
  Flash Latest без model-list fallback.
- Lesson 12 — security extension-шар над тим самим Content Review workflow та
  eval harness: trust boundaries, strict tool schemas, operation/resource
  authorization, approval перед publish, output redaction, MCP manifest gate і
  12 security cases поверх усіх 12 baseline cases, разом 24 cases.
- [Lesson 12 – OpenRouter](lesson-12-security-openrouter/) – режим C поверх
  Lesson 10/11 OpenRouter: той самий Content Review graph і eval harness,
  security delta з 11 cases, canonical DeepSeek V4 Flash alias та disabled
  model-list fallback.
- Lesson 13 — data extension-шар над security guarantees лекції № 12:
  PostgreSQL, pgvector, restricted read/write roles, typed repository,
  parameterized SQL, tenant-scoped tools, embeddings, vector search і human
  approval перед зміною `stock`. Runtime checkpoint та очікуване рішення
  зберігаються в PostgreSQL і переживають перезапуск процесу.
- [Lesson 13 – OpenRouter](lesson-13-databases-openrouter/) – той самий data
  layer поверх Lesson 12 OpenRouter. Embedding-шар використовує сумісний
  OpenRouter endpoint із моделлю `openai/text-embedding-3-small` та
  розмірністю `1536`; offline fixtures використовують детермінований провайдер.
  `vector(1536)`, cosine distance `<=>`, metadata-фільтри, tenant scope і
  read/write roles залишаються справжніми. Chat-модель – успадкований DeepSeek
  V4 Flash alias із disabled model-list fallback.
- Lesson 14 — React + SSE extension-шар над catalog agent лекції № 13:
  same-origin Node API, signed HttpOnly session, conversation ownership,
  типізовані `status/delta/done/error/approval_required` events, authenticated
  approval endpoints, cancellation, safe Markdown і PostgreSQL-backed history.
- [Lesson 14 – OpenRouter](lesson-14-react-sse-openrouter/) – режим A з
  provider-адаптацією transport-шару: той самий React + SSE контракт поверх
  фактичної реалізації Lesson 13 OpenRouter. Model configuration успадковано
  (DeepSeek V4 Flash Latest, `provider.sort=price`, disabled model-list
  fallback), а новий delta — підписана session, owner-scoped persistence,
  справжній SSE-потік, persistent approval workflow, cancellation до agent
  stream і React lifecycle.
- Lesson 15 — окремий Final Project Workshop snapshot: starter фіксує завершену
  Lesson 14 solution, а solution додає readiness/security/eval evidence,
  bounded provider calls і план демонстрації без зміни Lesson 14. Persisted
  approval workflow успадковується разом із runtime.
- [Lesson 15 – OpenRouter](lesson-15-final-project-workshop-openrouter/) — той
  самий workshop у OpenRouter-лінійці. Starter успадковує завершену Lesson 14
  OpenRouter solution; робота Lesson 15 зосереджена на RC-артефактах, eval та
  доказах readiness, включно з restart recovery check для успадкованого
  approval workflow, а не на повторному виборі моделі чи реалізації React/SSE.
- `starter/` — робоча початкова точка з контрольованими TODO.
- `solution/` — завершений і тестований варіант.
- `checkpoints/` — проміжні snapshots livecoding, коли вони потрібні модулю.
- Кожне заняття від 01 до 15 має окремі `starter/` і `solution/` з власними
  `src/`, `tests/` та `README.md`. Evals для Lesson 10 реалізовано в Lesson 11.
- Інкрементальні Lessons 04–15 імпортують потрібні контракти завершених
  попередніх практик.
  Lesson 10 розширює застосунок Lesson 09 двома LangGraph-маршрутами,
  а Lesson 11 викликає публічний `ContentReviewService` цього графа через тонкий
  adapter. Lesson 12 композиційно додає окремий security action graph і повторно
  використовує Content Review service та eval harness. Lesson 13 повторно
  використовує ID-схеми, guardrails і audit contracts Lesson 12 без дублювання
  campaign-specific workflow. Lesson 14 повторно використовує catalog agent,
  typed tools і database layer Lesson 13; додається лише web transport, UI та
  chat persistence. Lesson 15 є окремим snapshot цієї реалізації для workshop і
  не змінює файли Lesson 14. Попередні agent/data contracts імпортуються, а не
  дублюються.
- `package.json` — єдине джерело scripts і версій залежностей.

## Передумови

- Node.js 24 LTS;
- Corepack;
- Docker Desktop із доступним Linux/WSL2 backend для Lessons 13–14;
- OpenAI API key лише для live-запуску серверів, embedding seed або live eval;
  локальні unit/DB integration tests і offline eval не потребують ключа;
- OpenRouter API key для OpenRouter-варіантів; позитивний баланс потрібен для
  платного DeepSeek у Lesson 02;
- контрольований project budget.

## Відтворюване встановлення

Команди встановлення залежностей і створення `.env` виконуються з кореня
репозиторію — каталогу з файлом `package.json`. Після клонування відкривається
саме каталог локальної копії `ai-agents-for-developers-practical`.

```bash
corepack enable
yarn --version
yarn install --immutable
yarn check:solution
```

Версія Yarn має відповідати полю `packageManager` у `package.json`. Lockfile під
час звичайного встановлення не змінюється.

## Локальна конфігурація

PowerShell:

```powershell
yarn env:init
```

`yarn env:init` створює спільний кореневий `./.env` лише за його відсутності;
наявні налаштування не перезаписуються. Усі практики читають цей файл, а
зовнішні змінні процесу мають пріоритет над ним.

Заповнюються потрібні для обраної практики змінні та секретний API key. Для
Lesson 01 OpenRouter початкові значення – модель `~deepseek/deepseek-v4-flash-latest`,
`OPENROUTER_REASONING_EFFORT=low` і `OPENROUTER_MAX_OUTPUT_TOKENS=1600`:

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL_FAST=
OPENAI_MODEL_MAIN=
OPENAI_MODEL_EVAL=
OPENAI_TIMEOUT_MS=30000
OPENAI_MAX_OUTPUT_TOKENS=800
OPENROUTER_API_KEY=
OPENROUTER_MODEL=~deepseek/deepseek-v4-flash-latest
OPENROUTER_FALLBACK_MODEL=openrouter/free
OPENROUTER_MODEL_FAST=
OPENROUTER_MODEL_MAIN=
OPENROUTER_REASONING_EFFORT=low
OPENROUTER_TIMEOUT_MS=30000
OPENROUTER_MAX_OUTPUT_TOKENS=1600
EVAL_MAX_COST_USD=0.50
EVAL_MIN_SUCCESS_RATE=0.70
PORT=3000
LESSON13_ADMIN_DATABASE_URL=postgresql://course_admin:course_admin_password@localhost:5433/ai_agents_course
LESSON13_READ_DATABASE_URL=postgresql://catalog_reader:catalog_reader_password@localhost:5433/ai_agents_course
LESSON13_WRITE_DATABASE_URL=postgresql://catalog_writer:catalog_writer_password@localhost:5433/ai_agents_course
LESSON13_AGENT_DATABASE_URL=postgresql://catalog_agent_runtime:catalog_agent_runtime_password@localhost:5433/ai_agents_course
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1536
LESSON14_DATABASE_URL=postgresql://chat_app:chat_app_password@localhost:5433/ai_agents_course
LESSON14_AUTH_SECRET=replace-with-at-least-32-random-characters
LESSON14_ENABLE_DEV_LOGIN=true
LESSON14_PORT=3014
LESSON14_OPENROUTER_DATABASE_URL=postgresql://chat_app:chat_app_password@localhost:5434/ai_agents_openrouter
LESSON13_OPENROUTER_ADMIN_DATABASE_URL=postgresql://course_admin:course_admin_password@localhost:5434/ai_agents_openrouter
LESSON13_OPENROUTER_AGENT_DATABASE_URL=postgresql://catalog_agent_runtime:catalog_agent_runtime_password@localhost:5434/ai_agents_openrouter
LESSON14_OPENROUTER_AUTH_SECRET=replace-with-at-least-32-random-characters
LESSON14_OPENROUTER_ENABLE_DEV_LOGIN=true
LESSON14_OPENROUTER_PORT=3016
LESSON15_DATABASE_URL=postgresql://chat_app:chat_app_password@localhost:5433/ai_agents_course
LESSON15_AUTH_SECRET=replace-with-at-least-32-random-characters
LESSON15_ENABLE_DEV_LOGIN=true
LESSON15_PORT=3015
```

`LESSON13_OPENROUTER_ADMIN_DATABASE_URL` потрібен лише для локальних міграцій і setup checkpoint schemas. Сервіси агентів використовують `LESSON13_OPENROUTER_AGENT_DATABASE_URL` з обмеженою роллю `catalog_agent_runtime`.

Файл `.env` не додається до Git і є єдиним спільним файлом налаштувань усіх
практик. Не створюйте локальні `.env` в папках `starter/`, `solution/`, `my-dev/`
або `dev/`.

## Основні команди

Наведені нижче команди рекомендовано виконувати з кореня репозиторію. Yarn також
знаходить батьківський `package.json`, тому команди ранніх практик працюють із
папки конкретного lesson, `solution` або `starter`.

Поточна папка не визначає версію застосунку. Команди нижче запускають канонічні `starter` і `solution`. Для власної `my-dev/` використовуйте наявні `*:my:*` scripts або команди у README вашої папки, створеному Промптом 1.

| Команда                                 | Що запускається                |
| --------------------------------------- | ------------------------------ |
| `yarn dev:lesson01:solution`            | Готовий OpenAI `solution`      |
| `yarn dev:lesson01`                     | OpenAI `starter` із `TODO`     |
| `yarn demo:lesson02:solution`           | Готова OpenAI демонстрація     |
| `yarn dev:lesson02`                     | OpenAI `starter` із `TODO`     |
| `yarn dev:lesson01:openrouter:solution` | Готовий OpenRouter `solution`  |
| `yarn dev:lesson01:openrouter`          | OpenRouter `starter` із `TODO` |

```bash
# Lesson 01
yarn dev:lesson01 "Що таке closure у JavaScript?"
yarn dev:lesson01:solution "Що таке closure у JavaScript?"
yarn test:lesson01
yarn verify:lesson01
yarn test:lesson01:solution
yarn check:lesson01:solution

# Lesson 01 — DeepSeek V4 Flash через OpenRouter
yarn dev:lesson01:openrouter "Що таке closure у JavaScript?"
yarn dev:lesson01:openrouter:solution "Що таке closure у JavaScript?"
yarn test:lesson01:openrouter
yarn verify:lesson01:openrouter
yarn test:lesson01:openrouter:solution
yarn check:lesson01:openrouter:solution

# Lesson 02
yarn demo:lesson02:solution
yarn dev:lesson02
yarn dev:lesson02:solution
yarn test:lesson02
yarn verify:lesson02
yarn test:lesson02:solution
yarn test:lesson02:checkpoints
yarn eval:lesson02
yarn eval:lesson02:solution
yarn eval:lesson02:solution:live
yarn check:lesson02:solution

# Lesson 02 — варіант OpenRouter
yarn dev:lesson02:openrouter
yarn dev:lesson02:openrouter:solution
yarn test:lesson02:openrouter
yarn verify:lesson02:openrouter
yarn test:lesson02:openrouter:solution
yarn test:lesson02:openrouter:checkpoints
yarn eval:lesson02:openrouter
yarn eval:lesson02:openrouter:solution
yarn eval:lesson02:openrouter:solution:live
yarn build:lesson02:openrouter
yarn check:lesson02:openrouter:solution

# Lesson 03
yarn dev:lesson03
yarn dev:lesson03:solution
yarn test:lesson03
yarn verify:lesson03
yarn test:lesson03:solution
yarn eval:lesson03
yarn eval:lesson03:solution
yarn check:lesson03
yarn check:lesson03:solution

# Lesson 03 – варіант OpenRouter
yarn demo:lesson03:openrouter:solution
yarn dev:lesson03:openrouter
yarn dev:lesson03:openrouter:solution
yarn test:lesson03:openrouter
yarn verify:lesson03:openrouter # очікувана відмова на незміненому starter
yarn test:lesson03:openrouter:solution
yarn eval:lesson03:openrouter
yarn eval:lesson03:openrouter:solution
yarn eval:lesson03:openrouter:solution:live
yarn eval:lesson03:openrouter:solution:live:extraction
yarn build:lesson03:openrouter
yarn check:lesson03:openrouter:solution

# Lesson 04
yarn dev:lesson04
yarn dev:lesson04:solution
yarn test:lesson04
yarn test:lesson04:solution
yarn eval:lesson04
yarn eval:lesson04:solution
yarn smoke:lesson04:mcp:solution
yarn build:lesson04
yarn check:lesson04
yarn check:lesson04:solution

# Контракт спадковості офіційних OpenAI-практик Lessons 01–04
yarn verify:openai:scaffolding

# Lesson 05
yarn dev:lesson05
yarn dev:lesson05:solution
yarn test:lesson05
yarn test:lesson05:solution
yarn eval:lesson05
yarn eval:lesson05:solution
yarn build:lesson05
yarn check:lesson05
yarn check:lesson05:solution

# Lesson 06
yarn dev:lesson06
yarn dev:lesson06:solution
yarn test:lesson06
yarn verify:lesson06
yarn test:lesson06:solution
yarn eval:lesson06
yarn eval:lesson06:solution
yarn build:lesson06:starter
yarn build:lesson06:solution
yarn check:lesson06
yarn check:lesson06:solution

# Lesson 06 — безкоштовна альтернатива OpenRouter
yarn dev:lesson06:openrouter
yarn dev:lesson06:openrouter:solution
yarn demo:lesson06:openrouter:solution
yarn test:lesson06:openrouter
yarn verify:lesson06:openrouter
yarn test:lesson06:openrouter:solution
yarn eval:lesson06:openrouter
yarn eval:lesson06:openrouter:solution
yarn eval:lesson06:openrouter:solution:live
yarn build:lesson06:openrouter:starter
yarn build:lesson06:openrouter:solution
yarn check:lesson06:openrouter
yarn check:lesson06:openrouter:solution

# Lesson 07
yarn dev:lesson07
yarn dev:lesson07:solution
yarn test:lesson07
yarn test:lesson07:solution
yarn eval:lesson07
yarn eval:lesson07:solution
yarn build:lesson07
yarn check:lesson07
yarn check:lesson07:solution

# Lesson 07 — варіант OpenRouter з DeepSeek V4 Flash
yarn dev:lesson07:openrouter
yarn dev:lesson07:openrouter:solution
yarn demo:lesson07:openrouter:solution
yarn verify:lesson07:openrouter:scaffolding
yarn verify:lesson07:openrouter:continuity
yarn verify:lesson07:openrouter
yarn verify:mvp:no-fallback
yarn test:lesson07:openrouter
yarn test:lesson07:openrouter:solution
yarn eval:lesson07:openrouter
yarn eval:lesson07:openrouter:solution
yarn eval:lesson07:openrouter:solution:agent-loop
yarn eval:lesson07:openrouter:solution:agent-loop:live
yarn eval:lesson07:openrouter:solution:catalog
yarn eval:lesson07:openrouter:solution:live
yarn smoke:lesson07:openrouter:solution
yarn build:lesson07:openrouter:starter
yarn build:lesson07:openrouter:solution
yarn check:lesson07:openrouter
yarn check:lesson07:openrouter:solution
yarn dev:my:lesson07:openrouter
yarn test:my:lesson07:openrouter
yarn eval:my:lesson07:openrouter
yarn verify:my:lesson07:openrouter
yarn check:my:lesson07:openrouter

# MVP policy guard: practices 01–07 send each request to its configured model.
# Extend --through and wire the guard into later checks after those lessons are cleaned up.

# Lesson 08
yarn dev:lesson08
yarn dev:lesson08:solution
yarn test:lesson08
yarn test:lesson08:solution
yarn eval:lesson08
yarn eval:lesson08:solution
yarn build:lesson08
yarn check:lesson08
yarn check:lesson08:solution

# Lesson 08 OpenRouter
yarn dev:lesson08:openrouter
yarn dev:lesson08:openrouter:solution
yarn demo:lesson08:openrouter:solution
yarn verify:lesson08:openrouter:scaffolding
yarn verify:lesson08:openrouter:continuity
yarn test:lesson08:openrouter
yarn test:lesson08:openrouter:solution
yarn eval:lesson08:openrouter
yarn eval:lesson08:openrouter:solution
yarn eval:lesson08:openrouter:solution:catalog
yarn eval:lesson08:openrouter:solution:live
yarn smoke:lesson08:openrouter:solution
yarn build:lesson08:openrouter
yarn check:lesson08:openrouter
yarn check:lesson08:openrouter:solution

# Lesson 09
yarn dev:lesson09
yarn dev:lesson09:solution
yarn test:lesson09
yarn test:lesson09:solution
yarn eval:lesson09
yarn eval:lesson09:solution
yarn smoke:lesson09:sdk
yarn build:lesson09
yarn check:lesson09
yarn check:lesson09:solution

# Lesson 09 OpenRouter
yarn dev:lesson09:openrouter
yarn dev:lesson09:openrouter:solution
yarn demo:lesson09:openrouter:solution
yarn verify:lesson09:openrouter:scaffolding
yarn verify:lesson09:openrouter:continuity
yarn test:lesson09:openrouter
yarn test:lesson09:openrouter:solution
yarn eval:lesson09:openrouter
yarn eval:lesson09:openrouter:solution
yarn eval:lesson09:openrouter:solution:catalog
yarn eval:lesson09:openrouter:solution:live
yarn smoke:lesson09:openrouter:sdk
yarn build:lesson09:openrouter
yarn check:lesson09:openrouter
yarn check:lesson09:openrouter:solution

# Lesson 10
yarn dev:lesson10
yarn dev:lesson10:solution "Нова колекція одягу"
yarn verify:lesson10:scaffolding
yarn verify:lesson10:continuity
yarn verify:lesson10
yarn test:lesson10
yarn test:lesson10:solution
yarn smoke:lesson10:graph
yarn build:lesson10
yarn check:lesson10
yarn check:lesson10:solution

# Lesson 10 OpenRouter
yarn dev:lesson10:openrouter
yarn dev:lesson10:openrouter:solution
yarn demo:lesson10:openrouter:solution
yarn verify:lesson10:openrouter:scaffolding
yarn verify:lesson10:openrouter:continuity
yarn verify:lesson10:openrouter
yarn verify:lesson10:openrouter:catalog
yarn test:lesson10:openrouter
yarn test:lesson10:openrouter:solution
yarn smoke:lesson10:openrouter:graph
yarn build:lesson10:openrouter
yarn check:lesson10:openrouter
yarn check:lesson10:openrouter:solution

# Lesson 11
yarn test:lesson11
yarn test:lesson11:solution
yarn eval:lesson11
yarn eval:lesson11:solution:offline
yarn eval:lesson11:solution # платний live-run
yarn build:lesson11
yarn check:lesson11
yarn check:lesson11:solution

# Lesson 11 OpenRouter
yarn demo:lesson11:openrouter:solution # мінімальний платний live-run
yarn verify:lesson11:openrouter:scaffolding
yarn verify:lesson11:openrouter:continuity
yarn verify:lesson11:openrouter # completion gate після виконання TODO
yarn verify:lesson11:openrouter:catalog
yarn test:lesson11:openrouter
yarn test:lesson11:openrouter:solution
yarn eval:lesson11:openrouter
yarn eval:lesson11:openrouter:solution:offline
yarn eval:lesson11:openrouter:solution # повний платний live-run
yarn build:lesson11:openrouter
yarn check:lesson11:openrouter
yarn check:lesson11:openrouter:solution

# Lesson 12
yarn dev:lesson12
yarn dev:lesson12:solution
yarn test:lesson12
yarn test:lesson12:solution
yarn eval:lesson12
yarn eval:lesson12:solution
yarn build:lesson12
yarn check:lesson12
yarn check:lesson12:solution

# Lesson 12 OpenRouter
yarn dev:lesson12:openrouter
yarn dev:lesson12:openrouter:solution
yarn demo:lesson12:openrouter:solution # окремий opt-in live-run
yarn verify:lesson12:openrouter:scaffolding
yarn verify:lesson12:openrouter:continuity
yarn verify:lesson12:openrouter # completion gate після виконання TODO
yarn verify:lesson12:openrouter:catalog # public catalog check; дані динамічні
yarn test:lesson12:openrouter
yarn test:lesson12:openrouter:solution
yarn eval:lesson12:openrouter
yarn eval:lesson12:openrouter:solution:offline
yarn eval:lesson12:openrouter:solution:live # окремий opt-in live-run
yarn build:lesson12:openrouter
yarn check:lesson12:openrouter
yarn check:lesson12:openrouter:solution

# Lesson 13
yarn dev:lesson13
yarn dev:lesson13:solution
yarn db:lesson13:up
yarn db:lesson13:migrate
yarn db:lesson13:seed
yarn test:lesson13
yarn test:lesson13:solution
yarn test:lesson13:integration
yarn eval:lesson13
yarn eval:lesson13:solution
yarn build:lesson13
yarn check:lesson13
yarn check:lesson13:solution

# Lesson 13 OpenRouter
yarn dev:lesson13:openrouter
yarn dev:lesson13:openrouter:solution # окремий opt-in live-run
yarn db:lesson13:openrouter:up
yarn db:lesson13:openrouter:migrate
yarn db:lesson13:openrouter:seed # локальні embeddings, ключ не потрібен
yarn verify:lesson13:openrouter:scaffolding
yarn verify:lesson13:openrouter:continuity
yarn verify:lesson13:openrouter # completion gate після виконання TODO
yarn verify:lesson13:openrouter:catalog # public catalog check; дані динамічні
yarn test:lesson13:openrouter
yarn test:lesson13:openrouter:solution
yarn test:lesson13:openrouter:integration
yarn eval:lesson13:openrouter
yarn eval:lesson13:openrouter:solution # offline: без мережі та без ключа
yarn build:lesson13:openrouter
yarn check:lesson13:openrouter
yarn check:lesson13:openrouter:solution

# Lesson 14
yarn dev:lesson14
yarn dev:lesson14:solution
yarn db:lesson14:migrate
yarn test:lesson14
yarn test:lesson14:solution
yarn test:lesson14:integration
yarn eval:lesson14
yarn eval:lesson14:solution
yarn build:lesson14
yarn check:lesson14
yarn check:lesson14:solution

# Lesson 14 OpenRouter
yarn dev:lesson14:openrouter
yarn dev:lesson14:openrouter:solution
yarn demo:lesson14:openrouter:solution # окремий opt-in live-run
yarn db:lesson14:openrouter:migrate
yarn verify:lesson14:openrouter:scaffolding
yarn verify:lesson14:openrouter:continuity
yarn verify:lesson14:openrouter # completion gate після виконання TODO
yarn verify:lesson14:openrouter:catalog # public catalog check; дані динамічні
yarn test:lesson14:openrouter
yarn test:lesson14:openrouter:solution
yarn test:lesson14:openrouter:integration
yarn eval:lesson14:openrouter
yarn eval:lesson14:openrouter:solution # offline: без мережі та без ключа
yarn eval:lesson14:openrouter:solution:live # окремий opt-in live-run
yarn build:lesson14:openrouter
yarn check:lesson14:openrouter
yarn check:lesson14:openrouter:solution

# Lesson 15 — окремий Final Project Workshop snapshot
yarn dev:lesson15
yarn dev:lesson15:solution
yarn db:lesson15:migrate
yarn test:lesson15
yarn test:lesson15:starter:integration
yarn test:lesson15:solution
yarn test:lesson15:integration
yarn eval:lesson15
yarn eval:lesson15:solution
yarn build:lesson15
yarn check:lesson15
yarn check:lesson15:solution
yarn eval:rc
yarn check:rc
yarn audit:dependencies

# Lesson 15 — OpenRouter Final Project Workshop
yarn dev:lesson15:openrouter
yarn dev:lesson15:openrouter:solution
yarn demo:lesson15:openrouter:solution # окремий opt-in live-run
yarn db:lesson15:openrouter:migrate
yarn verify:lesson15:openrouter:scaffolding
yarn verify:lesson15:openrouter:continuity
yarn verify:lesson15:openrouter:model
yarn verify:lesson15:openrouter # student completion gate after RC artifacts
yarn verify:lesson15:openrouter:catalog # public catalog check; дані динамічні
yarn test:lesson15:openrouter
yarn test:lesson15:openrouter:solution
yarn test:lesson15:openrouter:integration
yarn eval:lesson15:openrouter
yarn eval:lesson15:openrouter:solution # offline: без мережі та без ключа
yarn eval:lesson15:openrouter:solution:live # opt-in live-run
yarn build:lesson15:openrouter
yarn check:lesson15:openrouter
yarn check:lesson15:openrouter:solution

# Увесь репозиторій
yarn audit:structure
yarn lint
yarn format:check
yarn typecheck
yarn test
yarn test:solution
yarn build
yarn check
yarn check:solution
```

Lesson 15 OpenRouter має окремий каталог [lesson-15-final-project-workshop-openrouter](lesson-15-final-project-workshop-openrouter/). Його `starter/` фізично продовжує завершену Lesson 14 OpenRouter solution. Auth, React/SSE, history, catalog agent і модельний контракт DeepSeek V4 Flash Latest уже успадковані; нова робота готує RC readiness/security/eval докази та 5–7-хвилинний demo plan. Вона не повторює вибір моделі чи Lesson 14 UI/streaming delta.

`verify:lesson15:openrouter:scaffolding` і `check:lesson15:openrouter` підтверджують початковий snapshot та мають проходити до роботи студента. Окремий completion gate `verify:lesson15:openrouter` очікувано червоний, доки студент не створить шість RC-файлів у `starter/`: `ARCHITECTURE.md`, `PRODUCTION_READINESS.md`, `SECURITY.md`, `EVAL_REPORT.md`, `KNOWN_LIMITATIONS.md` і `DEMO_PLAN.md`. Файли в `solution/` є прикладами; `verify:lesson15:openrouter:solution:completion` і `check:lesson15:openrouter:solution` перевіряють завершене еталонне рішення. Offline eval не є live-перевіркою провайдера. Для зовнішнього запиту запускайте окремо `eval:lesson15:openrouter:solution:live` або `demo:lesson15:openrouter:solution`; запит і API key передаються OpenRouter та можуть мати ненульову вартість.

`yarn test:lesson01` є проміжним test runner: starter може містити `it.todo`, а
зелений exit code тоді підтверджує лише працездатність Vitest. Фінальна команда
`yarn verify:lesson01` спочатку відхиляє будь-які `describe.todo`, `it.todo` або
`test.todo`, а потім запускає активну student suite.

`yarn audit:structure` окремо перевіряє, що Lessons 01–15 мають обидва стани,
обов’язкові каталоги `src/tests`, README, тестові файли та solution без
`it.todo`. Каталог `evals` потрібен для інших відповідних занять, а в обох
provider-варіантах Lesson 10 він має бути відсутній, оскільки eval framework
належить заняттю № 11.

У multi-root workspace репозиторій матеріалів очікується поруч у директорії
`AI Agents for Developers`. Для іншого розташування задається абсолютний
`COURSE_CONTENT_ROOT`; це впливає лише на перевірку лекційних Markdown-файлів.

Offline evals використовують deterministic recorded replay без мережі. MCP
smoke test запускає справжній локальний subprocess, читає дозволений файл і
перевіряє відмову поза sandbox без OpenAI API. Memory eval перевіряє переходи
між першим ходом, follow-up, reset, створенням і продовженням Conversation.
RAG eval виконує п’ять нерелевантних запитів і перевіряє code-level refusal із
нульовою кількістю generation-викликів. Agent Loop eval перевіряє сім
deterministic сценаріїв за model iterations, tool calls, execution attempts,
token usage і stop reason. Report Workflow eval перевіряє п’ять recorded
сценаріїв за кількістю Researcher/Writer calls, унікальних джерел і tokens.
Agents SDK eval перевіряє шість сценаріїв: локальну відповідь router-а,
handoff, approval gate, session follow-up, guardrail і безпечну tracing
конфігурацію.
LangGraph Lesson 10 використовує unit/integration tests та окремий offline smoke
scenario замість передчасного eval framework. Integration test також перевіряє,
що попередній Report Workflow працює поруч із новими start/resume маршрутами.
Lesson 11 offline eval виконує 12 scripted сценаріїв через справжній
`ContentReviewService`; provider usage і cost у цьому режимі позначаються
`unavailable`. Окремий live-run послідовно порівнює `OPENAI_MODEL_FAST` та
`OPENAI_MODEL_MAIN`, використовує `OPENAI_MODEL_EVAL` лише для чотирьох
free-text rubric cases і застосовує success-rate та cost gates.
Lesson 12 offline eval повторно запускає всі 12 baseline cases і 12 security
cases, разом 24. Негативні cases перевіряють фактичний side-effect count, а security audit
містить лише фіксовані event codes без prompt, arguments, brief або draft.
Lesson 13 unit tests використовують deterministic tool-calling model, а DB
integration tests та solution eval виконують справжні PostgreSQL/pgvector
запити з детермінованими 1536-вимірними embeddings без model API.
Lesson 14 unit/UI tests перевіряють SSE parser, auth/ownership, cancellation і
React lifecycle. Integration test проходить шлях HTTP → catalog agent → typed
tool → PostgreSQL → SSE/history з deterministic model без OpenAI API.
Lesson 14 OpenRouter повторює той самий обсяг на OpenRouter-лінійці: unit/UI
тести додають успадкований model contract, offline transport eval перевіряє
справжній SSE framing і cancellation, а integration test виконує шлях
HTTP login → SSE route → secured catalog agent → typed tool → PostgreSQL →
history → foreign-owner `404` з deterministic model без мережі.
Lesson 15 starter є окремим snapshot завершеної Lesson 14 solution. Lesson 15
solution додає RC-докази, bounded model/embedding requests і фінальний eval
report, не змінюючи код у `lesson-14-react-sse`.
Live eval лекції № 02 виконує п'ять реальних API-запитів і запускається окремо
після рішення про витрати.

## Політика OpenAI API-клієнта

- model IDs надходять лише з environment;
- `store: false` використовується для stateless-запитів Lessons 02–04;
- Lesson 05 явно використовує `store: true`, оскільки stateful response chain
  потребує збереженої Response;
- timeout і retries мають явні межі;
- `max_output_tokens` передається у Lessons 02–11 для live model calls;
- API key, headers, request body і повний error object не логуються;
- unit, integration та offline eval тести не звертаються до реального API;
- Lesson 03 передає між model turns усі потрібні output items і блокує шостий
  локальний function call до виконання інструмента;
- Lesson 04 повторює цю stateless-модель, перевіряє MCP allowlist перед кожним
  локальним викликом і зупиняється після одного навчального раунду;
- Lesson 05 повторює `instructions`, не змішує `previous_response_id` із
  `conversation`, вмикає server-side compaction і повертає
  `function_call_output` після `save_user_fact`;
- Lesson 06 не викликає Conversation Manager, коли retrieval не пройшов
  similarity threshold, і відхиляє порожні або невідомі citation labels.
- Lesson 07 вручну передає `response.output` і `function_call_output` між
  stateless model turns, не логує prompt або hidden chain-of-thought та
  повторює лише retryable idempotent tool calls.
- Lesson 08 використовує `web_search` із `tool_choice: "required"`, зберігає
  URL citation annotations, додає видимий список джерел і запускає незалежні
  research-кроки через `Promise.all`.
- Lesson 08 OpenRouter зберігає цей orchestration contract, але Researcher
  використовує Responses API server tool `openrouter:web_search`; model source
  позначено як `INHERITED_FROM_PREVIOUS_OPENROUTER`, без нового вибору моделі.
- Lesson 09 повторно використовує Report Workflow як `prepare_report`, зупиняє
  `publish_report` до human approval, відновлює той самий `RunState` і задає
  `traceIncludeSensitiveData: false` у конфігурації `Runner`. SDK-моделі
  повторно використовують налаштований OpenAI client спільного runtime.
- Lesson 10 повторно використовує цей OpenAI client і model resolver лише в
  live Draft Generator. Офлайн-тести підміняють генератор записаними чернетками;
  `MemorySaver` зберігає checkpoints в пам’яті процесу, а Store не додається без
  міжпотокових даних.
- Lesson 11 додає необов'язковий observer до `OpenAIDraftGenerator`, не змінюючи
  контракт `DraftGenerator`; обробляє `failed`, `incomplete` і refusal, збирає
  фактичний Responses usage та не підставляє синтетичні token/cache metrics.
- Lesson 11 judge використовує `responses.parse()` і `zodTextFormat()`; невідомий
  model ID, відсутній usage або не-standard service tier повертає
  `cost=unavailable`, а не fallback-оцінку.
- Lesson 11 OpenRouter повторно використовує `ContentReviewService` і
  `OpenRouterDraftGenerator` з Lesson 10 OpenRouter. Judge надсилає strict JSON
  Schema через Responses API та повторно перевіряє результат у Zod; offline-run
  не викликає провайдера, а live-run покладається на фактичний `usage.cost` і
  повертає `cost=unavailable`, якщо повних даних немає.
- Lesson 12 не додає нових live model calls: model tool proposal в security
  tests є scripted boundary, а application code незалежно перевіряє tool,
  operation, permission, tenant, resource, approval і redaction до commit.
- Lesson 13 бере chat model із `OPENAI_MODEL_MAIN`; embedding contract фіксує
  `text-embedding-3-small` і 1536 dimensions разом із `vector(1536)`. Live seed
  потребує API key, а unit/integration tests використовують deterministic
  embedding provider.
- Lesson 13/14 OpenRouter беруть chat model із `OPENROUTER_MODEL_MAIN` і
  продовжують canonical DeepSeek V4 Flash Latest без самостійного вибору моделі.
  Embedding-шар Lesson 13 OpenRouter використовує сумісний endpoint із
  `openai/text-embedding-3-small`; Lesson 14 OpenRouter не додає власного
  embedding-провайдера й не змінює model family.
- Lesson 14 використовує `SecuredCatalogAgent.streamText()` поверх того самого
  LangChain agent/checkpointer і не передає raw model events у browser. Live UI
  потребує API key; unit, React, PostgreSQL integration та offline eval — ні.
- Lesson 14 OpenRouter повторює цей transport-контракт поверх фактичної
  реалізації Lesson 13 OpenRouter. Chat-модель успадкована
  (`~deepseek/deepseek-v4-flash-latest`, `provider.sort=price`,
  `prompt_cache_key=lesson-11-main-v1`, `fallbackModels=[]`,
  `fallbackState=DISABLED`, `maxRetries: 0`); новий delta — HttpOnly session,
  owner-scoped history, SSE `status/delta/done/error`, cancellation до agent
  stream, React lifecycle і safe Markdown. Live demo виконує один короткий
  платний запит; offline eval та integration test мережі не потребують.
- Lesson 15 має окремі `LESSON15_*` environment variables, cookie namespace і
  dev ports. Starter фіксує рівень Lesson 14, а solution додає timeout, bounded
  retries, output-token limit та RC artifacts.

## Практичні student та teacher маршрути 02–15

Кожне заняття має два provider-варіанти з однаковою навчальною метою. Обирайте той, що відповідає середовищу групи; переходити між провайдерами не потрібно. Student guide задає послідовність реалізації та здачі, а instructor guide містить live-coding кроки, checkpoints і очікувані відповіді.

| Lesson | OpenAI                                                                                                                             | OpenRouter                                                                                                                                               |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 02     | [Student](./lesson-02-llm-api/student-guide.md) · [Teacher](./lesson-02-llm-api/instructor-guide.md)                               | [Student](./lesson-02-llm-api-openrouter/student-guide.md) · [Teacher](./lesson-02-llm-api-openrouter/instructor-guide.md)                               |
| 03     | [Student](./lesson-03-function-calling/student-guide.md) · [Teacher](./lesson-03-function-calling/instructor-guide.md)             | [Student](./lesson-03-function-calling-openrouter/student-guide.md) · [Teacher](./lesson-03-function-calling-openrouter/instructor-guide.md)             |
| 04     | [Student](./lesson-04-mcp-built-in-tools/student-guide.md) · [Teacher](./lesson-04-mcp-built-in-tools/instructor-guide.md)         | [Student](./lesson-04-mcp-built-in-tools-openrouter/student-guide.md) · [Teacher](./lesson-04-mcp-built-in-tools-openrouter/instructor-guide.md)         |
| 05     | [Student](./lesson-05-memory/student-guide.md) · [Teacher](./lesson-05-memory/instructor-guide.md)                                 | [Student](./lesson-05-memory-openrouter/student-guide.md) · [Teacher](./lesson-05-memory-openrouter/instructor-guide.md)                                 |
| 06     | [Student](./lesson-06-rag/student-guide.md) · [Teacher](./lesson-06-rag/instructor-guide.md)                                       | [Student](./lesson-06-rag-openrouter/student-guide.md) · [Teacher](./lesson-06-rag-openrouter/instructor-guide.md)                                       |
| 07     | [Student](./lesson-07-agent-loop/student-guide.md) · [Teacher](./lesson-07-agent-loop/instructor-guide.md)                         | [Student](./lesson-07-agent-loop-openrouter/student-guide.md) · [Teacher](./lesson-07-agent-loop-openrouter/instructor-guide.md)                         |
| 08     | [Student](./lesson-08-multi-agent-workflow/student-guide.md) · [Teacher](./lesson-08-multi-agent-workflow/instructor-guide.md)     | [Student](./lesson-08-multi-agent-workflow-openrouter/student-guide.md) · [Teacher](./lesson-08-multi-agent-workflow-openrouter/instructor-guide.md)     |
| 09     | [Student](./lesson-09-openai-agents-sdk/student-guide.md) · [Teacher](./lesson-09-openai-agents-sdk/instructor-guide.md)           | [Student](./lesson-09-openai-agents-sdk-openrouter/student-guide.md) · [Teacher](./lesson-09-openai-agents-sdk-openrouter/instructor-guide.md)           |
| 10     | [Student](./lesson-10-langgraph/student-guide.md) · [Teacher](./lesson-10-langgraph/instructor-guide.md)                           | [Student](./lesson-10-langgraph-openrouter/student-guide.md) · [Teacher](./lesson-10-langgraph-openrouter/instructor-guide.md)                           |
| 11     | [Student](./lesson-11-evals-observability/student-guide.md) · [Teacher](./lesson-11-evals-observability/instructor-guide.md)       | [Student](./lesson-11-evals-observability-openrouter/student-guide.md) · [Teacher](./lesson-11-evals-observability-openrouter/instructor-guide.md)       |
| 12     | [Student](./lesson-12-security/student-guide.md) · [Teacher](./lesson-12-security/instructor-guide.md)                             | [Student](./lesson-12-security-openrouter/student-guide.md) · [Teacher](./lesson-12-security-openrouter/instructor-guide.md)                             |
| 13     | [Student](./lesson-13-databases/student-guide.md) · [Teacher](./lesson-13-databases/instructor-guide.md)                           | [Student](./lesson-13-databases-openrouter/student-guide.md) · [Teacher](./lesson-13-databases-openrouter/instructor-guide.md)                           |
| 14     | [Student](./lesson-14-react-sse/student-guide.md) · [Teacher](./lesson-14-react-sse/instructor-guide.md)                           | [Student](./lesson-14-react-sse-openrouter/student-guide.md) · [Teacher](./lesson-14-react-sse-openrouter/instructor-guide.md)                           |
| 15     | [Student](./lesson-15-final-project-workshop/student-guide.md) · [Teacher](./lesson-15-final-project-workshop/instructor-guide.md) | [Student](./lesson-15-final-project-workshop-openrouter/student-guide.md) · [Teacher](./lesson-15-final-project-workshop-openrouter/instructor-guide.md) |
