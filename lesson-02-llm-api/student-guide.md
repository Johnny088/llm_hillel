# Керівництво студента – Lesson 02: Document API (OpenAI)

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Створити Document API для перевіреного вилучення сутностей і streaming-підсумку.

### 💎 Практична цінність застосунку

Типізована схема повертає передбачуваний результат; SSE дає змогу показувати частини підсумку під час генерації.

### ⚙️ Що робить застосунок

Маршрути `/api/documents/extract` та `/api/documents/summary/stream` використовують один `DocumentAi` контракт із різними вихідними форматами.

Почніть із [INSTRUCTION.md](../INSTRUCTION.md) – головної точки входу. Для prompt і правил роботи використовуйте [STUDENTS.md](../STUDENTS.md). Цей посібник веде OpenAI-треком від підготовки робочої гілки до здачі, а обов'язкові вимоги визначає [homework.md](homework.md).

---

## 1. Підготуйте робоче місце

Запустіть **Промпт 1** зі [STUDENTS.md](../STUDENTS.md), вкажіть заняття `02` і трек `OpenAI`. Агент підготує гілку `lesson-02-llm-api`, скопіює starter до `my-dev/lesson-02-llm-api/` та налаштує студентські команди. Не копіюйте файли вручну.

Працюйте в `my-dev/lesson-02-llm-api/`. Не змінюйте `starter/`, `solution/` або `dev/`. Перевірте власну роботу за `homework.md` і цим посібником; не копіюйте код із `solution/`.

---

## 2. Що будуємо

Реалізуйте два HTTP-маршрути на Express:

- `POST /api/documents/summary/stream` надсилає підсумок як named Server-Sent Events.
- `POST /api/documents/extract` повертає структуровані `names`, `dates`, `locations` і `summary`.

Модель вибирається через конфігурацію застосунку. Не прив'язуйте реалізацію до конкретного model ID і не записуйте ID моделі в код маршрутів. Starter уже містить основу конфігурації моделей, промпти, тарифи та обчислення usage-метрик. Основні навчальні TODO зосереджені в OpenAI adapter, маршрутах і 12 тестах `it.todo`.

---

## 3. Орієнтир по структурі

```text
my-dev/lesson-02-llm-api/
├── src/
│   ├── app.ts                         маршрути, валідація та SSE
│   ├── config/
│   │   ├── env.ts                     конфігурація середовища
│   │   ├── models.ts                  вибір налаштованих моделей
│   │   ├── pricing.ts                 тарифи й calculateCost()
│   │   └── prompts.ts                 системні інструкції
│   ├── lib/
│   │   ├── errors.ts                  доменні помилки
│   │   ├── metrics.ts                 usage-метрики та вартість
│   │   └── sse.ts                     форматування SSE-подій
│   ├── schemas/                       схеми запиту й результату
│   └── services/
│       ├── document-ai.ts             інтерфейс AI-сервісу
│       └── openai-document-ai.ts      TODO: OpenAI adapter
├── tests/
│   ├── scaffolding.test.ts            перевірки структури
│   └── app.test.ts                    12 TODO: контракти маршрутів
└── evals/                              п'ять підготовлених offline cases
```

Структура відображає starter. Конкретні файли та TODO перевіряйте в своїй папці після запуску Промпту 1.

---

## 4. Порядок виконання

1. **Підготуйте starter через Промпт 1.** Прочитайте `homework.md`, README своєї папки та код starter. З'ясуйте доступні конфігурації моделей і наявні команди.
2. **Реалізуйте OpenAI adapter.** Для streaming використайте `client.responses.create()` з `stream: true`, `store: false` і `max_output_tokens`. Перетворіть typed SDK events на події сервісу та коректно обробіть completed, incomplete, failed і error стани. Для extraction використайте `client.responses.parse()` із `zodTextFormat(ExtractionSchema, ...)`, також передавши `store: false` і `max_output_tokens`. Моделі мають надходити з конфігурації, без hardcoded model IDs. Обробіть refusal, incomplete, failed і відсутній parsed result.
3. **Завершіть JSON та SSE маршрути в `src/app.ts`.** Перевірте запит, викличте сервіс і поверніть контрактні дані. Для SSE зберігайте визначений порядок подій і не надсилайте `done` після помилки. Перевірте граничні HTTP-статуси з `homework.md`.
4. **Замініть усі 12 `it.todo` в `tests/app.test.ts` на тести з fake-сервісом.** Тести мають перевіряти вашу реалізацію без мережевих викликів.
5. **Заповніть контрольну точку фінального проєкту.** В `my-dev/lesson-02-llm-api/final-project-ideas.md`, скопійованому зі [starter-шаблону](./starter/final-project-ideas.md), запропонуйте 2–3 теми та для кожної вкажіть проблему, цільового користувача, очікуваний результат агента, джерела даних і ризики.
6. **Запустіть п'ять підготовлених offline eval cases** на записаних даних. Записаний replay перевіряє eval/scorer, але не виконує ваш OpenAI adapter і не доводить доступність live-провайдера.
7. **За бажанням виконайте live smoke test.** Спершу визначте допустимий бюджет і лише тоді запускайте live-команду. Це необов'язкове поглиблення, а ключі та інші секрети не додавайте до Git.
8. **Підготуйте здачу через Промпт 2** зі [STUDENTS.md](../STUDENTS.md). Дотримуйтеся перевірки, яку виконує промпт, і надайте пряме посилання на папку `my-dev/lesson-02-llm-api/` в своїй студентській гілці та повний Commit SHA перевіреної версії. Merge Request для здачі не потрібен.

---

## 5. Команди

Виконуйте команди з кореня fork через Yarn:

```bash
yarn dev:my:lesson02:openai
yarn test:my:lesson02:openai
yarn eval:my:lesson02:openai
yarn check:my:lesson02:openai
```

`check` запускає typecheck, lint, форматування, тести та offline eval. Дивіться [homework.md](homework.md) для повного Definition of Done і сценаріїв приймання.
