# Lesson 04 OpenRouter – перевірки eval

## Відтворення записаних відповідей

З кореня репозиторію запускаються три незалежні набори:

```powershell
node scripts/run-tsx-entrypoint.mjs my-dev/lesson-04-mcp-built-in-tools-openrouter/evals/run.ts
node scripts/run-tsx-entrypoint.mjs my-dev/lesson-04-mcp-built-in-tools-openrouter/evals/run.ts --mode=extraction
node scripts/run-tsx-entrypoint.mjs my-dev/lesson-04-mcp-built-in-tools-openrouter/evals/run-tool-calling.ts
```

Звичайний `run.ts` перевіряє п’ять MCP-сценаріїв: два локальні читання, два спостереження вебпошуку й відмову поза дозволеним каталогом. `--mode=extraction` перевіряє п’ять успадкованих extraction-сценаріїв; окремий tool-calling runner перевіряє п’ять успадкованих валютних сценаріїв. Дані вже записані, запитів до OpenRouter немає.

Extraction і MCP можна перевірити разом:

```powershell
node scripts/run-tsx-entrypoint.mjs my-dev/lesson-04-mcp-built-in-tools-openrouter/evals/run.ts --mode=all
```

Очікуються extraction 5/5 та MCP 5/5. Результат цього відтворення не підтверджує поточну доступність моделі або вебпошуку.

## Необов’язкові реальні запити

`run.ts --live` запускає MCP demo; `run.ts --mode=extraction --live` надсилає реальні extraction-запити. Обидва режими потребують власного кореневого `.env`, можуть витрачати баланс і не входять до локального completion gate. Ключі не виводяться у звіт.
