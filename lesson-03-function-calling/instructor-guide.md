# Lesson 03 – сценарій викладача

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Пояснити цикл function calling на прикладі конвертації валюти з локальною перевіркою аргументів і контрольованим RateProvider.

### 💎 Практична цінність застосунку

Модель пропонує дію, але сервер сам перевіряє її назву й аргументи, отримує курс та обмежує кількість повторів. Курс не генерується довільним текстом.

### ⚙️ Що робить застосунок

`POST /api/agent` передає запит `ResponsesToolCallingAgent`; `convert_currency` отримує суму й коди валют, `executeCurrencyToolCall()` повертає `function_call_output` з відповідним `call_id`.

## План демонстрації

1. Покажіть, що Document API Lesson 02 вже є частиною поточного starter; не просіть переносити код попереднього заняття вручну.
2. Надішліть `Конвертуй 25 USD в UAH` і простежте model call → `function_call` → provider → `function_call_output` → фінальну відповідь.
3. Надішліть запит без суми або однієї з валют. Очікуйте уточнення без запуску інструмента.
4. Перевірте невалідні аргументи, `UNKNOWN_TOOL`, transient retry і відмову для непідтримуваної валютної пари.
5. Поясніть, що ліміт п’яти tool calls зупиняє довгий цикл до виконання шостого виклику.

## Питання з очікуваними відповідями

- **Хто перевіряє tool arguments?** `ConvertCurrencyArgsSchema` в `executeCurrencyToolCall()` безпосередньо перед `RateProvider`.
- **Чому `call_id` не змінюється?** Він з’єднує конкретний `function_call` із відповідним `function_call_output` в наступному model input.
- **Чим retry відрізняється від model iteration?** Retry повторює тимчасово невдалу зовнішню операцію; model iteration запитує наступний Responses turn. Metrics рахують їх окремо.
- **Що показує наявність function call?** Лише запропоновану операцію. Результат з’являється після її виконання застосунком.

## Підготовка й перевірки

Перегляньте `solution/src/services/tool-calling-agent.ts`, `solution/src/tools/currency.ts`, `solution/tests/tool-calling.test.ts` і `solution/tests/agent-route.test.ts`. З кореня запускайте `yarn test:lesson03:solution`, `yarn eval:lesson03:solution` та `yarn check:lesson03:solution`. Ключ OpenAI не потрібен для fake-client tests та recorded eval.

[Карта starter](starter-code-guide.md) · [Roadmap коду](roadmap-code-guide.md) · [Student guide](student-guide.md) · [Homework](homework.md).
