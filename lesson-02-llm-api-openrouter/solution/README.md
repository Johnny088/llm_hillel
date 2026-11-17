# Lesson 02 (OpenRouter) — solution

Завершений backend API (Application Programming Interface, програмний інтерфейс
серверної частини) як продовження `lesson-01-intro-openrouter/solution/`.

API-контракт (HTTP-маршрути, структура відповідей і помилок) збігається з оригінальним
`lesson-02-llm-api/solution/`, але провайдером виступає OpenRouter. Для обох
ролей за замовчуванням використовується платна
`~deepseek/deepseek-v4-flash-latest`.

## Найпростіша перевірка: одна команда

Цей варіант призначений для першого знайомства з результатом. Команда сама:

1. запускає тимчасовий локальний сервер;
2. перевіряє маршрут `/health`;
3. надсилає один реальний запит до моделі на вилучення даних;
4. надсилає один реальний потоковий запит;
5. показує, що було надіслано і що повернула модель;
6. зупиняє тимчасовий сервер.

### Крок 1. Відкрити PowerShell

PowerShell відкривається в корені клонованого репозиторію — каталозі з файлами
`package.json` і `.env.example`.

### Крок 2. Один раз підготувати проєкт

```powershell
yarn install --immutable
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

У файлі `.env` задається ключ і зберігається файл:

```dotenv
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=~deepseek/deepseek-v4-flash-latest
OPENROUTER_REASONING_EFFORT=low
OPENROUTER_MAX_OUTPUT_TOKENS=1600
```

### Крок 3. Запустити демонстрацію

```powershell
Remove-Item Env:OPENROUTER_MODEL,Env:OPENROUTER_MODEL_FAST,Env:OPENROUTER_MODEL_MAIN,Env:OPENROUTER_REASONING_EFFORT,Env:OPENROUTER_MAX_OUTPUT_TOKENS -ErrorAction SilentlyContinue
yarn demo:lesson02:openrouter:solution
```

Перший рядок очищує лише тимчасові model-настройки поточного PowerShell. Це
важливо після попередніх експериментів: process env має вищий пріоритет за
кореневий `.env` і інакше може непомітно залишити стару модель.

Сервер окремо запускати не потрібно. Друге вікно PowerShell не потрібне.
Команда виконує два реальні платні запити. Перед запуском перевірте актуальну
ціну й баланс OpenRouter; для перевірки без витрат використовуйте offline-тести.

У терміналі з'явиться звіт такого виду:

```text
=== ДЕМОНСТРАЦІЯ LESSON 02 ЧЕРЕЗ OPENROUTER ===
Текст для перевірки: 14 липня 2026 року Олена Коваль представила демонстрацію у Львові.
Основна модель (summary): ~deepseek/deepseek-v4-flash-latest
Основна модель (extraction): ~deepseek/deepseek-v4-flash-latest
Reasoning effort: low

[1/3] Перевірка локального сервера
Отримано: HTTP 200, status=ok
Висновок: локальний HTTP API працює.

[2/3] Структуроване вилучення даних
Отримано: HTTP 200
  Імена: Олена Коваль
  Дати: 14 липня 2026 року
  Місця: Львові
  Підсумок: ...
  Модель: deepseek/deepseek-v4-flash
  Час: ... с
  Токени: ...
  Вартість: ...

[3/3] Потоковий підсумок
Отримано: HTTP 200
  Повний текст: ...
  Модель: deepseek/deepseek-v4-flash
  Повний час: ... с
  Токени: ...
  Вартість: ...

=== ПІДСУМОК: УСІ 3 ПЕРЕВІРКИ ПРОЙДЕНО, ПРОЄКТ ПРАЦЮЄ ===
```

Текст після `Підсумок`, час, кількість токенів і фактичний ID моделі
можуть відрізнятися. Критерій успішної перевірки — фінальний рядок
`УСІ 3 ПЕРЕВІРКИ ПРОЙДЕНО, ПРОЄКТ ПРАЦЮЄ`.

Якщо OpenRouter поверне rate limit, замість результату моделі буде однозначне
повідомлення з кодом `UPSTREAM_RATE_LIMITED`.

Це не помилка локального сервера: крок `[1/3]` уже підтвердив його роботу. Після
відновлення доступу повторюється та сама команда; код і `.env` змінювати не
потрібно.

Власний текст передається після команди:

```powershell
yarn demo:lesson02:openrouter:solution "3 вересня Марія Савчук проведе воркшоп у Києві."
```

## Чим відрізняється від оригіналу Lesson 02

| Аспект             | lesson-02-llm-api                       | lesson-02-llm-api-openrouter                                                                               |
| ------------------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| API                | OpenAI Responses API                    | OpenAI-сумісний Chat Completions через OpenRouter                                                          |
| Структуровані дані | `responses.parse()` + `zodTextFormat()` | строгий `response_format: { type: "json_schema" }` + локальний `JSON.parse` і `ExtractionSchema.safeParse` |
| Streaming          | SSE-події `response.output_text.delta`  | SSE-події `choices[].delta.content`                                                                        |
| Ключі оточення     | `OPENAI_*`                              | `OPENROUTER_*`, одна базова модель і опційні role overrides                                                |
| Повтори запитів    | `maxRetries: 1`                         | `maxRetries: 0` (не збільшувати витрати, не дублювати streaming)                                           |

**SSE (Server-Sent Events)** — формат потокових HTTP-подій. **TTFT (Time to
First Token)** — час від початку запиту до першого текстового фрагмента.

## Що саме запускається

`solution` — готовий backend API без графічного веб-інтерфейсу. У браузері
перевіряється лише службовий маршрут `/health`. Маршрути, які звертаються до
мовної моделі, приймають HTTP `POST`-запити з PowerShell, `curl.exe` або іншого
API-клієнта.

Стандартний порт — `3000`. Фактичний порт завжди виводиться в терміналі після
запуску та береться зі змінної `PORT` у кореневому `.env`.

## Ручна перевірка HTTP API: два вікна PowerShell

Цей варіант показує роботу довготривалого сервера та окремих HTTP-запитів.
Для першої перевірки достатньо однокомандної демонстрації з попереднього розділу.

### Вікно 1 — сервер

Рекомендований робочий каталог — корінь репозиторію. Саме там розташовані
`package.json`, `yarn.lock`, `.env.example` і робочий `.env`.

```powershell
yarn install --immutable
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

У відкритому `.env` задається ключ і зберігається файл:

```dotenv
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=~deepseek/deepseek-v4-flash-latest
OPENROUTER_REASONING_EFFORT=low
OPENROUTER_MAX_OUTPUT_TOKENS=1600
PORT=3000
```

Після збереження `.env` сервер запускається в тому самому вікні:

```powershell
Remove-Item Env:OPENROUTER_MODEL,Env:OPENROUTER_MODEL_FAST,Env:OPENROUTER_MODEL_MAIN,Env:OPENROUTER_REASONING_EFFORT,Env:OPENROUTER_MAX_OUTPUT_TOKENS -ErrorAction SilentlyContinue
yarn dev:lesson02:openrouter:solution
```

Очікуваний результат:

```text
Document API запущено на порту 3000.
Перевірка стану: http://localhost:3000/health
Основна модель (summary): ~deepseek/deepseek-v4-flash-latest
Основна модель (extraction): ~deepseek/deepseek-v4-flash-latest
Графічного веб-інтерфейсу немає. Приклади API-запитів наведено в README.
Для зупинки сервера: Ctrl+C
```

Вікно 1 залишається відкритим. Відсутність нового запрошення `PS ...>` означає,
що процес сервера продовжує працювати. Зупинка виконується комбінацією `Ctrl+C`.

### Вікно 2 — перевірка

Стан сервера перевіряється в іншому вікні PowerShell:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Очікуване значення поля `status` — `ok`. Той самий результат відкривається у
браузері за адресою <http://localhost:3000/health>.

Справжній запит до моделі виконується у вікні 2:

```powershell
$body = @{ content = "14 липня 2026 року Олена Коваль представила демонстрацію у Львові." } | ConvertTo-Json -Compress
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/documents/extract" -Method Post -ContentType "application/json; charset=utf-8" -Body $body
$response | ConvertTo-Json -Depth 6
```

Команда навмисно записана без PowerShell-backtick: її можна вставити як три
окремі цілі рядки, і перенос із браузера не пошкодить аргументи.

Відповідь містить `data` з іменами, датами, місцями й підсумком, а також
`usage` і `metrics`. Точне формулювання підсумку може змінюватися, оскільки
відповідь генерується реальною мовною моделлю.

## Запуск з каталогу заняття, starter або solution

Після одноразового встановлення залежностей і створення кореневого `.env` Yarn
знаходить батьківський `package.json`. Тому команда
`yarn dev:lesson02:openrouter:solution` також запускається з каталогів
`lesson-02-llm-api-openrouter`, `starter` і `solution`.

Поточний каталог не вибирає версію практики. Команда без суфікса `:solution`
запускає незавершений `starter`; команда із суфіксом запускає готовий
`solution`.

## Як вибирається модель

`OPENROUTER_MODEL` задає базову модель для summary та extraction. За потреби
`OPENROUTER_MODEL_FAST` і `OPENROUTER_MODEL_MAIN` можуть явно розділити ці ролі.
Кожна операція використовує модель своєї налаштованої ролі.

## Якщо браузер показує `ERR_CONNECTION_REFUSED`

- перевіряється порт у повідомленні вікна 1;
- перевіряється, що вікно 1 досі відкрите й після повідомлення запуску не
  з'явилося нове запрошення `PS ...>`;
- використовується адреса з `/health`, наприклад
  `http://localhost:3000/health`;
- команда запуску повторюється після виправлення помилки, надрукованої у
  вікні 1.

`ERR_CONNECTION_REFUSED` означає, що на вказаному порту немає запущеного
сервера. Ця помилка виникає до звернення до OpenRouter і не є відповіддю мовної
моделі.

## Якщо виводиться стара модель або `STRUCTURED_OUTPUT_UNSUPPORTED`

1. Зупиніть сервер через `Ctrl+C` у його вікні.
2. Виконайте очищення тимчасових override одним рядком:

```powershell
Remove-Item Env:OPENROUTER_MODEL,Env:OPENROUTER_MODEL_FAST,Env:OPENROUTER_MODEL_MAIN,Env:OPENROUTER_REASONING_EFFORT,Env:OPENROUTER_MAX_OUTPUT_TOKENS -ErrorAction SilentlyContinue
```

3. Повторіть `yarn demo:lesson02:openrouter:solution` або запуск сервера.

Якщо banner знову показує не `~deepseek/deepseek-v4-flash-latest`, відкрийте
нове вікно PowerShell: старе значення все ще надходить із process env.

## Якщо повертається `INCOMPLETE_RESPONSE`

Перевірте, що в кореневому `.env` задано
`OPENROUTER_MAX_OUTPUT_TOKENS=1600`. Значення `800` може повністю витратитися на
hidden reasoning до появи фінального JSON.

## Перевірка без мережі

```bash
yarn test:lesson02:openrouter:solution
yarn eval:lesson02:openrouter:solution
yarn build:lesson02:openrouter
yarn check:lesson02:openrouter:solution
```

`yarn eval:lesson02:openrouter:solution` запускає deterministic replay п'яти
записаних спостережень. Очікуваний результат: `Result: 5/5`, `Success rate: 100.0%`.

## Перевірка каталогу та live eval

Перед платними inference-запитами можна окремо перевірити публічний каталог без
API key і без витрат:

```bash
yarn eval:lesson02:openrouter:solution:catalog
```

Live eval — це п'ять додаткових реальних запитів для оцінки стабільності
відповідей. Локальний сервер для цієї команди не потрібний. Після заповнення
кореневого `.env` виконується одна команда:

```bash
yarn eval:lesson02:openrouter:solution:live
```

`...:live` виконує п'ять реальних платних запитів і перевіряє публічний каталог
OpenRouter (`live-catalog.ts`): існування налаштованих моделей, зареєстровану
ціну та підтримку параметрів `response_format`, `reasoning` і вибраного
reasoning effort.
Для кожного запиту виводяться надісланий текст, фактична відповідь моделі, час
відповіді, кількість токенів і зрозумілий результат перевірки.

## Ручна перевірка інших HTTP-маршрутів

Потоковий SSE-запит через `curl.exe`:

```powershell
curl.exe --no-buffer --request POST `
  http://localhost:3000/api/documents/summary/stream `
  --header "Content-Type: application/json; charset=utf-8" `
  --data-raw '{"content":"Навчальний API успішно пройшов перевірку."}'
```

## HTTP API

### `POST /api/documents/extract`

Успішна відповідь:

```json
{
  "data": {
    "names": ["Олена Коваль"],
    "dates": ["14 липня"],
    "locations": ["Львова"],
    "summary": "Олена Коваль приїхала до Львова 14 липня."
  },
  "usage": {
    "inputTokens": 100,
    "outputTokens": 30,
    "totalTokens": 130,
    "cachedTokens": 0,
    "cacheWriteTokens": 0
  },
  "metrics": {
    "model": "configured-model-id",
    "totalLatencyMs": 420,
    "cacheHitRate": 0,
    "estimatedCostUsd": 0.00001,
    "pricingAvailable": true
  }
}
```

Якщо OpenRouter повертає вартість запиту, застосунок використовує її навіть
без локальної ціни моделі. Якщо немає ні вартості від OpenRouter, ні ціни у
`MODEL_PRICES`, `metrics` містить:

```json
{
  "estimatedCostUsd": null,
  "pricingAvailable": false,
  "pricingUnavailableReason": "MODEL_NOT_CONFIGURED"
}
```

### `POST /api/documents/summary/stream`

Потік містить named SSE-події:

```text
event: delta
data: {"delta":"Короткий "}

event: usage
data: {"usage":{...},"metrics":{...}}

event: done
data: {"status":"completed"}
```

Після refusal, incomplete response, failed response або stream error подія
`done` не надсилається.

## Архітектурні рішення для OpenRouter

- OpenAI SDK використовується як OpenAI-сумісний клієнт OpenRouter
  (`baseURL: https://openrouter.ai/api/v1`).
- Adapter `OpenRouterDocumentAi` реалізує провайдер-незалежний інтерфейс `DocumentAi`.
- `resolveModelCapabilities()` зберігає точний режим `response_format` для
  перевірених моделей. Для невідомих моделей provider-specific параметри не
  надсилаються.
- DeepSeek V4 Flash використовує строгий
  `response_format: { type: "json_schema", ... }`. Після отримання відповіді
  застосунок додатково виконує локальні `JSON.parse` та
  `ExtractionSchema.safeParse`.
- Для структурованого JSON використовується `provider.require_parameters`, щоб
  маршрутизація не обрала несумісний endpoint.
- Для коротких extraction і summary використовується reasoning effort із
  `OPENROUTER_REASONING_EFFORT` (рекомендовано `low`), а reasoning-текст
  виключається з відповіді. Низький рівень залишає більшу частину вихідного
  ліміту для результату, зменшує latency та витрати. `temperature: 0` зменшує
  випадковість результату.
- Значення `locations` очищуються від початкового прийменника: відповідь
  `у Львові` перетворюється на назву `Львові`, якщо вона дослівно присутня у
  вхідному тексті.
- streaming-запит використовує `stream: true`. OpenRouter автоматично додає
  usage у фінальний chunk; застарілий `stream_options.include_usage` не
  передається. Дані з `choices[].delta.content` надсилаються лише як текст підсумку;
  службові поля (reasoning, provider metadata) у текст користувача не потрапляють.
- `maxRetries: 0`, щоб SDK не створював окремих повторних HTTP-запитів і не
  дублював streaming. Автоматична заміна моделі не виконується.
- Опція `store: false` не використовується: вона не є гарантією приватності
  OpenRouter. Для зберігання документів варто звертатися до документації OpenRouter.

## Стабільний error contract

```json
{
  "error": {
    "code": "MALFORMED_JSON",
    "message": "Тіло запиту містить невалідний JSON."
  }
}
```

Provider message, stack trace, API key і повний input до клієнтської помилки не
додаються. Запит і відповідь тестуються без реальної мережі у
`solution/tests/`.

## Безпека й обмеження

- Rate limit завершує запит стабільною помилкою `UPSTREAM_RATE_LIMITED` без
  provider message; прихованої заміни моделі немає.
- model IDs надходять лише з environment;
- короткий підсумок обмежено 60 словами, reasoning effort береться з
  `OPENROUTER_REASONING_EFFORT` (рекомендовано `low` для меншого обсягу
  міркувань). `exclude: true` лише приховує reasoning-текст у відповіді;
  ці токени й далі враховуються у вихідному ліміті та вартості, тому
  `INCOMPLETE_RESPONSE` з причиною `max_tokens` залишається можливим;
- `finish_reason: length` завжди мапиться на `INCOMPLETE_RESPONSE`; часткова
  відповідь не приймається навіть тоді, коли її текст схожий на JSON;
- request body обмежено 32 KiB, поле `content` — 20 000 символами;
- клієнтське закриття SSE-з'єднання скасовує upstream request;
- повний error object, input document, API key і headers не повертаються;
- сторонні endpoints не призначені для персональних, закритих або
  конфіденційних документів без належної політики обробки даних;
- `MODEL_PRICES` містить перевірену базову модель; для інших невідомих моделей
  ціна не підмінюється нулем.

## Контрольна точка фінального проєкту

Три заповнені варіанти з проблемою, користувачем, результатом, джерелами даних
і ризиками містяться у `final-project-ideas.md`.
