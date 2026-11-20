# Tool-calling evals

## Offline

```bash
yarn eval:lesson03:solution
```

Deterministic recorded replay без мережі перевіряє п'ять сценаріїв: happy
path, нормалізацію валют, уточнення за неповних даних, непідтримувану валютну
пару та пряму відповідь без tool call. Очікуваний результат: `5/5`, `100.0%`.
