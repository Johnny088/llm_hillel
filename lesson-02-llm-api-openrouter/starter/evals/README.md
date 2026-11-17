# Lesson 02 (OpenRouter) — starter: evals

## Offline eval (за замовчуванням)

```bash
yarn eval:lesson02:openrouter
```

Deterministic replay п'яти записаних спостережень. Не звертається до мережі.
Очікуваний результат: `Result: 5/5`, `Success rate: 100.0%`.

## Live eval (opt-in, реальні запити)

```bash
yarn eval:lesson02:openrouter:solution:live
```

Live-режим потребує реалізованого `OpenRouterDocumentAi` зі `solution/`
і виконує п'ять реальних запитів до DeepSeek V4 Flash Latest через OpenRouter.
Ці запити оплачуються за тарифом OpenRouter; запуск виконується лише після
окремого рішення про витрати.
