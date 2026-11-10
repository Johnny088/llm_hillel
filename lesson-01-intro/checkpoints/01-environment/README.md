# Checkpoint 1 — environment

Стан після реалізації Zod-схеми та `loadEnvironment()`. Програма вже може
відхилити відсутні `OPENAI_API_KEY` і `OPENAI_MODEL_FAST`, але ще не читає
запит користувача.

Три offline unit-тести перевіряють обидві обов'язкові змінні та відсікання
зайвих env-полів. Вони входять до `yarn test:lesson01:checkpoints`, а код — до
загального `yarn typecheck`. Наступний стан: `../02-cli-input/`.
