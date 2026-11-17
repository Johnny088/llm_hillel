# Lesson 02 OpenRouter – маршрут викладача

## Мета, цінність і поведінка застосунку

### 🎯 Мета проєкту

Показати повний HTTP шлях від перевірки документа до структурованого extraction або потокового summary через OpenRouter.

### 💎 Практична цінність застосунку

Студенти бачать, де завершується локальна перевірка даних і починається зовнішній виклик моделі, а також як не приховувати помилку провайдера.

### ⚙️ Що робить застосунок

`POST /api/documents/extract` повертає сутності та summary; `POST /api/documents/summary/stream` передає SSE події `delta`, `usage`, `done` або контрольовану `error`.

> Еталонні файли відкривайте за шляхами `lesson-02-llm-api-openrouter/solution/src/...` від кореня практичного репозиторію. Під час роботи зі студентською копією відкривайте відповідні файли `src/...` в candidate; команди нижче також запускайте з кореня практичного репозиторію.

## Послідовність live coding

1. Почніть з `src/schemas/document-request.ts` і `src/app.ts`. Поясніть, що schema перевіряє тіло запиту до сервісу, а HTTP 400 означає, що запит некоректний.
2. Пройдіть `src/services/openrouter-document-ai.ts`: адаптер надсилає запит до Chat Completions, витягує structured output і повертає нормалізований результат. Порівняйте це з provider-neutral `src/services/document-ai.ts`.
3. Перевірте summary stream в `src/lib/sse.ts` і route. SSE – це текстовий протокол подій поверх HTTP: кожен `delta` містить частину тексту, `usage` передає usage, а `done` завершує успішний потік.
4. Завершіть перевірками на еталоні. Тести підставляють фіктивний клієнт; це не live-запит до OpenRouter.

## Контрольні точки з відповідями

- Порожній або неправильно сформований payload для extraction має дати HTTP 400 до виклику adapter. Запитайте, як це довести: в `tests/app.test.ts` має бути перевірка відсутності виклику сервісу.
- Валідний fixture повертає три категорії entities і непорожній summary; в `tests/openrouter-document-ai.test.ts` adapter має витягти JSON із відповіді моделі, а не повертати сире тіло провайдера.
- Для stream очікуйте впорядковані `delta → usage → done`; за помилки очікуйте `error` і закриття без `done`. Запитайте, чому usage не слід вгадувати з довжини тексту: його передає провайдер.
- `GET /health` має відповісти HTTP 200 незалежно від API ключа. Це перевіряє життєздатність HTTP сервера, а не доступність моделі.

## Команди еталона

Команди запускайте з кореня практичного репозиторію:

```powershell
corepack yarn test:lesson02:openrouter:solution
corepack yarn eval:lesson02:openrouter:solution
corepack yarn check:lesson02:openrouter:solution
```
