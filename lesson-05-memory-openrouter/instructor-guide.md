# Lesson 05 OpenRouter – маршрут викладача

## Мета, цінність і поведінка застосунку

### 🎯 Мета проєкту

Додати session history, durable conversation, reset, sliding window і незалежний набір user facts поверх готової основи Lesson 04.

### 💎 Практична цінність застосунку

Урок показує різницю між короткою історією запиту, відновлюваною розмовою та збереженими фактами користувача.

### ⚙️ Що робить застосунок

`POST /api/agent/conversation` працює з session або conversation ID; reset очищує вибрану session, тоді як durable history і user facts мають окреме сховище та життєвий цикл.

## Послідовність live coding

1. Перегляньте `src/schemas/conversation-request.ts`, далі `src/app.ts`: назвіть параметри route до обговорення сховища.
2. В `src/services/conversation-manager.ts` простежте завантаження завершеної історії, складання prompt, виклик моделі та збереження лише завершеної відповіді.
3. Порівняйте `src/memory/conversation-history.ts` і `src/memory/user-facts.ts`. Durable conversation є історією повідомлень; user facts – відібраними даними з окремим доступом. Перевірте reset і window в `tests/conversation-manager.test.ts`; там само звірте пару `tool_call_id` і приховування `reasoning_details` з публічного результату. Окремий сценарій має пройти повний restart chain: перший публічний `ConversationManager.send()` записує відповідь в тимчасовий JSON, нові store, SDK client і manager відкривають той самий `conversationId`, а наступний mocked SDK request містить точні opaque `reasoning_details`.
4. Покажіть cleanup тимчасових файлів в `tests/json-stores.test.ts`; canonical `solution/data` не є тестовим scratch space. Fault injection для write/rename має залишити попередній snapshot незмінним і прибрати тимчасовий файл.
5. В `tests/app.test.ts` перевірте conversation `200/400/503/502` і reset `200/400/503`; невалідний reset та відсутній runtime не викликають manager.
6. В `tests/user-facts.test.ts` покажіть помилки `EACCES` і `ENOSPC` під час запису тимчасового файла для прямого `save()` та `executeSaveUserFactToolCall()`. Обидва виклики мають відхилитися, попередній snapshot має лишитися валідним, тимчасовий файл має бути очищений, а успішний tool result не повертається.

## Контрольні точки з відповідями

- Два запити з тим самим session ID: другий model input містить перший завершений user/assistant turn; інший ID не бачить його.
- Reset session A залишає session B та user facts без змін. Запитайте, чому один спільний JSON store це ускладнює.
- Після перевищення window в prompt залишаються останні налаштовані завершені ходи. Невдала або порожня відповідь моделі не потрапляє до history.
- Після перезапуску durable conversation відновлюється за ID; повний manager test додатково підтверджує, що opaque `reasoning_details` із першої відповіді після створення нових store, SDK client і manager потрапляють без змін до наступного mocked SDK request. Публічний результат manager цих полів не містить; ephemeral session не варто представляти як durable state.
- Паралельні операції JSON store серіалізуються лише між екземплярами в тому самому Node.js процесі. Інший процес не координується, а rename не обіцяє транзакцію після втрати живлення.

## Команди еталона

```powershell
corepack yarn test:lesson05:openrouter:solution
corepack yarn eval:lesson05:openrouter:solution
corepack yarn check:lesson05:openrouter:solution
```
