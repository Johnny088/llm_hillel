# Lesson 03 — solution

Завершене інкрементальне розширення
`lesson-02-llm-api/solution/`. Попередні Document API маршрути й усі їхні
перевірки збережено.

## Зміни відносно лекції № 02

- додано `POST /api/agent` із strict request schema;
- додано strict function tool `convert_currency`, сформований із Zod 4;
- додано детермінований rate provider і окремий HTTP adapter із runtime-
  валідацією відповіді;
- додано timeout, bounded retry, jitter і підтримку `Retry-After`;
- додано safe tool executor зі стабільними error codes;
- додано локальний ліміт п’яти виконаних tool calls;
- додано сумування usage між model turns та окремі лічильники model calls,
  tool calls і retries;
- додано 25 нових unit/HTTP/eval тестів і п’ять offline eval cases.

Нових залежностей немає. OpenAI model IDs, timeout і max output tokens
використовують наявну environment-конфігурацію лекції № 02.

## Швидкий запуск

Після заповнення кореневого `.env` у першому вікні PowerShell:

```powershell
# Команди виконуються з кореня репозиторію, де розташований package.json.
yarn dev:lesson03:solution
```

В іншому вікні PowerShell:

```powershell
$body = @{ message = "Конвертуй 250 USD у UAH" } | ConvertTo-Json -Compress
$result = Invoke-RestMethod `
  -Uri http://localhost:3000/api/agent `
  -Method Post `
  -ContentType "application/json; charset=utf-8" `
  -Body $body

$result | ConvertTo-Json -Depth 6
```

Очікується HTTP 200 з `status: "success"`, непорожнім `text`, token usage та
метриками model/tool calls. Це реальний OpenAI API-запит, який може бути
платним. Сервер зупиняється через `Ctrl+C` у першому вікні.

## HTTP API

### `POST /api/agent`

Запит:

```json
{
  "message": "Конвертуй 250 USD у UAH"
}
```

Успішна відповідь містить фінальний текст, модель, сумарний token usage і
метрики:

```json
{
  "status": "success",
  "text": "250 USD дорівнюють 10 375 UAH.",
  "model": "configured-model-id",
  "usage": {
    "inputTokens": 220,
    "outputTokens": 48,
    "totalTokens": 268,
    "cachedTokens": 0,
    "cacheWriteTokens": 0
  },
  "metrics": {
    "modelCallCount": 2,
    "toolCallCount": 1,
    "retryCount": 0,
    "totalLatencyMs": 410
  }
}
```

## Безпека й межі

- `store: false` передається на кожному model turn;
- `parallel_tool_calls: false` спрощує навчальний runtime до одного tool call
  за model turn;
- аргументи повторно перевіряються через `safeParse()`;
- raw errors, stack traces, API keys і upstream payloads не повертаються
  моделі або HTTP-клієнту;
- шостий function call блокується до виконання інструмента;
- повноцінні Agent Loop, ReAct, tracing і MCP не реалізуються в цій практиці.

## Перевірка

```bash
yarn test:lesson03:solution
yarn eval:lesson03:solution
yarn build:lesson03
yarn check:lesson03:solution
```

## Пов’язані навчальні інструкції

[Інструкція студента](../student-guide.md) · [Карта starter](../starter-code-guide.md) · [Roadmap коду](../roadmap-code-guide.md) · [Сценарій викладача](../instructor-guide.md)

Спадковість коду: non-Markdown файли канонічного starter є байтово тотожним snapshot попереднього OpenAI solution (Lesson 02). Створюйте код і перевірки поточної теми лише в my-dev/lesson-03-function-calling/ після yarn student:init 03 openai.
