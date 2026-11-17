# Lesson 02 – покроковий roadmap коду

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Провести один документ через валідацію HTTP-запиту, адаптер Responses API й стабільну JSON або SSE-відповідь.

### 💎 Практична цінність застосунку

Перевірка меж формату та стану генерації не дозволяє видавати неповну відповідь за успішну; token usage залишається видимим для клієнта.

### ⚙️ Що робить застосунок

`DocumentRequestSchema` перевіряє вхід, `OpenAiDocumentAi` ізолює SDK, а `createApp()` формує HTTP-контракт із даними, usage, latency або named SSE events.

## Крок 1. Прочитайте контракти

Почніть із `starter/src/schemas/document-request.ts`, `starter/src/schemas/extraction.ts` і `starter/src/services/document-ai.ts`. Запит має поле `content`; результат extraction містить масиви `names`, `dates`, `locations` і рядок `summary`. Перевищення 20 000 символів не передається моделі.

## Крок 2. Реалізуйте OpenAI adapter

В `starter/src/services/openai-document-ai.ts` використайте `resolveModel("fast", environment)` для summary та `resolveModel("main", environment)` для extraction. Не записуйте model ID в маршрути. Для streaming відобразіть Responses SDK events на `SummaryStreamEvent`; incomplete та failed – це помилки, а не звичайне завершення. Для extraction викличте `responses.parse()` з `zodTextFormat(ExtractionSchema, ...)`, передайте `store: false` і `max_output_tokens`, перевірте `response.status`, refusal та `output_parsed`.

## Крок 3. З’єднайте адаптер із HTTP

В `starter/src/app.ts` лишіть перевірку `DocumentRequestSchema` перед AI-викликом. В `/api/documents/extract` поверніть `data`, `model`, нормалізований `usage` та `metrics`. В `/api/documents/summary/stream` викличте `sendSseHeaders()` і `writeSseEvent()` з `starter/src/lib/sse.ts`. Після `error` або незавершеного потоку закрийте відповідь без `done`.

## Крок 4. Перевірте межові випадки

`starter/tests/app.test.ts` задає 12 сценаріїв: порожній/невідомий вхід, malformed JSON, завеликий body, статуси extraction, usage, успішні named events, incomplete/refusal і timeout. `starter/tests/scaffolding.test.ts` перевіряє вже готові правила environment, schema, usage й ціни. Використовуйте fake SDK для adapter і тестовий сервер для маршрутів.

## Крок 5. Звірте приклади

Запит: `{"content":"14 липня Олена Коваль представила звіт у Львові."}`. Успішна відповідь має містити `data.names`, `data.dates`, `data.locations`, `data.summary`, `usage` та `metrics`; конкретний текст моделі не є фіксованим. В stream клієнт читає послідовність `delta` → `usage` → `done`. На failure terminal `done` відсутній.

## Перевірки

З кореня практичного репозиторію запустіть `yarn test:lesson02`, потім `yarn eval:lesson02`, після реалізації – `yarn verify:lesson02` та `yarn check:lesson02`. Для перевірки готового прикладу без live запитів доступні `yarn test:lesson02:solution`, `yarn eval:lesson02:solution` і `yarn check:lesson02:solution`. Команди student-копії є в [student-guide.md](student-guide.md).

[Карта starter](starter-code-guide.md) · [Домашнє завдання](homework.md) · [Сценарій викладача](instructor-guide.md).
