# Student guide – Lesson 03: Function Calling через OpenAI

**Робочий контракт студента.** Non-Markdown файли канонічного `starter/` байтово тотожні OpenAI `solution/` Lesson 02. Один раз створіть копію командою `yarn student:init 03 openai`; вона не перезаписує наявну роботу. Виконуйте вимоги Lesson 03 лише в `my-dev/lesson-03-function-calling/`. Зелені успадковані тести підтверджують попередню основу, а не завершення поточної теми. Повний критерій завершення перевіряє `yarn student:check 03 openai`.

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Навчитися приймати модельний function call лише після локальної перевірки його назви й аргументів.

### 💎 Практична цінність застосунку

Проміжний output інструмента зберігає `call_id`, а помилки й retry мають окремі типи та обмеження.

### ⚙️ Що робить застосунок

Currency agent приймає `/api/agent`, дає моделі `convert_currency` та виконує його через `RateProvider`; успадкований Document API Lesson 02 вже підключений до цього starter.

Почніть із [INSTRUCTION.md](../INSTRUCTION.md), а для підготовки гілки, робочої папки та здачі дотримуйтеся [STUDENTS.md](../STUDENTS.md). Цей маршрут призначений для OpenAI-треку. Обов'язкові вимоги задає [homework.md](./homework.md).

## 1. Підготуйте робоче місце

Запустіть Промпт 1 зі STUDENTS.md і вкажіть заняття 03 та трек OpenAI. Для нової роботи очікується гілка **lesson-03-function-calling** і папка **my-dev/lesson-03-function-calling/**, скопійована зі starter. Працюйте лише в своїй папці. Не змінюйте канонічні starter, solution чи dev.

Після підготовки відкрийте створений README в my-dev. Команди виконуються з кореня репозиторію, де міститься package.json. Не створюйте папку вручну, якщо Промпт 1 уже підготував її.

## 2. З'ясуйте стартовий контракт

Канонічний `starter/` є байтово тотожним non-Markdown snapshot Lesson 02 solution. У ньому ще немає `POST /api/agent` чи Function Calling runtime; створіть їх у `my-dev/lesson-03-function-calling/`, не змінюючи успадкований Document API.

Практика додає один Responses API tool – convert_currency. Модель пропонує назву функції та аргументи, а ваш код перевіряє їх, виконує локальну функцію, повертає function_call_output з тим самим call_id і продовжує model turn. Модель не виконує функцію самостійно.

## 3. Реалізуйте кроки в roadmap

Виконуйте [roadmap-code-guide.md](./roadmap-code-guide.md) по порядку в папці my-dev/lesson-03-function-calling/. Він проводить від Zod-контракту інструмента через безпечне виконання, retry та Responses loop до HTTP-маршруту і regression tests. Для кожного кроку звіряйтеся з homework.md і запускайте вказаний scoped check.

Не переносіть OpenRouter поля до цього треку. Тут використовується OpenAI Responses API: input, function_call, call_id, function_call_output, max_output_tokens, parallel_tool_calls та store.

## 4. Запустіть офлайн-перевірки

З кореня репозиторію запускайте лише student-команди, які Prompt 1 додав для вашої робочої папки:

```powershell
yarn student:test 03 openai
yarn student:eval 03 openai
yarn student:check 03 openai
```

Повний check охоплює TypeScript, lint, форматування, активні тести та обидва recorded eval-набори. Усі перевірки виконуються без запиту до OpenAI. Recorded eval перевіряє дані та scorer, але сам собою не доводить, що ваш агент звернувся до моделі. Готовність визначайте за фактичними результатами, нульовими todo/skipped/failed і вимогами homework.md.

Якщо перевірка лишилася червоною, спочатку прочитайте перше повідомлення про помилку. Після зміни коду повторіть саме пошкоджений scoped check, а потім повний student check.

## 5. За бажанням перевірте live-запит

Live-запуск не потрібен для основного Definition of Done. Якщо ви його обираєте, спершу оцініть допустимий бюджет. В кореневому локальному .env мають бути OPENAI_API_KEY, OPENAI_MODEL_FAST і OPENAI_MODEL_MAIN. Не показуйте та не додавайте ключ до Git.

Запустіть student-сервер, а потім надішліть синтетичний запит до локального API:

```powershell
yarn dev:my:lesson03:openai
```

```powershell
$body = @{ message = "Конвертуй 250 USD у UAH" } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri http://localhost:3000/api/agent -Method Post -ContentType "application/json; charset=utf-8" -Body $body
```

Такий запит використовує OpenAI API і може бути платним. Запишіть live-результат окремо від unit tests та recorded evals. Зупиніть сервер через Ctrl+C.

## 6. Підготуйте здачу

Запустіть Промпт 2 зі STUDENTS.md. Здавайте свою гілку та папку my-dev/lesson-03-function-calling/ з перевіреним commit SHA. Перед здачею запустіть повний student check і перевірте git status. Не створюйте Merge Request до upstream, якщо викладач окремо цього не просив.
