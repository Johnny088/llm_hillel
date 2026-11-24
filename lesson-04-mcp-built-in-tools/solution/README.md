# Lesson 04 — solution

Завершене розширення `lesson-03-function-calling/solution/` із локальним
filesystem MCP, read-only allowlist і built-in `web_search`.

## Швидкий запуск

Робоча директорія — корінь `ai-agents-for-developers-practical`. У `.env`
мають бути задані `OPENAI_API_KEY`, `OPENAI_MODEL_FAST` і `OPENAI_MODEL_MAIN`.

```bash
corepack yarn dev:lesson04:solution
```

В іншому терміналі:

```bash
curl -X POST http://localhost:3000/api/agent/research \
  -H "Content-Type: application/json" \
  -d '{"message":"Прочитай notes.txt у локальній sandbox-папці"}'
```

Очікується HTTP 200 з `status: "success"`, непорожнім `text` і
`metrics.toolCallCount >= 1`. Сервер зупиняється через `Ctrl+C`.

## Реалізовано

- `POST /api/agent/research`;
- MCP Client через `stdio`;
- sandbox у `solution/sandbox/`;
- model-facing allowlist лише з `read_text_file`;
- повторну перевірку дозволу перед `client.callTool()`;
- безпечну нормалізацію MCP-відмов;
- один контрольований раунд локальних tool calls;
- передавання всіх response output items між model turns;
- unit, HTTP integration, offline eval і реальний локальний MCP smoke test.

Попередні `/health`, Document API та currency agent не змінено.

## Перевірка без OpenAI API

```bash
corepack yarn test:lesson04:solution
corepack yarn eval:lesson04:solution
corepack yarn smoke:lesson04:mcp:solution
corepack yarn build:lesson04
corepack yarn check:lesson04:solution
```

Smoke test запускає справжній filesystem MCP subprocess, читає дозволений
`notes.txt` і підтверджує відмову для шляху поза sandbox.

## Навчальні межі

Runtime виконує не більше одного раунду локальних MCP-викликів і одного
фінального model turn. Повний Agent Loop, довготривала пам’ять, RAG, remote MCP
authentication і production approval workflow не входять до цієї практики.

## Пов’язані навчальні інструкції

[Інструкція студента](../student-guide.md) · [Карта starter](../starter-code-guide.md) · [Roadmap коду](../roadmap-code-guide.md) · [Сценарій викладача](../instructor-guide.md)

Спадковість коду: non-Markdown файли канонічного starter є байтово тотожним snapshot попереднього OpenAI solution (Lesson 03). Створюйте код і перевірки поточної теми лише в my-dev/lesson-04-mcp-built-in-tools/ після yarn student:init 04 openai.
