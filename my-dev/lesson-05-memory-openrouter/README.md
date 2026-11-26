# Lesson 05 OpenRouter – памʼять розмови

Застосунок зберігає успадковані маршрути практики 04. `POST /api/agent/conversation` продовжує окрему сесію або збережену розмову. `POST /api/agent/conversation/reset` очищає вказану сесію.

## Перевірити роботу

Відкрийте термінал в корені репозиторію, де лежить `package.json`.

```powershell
yarn student:check 05 openrouter
```

Очікується `PASS student:check 05 openrouter`. Команда перевіряє вашу копію, запускає незалежні тести проти вашого коду, відтворює записані сценарії та збирає застосунок.

## Перевірити маршрути локально

```powershell
node scripts/run-tsx-entrypoint.mjs my-dev/lesson-05-memory-openrouter/scripts/smoke-conversation-api.ts
```

Скрипт використовує підставну відповідь менеджера розмови, перевіряє HTTP-відповіді й завершує сервер.

## Де зберігаються дані

Історія зберігається в `data/conversation-history.json`, факти – в `data/user-memory.json`. Файли `*.example.json` показують форму даних. Робочі JSON-файли створюються під час запису й ігноруються Git.
