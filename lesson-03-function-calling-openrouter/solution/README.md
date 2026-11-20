# Lesson 03 (OpenRouter) – готове рішення

Готовий solution додає HTTP-маршрут `POST /api/agent` до успадкованого Document API. Модель може запросити локальний `convert_currency`; застосунок перевіряє параметри, виконує зареєстровану функцію та передає результат назад моделі.

## Найпростіший запуск

Відкрийте PowerShell у корені репозиторію, де є `package.json`. Один раз встановіть залежності та підготуйте кореневий `.env`:

```powershell
yarn install --immutable
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

У `.env` задайте `OPENROUTER_API_KEY` і, за потреби, одну `OPENROUTER_MODEL`. Не додавайте `.env` до Git. Потім запустіть:

```powershell
yarn demo:lesson03:openrouter:solution
```

Демонстрація запускає тимчасовий локальний API, перевіряє `/health`, надсилає `POST /api/agent` із повідомленням `Конвертуй 250 USD у UAH`, друкує хід tool calling і завершує власний сервер. Це реальний provider request і він не є обов'язковим для offline acceptance. Модель, текст і метрики можуть різнитися.

## Форма очікуваного результату

Для навчального курсу валют використовується синтетичний курс `1 USD = 41.5 UAH`. За успішного tool call локальна функція повертає структуру такого виду:

```json
{
  "status": "success",
  "data": {
    "amount": 250,
    "from": "USD",
    "to": "UAH",
    "rate": 41.5,
    "convertedAmount": 10375
  }
}
```

Це очікувана форма локального tool result, а не записаний live output. Провайдер може сформулювати остаточну відповідь інакше. Успіх означає HTTP 200, непорожній `text` і узгоджені `model`, `usage` та `metrics` у відповіді.

## Перевірки без провайдера

З кореня репозиторію:

```powershell
yarn test:lesson03:openrouter:solution
yarn eval:lesson03:openrouter:solution
yarn build:lesson03:openrouter
yarn check:lesson03:openrouter:solution
```

Unit та route tests використовують scripted clients і fake dependencies. Recorded extraction та tool-calling evals читають локальні fixtures; вони не підтверджують доступність провайдера або поведінку живої моделі. Точні active/failed/todo/skipped counts потрібно брати з фактичного актуального runner output.

## Як працює маршрут

`POST /api/agent` приймає JSON з непорожнім `message`. Агент надсилає налаштовану модель із `tools`, `tool_choice: "auto"`, `temperature: 0`, `max_completion_tokens` і `provider.require_parameters: true`.

Модель може повернути звичайний текст або assistant tool calls. Для кожного виклику код перевіряє зареєстроване ім'я, розбирає JSON і валідує `amount`, `from` та `to` через strict Zod schema. Лише після цього виконується локальна функція. Tool call і відповідь з відповідним `tool_call_id` додаються до history перед наступним model turn. Виклики обробляються послідовно; п'ятий дозволений, шостий блокується до виконання.

Фінальна відповідь містить `status`, `text`, фактичний `model`, сумарний usage і metrics `modelCallCount`, `toolCallCount`, `retryCount`, `totalLatencyMs`. Помилки мають стабільні публічні коди. Raw provider body, ключі, stack traces і внутрішній reasoning не повертаються клієнту.

## Межі поведінки

- Курси валют фіксовані для навчання й не є поточними фінансовими даними.
- Новий tool-calling маршрут використовує налаштовану OpenRouter модель.
- Timeout і bounded retry стосуються тимчасових помилок rate provider, а не прихованого повтору чи перемикання model provider.
- Повний автономний Agent Loop, ReAct, MCP і tracing не входять до Lesson 03.
- Сервер не надає графічного інтерфейсу. Для зупинки довготривалого ручного запуску використовується `Ctrl+C`.

## Сумісність із Lesson 04

Solution зберігає успадковані спільні exports/settings, які використовують downstream OpenRouter практики, зокрема уроки 05–09. Новий Lesson 03 tool-calling request використовує налаштовану модель своєї ролі. Цей спільний compatibility surface не є новою функціональністю Lesson 03.
