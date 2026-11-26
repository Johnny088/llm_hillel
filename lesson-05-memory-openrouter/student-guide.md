# Lesson 05 OpenRouter – студентський маршрут

## Мета, цінність і поведінка застосунку

### 🎯 Мета проєкту

Реалізувати session history, відновлювану conversation, reset, sliding window і окреме сховище user facts.

### 💎 Практична цінність застосунку

Ви зможете пояснити, що лишається між запитами, що очищує reset і які дані не повинні переходити між різними користувачами.

### ⚙️ Що робить застосунок

`POST /api/agent/conversation` приймає session або conversation ID; manager додає завершені turns до відповідного сховища й обмежує контекст налаштованим вікном.

Виконуйте практику в власному candidate my-dev/lesson-05-memory-openrouter/. Поточний Lesson 05 starter уже містить підготовлену Lesson 04 основу й README цього заняття. Не переносіть попередній solution вручну.

## Послідовність

1. З кореня клону перегляньте git status --short --branch і збережіть наявну роботу.
2. Прочитайте [homework](./homework.md) і [starter guide](./starter-code-guide.md). Одноразово виконайте `yarn student:init 05 openrouter`, щоб створити candidate з canonical starter у `my-dev/lesson-05-memory-openrouter/`. Команда відмовляється перезаписувати наявний destination.
3. Запустіть yarn verify:lesson05:openrouter:scaffolding. Виконуйте [roadmap](./roadmap-code-guide.md) послідовно.
4. Після реалізації запустіть yarn verify:my:lesson05:openrouter і yarn check:my:lesson05:openrouter. Перевірки мають стосуватися власного candidate.
5. Зафіксуйте команди й реальні результати. Не додавайте .env, файли сесій, user-memory.json, приватні дані або dist/.

## Що доводить успіх

Успадковані тести підтверджують тільки базу Lesson 04. Completion gate має відхилити untouched starter через відсутню Lesson 05 поведінку. Завершений candidate перевіряє session, durable history, reset, sliding window, function tool і safe persistence. Окремий regression test проходить весь шлях `reasoning_details`: перший публічний `ConversationManager.send()` записує opaque значення в тимчасовий JSON, після створення нового store, SDK client і manager наступний запит із тим самим `conversationId` передає це значення без змін. Публічний результат manager не містить `reasoning_details`.

JSON stores серіалізують повний read-modify-write за шляхом в межах одного процесу та встановлюють snapshot через тимчасовий файл і rename. Перевірка помилки запису має підтвердити незмінність попереднього snapshot і прибирання тимчасового файла. Це не координує інші процеси й не гарантує транзакцію при втраті живлення.

Локальні тести та eval офлайн; вони не доводять, що жива модель використала пам’ять. Live-запит необов’язковий для звичайної здачі.
