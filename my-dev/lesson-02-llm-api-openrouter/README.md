# Lesson 02 (OpenRouter) — Document API

HTTP-сервер на Express, який перетворює текст документа на структурований JSON
(`POST /api/documents/extract`) і на потоковий підсумок через SSE
(`POST /api/documents/summary/stream`). Провайдер — OpenRouter через OpenAI SDK
з `baseURL: https://openrouter.ai/api/v1`.

Моделі не захардкоджені: вони приходять з `OPENROUTER_MODEL`,
`OPENROUTER_MODEL_FAST` і `OPENROUTER_MODEL_MAIN` через `src/config/env.ts`.

## Команди

Запускаються з кореня репозиторію.

```bash
yarn test:my:lesson02:openrouter     # Vitest, offline
yarn check:my:lesson02:openrouter    # typecheck + lint + format + tests + eval
yarn eval:my:lesson02:openrouter     # 5 записаних eval-кейсів
yarn dev:my:lesson02:openrouter      # сервер на http://127.0.0.1:3000
```

Перевірка стану сервера (у другому терміналі, поки перший зайнятий):

```bash
curl http://127.0.0.1:3000/health
# {"status":"ok"}
```

## `POST /api/documents/extract`

Запит:

```json
{ "content": "14 липня Олена Коваль приїхала до Львова." }
```

Успішна відповідь `200`:

```json
{
  "data": {
    "names": ["Олена Коваль"],
    "dates": ["14 липня"],
    "locations": ["Львова"],
    "summary": "Олена Коваль приїхала до Львова 14 липня."
  },
  "usage": {
    "inputTokens": 120,
    "outputTokens": 40,
    "totalTokens": 160,
    "cachedTokens": 0,
    "cacheWriteTokens": 0
  },
  "metrics": {
    "model": "~deepseek/deepseek-v4-flash-latest",
    "totalLatencyMs": 830,
    "cacheHitRate": 0,
    "estimatedCostUsd": 0.000229,
    "pricingAvailable": true
  }
}
```

Помилки:

```json
{ "error": { "code": "INVALID_INPUT", "message": "Невалідний запит." } }
```

| Код                   | HTTP    | Коли                                       |
| --------------------- | ------- | ------------------------------------------ |
| `INVALID_INPUT`       | 400     | порожній `content`, unknown fields         |
| `MALFORMED_JSON`      | 400     | тіло не є валідним JSON                    |
| `PAYLOAD_TOO_LARGE`   | 413     | тіло перевищує ліміт Express               |
| `REQUEST_REFUSED`     | 422     | модель відмовилась відповідати             |
| `INCOMPLETE_RESPONSE` | 422     | `finish_reason: length` без валідного JSON |
| `GATEWAY_TIMEOUT`     | 504     | таймаут OpenRouter                         |
| `UPSTREAM_*`          | 502/503 | помилка провайдера                         |

## `POST /api/documents/summary/stream`

Той самий запит, відповідь — `text/event-stream` з іменованими подіями:

```
event: delta
data: {"delta":"Олена"}

event: usage
data: {"usage":{...}}

event: done
data: {"status":"completed"}
```

Подія `done` надсилається **лише** після реального terminal-стану (`stop` або
refusal). Для `incomplete`, `failed`, таймауту або помилки провайдера
надсилається `event: error` і `done` не надсилається.

## Обмеження

- Offline-тести та eval працюють на замоканому клієнті й записаних відповідях;
  вони не доводять доступність live-провайдера.
- Один документ на запит; довгі документи не нарізаються на частини.
- SSE не підтримує resume: після розриву з'єднання upstream-запит скасовується.
- Немає автентифікації, rate limiting і збереження історії — сервер stateless.
- `reasoning` і `response_format` надсилаються лише моделям, зареєстрованим у
  `src/config/model-capabilities.ts`.
- Якщо ціни моделі немає в `MODEL_PRICES`, повертається
  `estimatedCostUsd: null` (нуль не підмінюється).
