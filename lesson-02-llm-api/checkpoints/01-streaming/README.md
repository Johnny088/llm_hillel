# Checkpoint 1 — streaming

У цьому стані `POST /api/documents/summary/stream` уже працює, а
`POST /api/documents/extract` навмисно повертає `501 NOT_IMPLEMENTED`.

Реалізовані typed Responses API stream events, SSE-події `delta`, `usage`,
`done`, `error`, terminal states, TTFT, latency, token usage і скасування
upstream request після закриття клієнта.

Перевірка без реального API:

```powershell
# Команди виконуються з кореня репозиторію, де розташований package.json.
yarn vitest run lesson-02-llm-api/checkpoints/01-streaming/tests
```

Очікування: 2 test files і 9 пройдених тестів. Наступний навчальний крок —
реалізувати Structured Output extraction у `starter/`.
