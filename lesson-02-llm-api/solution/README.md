# Lesson 02 — готове рішення

Готовий Document API витягує структуровані дані з тексту та створює потоковий
підсумок через OpenAI Responses API.

## Походження та зв’язок із Lesson 01

Перехід від `lesson-01-intro/solution` є концептуальним, а не буквальним
копіюванням файлів: одноразовий CLI замінено локальним Express API. Готове
рішення завершує HTTP-інфраструктуру зі `starter/`, зберігаючи вже вивчені
принципи environment-валідації, `store: false` і безпечної обробки помилок.

## Варіант 1 — одна команда для повної перевірки

Це рекомендований спосіб побачити, що саме було надіслано й що повернула
реальна модель:

```powershell
# Команди виконуються з кореня репозиторію, де розташований package.json.
yarn demo:lesson02:solution
```

Команда сама запускає тимчасовий сервер, перевіряє `/health`, робить extraction
і streaming запити, друкує їхні результати та зупиняє сервер. Успіх підтверджує
фінальний рядок `УСІ 3 ПЕРЕВІРКИ ПРОЙДЕНО, ПРОЄКТ ПРАЦЮЄ`.

Перед запуском у кореневому `.env` мають бути заповнені `OPENAI_API_KEY`,
`OPENAI_MODEL_FAST` і `OPENAI_MODEL_MAIN`. Повна підготовка описана в
[кореневому README практики](../README.md).

## Варіант 2 — постійний сервер і ручні запити

Цей режим потрібен для дослідження окремих HTTP-маршрутів.

### Крок 1. Запустити сервер у першому вікні PowerShell

```powershell
# Команди виконуються з кореня репозиторію, де розташований package.json.
yarn dev:lesson02:solution
```

У першому вікні з'явиться приблизно таке повідомлення:

```text
Document API запущено на порту 3000.
Перевірка стану: http://localhost:3000/health
Графічного веб-інтерфейсу немає. Приклади API-запитів наведено в README.
Модель для summary: <OPENAI_MODEL_FAST>
Модель для extraction: <OPENAI_MODEL_MAIN>
Для зупинки сервера: Ctrl+C
```

PowerShell prompt у цьому вікні не повертається, доки сервер працює. Вікно
потрібно залишити відкритим.

### Крок 2. Відкрити друге вікно PowerShell і перевірити сервер

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Очікуваний результат:

```text
status
------
ok
```

Ця перевірка не звертається до OpenAI. У браузері адреса `/health` покаже лише
JSON `{"status":"ok"}` — окремої вебсторінки в проєкті немає.

### Крок 3. Надіслати текст для структурованого вилучення

У другому вікні PowerShell:

```powershell
$body = @{ content = "14 липня 2026 року Олена Коваль представила демонстрацію у Львові." } | ConvertTo-Json -Compress
$result = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/documents/extract -ContentType "application/json; charset=utf-8" -Body $body
$result | ConvertTo-Json -Depth 6
```

У відповіді мають бути:

- `data.names`, `data.dates`, `data.locations`, `data.summary`;
- `usage.totalTokens`;
- `metrics.model` і `metrics.totalLatencyMs`.

Це один реальний OpenAI API-запит і він може бути платним.

### Крок 4. Перевірити потоковий підсумок

У тому самому другому вікні:

```powershell
$body = @{ content = "14 липня 2026 року Олена Коваль представила демонстрацію у Львові." } | ConvertTo-Json -Compress
curl.exe -N -X POST http://localhost:3000/api/documents/summary/stream -H "Accept: text/event-stream" -H "Content-Type: application/json" --data-raw $body
```

Під час успішного запиту з'являються named SSE-події:

```text
event: delta
data: {"delta":"..."}

event: usage
data: {"usage":{...},"metrics":{...}}

event: done
data: {"status":"completed"}
```

Це ще один реальний OpenAI API-запит. Успіх — у кінці є `event: done` зі
статусом `completed` і немає `event: error`.

### Крок 5. Зупинити сервер

Повернутися в перше вікно й натиснути `Ctrl+C`. Після цього `/health` більше не
відкриватиметься — це очікувана поведінка.

## Автоматичні перевірки без мережі

Повний gate готового рішення:

```powershell
yarn check:lesson02:solution
```

Окремі перевірки:

```powershell
yarn test:lesson02:solution
yarn test:lesson02:checkpoints
yarn eval:lesson02:solution
yarn build:lesson02
```

Offline eval використовує 5 записаних спостережень і має показати `5/5` та
`100.0%`. Він перевіряє dataset і scorer, але не поточну якість моделі.

Live eval виконує 5 реальних extraction-запитів і може бути платним:

```powershell
yarn eval:lesson02:solution:live
```

## Що реалізовано

- `POST /api/documents/extract` через `responses.parse()` і Zod Structured
  Output;
- `POST /api/documents/summary/stream` через `stream: true` і named SSE-події;
- `store: false` в обох запитах;
- валідація input, стабільні безпечні помилки, timeout і скасування upstream
  stream після закриття клієнта;
- token usage, TTFT і загальна latency.

Локальна таблиця `MODEL_PRICES` навмисно порожня, тому демонстрація показує
вартість як `не розраховано локально`, а не як неправдивий нуль. Фактичні
витрати перевіряються в OpenAI usage dashboard.

## Пов’язані навчальні інструкції

[Інструкція студента](../student-guide.md) · [Карта starter](../starter-code-guide.md) · [Roadmap коду](../roadmap-code-guide.md) · [Сценарій викладача](../instructor-guide.md)
