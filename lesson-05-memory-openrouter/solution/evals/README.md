# Lesson 04 OpenRouter – перевірки eval

## Offline recorded checks

Запустіть з кореня репозиторію:

```powershell
yarn eval:lesson04:openrouter:solution
node scripts/run-tsx-entrypoint.mjs lesson-04-mcp-built-in-tools-openrouter/solution/evals/run.ts --mode=extraction
node scripts/run-tsx-entrypoint.mjs lesson-04-mcp-built-in-tools-openrouter/solution/evals/run-tool-calling.ts
```

Перша команда запускає default MCP recorded replay: п'ять synthetic cases, зокрема два локальні читання, два hosted-search observations і один sandbox denial. Друга запускає успадкований extraction replay 5/5. Третя зберігає успадкований currency tool-calling replay 5/5. Усі три offline команди оцінюють записані дані й не роблять поточних provider requests.

Для одного звіту extraction та MCP виконайте:

```powershell
node scripts/run-tsx-entrypoint.mjs lesson-04-mcp-built-in-tools-openrouter/solution/evals/run.ts --mode=all
```

Очікувана структура виводу – окремі counts extraction 5/5 і MCP 5/5, разом 10/10. Записуйте фактичні counts, а також pass/fail/todo/skip окремо від exit code. Recorded replay не доводить доступність OpenRouter catalog чи поточну поведінку моделі.

## Необов'язковий live inference

`run.ts --live` запускає окрему MCP live demo, а `run.ts --mode=extraction --live` надсилає реальні extraction requests. Обидва шляхи потребують власного repository `.env` та можуть витрачати provider balance; вони не є частиною offline acceptance. Ніколи не друкуйте ключ у командному рядку або звіті. Позначайте live результат окремо від recorded replay та локального MCP subprocess smoke.
