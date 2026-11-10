# Checkpoint 3 — перший Responses API request

Стан із першим запитом через mock-сумісну межу `ResponsesClient`. Запит уже
використовує модель з environment, `instructions` та `input`, але ще не додає
`store: false` і не перевіряє порожній `output_text`.

```powershell
# Команди виконуються з кореня репозиторію, де розташований package.json.
yarn vitest run lesson-01-intro/checkpoints/03-responses-request/tests
```

Очікування: один test file і 6 пройдених тестів. Наступний стан:
`../04-output-store/`.
