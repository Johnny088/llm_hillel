# Домашнє завдання — Conversation State та Memory через OpenRouter

## Мета

Завершити starter так, щоб Chat Completions отримував client-managed history,
короткочасний стан можна було очистити, durable conversation відновлювалася
після повторної ініціалізації store, а дозволені навчальні факти зберігалися
через function tool.

## Обов’язковий результат

1. `sessionId` ізолює історію різних сесій.
2. Reset видаляє лише обрану session history.
3. `conversationId` відновлює durable JSON history.
4. Sliding window залишає не більше налаштованої кількості завершених ходів.
5. OpenRouter-запит не містить `store`, `previous_response_id`, `conversation`
   або `context_management`.
6. Якщо provider повертає `reasoning_details`, наступний model call отримує їх без змін. Повний regression test починається з публічного `ConversationManager.send()`, записує справжній тимчасовий JSON, створює нові JSON store, SDK client і manager та продовжує той самий `conversationId`; наступний mocked SDK request має містити точні opaque дані. Публічний результат `send()` не розкриває `reasoning_details`; tool result зберігає той самий `tool_call_id`, що й виклик `call.id`.
7. `save_user_fact` приймає лише три дозволені категорії та відхиляє секрети.
8. Після reset дозволений факт читається з Long-term Memory.
9. Нові behavior tests та evals активні; inherited green tests самі собою не доводять завершення Lesson 05.
10. HTTP-тести перевіряють для conversation route статуси `200`, `400`, `503` і `502`, а для reset – `200`, `400` і `503`. Невалідний reset та reset без runtime не викликають manager.
11. Тести з `EACCES` і `ENOSPC` ін’єктують помилку запису тимчасового файла для `JsonUserFactStore.save()` та `executeSaveUserFactToolCall()`. Обидві операції відхиляються; попередній валідний snapshot не змінюється, тимчасовий файл прибирається, успішний tool result не повертається. Паралельні операції одного шляху серіалізуються в межах процесу, але не між процесами й не дають гарантії після раптового вимкнення живлення.

## Перевірка

```powershell
# Команди виконуються з кореня репозиторію, де розташований package.json.
yarn verify:lesson05:openrouter:scaffolding
yarn test:my:lesson05:openrouter
yarn eval:my:lesson05:openrouter
yarn verify:my:lesson05:openrouter
yarn check:my:lesson05:openrouter
```

Спочатку одноразово виконайте `yarn student:init 05 openrouter`, щоб створити власну копію в `my-dev/lesson-05-memory-openrouter/`, а потім реалізуйте нові файли за [roadmap](./roadmap-code-guide.md). Untouched starter може пройти успадковані активні тести й recorded eval, але completion gate має відхилити його через відсутні Lesson 05 файли та поведінку. Фінальний gate перевіряє лише власну папку. Recorded eval є offline evidence; він не робить запитів до моделі й не підтверджує live provider inference.
