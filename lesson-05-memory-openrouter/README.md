# Lesson 05 OpenRouter – Conversation State та Memory

У цій практиці до готового API додаються пам’ять поточної розмови та окреме JSON-сховище дозволених фактів. Готове рішення зберігає попередні маршрути Lesson 04 і додає `POST /api/agent/conversation` та `POST /api/agent/conversation/reset`.

## Як запустити готове рішення

Команди виконуються з кореня клонованого репозиторію, де розташований `package.json`.

1. Встановіть залежності командою `yarn install --immutable`.
2. Створіть кореневий `.env` з `.env.example` і задайте `OPENROUTER_API_KEY`.
3. Запустіть сервер:

```powershell
yarn dev:lesson05:openrouter:solution
```

Сервер продовжує працювати до `Ctrl+C`. У другому вікні PowerShell надішліть синтетичний приклад:

```powershell
$body = @{
  mode = "session"
  sessionId = "student-1"
  message = "Запам'ятай синтетичний маркер LIME-42 у межах цієї сесії."
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/agent/conversation" -ContentType "application/json" -Body $body
```

Надішліть наступне повідомлення з тим самим `sessionId` і запитайте маркер. У відповіді має бути `mode="session"`, `retainedTurns=2` і `LIME-42`. Це приклад реального запиту до налаштованої моделі; він може витрачати баланс OpenRouter. Зупиніть сервер через `Ctrl+C`.

## Що вже працює та що додається

`starter` є фізичною копією Lesson 04 OpenRouter solution. Його успадковані маршрути, код, тести й evals уже працюють. Єдиний файл starter, який відрізняється від успадкованого набору, – `starter/README.md`. Нових Lesson 05 маршрутів, memory-файлів, конфігурації чи тестів у ньому ще немає.

У практиці створюються короткочасна історія за `sessionId`, durable JSON history за локальним `conversationId`, sliding window повних ходів та окреме сховище фактів. `reset` очищає лише вибрану короткочасну session; durable conversation і Long-term facts залишаються. JSON-файли є навчальними даними, а тести мають використовувати синтетичні тимчасові шляхи.

## Перевірки

З кореня репозиторію можна перевірити успадковану базу та записані приклади:

```powershell
yarn verify:lesson05:openrouter:scaffolding
yarn test:lesson05:openrouter
yarn eval:lesson05:openrouter
```

Ці результати підтверджують лише базу Lesson 04. Незмінений starter має бути відхилений completion gate, бо в ньому відсутня робота Lesson 05. Після проходження студентського маршруту перевірте власну папку командами `yarn check:my:lesson05:openrouter` та `yarn verify:my:lesson05:openrouter`.

Готове рішення має окремі тести, записаний eval і локальний HTTP smoke:

```powershell
yarn test:lesson05:openrouter:solution
yarn eval:lesson05:openrouter:solution
yarn smoke:lesson05:openrouter:solution
yarn build:lesson05:openrouter
```

Unit-тести, recorded eval і HTTP smoke не виконують запитів до моделі. Вони не підтверджують live-доступність OpenRouter.

## Варіанти роботи

| Варіант                              | Призначення                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| `starter`                            | Завершена основа Lesson 04 для початку роботи; нова поведінка створюється за гайдом. |
| `solution`                           | Повний еталон Lesson 05 для читання та локальної перевірки.                          |
| `my-dev/lesson-05-memory-openrouter` | Окрема студентська копія starter, яку змінюють за roadmap.                           |

## Межі реалізації

Кожен OpenRouter Chat Completions виклик отримує повну потрібну client-managed `messages` history; `conversationId` є локальним ID застосунку. Код не використовує `store`, `previous_response_id` чи Conversation object. Дозволені Long-term facts обмежені категоріями `displayName`, `preferredStack` і `learningGoal`; невідомі або схожі на секрети значення відхиляються.

## Детальні інструкції

- [Студентський маршрут](./student-guide.md)
- [Опис успадкованого starter](./starter-code-guide.md)
- [Покрокова реалізація](./roadmap-code-guide.md)
- [Підготовка власної student-копії](./dev-migration-guide.md)
- [Домашнє завдання](./homework.md)
- [Готове рішення](./solution/README.md)
