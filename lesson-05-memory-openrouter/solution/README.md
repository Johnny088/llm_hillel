# Lesson 05 OpenRouter – готове рішення

Готове рішення зберігає всі маршрути й перевірки Lesson 04 та додає client-managed Conversation State, durable JSON conversation і дозволену Long-term Memory через OpenRouter Chat Completions.

## Найпростіша локальна перевірка

Команди виконуються з кореня клонованого репозиторію, де розташований `package.json`.

```powershell
yarn test:lesson05:openrouter:solution
yarn eval:lesson05:openrouter:solution
yarn smoke:lesson05:openrouter:solution
yarn build:lesson05:openrouter
```

Очікується успішний активний набір тестів, записаний offline eval, локальний HTTP smoke та TypeScript build. Точні підрахунки наведено у звіті про фінальну перевірку. Ці команди не запускають модель.

## Поведінка розмови

- `mode="session"` зберігає історію в пам’яті процесу окремо для кожного `sessionId`.
- `POST /api/agent/conversation/reset` очищає лише вибрану session history.
- `mode="conversation"` використовує локальний `conversationId` і JSON history, що відновлюється після повторної ініціалізації store.
- Sliding window за замовчуванням зберігає не більше восьми завершених ходів, не розриваючи пари повідомлень.
- Long-term facts записуються окремо в `solution/data/user-memory.json`; durable history – у `solution/data/conversation-history.json`. Тести використовують синтетичні тимчасові шляхи.

OpenRouter отримує повну потрібну client-managed `messages` history. Якщо модель повернула `reasoning_details`, код зберігає і повторно передає ці дані без зміни під час tool loop і відновлення з JSON. Наскрізний manager test проходить публічний `send()`, реальний тимчасовий JSON, нові store, SDK client і manager, а потім перевіряє точні opaque дані в наступному SDK request для того самого `conversationId`. Публічний результат `send()` їх не розкриває. За один хід дозволений один `save_user_fact`; результат передається як Chat Completions tool message з відповідним `tool_call_id`.

## Перевірка готового рішення

```powershell
yarn check:lesson05:openrouter:solution
```

Цей lesson-scoped gate перевіряє типи, lint, форматування, успадковані маршрути й тести, Lesson 05 тести та evals, обидва MCP/HTTP smoke, збірку і негативну перевірку незавершеного кандидата. Recorded replay і локальний smoke не є доказом реального provider inference.

Окремий live eval доступний командою `yarn eval:lesson05:openrouter:solution:live`. Він потребує `OPENROUTER_API_KEY`, звертається до налаштованої моделі й може витрачати баланс; його не потрібно запускати для стандартної перевірки практики.

## Межі даних і помилок

- Дозволені лише `displayName`, `preferredStack` і `learningGoal`.
- Значення обрізаються за пробілами, мають максимум 120 символів, а ключі, токени, паролі, номери карток та інші заборонені дані не записуються.
- Помилки JSON persistence повертаються без розкриття приватного вмісту.
- Session reset не видаляє durable conversation або Long-term facts.
- JSON сховища призначені для локального навчального сценарію в одному процесі; синтетичні тести перевіряють незалежність сесій, відновлення й помилки запису.
