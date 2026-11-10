# Lesson 01 — проміжні стани

Checkpoint-папки потрібні викладачу для відновлення лайвкодингу. Студенту для
звичайного проходження достатньо [starter/README.md](../starter/README.md).

1. `01-environment` — перевірка `.env` через Zod.
2. `02-cli-input` — читання аргументів PowerShell і перші unit-тести.
3. `03-responses-request` — перший запит до Responses API через mock-сумісну
   межу.
4. `04-output-store` — `output_text`, `store: false` і порожня відповідь.
5. `05-errors-tests` — безпечні помилки та повний набір тестів.

Кожний наступний checkpoint містить попередні кроки. Для відновлення стану
його `src/cli.ts` і, якщо є, `tests/cli.test.ts` копіюються до `starter/`.

Перевірка всіх checkpoint-тестів без мережі:

```powershell
# Команди виконуються з кореня репозиторію, де розташований package.json.
yarn test:lesson01:checkpoints
```

Успіх — Vitest не показує failed tests і повертає PowerShell prompt.
