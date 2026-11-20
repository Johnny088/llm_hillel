# Lesson 03 (OpenRouter) – Tool Calling

Практика додає `POST /api/agent` до успадкованого сервісу Lesson 02. Модель може запросити `convert_currency`; сервер валідує аргументи, виконує локальну функцію та передає результат назад моделі.

## Маршрути

- `GET /health` перевіряє сервер.
- `POST /api/documents/extract` та `POST /api/documents/summary/stream` успадковані з Lesson 02.
- `POST /api/agent` приймає JSON з непорожнім `message` і повертає status, text, фактичну model, usage та runtime metrics.

## Offline перевірки

Запускайте з кореня репозиторію:

```powershell
yarn test:my:lesson03:openrouter
yarn eval:my:lesson03:openrouter
yarn eval:my:lesson03:openrouter:tool-calling
yarn check:my:lesson03:openrouter
```

Tool request використовує налаштовану модель. Recorded evals працюють з локальними fixtures і не звертаються до мережі. `check:my` охоплює typecheck, lint, format, student tests, обидва recorded evals та semantic completion gate, який перевіряє фактичний student source.

## Межі

Курси `EducationalRateProvider` є синтетичними навчальними значеннями. Live request потребує власного локального `.env`, може витратити баланс OpenRouter і не входить до обов'язкової acceptance.
