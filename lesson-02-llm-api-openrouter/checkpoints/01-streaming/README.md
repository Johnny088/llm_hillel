# Checkpoint 1 — streaming

Накопичувальний snapshot після реалізації `POST /api/documents/summary/stream`.

**SSE (Server-Sent Events)** — формат потокових HTTP-подій. **TTFT (Time to
First Token)** — час до першого текстового фрагмента.

У цьому стані вже працюють:

- streaming через OpenRouter Chat Completions (`choices[].delta.content`);
- основна модель DeepSeek V4 Flash Latest без автоматичної заміни; фактичний ID
  моделі береться з фінального chunk;
- короткий підсумок до 60 слів із `temperature: 0` та reasoning effort `low`
  для меншого обсягу міркувань. `exclude: true` приховує reasoning-текст у
  відповіді, але ці токени й далі враховуються у вихідному ліміті та вартості;
- іменовані SSE-події `delta`, `usage`, `done`, `error`;
- terminal states без `done` після refusal, incomplete або failed;
- TTFT, latency, token usage, cache metrics і pricing availability;
- скасування upstream request після закриття клієнта;
- HTTP input validation і стабільні помилки.

`POST /api/documents/extract` навмисно повертає `501 NOT_IMPLEMENTED`:
Structured Output через `response_format: json_schema` і локальну Zod-перевірку
додається на наступному кроці.

Перевірка snapshot:

```bash
yarn test:lesson02:openrouter:checkpoints
```
