# Записані evals Lesson 03

Команди запускайте з кореня репозиторію.

```powershell
yarn eval:my:lesson03:openrouter
yarn eval:my:lesson03:openrouter:tool-calling
```

Перша команда відтворює успадковані extraction cases. Друга запускає п'ять записаних tool-calling observations. Обидві використовують локальні fixtures і не звертаються до OpenRouter. Запишіть фактичний результат і `failed/todo/skipped` з поточного виводу.

Жива генерація є необов'язковою та відокремлена від offline acceptance. Для неї потрібен локальний `.env`; запит може витратити баланс провайдера:

```powershell
yarn eval:my:lesson03:openrouter --live
yarn eval:my:lesson03:openrouter:tool-calling --live
```

Записуйте live results окремо. Recorded replay не підтверджує поточну доступність провайдера чи поведінку живої моделі.
