# Lesson 02 (OpenRouter) — solution: evals

## Offline eval (за замовчуванням)

```bash
yarn eval:lesson02:openrouter:solution
```

Deterministic replay п'яти записаних спостережень. Не звертається до мережі.
Очікуваний результат: `Result: 5/5`, `Success rate: 100.0%`.

## Live eval (opt-in, реальні запити)

```bash
yarn eval:lesson02:openrouter:solution:live
```

Виконує п'ять реальних платних запитів до DeepSeek V4 Flash Latest через
OpenRouter.
Для кожного запиту в терміналі виводяться:

- текст, надісланий моделі;
- знайдені імена, дати й місця;
- сформований підсумок;
- назва моделі, час відповіді та кількість токенів;
- результат автоматичної перевірки `PASS` або `FAIL`.

**Токен** — невеликий фрагмент тексту, який обробляє мовна модель. Кожен запит
може тривати десятки секунд і витрачає баланс OpenRouter.

## Live-перевірка публічного каталогу (opt-in)

```bash
yarn eval:lesson02:openrouter:solution:catalog
```

Ця окрема команда не потребує API key, не виконує inference-запитів і перевіряє:

- налаштовані model IDs існують у публічному каталозі OpenRouter;
- ціна DeepSeek збігається з `MODEL_PRICES`;
- заявлені параметри (`response_format`, `reasoning`) підтверджені каталогом;
- модель підтримує всі зареєстровані reasoning efforts і поточне налаштоване
  значення.

Після п'яти inference-запитів команда `...:live` автоматично запускає цю саму
catalog-перевірку.

Якщо будь-яка з перевірок не виконується, скрипт повертає ненульовий exit code.
