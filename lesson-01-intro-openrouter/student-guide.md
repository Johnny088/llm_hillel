# Навігатор студента — Lesson 01: Перший запит до мовної моделі через OpenRouter CLI

Почніть із [INSTRUCTION.md](../INSTRUCTION.md) як головної точки входу, потім скористайтеся [STUDENTS.md](../STUDENTS.md) для Промптів 1 і 2 та правил my-dev. Цей навігатор веде до roadmap і homework для Lesson 01.

---

## 📚 Повний комплект гайдів заняття

У цій папці підготовлено детальні посібники для успішного старту та виконання завдань:

1. 🔍 **[starter-code-guide.md](./starter-code-guide.md) — Знайомство зі стартовим кодом**
   - Ментальна модель розподілу обов'язків: `src/index.ts` (оркестрація) → `src/cli.ts` (тестована логіка) → `tests/cli.test.ts` (контракт поведінки).
   - Повний потік даних програми: від читання `.env` до виводу в термінал.
   - Що вже готово у starter, а що реалізує студент.

2. 🛠️ **[roadmap-code-guide.md](./roadmap-code-guide.md) — Повний покроковий гайд виконання роботи**
   - Детальне покрокове керівництво від порожніх TODO до повної консольної утиліти:
     - **Крок 1:** валідація змінних середовища через Zod (`loadEnvironment`) без витоку секретів.
     - **Крок 2:** зчитування аргументів CLI (`readUserInput`).
     - **Крок 3:** безпечна обробка помилок API (`formatApiFailure`: HTTP 401, таймаути, загальний HTTP 429).
     - **Крок 4:** один запит до вибраної моделі (`requestAnswer`) з reasoning effort та max_completion_tokens.
     - **Крок 5:** написання unit-тестів в `tests/cli.test.ts` з використанням mock-клієнта (без мережевого API-запиту).
   - Повний код, построкові пояснення та схеми.

3. 📋 **[homework.md](./homework.md) — Вимоги до ДЗ та критерії приймання**
   - Сценарії поведінки та критерії оцінювання.

---

## ⚡ Швидкий старт для студента

1. **Підготовка робочого місця (за STUDENTS.md):**
   - Запустіть **Промпт 1** зі [STUDENTS.md](../STUDENTS.md), оберіть Lesson `01` та `OpenRouter`.
   - Агент створить гілку `lesson-01-intro-openrouter` та робочу папку `my-dev/lesson-01-intro-openrouter/`.
   - Папки `starter/` і `solution/` є канонічними, а `dev/` – викладацька папка; жодну з них не редагуйте.

2. **Прочитайте вимоги до здачі перед реалізацією.**
   - Відкрийте [homework.md](./homework.md). У ньому визначені обов'язковий обсяг роботи, перевірки та критерії приймання.

3. **Виконайте практику у своїй копії.**
   - [starter-code-guide.md](./starter-code-guide.md) – необов'язкова довідка про структуру стартового коду.
   - Виконуйте кроки [roadmap-code-guide.md](./roadmap-code-guide.md) і пишіть код у `my-dev/lesson-01-intro-openrouter/`.
   - Перед змінами можна переглянути TODO baseline без strict gate:
     `yarn vitest run my-dev/lesson-01-intro-openrouter/tests`. Кількість сценаріїв перевіряйте за фактичним виводом.

4. **Запустіть offline-перевірки після реалізації (з кореня fork).**
   Після заміни всіх 21 TODO запустіть:

   ```bash
   yarn typecheck:my:lesson01:openrouter # перевірка типів TypeScript
   yarn test:my:lesson01:openrouter      # unit-тести без реальних API calls
   yarn check:my:lesson01:openrouter     # повний offline gate: типи, лінтер, форматування і тести
   ```

5. **Після offline-перевірок виконайте один контрольований ручний live smoke, якщо доступні ключ і мережа.**
   Використайте синтетичний запит. Якщо ключ або мережа недоступні, запишіть у здачі `NOT RUN`; не заявляйте про підтверджений live-результат. Автоматичні тести не виконують реальних API calls.

   ```bash
   yarn dev:my:lesson01:openrouter "Поясни коротко, що таке closure у JavaScript."
   ```

6. **Здайте роботу.**
   Коли `yarn check:my:lesson01:openrouter` успішний і виконані критерії з `homework.md`, запустіть **Промпт 2** зі [STUDENTS.md](../STUDENTS.md). У здачі вкажіть фактичний статус live smoke: `PASS`, `FAIL` або `NOT RUN`.
