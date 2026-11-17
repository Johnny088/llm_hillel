# Lesson 02 – карта навчального starter

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Завершити HTTP API, яке приймає текст документа й повертає перевірені поля сутностей та короткий підсумок або надсилає підсумок частинами.

### 💎 Практична цінність застосунку

Клієнт отримує узгоджену JSON-схему замість неструктурованої відповіді та може показувати streaming результат без очікування повного тексту.

### ⚙️ Що робить застосунок

`GET /health` перевіряє сервер, `POST /api/documents/extract` викликає structured output, а `POST /api/documents/summary/stream` передає `delta`, `usage` і terminal SSE-подію.

## Що вже готове в starter

`starter/src/app.ts` уже містить маршрути, перевірку body та межу розміру 20 000 символів. Незавершені частини передають роботу через інтерфейс `DocumentAi`; файл `starter/src/services/openai-document-ai.ts` має окремі TODO для Responses API streaming і extraction. Схеми, конфігурація моделі, промпти, usage та SSE formatter уже підготовлені.

## Карта файлів і контрактів

| Файл                                         | Призначення                                                             |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `starter/src/app.ts`                         | JSON-помилки, `data`, usage та latency; іменовані SSE-події             |
| `starter/src/services/document-ai.ts`        | типи `SummaryStreamEvent`, `ExtractionResult` та інтерфейс `DocumentAi` |
| `starter/src/services/openai-document-ai.ts` | два OpenAI Responses виклики та перетворення їх статусів                |
| `starter/src/schemas/document-request.ts`    | непорожній `content`, відомі поля й ліміт 20 000 символів               |
| `starter/src/schemas/extraction.ts`          | обов’язкові `names`, `dates`, `locations`, `summary`                    |
| `starter/src/lib/sse.ts`                     | `delta`, `usage`, `done`, `error` в форматі SSE                         |
| `starter/tests/app.test.ts`                  | 12 маршрутних контрактів, включно з помилками й terminal states         |
| `starter/evals/`                             | п’ять підготовлених кейсів та recorded observations для offline scorer  |

## Порядок реалізації

1. В `OpenAiDocumentAi.streamSummary()` викличте `client.responses.create()` зі `stream: true`, `store: false` і налаштованою fast-моделлю. Перетворіть typed SDK events на типи `SummaryStreamEvent`; завершення має розрізняти `completed`, `incomplete`, `failed` і transport error.
2. В `extract()` застосуйте `client.responses.parse()` та `zodTextFormat(ExtractionSchema, ...)`. Відхиляйте refusal, incomplete/failed status, відсутній parsed result і результат, що не проходить схему.
3. В `createApp()` додайте результат extraction, usage та виміряну latency. Для SSE послідовно передайте `delta` і `usage`, а `done` надсилайте лише після успішного terminal event.
4. Тести пишіть з fake OpenAI client або fake `DocumentAi`; мережа не потрібна. Збережіть стабільні HTTP-коди з README й `homework.md`.

## Приклад запиту й очікувана форма

```json
{ "content": "14 липня Олена Коваль представила звіт у Львові." }
```

Очікувана форма успішного extraction. Текст підсумку й token counts залежать від відповіді моделі:

```json
{
  "data": {
    "names": ["Олена Коваль"],
    "dates": ["14 липня"],
    "locations": ["Львові"],
    "summary": "..."
  },
  "model": "<configured model>",
  "usage": { "inputTokens": 0, "outputTokens": 0, "totalTokens": 0 },
  "metrics": { "totalLatencyMs": 0, "estimatedCostUsd": null }
}
```

Для stream перевірте SSE рядки `event: delta`, `event: usage`, `event: done`. На refusal чи incomplete очікується `event: error` без `event: done`.

## Перевірки з кореня репозиторію

```powershell
yarn verify:lesson02
yarn eval:lesson02
yarn test:lesson02:solution
yarn check:lesson02:solution
```

`verify:lesson02` є completion gate й лишається червоним, доки `starter/tests` містить TODO. Підсумкові student-команди для підготовленої папки наведені в [student-guide.md](student-guide.md); повний критерій готовності – в [homework.md](homework.md).

Дивіться також [roadmap коду](roadmap-code-guide.md) та [сценарій викладача](instructor-guide.md).
