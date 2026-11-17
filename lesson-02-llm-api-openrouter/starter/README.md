# Lesson 02 (OpenRouter) — starter

Незавершена версія практики. Навчальна мета — реалізувати backend API
(Application Programming Interface, програмний інтерфейс серверної частини)
через OpenRouter. Спочатку реалізується extraction (структуроване вилучення
даних) і streaming (поступове надсилання відповіді) у
`src/services/openrouter-document-ai.ts`, потім — HTTP-маршрути у `src/app.ts`.
Одноразовий CLI з Lesson 01 концептуально перетворюється на довготривалий HTTP-сервер;
готова серверна інфраструктура вже надана, тому робота зосереджена на новому API-контракті.

**SSE (Server-Sent Events)** — формат іменованих подій у потоковому
HTTP-з'єднанні. **Structured Output** — режим, у якому модель повертає JSON за
заданою схемою; його поля та типи додатково перевіряє локальна Zod-схема.

## Як спочатку побачити готовий результат

З кореня репозиторію запускається однокомандна демонстрація готового `solution`:

```powershell
yarn demo:lesson02:openrouter:solution
```

Команда показує надісланий текст, фактичні відповіді моделі та фінальний висновок
про працездатність. Після ознайомлення робота продовжується в `starter`.

## Де запускати команди

Корінь репозиторію — це батьківська папка курсу (та, у якій лежить `package.json`
і `yarn.lock`). Залежності встановлюються з кореня:

```bash
yarn install --immutable
```

Файл `.env` також створюється з кореня: скопіювати `.env.example` у `.env` і
вписати `OPENROUTER_API_KEY`. Від Lesson 02 сервер читає лише цей кореневий
файл і не використовує `dev/.env`. За замовчуванням для обох ролей
використовується платна `~deepseek/deepseek-v4-flash-latest`.

Порожні `OPENROUTER_MODEL_FAST` і `OPENROUTER_MODEL_MAIN` у скопійованому
`.env.example` означають використання `OPENROUTER_MODEL` як базової моделі для
обох ролей. Прихованого переходу на іншу модель немає.

Yarn-команди запускаються з кореня репозиторію, з папки заняття, зі `starter` або
зі `solution` — результат однаковий, бо всі команди прописані в кореневому
`package.json`. Версія практики вибирається командою, а не поточною папкою:

```bash
yarn dev:lesson02:openrouter          # starter
yarn dev:lesson02:openrouter:solution # повна реалізація
```

## Що вже працює

- `GET /health` повертає `{"status":"ok"}`;
- валідація HTTP-вхідних даних: порожній `content`, unknown fields,
  malformed JSON, body понад 32 KiB;
- маршрути `/api/documents/extract` і `/api/documents/summary/stream`
  повертають `501 NOT_IMPLEMENTED`;
- `src/config/model-capabilities.ts` містить готовий консервативний реєстр
  перевірених provider-specific параметрів;
- `tests/scaffolding.test.ts` містить 5 активних baseline-тестів готової
  конфігурації, схем, capability registry і метрик;
- `tests/app.test.ts` містить 12 незавершених тестів (`it.todo`) —
  усі мають стати звичайними `it` після реалізації.

## Запуск сервера (starter)

```bash
yarn dev:lesson02:openrouter
```

Очікуваний результат у консолі:

```text
Document API запущено на порту 3000.
Перевірка стану: http://localhost:3000/health
Основна модель (summary): ~deepseek/deepseek-v4-flash-latest
Основна модель (extraction): ~deepseek/deepseek-v4-flash-latest
Графічного веб-інтерфейсу немає. Приклади API-запитів наведено в README.
Для зупинки сервера: Ctrl+C
```

Перевірка `/health` (PowerShell):

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Або через `curl.exe`:

```bash
curl.exe http://localhost:3000/health
```

Очікуваний результат: `{"status":"ok"}`.

## Як перевірити незавершені маршрути

```powershell
$body = @{ content = "14 липня Олена Коваль приїхала до Львова." } | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:3000/api/documents/extract -Method Post -ContentType "application/json" -Body $body
```

Очікуваний результат: HTTP `501` з `{"error":{"code":"NOT_IMPLEMENTED",...}}`.

## Тести, eval і перевірка

```bash
yarn test:lesson02:openrouter        # 5 active baseline + 12 it.todo
yarn eval:lesson02:openrouter        # offline eval, recorded replay
yarn build:lesson02:openrouter       # production build готового solution
yarn check:lesson02:openrouter       # повна перевірка starter
```

Очікуваний результат `eval`: `Result: 5/5`, `Success rate: 100.0%`.

## Чим starter відрізняється від solution

|                                | starter                   | solution                       |
| ------------------------------ | ------------------------- | ------------------------------ |
| Адаптер `OpenRouterDocumentAi` | скелет із `TODO`          | повна реалізація               |
| Маршрути extract/stream        | `501 NOT_IMPLEMENTED`     | повний API з SSE і metrics     |
| Тести                          | 5 baseline + 12 `it.todo` | повні offline-тести без мережі |
| Ціни                           | `MODEL_PRICES` порожній   | перевірена ціна DeepSeek       |

Під час реалізації адаптер має додати `provider.require_parameters: true` до
структурованого JSON-запиту.
Для DeepSeek V4 Flash використовується строгий
`response_format: { type: "json_schema", ... }`. Після `JSON.parse` результат
обов'язково проходить локальну `ExtractionSchema.safeParse`. Фактичний ID
моделі береться з відповіді OpenRouter, а не з локальної конфігурації.

## Вартість, квоти й приватність

- `~deepseek/deepseek-v4-flash-latest` — платна модель. Перед live-демо
  перевірте актуальну ціну та баланс в OpenRouter; offline-тести мережу не
  використовують і кошти не витрачають.
- Повтори з боку SDK вимкнені (`maxRetries: 0`), щоб не збільшувати витрати й не
  дублювати streaming-запити. Інша модель автоматично не підставляється.
- Сторонні endpoints не призначені для персональних, закритих або
  конфіденційних документів без належної політики обробки даних.
- Опція `store: false` не використовується: вона не є гарантією приватності
  OpenRouter.
