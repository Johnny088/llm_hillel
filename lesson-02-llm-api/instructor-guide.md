# Lesson 02 – сценарій викладача

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Показати, як одна сервісна межа обслуговує structured extraction і streaming summary через HTTP.

### 💎 Практична цінність застосунку

Студенти бачать межу між вхідною валідацією, provider adapter і стабільним API, а також вчаться відрізняти успішне завершення від відмови чи неповної генерації.

### ⚙️ Що робить застосунок

`POST /api/documents/extract` повертає поля документа, usage і метрики; `/api/documents/summary/stream` передає named SSE events. Реалізація тестується фейковим клієнтом без мережі.

## Ритм заняття

1. Почніть із запиту `{"content":"14 липня Олена Коваль представила звіт у Львові."}` і попросіть назвати вихідні сутності та формат відповіді.
2. Порівняйте `DocumentRequestSchema` з `ExtractionSchema`: перша захищає межу API, друга перевіряє форму відповіді моделі.
3. Простежте один extraction від `createApp()` до `DocumentAi.extract()` та назад до JSON response.
4. Прочитайте один stream event і перевірте, чому `done` не має з’являтися після `incomplete` або `refusal`.
5. Завершіть тестами й зафіксуйте різницю між offline scorer та реальним provider викликом.

## Питання з очікуваними відповідями

- **Чому adapter не повертає довільний текст для extraction?** `ExtractionSchema` вимагає чотири поля й відкидає зайві; маршрут отримує typed result, а не JSON, розібраний навмання.
- **Чому `event: done` є окремим від `event: error`?** Клієнт може однозначно зрозуміти, чи потік завершився успішно. Тест `emits an SSE error and no done event for incomplete generation` закріплює цей контракт.
- **Чому є два model task names?** `resolveModel()` обирає налаштовану модель за задачею, тому зміна конфігурації не вимагає редагування route.
- **Що доводить offline eval?** Лише scorer на зафіксованих observations; він не викликає adapter і не підтверджує доступ до OpenAI.

## Перевірка до заняття

Відкрийте `solution/src/app.ts`, `solution/src/services/openai-document-ai.ts` і `solution/tests/app.test.ts`. Запускайте `yarn test:lesson02:solution`, `yarn eval:lesson02:solution` та `yarn check:lesson02:solution` з кореня. Live API не є необхідною частиною демонстрації.

Для детального маршруту використовуйте [roadmap коду](roadmap-code-guide.md), а критерії здавання лишаються в [homework.md](homework.md).
