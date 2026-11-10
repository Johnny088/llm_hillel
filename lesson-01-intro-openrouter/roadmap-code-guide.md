# Lesson 01 — Перший запит до мовної моделі (OpenRouter)

> **Для студентів курсу:** Усі кроки розробки виконуються у вашій робочій папці `my-dev/lesson-01-intro-openrouter/` (підготовленій за [STUDENTS.md](../STUDENTS.md)). Канонічні папки `starter/`, `solution/` та викладацька папка `dev/` не змінюються.
>
> **Команди перевірки з кореня репозиторію:**
>
> - `yarn test:my:lesson01:openrouter` — запуск тестів вашої реалізації
> - `yarn check:my:lesson01:openrouter` — повний quality gate (типи, лінтер, тести)
> - `yarn dev:my:lesson01:openrouter "текст запиту"` — ручний запуск вашої програми

## Гайд для студента

- Provider: OpenRouter
- Особиста робоча папка: `my-dev/lesson-01-intro-openrouter/`, підготовлена за маршрутом із [STUDENTS.md](../STUDENTS.md).
- Основа: canonical `lesson-01-intro-openrouter/starter`; `solution/` залишається довідковим прикладом.

> Основний потік кожного кроку: **Навіщо → Файл → Де саме → Код для вставки → Перевірка**. Наприкінці кожного кроку — акордеон «Розгорнути» з детальними построковими поясненнями та схемами runtime. Акордеон відкривається лише тоді, коли студентам потрібне додаткове пояснення.

---

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Створити з нуля мінімальний, надійний та повністю типізований CLI-застосунок (консольну утиліту) на TypeScript/Node.js для прямої взаємодії з великими мовними моделями (LLM) через OpenRouter API за стандартом Chat Completions.

### 💎 Практична цінність застосунку

- **Нульовий фінансовий поріг (Free Tier):** Дозволяє виконувати повноцінні AI-запити до доступних безкоштовних моделей через єдиний шлюз OpenRouter без витрат на inference у межах доступної Free Tier квоти.
- **Безпечна обробка конфігурації та помилок (Fail-Fast & Secret-Safe):** Строга валідація конфігурації через Zod зупиняє застосунок на старті при некоректному оточенні, а контрольоване форматування помилок не виводить значення API-ключа, сирі тіла HTTP-відповідей або чутливі заголовки в user-facing повідомлення.
- **Передбачуваний запит:** Кожен запуск використовує одну модель із конфігурації. Помилка провайдера повертається через контрольоване українське повідомлення.
- **Чиста та ізольована архітектура (Ports & Adapters):** Відокремлення мережевого шару через інтерфейс `ChatClient` дозволяє тестувати логіку через mocks без реальних API-викликів, витрачання добової квоти та залежності від доступності мережі.
- **Зручний інтерфейс та людиноорієнтовані помилки:** Замість сирих stack trace користувач отримує чіткі та зрозумілі повідомлення українською мовою про таймаут, проблеми з мережею, перевищення квоти та інші контрольовано оброблені збої.

### ⚙️ Що робить цей застосунок

1. **Зчитує вхідний запит:** Отримує prompt від користувача через аргументи командного рядка (`process.argv`), об'єднує аргументи в цілісний рядок та очищає його від зайвих крайніх пробілів.
2. **Перевіряє оточення:** Завантажує змінні середовища, валідує наявність `OPENROUTER_API_KEY` і підставляє значення за замовчуванням для моделі та `reasoning_effort`.
3. **Формує та надсилає запит:** Складає системний контекст і запит користувача, додає конфігурацію reasoning та ліміт токенів (`max_tokens: 800`), після чого надсилає структурований запит до OpenRouter API.
4. **Обробляє результат:** Повертає текст і фактичний model ID, повідомлений провайдером, або налаштований ID, якщо провайдер його не повернув.
5. **Безпечно реагує на помилки:** Перехоплює контрольовано оброблювані API-, мережеві та конфігураційні збої й повертає безпечне пояснення без виведення секретів, сирих тіл HTTP-відповідей або stack trace.

---

## Поточна позиція

```text
Lesson 01 starter (copied to my-dev/lesson-01-intro-openrouter/ before class)
  ↓
○ Checkpoint 1 — Завантаження конфігурації (loadEnvironment)
  ↓
○ Checkpoint 2 — Отримання CLI-вводу (readUserInput)
  ↓
○ Checkpoint 3 — Безпечна обробка помилок (formatApiFailure & formatError)
  ↓
○ Checkpoint 4 — Відправка запиту до моделі (requestAnswer)
  ↓
○ Інтеграція точки входу (src/index.ts)
  ↓
○ Unit-тести CLI-модуля (tests/cli.test.ts)
  ↓
○ Тести безкоштовної моделі (tests/free-model.test.ts)
  ↓
○ Offline acceptance-gates для my-dev/lesson-01-intro-openrouter/
  ↓
○ За бажанням: локальний .env та ручний smoke test
  ↓
○ Один контрольований live smoke
  ↓
Solution
```

---

## Маршрут, що залишився

1. `my-dev/lesson-01-intro-openrouter/src/cli.ts` — нормалізація внутрішньої Zod-схеми та реалізація `loadEnvironment()` (валідація env-змінних через Zod).
2. `my-dev/lesson-01-intro-openrouter/src/cli.ts` — реалізація `readUserInput()` (читання та валідація CLI-аргументів).
3. `my-dev/lesson-01-intro-openrouter/src/cli.ts` — реалізація `formatApiFailure()` (безпечний парсинг помилок OpenRouter без витоку тіла відповіді чи ключів).
4. `my-dev/lesson-01-intro-openrouter/src/cli.ts` — реалізація `requestAnswer()` через один виклик тестованого `ChatClient`.
5. `my-dev/lesson-01-intro-openrouter/src/index.ts` — фіналізація оркестрації CLI та обробки помилок.
6. `my-dev/lesson-01-intro-openrouter/tests/cli.test.ts` — заміна 21 `it.todo` активними unit-тестами.
7. `my-dev/lesson-01-intro-openrouter/tests/free-model.test.ts` — 5 тестів обраної free-tier моделі та lesson-local `.env.example`.
8. Строга перевірка відсутності `it.todo` і повний offline gate — набір локальних перевірок без звернення до API — для `my-dev/lesson-01-intro-openrouter/`.
9. Створення lesson-local `my-dev/lesson-01-intro-openrouter/.env` із конфігурацією Lesson 01 перед контрольованим ручним smoke test.
10. Один контрольований live smoke — короткий реальний запит — із синтетичним текстом без приватних даних.

---

## Перед початком роботи

Почніть із кореня вашого fork і виконайте **Промпт 1** зі [STUDENTS.md](../STUDENTS.md), обравши Lesson `01` та OpenRouter. Він підготує гілку і вашу копію starter у `my-dev/lesson-01-intro-openrouter/`.

Редагуйте файли тільки у `my-dev/lesson-01-intro-openrouter/`. Папки canonical `starter/` та `solution/`, а також викладацька папка `dev/` не є вашими робочими копіями. Не запускайте команди керування викладацькою папкою `dev/` для цієї практики.

Перед роботою зафіксуйте наявний стан вашої гілки:

```powershell
git status --short
```

Застосунок спершу читає `.env` поруч зі своєю точкою входу в `my-dev/lesson-01-intro-openrouter/`, а потім використовує кореневий `.env` як резервне джерело. Якщо хочете мати окремі налаштування для Lesson 01, створіть локальний файл лише коли його ще немає:

```powershell
$studentEnvPath = "my-dev/lesson-01-intro-openrouter/.env"
if (-not (Test-Path -LiteralPath $studentEnvPath)) {
  Copy-Item "my-dev/lesson-01-intro-openrouter/.env.example" $studentEnvPath
}
notepad $studentEnvPath
```

Заповніть `OPENROUTER_API_KEY` локально. Не друкуйте й не надсилайте значення ключа, не додавайте `.env` до Git.

### Повторний запуск перевірок

Продовжуйте в наявній особистій копії `my-dev/lesson-01-intro-openrouter/`. Якщо потрібна нова чиста студентська гілка, скористайтеся маршрутом **Промпт 1** зі [STUDENTS.md](../STUDENTS.md), який готує особисту робочу папку. Ця практика не потребує reset викладацької папки `dev/`.

---

# Три фази роботи: код → тести → acceptance і live

Гайд складається з атомарних кроків. Атомарний крок — це самодостатня одиниця роботи: щось додано у конкретний файл → виконується єдина доступна на цьому етапі перевірка → перехід до наступного кроку. Іноді ця перевірка — лише компіляція. Робота поділена на три фази: спочатку реалізація, потім локальні unit-тести, після них повний acceptance-gate і лише один live-запит.

## Фаза A — розробка кодової бази (Кроки 1–5)

Створюються функції у `my-dev/lesson-01-intro-openrouter/src/cli.ts` та фіналізується `my-dev/lesson-01-intro-openrouter/src/index.ts`. Starter уже містить 21 `it.todo` як контракт майбутньої поведінки, але ці тести ще не виконують assertions. На кожному code-кроці запускається scoped перевірка `yarn typecheck:my:lesson01:openrouter`.

| Після кроку | Що перевіряється                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| Кроки 1–3   | `yarn typecheck:my:lesson01:openrouter`: поточна функція типізована; інші функції ще мають TODO-заглушки. |
| Крок 4      | `yarn typecheck:my:lesson01:openrouter`: усі чотири функції сумісні за типами.                            |
| Крок 5      | `yarn typecheck:my:lesson01:openrouter`: точка входу готова; далі починається реалізація 21 TODO-тесту.   |

Live-запуск до завершення ланцюжка падає на TODO-заглушках. Тести не вигадуються: їхні 21 назви вже зафіксовані starter-контрактом і послідовно перетворюються на assertions у наступній фазі.

## Фаза B — розробка unit-тестів (Кроки 6–7)

Кожен TODO-блок перетворюється на активні тести й одразу запускається цільово. Порядок іде від найпростішого до складного: `readUserInput` → `loadEnvironment` → `formatApiFailure` → `formatError` (справжні екземпляри помилок OpenAI SDK) → `requestAnswer` (async + мок ChatClient) → перевірки обраної free-tier моделі.

```powershell
yarn vitest run my-dev/lesson-01-intro-openrouter/tests/cli.test.ts -t "loadEnvironment"
```

Тести не звертаються до реального API, тож їх можна запускати необмежено часто. Повний проміжний прогін — `yarn vitest run my-dev/lesson-01-intro-openrouter/tests`. Для незміненого starter очікуються `0 passed, 21 todo`; це початкова специфікація, не завершений acceptance.

## Фаза C — offline acceptance та ручний smoke test за наявності ключа й мережі

Після заміни всіх TODO запускайте `yarn check:my:lesson01:openrouter` з кореня fork: цей gate перевіряє типи, lint, форматування та тести вашої папки `my-dev/lesson-01-intro-openrouter/`. До завершення реалізації strict TODO gate навмисно завершується помилкою. Після offline-перевірок можна виконати один ручний smoke test з вашої копії; точні команди наведені у фінальному розділі.

---

## ✅ Checkpoint 1 — Завантаження конфігурації

## Крок 1. Безпечна валідація змінних оточення (loadEnvironment)

### Навіщо це робимо

Застосунок взаємодіє із зовнішнім API OpenRouter, тому йому обов'язково потрібен коректний `OPENROUTER_API_KEY`, а також значення за замовчуванням для моделі та параметра reasoning effort. Якщо конфігурація некоректна або відсутня, виконання має зупинитися на самому початку (fail-fast), не розкриваючи значення секретів у повідомленні про помилку.

### Файл

`my-dev/lesson-01-intro-openrouter/src/cli.ts`

### Де саме

Спочатку Zod-схема у верхній частині файлу залишається внутрішньою деталлю модуля. Рядок:

```ts
export const environmentSchema = z.object({
```

замінюється на:

```ts
const environmentSchema = z.object({
```

Після цього потрібна функція:

```ts
export function loadEnvironment(_env: Readonly<Record<string, string | undefined>>): Environment;
```

Її поточна TODO-реалізація повністю замінюється наведеним кодом. Видалення `export` не змінює runtime-поведінку, але синхронізує публічну поверхню модуля з canonical solution.

### Код для вставки

```ts
export function loadEnvironment(env: Readonly<Record<string, string | undefined>>): Environment {
  const parsed = environmentSchema.safeParse(env);

  if (!parsed.success) {
    const fields = [
      ...new Set(parsed.error.issues.map((issue) => issue.path.join(".")).filter(Boolean)),
    ];

    throw new UserFacingError(`Потрібно задати: ${fields.join(", ")}. Значення не виводяться.`);
  }

  return parsed.data;
}
```

### Що тут важливо пояснити студентам

- `env` передається як аргумент замість прямого читання `process.env` всередині функції — це дає змогу легко виконувати unit-тести без мутації глобального стану Node.js.
- Zod автоматично підставляє `default` значення (`DEFAULT_OPENROUTER_MODEL`, `DEFAULT_REASONING_EFFORT`), якщо вони не вказані у файлі `.env`.
- Важливо ніколи не виводити значення секретних ключів у текст помилок чи логи.

### Перевірка

**Що перевіряємо:** синтаксичну коректність та компіляцію TypeScript після внесення змін.

**Навіщо:** переконатися, що типи узгоджені й модуль `cli.ts` компілюється без помилок.

**Команда:**

```powershell
yarn typecheck:my:lesson01:openrouter
```

**Очікуємо:** `tsc` завершується успішно без помилок типів.

_Атомарний крок Фази A завершено. Scoped typecheck пройдено; далі виконується наступний code checkpoint. TODO-тести поки залишаються специфікацією, а не доказом готовності._

<details> <summary><b>Розгорнути: детальні пояснення коду</b></summary>

### Той самий код з поясненнями

```ts
export function loadEnvironment(env: Readonly<Record<string, string | undefined>>): Environment {
  // Валідуємо об'єкт оточення через схему Zod; safeParse повертає success/error без викидання винятків.
  const parsed = environmentSchema.safeParse(env);

  // Якщо валідація не пройшла, збираємо імена проблемних полів.
  if (!parsed.success) {
    // Витягуємо унікальні шляхи/назви невалідних ключів без збереження їхніх значень.
    const fields = [
      ...new Set(parsed.error.issues.map((issue) => issue.path.join(".")).filter(Boolean)),
    ];

    // Викидаємо типізовану помилку UserFacingError, придатну для показу користувачу без витоку секретів.
    throw new UserFacingError(`Потрібно задати: ${fields.join(", ")}. Значення не виводяться.`);
  }

  // Повертаємо лише перевірені та очищені схемою поля з підставленими дефолтами.
  return parsed.data;
}
```

### Пояснення коду по логічних блоках

1. `environmentSchema.safeParse(env)` — перевіряє переданий об'єкт змінних середовища проти визначеної вище Zod-схеми, не викидаючи необроблений exception.
2. `if (!parsed.success)` — перехоплює невалідні вхідні дані (наприклад, відсутній або порожній API-ключ).
3. `const fields = [...]` — формує унікальний перелік назв полів, де виникла помилка валідації, навмисно ігноруючи їхній контент.
4. `throw new UserFacingError(...)` — створює безпечне для користувача повідомлення з іменами пропущених полів.
5. `return parsed.data` — повертає типізований об'єкт `Environment`, що містить лише дозволені поля з гарантованими значеннями за замовчуванням.

</details>

<details> <summary><b>Розгорнути: схема виконання в runtime</b></summary>

### Що відбувається в runtime

```text
process.env
    ↓
loadEnvironment()
    ↓ (Zod validation & default injection)
Environment { OPENROUTER_API_KEY, OPENROUTER_MODEL, ... }
```

</details>

---

## ✅ Checkpoint 2 — Отримання CLI-вводу

## Крок 2. Читання та валідація аргументів командного рядка (readUserInput)

### Навіщо це робимо

CLI-застосунок очікує prompt від користувача через аргументи командного рядка (`process.argv.slice(2)`). Користувач може передати запит як один рядок у лапках або як кілька слів окремими аргументами. Необхідно з'єднати їх, прибрати зайві пробіли та переконатися, що запит не порожній.

### Файл

`my-dev/lesson-01-intro-openrouter/src/cli.ts`

### Де саме

Потрібна функція:

```ts
export function readUserInput(_args: readonly string[]): string;
```

Її поточна TODO-реалізація повністю замінюється наведеним кодом.

### Код для вставки

```ts
export function readUserInput(args: readonly string[]): string {
  const input = args.join(" ").trim();

  if (!input) {
    throw new UserFacingError(
      'Потрібно передати запит, наприклад: yarn dev:my:lesson01:openrouter "Що таке closure у JavaScript?"',
    );
  }

  return input;
}
```

> Підказка показує команду запуску вашої особистої копії. Це лише текст повідомлення для порожнього вводу; запит до API надсилається тільки після окремого ручного запуску програми.

### Що тут важливо пояснити студентам

- Аргументи CLI в Node.js передаються як масив рядків. `args.join(" ")` робить інтерфейс зручним: користувачеві не обов'язково брати запит у подвійні лапки в терміналі.
- `trim()` захищає від випадкової відправки порожніх запитів, які б витрачали ліміти токенів.

### Перевірка

**Що перевіряємо:** відсутність помилок компіляції типів у `cli.ts`.

**Навіщо:** зафіксувати коректність сигнатури та повертаного типу функції.

**Команда:**

```powershell
yarn typecheck:my:lesson01:openrouter
```

**Очікуємо:** компіляція проходить успішно.

_Атомарний крок Фази A завершено. Scoped typecheck пройдено; далі виконується наступний code checkpoint. TODO-тести поки залишаються специфікацією, а не доказом готовності._

<details> <summary><b>Розгорнути: детальні пояснення коду</b></summary>

### Той самий код з поясненнями

```ts
export function readUserInput(args: readonly string[]): string {
  // Об'єднуємо всі аргументи командного рядка в один текстовий рядок та прибираємо крайні пробіли.
  const input = args.join(" ").trim();

  // Якщо користувач не передав жодного тексту або передав лише пробіли, сигналізуємо про помилку.
  if (!input) {
    // Показуємо команду запуску особистої копії програми.
    throw new UserFacingError(
      'Потрібно передати запит, наприклад: yarn dev:my:lesson01:openrouter "Що таке closure у JavaScript?"',
    );
  }

  // Повертаємо підготовлений текст запиту для моделі.
  return input;
}
```

### Пояснення коду по логічних блоках

1. `args.join(" ").trim()` — забезпечує підтримку як виклику в лапках (`"Що таке closure?"`), так і без лапок (`Що таке closure?`), одночасно відсікаючи зайві пробіли.
2. `if (!input)` — перевіряє наявність реального тексту для відправки до моделі.
3. `throw new UserFacingError(...)` — показує дружню підказку із командою запуску вашої копії, якщо ввід відсутній.
4. `return input` — повертає очищений рядок.

</details>

---

## ✅ Checkpoint 3 — Безпечна обробка помилок

## Крок 3. Безпечне форматування помилок API (formatApiFailure)

### Навіщо це робимо

Під час взаємодії з OpenRouter можуть виникати різні проблеми: мережеві збої, таймаути з'єднання, помилки авторизації або перевищення добового ліміту безкоштовних моделей. Сирі об'єкти помилок потрібно перетворити на зрозумілі людині повідомлення українською мовою, не допускаючи витоку тіла запиту, відповідей провайдера та конфіденційних заголовків.

### Файл

`my-dev/lesson-01-intro-openrouter/src/cli.ts`

### Де саме

Потрібна функція:

```ts
export function formatApiFailure(_error: SafeApiFailure): string;
```

Її поточна TODO-реалізація повністю замінюється наведеним кодом.

### Код для вставки

```ts
export function formatApiFailure(error: SafeApiFailure): string {
  if (error.name === "APIConnectionTimeoutError") {
    return "Перевищено час очікування відповіді API.";
  }

  if (error.name === "APIConnectionError") {
    return "Не вдалося з'єднатися з API.";
  }

  if (error.status === 429 && error.freeModelDailyLimit) {
    return "Вичерпано спільну добову квоту безкоштовних моделей OpenRouter. ";
  }

  const status = typeof error.status === "number" ? `HTTP ${error.status}` : error.name;
  const requestId = error.request_id ? `; request_id=${error.request_id}` : "";

  return `${status}${requestId}`;
}
```

### Що тут важливо пояснити студентам

- Безпека даних: сирі помилки від API можуть містити заголовки авторизації або приватні уривки запитів. Об'єкт `SafeApiFailure` дає змогу використати лише технічний код та `request_id`.
- Специфіка OpenRouter Free Tier: безкоштовні моделі з суфіксом `:free` мають спільний пул запитів на добу для акаунта. Якщо цей ліміт вичерпано, перемикання на іншу безкоштовну модель не допоможе, про що застосунок прямо повідомляє користувача.

### Перевірка

**Що перевіряємо:** статичну типізацію функції обробки помилок.

**Навіщо:** підтвердити, що `formatApiFailure` відповідає сигнатурі та коректно інтегрована з `formatError`.

**Команда:**

```powershell
yarn typecheck:my:lesson01:openrouter
```

**Очікуємо:** компіляція проходить успішно.

_Атомарний крок Фази A завершено. Scoped typecheck пройдено; далі виконується наступний code checkpoint. TODO-тести поки залишаються специфікацією, а не доказом готовності._

<details> <summary><b>Розгорнути: детальні пояснення коду</b></summary>

### Той самий код з поясненнями

```ts
export function formatApiFailure(error: SafeApiFailure): string {
  // Окремо ідентифікуємо таймаут: з'єднання було ініційовано, але відповідь не надійшла вчасно.
  if (error.name === "APIConnectionTimeoutError") {
    return "Перевищено час очікування відповіді API.";
  }

  // Обробляємо транспортну помилку мережі (DNS, розрив сокета, відсутність інтернету).
  if (error.name === "APIConnectionError") {
    return "Не вдалося з'єднатися з API.";
  }

  // Перевіряємо специфічну ситуацію OpenRouter: HTTP 429 у поєднанні з маркером free-models-per-day.
  // Це означає вичерпання спільної денної квоти акаунта на всі free-моделі.
  if (error.status === 429 && error.freeModelDailyLimit) {
    return "Вичерпано спільну добову квоту безкоштовних моделей OpenRouter. ";
  }

  // Для решти API-помилок формуємо безпечний статус: або код HTTP, або ім'я класу помилки.
  const status = typeof error.status === "number" ? `HTTP ${error.status}` : error.name;

  // Додаємо request_id за наявності для полегшення діагностики інцидентів без розкриття секретів.
  const requestId = error.request_id ? `; request_id=${error.request_id}` : "";

  // Повертаємо лаконічне повідомлення без витоку сирого JSON від сервера.
  return `${status}${requestId}`;
}
```

### Пояснення коду по логічних блоках

1. `if (error.name === "APIConnectionTimeoutError")` — відловлює перевищення заданого в клієнті ліміту очікування відповіді (30 секунд).
2. `if (error.name === "APIConnectionError")` — повертає чітке пояснення щодо проблем із мережею.
3. `if (error.status === 429 && error.freeModelDailyLimit)` — виявляє вичерпання загальної добової квоти безкоштовного пулу моделей OpenRouter.
4. `const status = ...` та `const requestId = ...` — для нетипових помилок створює рядок вигляду `HTTP 401; request_id=...` без включення приватного тексту тіла відповіді.

</details>

---

## ✅ Checkpoint 4 — Відправка запиту до моделі

## Крок 4. Реалізація виконання запиту (requestAnswer)

### Навіщо це робимо

Це центральна функція взаємодії з моделлю. Вона готує структуру запиту відповідно до формату Chat Completions API (системна інструкція, повідомлення користувача, параметри reasoning та токенів), надсилає один запит через клієнт-адаптер `ChatClient` і перевіряє текст та фактичну модель відповіді.

### Файл

`my-dev/lesson-01-intro-openrouter/src/cli.ts`

### Де саме

Потрібна функція:

```ts
export async function requestAnswer(
  _client: ChatClient,
  _environment: Environment,
  _input: string,
): Promise<AnswerResult>;
```

Її поточна TODO-реалізація повністю замінюється наведеним кодом.

### Код для вставки

```ts
export async function requestAnswer(
  client: ChatClient,
  environment: Environment,
  input: string,
): Promise<AnswerResult> {
  const response = await client.create({
    model: environment.OPENROUTER_MODEL,
    messages: [
      {
        role: "system",
        content:
          "Роль: досвідчений TypeScript-розробник. Стиль: лаконічні, точні й практичні пояснення.",
      },
      { role: "user", content: input },
    ],
    reasoning: { enabled: true, effort: environment.OPENROUTER_REASONING_EFFORT },
    max_tokens: DEFAULT_MAX_TOKENS,
  });

  const answer = response.text.trim();

  if (!answer) {
    throw new UserFacingError("API повернув чат-відповідь без текстового output.");
  }

  const model = response.model?.trim() || environment.OPENROUTER_MODEL;

  return {
    text: answer,
    model,
  };
}
```

### Що тут важливо пояснити студентам

- Чому `ChatClient` замість прямого `openai.chat.completions.create`? Патерн "Порт і Адаптер" (Dependency Inversion) дозволяє тестувати бізнес-логіку формування запитів без виконання реальних платних або квотних викликів до API.
- Параметр `reasoning`: сучасні моделі (наприклад, DeepSeek R1, Nemotron) підтримують керування глибиною внутрішніх міркувань (`effort: "low" | "medium"`).
- `max_tokens: 800` — захист від занадто довгих відповідей, що економить час очікування та токени.

### Перевірка

**Що перевіряємо:** цілісність типів усього файлу `my-dev/lesson-01-intro-openrouter/src/cli.ts`.

**Навіщо:** підтвердити, що всі 4 функції у модулі `cli.ts` реалізовані та сумісні між собою.

**Команда:**

```powershell
yarn typecheck:my:lesson01:openrouter
```

**Очікуємо:** компіляція проходить успішно.

_Атомарний крок Фази A завершено. Scoped typecheck пройдено; далі фіналізується точка входу, після чого починається реалізація тестів._

<details> <summary><b>Розгорнути: детальні пояснення коду</b></summary>

### Той самий код з поясненнями

```ts
export async function requestAnswer(
  client: ChatClient,
  environment: Environment,
  input: string,
): Promise<AnswerResult> {
  // Виконуємо виклик через інтерфейс ChatClient (що дозволяє мокати мережу в тестах).
  const response = await client.create({
    model: environment.OPENROUTER_MODEL,
    messages: [
      // Системна роль задає контекст, стиль та експертизу моделі.
      {
        role: "system",
        content:
          "Роль: досвідчений TypeScript-розробник. Стиль: лаконічні, точні й практичні пояснення.",
      },
      // Повідомлення користувача з текстом його запиту.
      { role: "user", content: input },
    ],
    // Налаштування reasoning effort для моделей з підтримкою міркувань.
    reasoning: { enabled: true, effort: environment.OPENROUTER_REASONING_EFFORT },
    // Обмежуємо максимальну кількість токенів генерації.
    max_tokens: DEFAULT_MAX_TOKENS,
  });

  // Очищаємо текст відповіді від зайвих крайніх пробілів.
  const answer = response.text.trim();

  // Захист від аномальних відповідей: якщо модель повернула порожній текст, сигналізуємо про помилку.
  if (!answer) {
    throw new UserFacingError("API повернув чат-відповідь без текстового output.");
  }

  // Визначаємо фактичну модель, яка сформувала відповідь (або використовуємо дефолтну).
  const model = response.model?.trim() || environment.OPENROUTER_MODEL;

  return {
    text: answer,
    model,
  };
}
```

### Пояснення коду по логічних блоках

1. `client.create(...)` — виконує запит із налаштованою моделлю та повним набором параметрів.
2. `client.create(...)` — відправляє структурований запит до моделі із системним промптом, текстом запиту користувача, конфігурацією `reasoning` та лімітом токенів `DEFAULT_MAX_TOKENS` (800).
3. `if (!answer)` — валідує наявність тексту у відповіді.
4. `const model = response.model?.trim() || ...` — фіксує ідентифікатор моделі, яка реально відповіла на запит.
5. `model` — зберігає фактичний ID моделі з відповіді провайдера, а за його відсутності використовує налаштовану модель.

</details>

<details> <summary><b>Розгорнути: схема виконання в runtime</b></summary>

### Що відбувається в runtime

```text
User Input ("Обчисли 37 * 19")
        ↓
requestAnswer()
        ↓
ChatClient.create({
  model: "nvidia/nemotron-3-super-120b-a12b:free",
  messages: [system, user],
  reasoning: { enabled: true, effort: "medium" },
  max_tokens: 800
})
        ↓
OpenRouter API
        ↓
{ text: "703", model: "nvidia/nemotron-3-super-120b-a12b:free" }
        ↓
AnswerResult { text: "703", model: "..." }
```

</details>

---

## Крок 5. Фіналізація точки входу застосунку (src/index.ts)

### Навіщо це робимо

Файл `src/index.ts` об'єднує всі компоненти CLI: завантажує оточення через `dotenv` та `loadEnvironment`, читає аргументи через `readUserInput`, створює інстанс SDK `OpenAI` з налаштуваннями OpenRouter, обгортає його в адаптер `ChatClient`, викликає `requestAnswer` та красиво форматує результат у терміналі. У ньому потрібно прибрати тимчасовий коментар TODO.

### Файл

`my-dev/lesson-01-intro-openrouter/src/index.ts`

### Де саме

Потрібний блок розташований навколо створення `client: ChatClient`:

```ts
  // TODO (фінальна перевірка): після реалізації cli.ts виконати контрольований
  // smoke-запит і підтвердити, що adapter повертає лише текст та фактичну модель.
  const client: ChatClient = {
```

Коментар TODO видаляється, а блок `client` залишається на його місці.

### Код для вставки

```ts
const client: ChatClient = {
  create: async (request) => {
    const response = await openai.chat.completions.create(request);
    return {
      text: response.choices[0]?.message?.content ?? "",
      model: response.model,
    };
  },
};
```

### Що тут важливо пояснити студентам

- Параметри створення клієнта `OpenAI` мають окремі ролі:
  - `baseURL: "https://openrouter.ai/api/v1"` — перенаправляє запити OpenAI SDK на сервери OpenRouter.
  - `maxRetries: 0` — вимикає автоматичні повторні запити SDK при помилках, щоб не витрачати квоту.

### Перевірка

**Що перевіряємо:** статичну типізацію та готовність CLI до виконання.

**Навіщо:** гарантувати відсутність помилок перед написанням тестів.

**Команда:**

```powershell
yarn typecheck:my:lesson01:openrouter
```

**Очікуємо:** компіляція проходить успішно.

_Атомарний крок Фази A завершено. Далі — Фаза B: реалізація unit-тестів. Live-запит виконується лише після повного offline gate._

<details> <summary><b>Розгорнути: детальні пояснення коду</b></summary>

### Той самий код з поясненнями

```ts
// Створюємо адаптер ChatClient поверх офіційного OpenAI SDK,
// який витягує лише потрібний текст повідомлення та ідентифікатор фактичної моделі.
const client: ChatClient = {
  create: async (request) => {
    // Виконуємо HTTP-запит через клієнт OpenAI з базовим URL OpenRouter.
    const response = await openai.chat.completions.create(request);
    return {
      // Захищаємося від null/undefined у відповіді моделі.
      text: response.choices[0]?.message?.content ?? "",
      // Зберігаємо ідентифікатор моделі з тіла відповіді.
      model: response.model,
    };
  },
};
```

### Пояснення коду по логічних блоках

1. `openai.chat.completions.create(request)` — надсилає підготовлений запит через OpenAI SDK до OpenRouter `https://openrouter.ai/api/v1`.
2. `response.choices[0]?.message?.content ?? ""` — витягує згенерований текст із першого варіанту відповіді.
3. `model: response.model` — повертає назву моделі, яку реально використав OpenRouter.

</details>

---

## Checkpoint 5 — Unit-тестування

## Крок 6. Заміна TODO-тестів на повноцінні Unit-тести (tests/cli.test.ts)

Unit-тести додаються логічними блоками відповідно до функцій, які вони перевіряють. Почніть із `loadEnvironment`, далі перевірте `readUserInput`, `formatApiFailure`, `formatError` та `requestAnswer`. Блоки незалежні, тож за бажанням порядок можна міняти.

---

### Крок 6.1. Оновлення імпортів та тестового оточення

#### Навіщо це робимо

Для якісних unit-тестів потрібні assertion helpers (`describe`, `expect`, `it`, `vi`) з бібліотеки `vitest`, усі функції з `src/cli.ts`, а також фіксований тестовий об'єкт `validEnvironment`.

#### Файл

`my-dev/lesson-01-intro-openrouter/tests/cli.test.ts`

#### Де саме

Вміст файлу `my-dev/lesson-01-intro-openrouter/tests/cli.test.ts` можна повністю замінити або почати з блоку імпортів на початку файлу:

```ts
import { describe, it } from "vitest";
```

#### Код для вставки

```ts
import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_REASONING_EFFORT,
  UserFacingError,
  formatApiFailure,
  formatError,
  loadEnvironment,
  readUserInput,
  requestAnswer,
} from "../src/cli.js";

const validEnvironment = {
  OPENROUTER_API_KEY: "test-only-value",
  OPENROUTER_MODEL: "configured-for-test",
  OPENROUTER_REASONING_EFFORT: "low",
} as const;
```

<details> <summary><b>Розгорнути: детальні пояснення коду</b></summary>

#### Той самий код з поясненнями

```ts
// Імпортуємо OpenAI для генерації автентичних екземплярів APIError у тестах обробки помилок.
import OpenAI from "openai";
// Імпортуємо інструменти тестування та мокінгу з Vitest.
import { describe, expect, it, vi } from "vitest";
// Імпортуємо всі константи, типи та функції, що тестуються, із розроблюваного модуля cli.js.
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_REASONING_EFFORT,
  UserFacingError,
  formatApiFailure,
  formatError,
  loadEnvironment,
  readUserInput,
  requestAnswer,
} from "../src/cli.js";

// Створюємо еталонний об'єкт валідного тестового середовища з фіктивним ключем.
const validEnvironment = {
  OPENROUTER_API_KEY: "test-only-value",
  OPENROUTER_MODEL: "configured-for-test",
  OPENROUTER_REASONING_EFFORT: "low",
} as const;
```

#### Пояснення коду по логічних блоках

1. `import ... from "vitest"` — підключає тестовий фреймворк.
2. `import { ... } from "../src/cli.js"` — імпортує інтерфейси та логіку для тестування.
3. `validEnvironment` — тестова фікстура, яка використовується у кількох тестових блоках.

</details>

---

### Крок 6.2. Тести для функції loadEnvironment

#### Навіщо це робимо

Тестуємо всі граничні випадки завантаження змінних: відсутність ключа, підстановку значень за замовчуванням, відхилення непідтримуваного reasoning effort та очищення сторонніх полів.

#### Файл

`my-dev/lesson-01-intro-openrouter/tests/cli.test.ts`

#### Де саме

Перший блок `describe("loadEnvironment", ...)` додається після `validEnvironment`.

#### Код для вставки

```ts
describe("loadEnvironment", () => {
  it("відхиляє відсутній OpenRouter API key", () => {
    expect(() => loadEnvironment({})).toThrow("OPENROUTER_API_KEY");
  });

  it("підставляє дефолтну модель та effort, якщо вони не задані", () => {
    expect(loadEnvironment({ OPENROUTER_API_KEY: "test-only-value" })).toEqual({
      OPENROUTER_API_KEY: "test-only-value",
      OPENROUTER_MODEL: DEFAULT_OPENROUTER_MODEL,
      OPENROUTER_REASONING_EFFORT: DEFAULT_REASONING_EFFORT,
    });
  });

  it("відхиляє рівень мислення, який модель не підтримує", () => {
    expect(() =>
      loadEnvironment({
        OPENROUTER_API_KEY: "test-only-value",
        OPENROUTER_REASONING_EFFORT: "high",
      }),
    ).toThrow("OPENROUTER_REASONING_EFFORT");
  });

  it("повертає лише перевірені поля", () => {
    expect(
      loadEnvironment({
        ...validEnvironment,
        EXTRA_VALUE: "not-returned",
      }),
    ).toEqual(validEnvironment);
  });
});
```

#### Перевірка

**Що перевіряємо:** успішне проходження всіх тестів блоку `loadEnvironment`.

**Навіщо:** переконатися у відповідності поведінки функції `loadEnvironment` технічним вимогам.

**Команда:**

```powershell
yarn vitest run my-dev/lesson-01-intro-openrouter/tests/cli.test.ts -t "loadEnvironment"
```

**Очікуємо:** 5 тестів пройшли успішно.

<details> <summary><b>Розгорнути: детальні пояснення коду</b></summary>

#### Той самий код з поясненнями

```ts
describe("loadEnvironment", () => {
  // Перевіряємо, що порожній об'єкт середовища призводить до винятку з вказівкою імені відсутнього ключа.
  it("відхиляє відсутній OpenRouter API key", () => {
    expect(() => loadEnvironment({})).toThrow("OPENROUTER_API_KEY");
  });

  // Перевіряємо автоматичне заповнення необов'язкових полів дефолтними константами.
  it("підставляє дефолтну модель та effort, якщо вони не задані", () => {
    expect(loadEnvironment({ OPENROUTER_API_KEY: "test-only-value" })).toEqual({
      OPENROUTER_API_KEY: "test-only-value",
      OPENROUTER_MODEL: DEFAULT_OPENROUTER_MODEL,
      OPENROUTER_REASONING_EFFORT: DEFAULT_REASONING_EFFORT,
    });
  });

  // Перевіряємо строге обмеження Zod enum: значення "high" має викликати помилку валідації.
  it("відхиляє рівень мислення, який модель не підтримує", () => {
    expect(() =>
      loadEnvironment({
        OPENROUTER_API_KEY: "test-only-value",
        OPENROUTER_REASONING_EFFORT: "high",
      }),
    ).toThrow("OPENROUTER_REASONING_EFFORT");
  });

  // Перевіряємо ізоляцію: сторонні змінні з process.env не повинні потрапляти у фінальний об'єкт.
  it("повертає лише перевірені поля", () => {
    expect(
      loadEnvironment({
        ...validEnvironment,
        EXTRA_VALUE: "not-returned",
      }),
    ).toEqual(validEnvironment);
  });
});
```

#### Пояснення коду по логічних блоках

1. `відхиляє відсутній OpenRouter API key` — перевіряє обов'язковість ключа авторизації.
2. `підставляє дефолтну модель та effort` — перевіряє коректність ін'єкції дефолтів.
3. `відхиляє рівень мислення` — підтверджує валідацію дозволених значень.
4. `відхиляє рівень мислення` — підтверджує валідацію `OPENROUTER_REASONING_EFFORTS` (`medium | low`).
5. `повертає лише перевірені поля` — перевіряє strip зайвих ключів.

</details>

---

### Крок 6.3. Тести для функції readUserInput

#### Навіщо це робимо

Перевіряємо склеювання масиву рядків у єдиний запит та валідацію порожнього вводу.

#### Файл

`my-dev/lesson-01-intro-openrouter/tests/cli.test.ts`

#### Де саме

Блок `describe("readUserInput", ...)` додається після тестів `loadEnvironment`.

#### Код для вставки

```ts
describe("readUserInput", () => {
  it("об'єднує аргументи CLI", () => {
    expect(readUserInput(["Що", "таке", "closure?"])).toBe("Що таке closure?");
  });

  it("відхиляє порожній CLI input", () => {
    expect(() => readUserInput([])).toThrow("yarn dev:my:lesson01:openrouter");
  });
});
```

#### Перевірка

**Що перевіряємо:** коректність обробки CLI-аргументів.

**Навіщо:** переконатися, що вхідний інтерфейс користувача працює згідно зі специфікацією.

**Команда:**

```powershell
yarn vitest run my-dev/lesson-01-intro-openrouter/tests/cli.test.ts -t "readUserInput"
```

**Очікуємо:** 2 тести пройшли успішно.

<details> <summary><b>Розгорнути: детальні пояснення коду</b></summary>

#### Той самий код з поясненнями

```ts
describe("readUserInput", () => {
  // Перевіряємо об'єднання масиву слів через пробіл.
  it("об'єднує аргументи CLI", () => {
    expect(readUserInput(["Що", "таке", "closure?"])).toBe("Що таке closure?");
  });

  // Перевіряємо, що запуск без аргументів викидає помилку з підказкою правильної команди.
  it("відхиляє порожній CLI input", () => {
    expect(() => readUserInput([])).toThrow("yarn dev:my:lesson01:openrouter");
  });
});
```

#### Пояснення коду по логічних блоках

1. `readUserInput(["Що", "таке", "closure?"])` — перевіряє коректне форматування складеного запиту.
2. `readUserInput([])` — перевіряє наявність зрозумілого повідомлення про помилку з прикладом команди.

</details>

---

### Крок 6.4. Тести для функції formatApiFailure

#### Навіщо це робимо

Перевіряємо форматування безпечних повідомлень для різних типів збоїв: таймаутів, мережевих проблем, добового ліміту безкоштовних моделей та невідомих статусів.

#### Файл

`my-dev/lesson-01-intro-openrouter/tests/cli.test.ts`

#### Де саме

Блок `describe("formatApiFailure", ...)` додається після `describe("readUserInput", ...)`.

#### Код для вставки

```ts
describe("formatApiFailure", () => {
  it("форматує лише безпечні поля HTTP-помилки", () => {
    expect(
      formatApiFailure({
        name: "AuthenticationError",
        status: 401,
        request_id: "req_test",
      }),
    ).toBe("HTTP 401; request_id=req_test");
  });

  it("форматує network error", () => {
    expect(formatApiFailure({ name: "APIConnectionError" })).toBe("Не вдалося з'єднатися з API.");
  });

  it("форматує timeout", () => {
    expect(formatApiFailure({ name: "APIConnectionTimeoutError" })).toBe(
      "Перевищено час очікування відповіді API.",
    );
  });

  it("форматує невідомий статус лише за ім'ям помилки", () => {
    expect(formatApiFailure({ name: "RateLimitError" })).toBe("RateLimitError");
  });

  it("пояснює спільний добовий ліміт безкоштовних моделей", () => {
    expect(
      formatApiFailure({
        name: "RateLimitError",
        status: 429,
        freeModelDailyLimit: true,
      }),
    ).toBe("Вичерпано спільну добову квоту безкоштовних моделей OpenRouter. ");
  });
});
```

#### Перевірка

**Що перевіряємо:** обробку безпечних структур помилок.

**Навіщо:** підтвердити захист від витоку внутрішніх даних через `formatApiFailure`.

**Команда:**

```powershell
yarn vitest run my-dev/lesson-01-intro-openrouter/tests/cli.test.ts -t "formatApiFailure"
```

**Очікуємо:** 5 тестів пройшли успішно.

<details> <summary><b>Розгорнути: детальні пояснення коду</b></summary>

#### Той самий код з поясненнями

```ts
describe("formatApiFailure", () => {
  // Перевіряємо формування повідомлення тільки зі статусу HTTP та request_id.
  it("форматує лише безпечні поля HTTP-помилки", () => {
    expect(
      formatApiFailure({
        name: "AuthenticationError",
        status: 401,
        request_id: "req_test",
      }),
    ).toBe("HTTP 401; request_id=req_test");
  });

  // Перевіряємо локалізоване повідомлення про помилку мережевого підключення.
  it("форматує network error", () => {
    expect(formatApiFailure({ name: "APIConnectionError" })).toBe("Не вдалося з'єднатися з API.");
  });

  // Перевіряємо повідомлення про таймаут запиту.
  it("форматує timeout", () => {
    expect(formatApiFailure({ name: "APIConnectionTimeoutError" })).toBe(
      "Перевищено час очікування відповіді API.",
    );
  });

  // Перевіряємо безпечний fallback на назву помилки, якщо статус відсутній.
  it("форматує невідомий статус лише за ім'ям помилки", () => {
    expect(formatApiFailure({ name: "RateLimitError" })).toBe("RateLimitError");
  });

  // Перевіряємо спеціальне повідомлення про вичерпання спільної квоти free-моделей.
  it("пояснює спільний добовий ліміт безкоштовних моделей", () => {
    expect(
      formatApiFailure({
        name: "RateLimitError",
        status: 429,
        freeModelDailyLimit: true,
      }),
    ).toBe("Вичерпано спільну добову квоту безкоштовних моделей OpenRouter. ");
  });
});
```

#### Пояснення коду по логічних блоках

1. `форматує лише безпечні поля HTTP-помилки` — перевіряє формування рядка без витоку деталей.
2. `форматує network error` — перевіряє обробку розриву з'єднання.
3. `форматує timeout` — перевіряє обробку таймауту.
4. `форматує невідомий статус` — перевіряє поведінку за замовчуванням.
5. `пояснює спільний добовий ліміт` — перевіряє спец-повідомлення для Free Tier.

</details>

---

### Крок 6.5. Тести для функції formatError

#### Навіщо це робимо

Перевіряємо парсинг реальних екземплярів класів помилок OpenAI SDK (`AuthenticationError`, `APIConnectionError`, `APIConnectionTimeoutError`, `APIError`), розпізнавання маркера `free-models-per-day`, пропуск повідомлень `UserFacingError` та маскування непередбачених помилок.

#### Файл

`my-dev/lesson-01-intro-openrouter/tests/cli.test.ts`

#### Де саме

Блок `describe("formatError", ...)` додається після `describe("formatApiFailure", ...)`.

#### Код для вставки

```ts
describe("formatError", () => {
  it("форматує реальний AuthenticationError без витоку body або headers", () => {
    const error = new OpenAI.AuthenticationError(
      401,
      { message: "synthetic secret-bearing body" },
      undefined,
      new Headers({ "x-request-id": "req_test" }),
    );

    expect(formatError(error)).toBe("HTTP 401; request_id=req_test");
  });

  it("розпізнає реальний APIConnectionError", () => {
    expect(formatError(new OpenAI.APIConnectionError({}))).toBe("Не вдалося з'єднатися з API.");
  });

  it("розпізнає реальний APIConnectionTimeoutError", () => {
    expect(formatError(new OpenAI.APIConnectionTimeoutError())).toBe(
      "Перевищено час очікування відповіді API.",
    );
  });

  it("розпізнає маркер добового free-ліміту в реальній APIError", () => {
    const error = OpenAI.APIError.generate(
      429,
      {
        error: {
          code: 429,
          message: "private aggregate message",
          metadata: {
            previous_errors: [
              {
                code: 429,
                message: "Rate limit exceeded: free-models-per-day. private provider text",
              },
            ],
          },
        },
      },
      undefined,
      new Headers(),
    );

    expect(formatError(error)).toBe(
      "Вичерпано спільну добову квоту безкоштовних моделей OpenRouter. ",
    );
  });

  it("пропускає повідомлення UserFacingError без витоку секретів", () => {
    expect(formatError(new UserFacingError("Внутрішній user-facing стан"))).toBe(
      "Внутрішній user-facing стан",
    );
  });

  it("безпечно маскує непередбачену помилку", () => {
    expect(formatError(new Error("raw secret-bearing stack"))).toBe(
      "Сталася непередбачена помилка. Спробу можна повторити або повідомити викладача.",
    );
  });

  it("безпечно обробляє пошкоджений metadata.previous_errors", () => {
    const error = OpenAI.APIError.generate(
      429,
      {
        error: {
          message: "opaque provider payload",
          metadata: { previous_errors: { message: "opaque provider payload" } },
        },
      },
      undefined,
      new Headers(),
    );

    expect(formatError(error)).toBe("HTTP 429");
  });
});
```

#### Перевірка

**Що перевіряємо:** універсальний диспетчер помилок `formatError`.

**Навіщо:** підтвердити безпеку додатка в разі будь-яких нештатних ситуацій у runtime.

**Команда:**

```powershell
yarn vitest run my-dev/lesson-01-intro-openrouter/tests/cli.test.ts -t "formatError"
```

**Очікуємо:** 5 тестів пройшли успішно.

<details> <summary><b>Розгорнути: детальні пояснення коду</b></summary>

#### Той самий код з поясненнями

```ts
describe("formatError", () => {
  // Створюємо синтетичну помилку автентифікації SDK із секретними даними в body
  // та перевіряємо, що назовні повертається лише HTTP 401 та request_id.
  it("форматує реальний AuthenticationError без витоку body або headers", () => {
    const error = new OpenAI.AuthenticationError(
      401,
      { message: "synthetic secret-bearing body" },
      undefined,
      new Headers({ "x-request-id": "req_test" }),
    );

    expect(formatError(error)).toBe("HTTP 401; request_id=req_test");
  });

  // Перевіряємо інтеграцію з екземпляром APIConnectionError.
  it("розпізнає реальний APIConnectionError", () => {
    expect(formatError(new OpenAI.APIConnectionError({}))).toBe("Не вдалося з'єднатися з API.");
  });

  // Перевіряємо інтеграцію з екземпляром APIConnectionTimeoutError.
  it("розпізнає реальний APIConnectionTimeoutError", () => {
    expect(formatError(new OpenAI.APIConnectionTimeoutError())).toBe(
      "Перевищено час очікування відповіді API.",
    );
  });

  // Перевіряємо виявлення маркера free-models-per-day у вкладеній структурі metadata.previous_errors.
  it("розпізнає маркер добового free-ліміту в реальній APIError", () => {
    const error = OpenAI.APIError.generate(
      429,
      {
        error: {
          code: 429,
          message: "private aggregate message",
          metadata: {
            previous_errors: [
              {
                code: 429,
                message: "Rate limit exceeded: free-models-per-day. private provider text",
              },
            ],
          },
        },
      },
      undefined,
      new Headers(),
    );

    expect(formatError(error)).toBe(
      "Вичерпано спільну добову квоту безкоштовних моделей OpenRouter. ",
    );
  });

  // Перевіряємо, що власні помилки UserFacingError віддають свій текст без змін.
  it("пропускає повідомлення UserFacingError без витоку секретів", () => {
    expect(formatError(new UserFacingError("Внутрішній user-facing стан"))).toBe(
      "Внутрішній user-facing стан",
    );
  });

  // Перевіряємо, що будь-який сторонній Error із сирим stack trace маскується стандартним текстом.
  it("безпечно маскує непередбачену помилку", () => {
    expect(formatError(new Error("raw secret-bearing stack"))).toBe(
      "Сталася непередбачена помилка. Спробу можна повторити або повідомити викладача.",
    );
  });

  // Перевіряємо, що неправильний тип metadata.previous_errors не спричиняє
  // виняток під час парсингу та переходить до безпечного HTTP-повідомлення.
  it("безпечно обробляє пошкоджений metadata.previous_errors", () => {
    const error = OpenAI.APIError.generate(
      429,
      {
        error: {
          message: "opaque provider payload",
          metadata: { previous_errors: { message: "opaque provider payload" } },
        },
      },
      undefined,
      new Headers(),
    );

    expect(formatError(error)).toBe("HTTP 429");
  });
});
```

#### Пояснення коду по логічних блоках

1. `AuthenticationError` — перевіряє безпечне маскування тіла 401 помилки.
2. `APIConnectionError` та `APIConnectionTimeoutError` — перевіряють обробку нативних класів SDK.
3. `isFreeModelDailyLimit` — перевіряє парсинг глибоких вкладених повідомлень від OpenRouter.
4. `UserFacingError` — перевіряє пропуск валідних користувацьких повідомлень.
5. `Error` fallback — гарантує, що невідомі винятки не розкриють стек викликів чи секрети.
6. Пошкоджений `metadata.previous_errors` — підтверджує безпечний generic fallback без винятку під час парсингу payload.

</details>

---

### Крок 6.6. Тести для функції requestAnswer

#### Навіщо це робимо

Тестуємо виклик `requestAnswer` через мок-клієнт `ChatClient`: перевіряємо параметри запиту (модель, системний промпт, reasoning, max_tokens), модель із відповіді провайдера або налаштований ID, відхилення порожніх відповідей та передачу помилок.

#### Файл

`my-dev/lesson-01-intro-openrouter/tests/cli.test.ts`

#### Де саме

Блок `describe("requestAnswer", ...)` додається наприкінці файлу `my-dev/lesson-01-intro-openrouter/tests/cli.test.ts`.

#### Код для вставки

```ts
describe("requestAnswer", () => {
  it("повертає текст через mock-клієнт", async () => {
    const create = vi.fn().mockResolvedValue({ text: "Готово", model: "configured-for-test" });

    const answer = await requestAnswer({ create }, validEnvironment, "Короткий запит");

    expect(answer).toEqual({
      text: "Готово",
      model: "configured-for-test",
    });
    expect(create).toHaveBeenCalledWith({
      model: validEnvironment.OPENROUTER_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Роль: досвідчений TypeScript-розробник. Стиль: лаконічні, точні й практичні пояснення.",
        },
        { role: "user", content: "Короткий запит" },
      ],
      reasoning: { enabled: true, effort: validEnvironment.OPENROUTER_REASONING_EFFORT },
      max_tokens: DEFAULT_MAX_TOKENS,
    });
  });

  it("підставляє дефолтні model, effort і max_tokens у запит", async () => {
    const create = vi.fn().mockResolvedValue({ text: "Готово" });

    const environment = loadEnvironment({
      OPENROUTER_API_KEY: "test-only-value",
    });

    await requestAnswer({ create }, environment, "Короткий запит");

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_OPENROUTER_MODEL,
        reasoning: { enabled: true, effort: DEFAULT_REASONING_EFFORT },
        max_tokens: DEFAULT_MAX_TOKENS,
      }),
    );
  });

  it("відхиляє порожній text", async () => {
    await expect(
      requestAnswer(
        { create: vi.fn().mockResolvedValue({ text: "   " }) },
        validEnvironment,
        "Короткий запит",
      ),
    ).rejects.toThrow("без текстового output");
  });

  it("передає помилку mock-клієнта вище", async () => {
    const failure = new Error("mock network failure");

    await expect(
      requestAnswer(
        { create: vi.fn().mockRejectedValue(failure) },
        validEnvironment,
        "Короткий запит",
      ),
    ).rejects.toBe(failure);
  });
});
```

#### Перевірка

**Що перевіряємо:** повний набір unit-тестів у файлі `my-dev/lesson-01-intro-openrouter/tests/cli.test.ts`.

**Навіщо:** підтвердити, що всі 23 тести проходять успішно і жодного `it.todo` не залишилося.

**Команда:**

```powershell
yarn vitest run my-dev/lesson-01-intro-openrouter/tests/cli.test.ts
```

**Очікуємо:** 23 passed тести.

<details> <summary><b>Розгорнути: детальні пояснення коду</b></summary>

#### Той самий код з поясненнями

```ts
describe("requestAnswer", () => {
  // Перевіряємо успішний запит із передачею всіх обов'язкових параметрів та повідомлень.
  it("повертає текст через mock-клієнт", async () => {
    const create = vi.fn().mockResolvedValue({ text: "Готово", model: "configured-for-test" });

    const answer = await requestAnswer({ create }, validEnvironment, "Короткий запит");

    expect(answer).toEqual({
      text: "Готово",
      model: "configured-for-test",
    });
    // Перевіряємо точний payload запиту до моделі.
    expect(create).toHaveBeenCalledWith({
      model: validEnvironment.OPENROUTER_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Роль: досвідчений TypeScript-розробник. Стиль: лаконічні, точні й практичні пояснення.",
        },
        { role: "user", content: "Короткий запит" },
      ],
      reasoning: { enabled: true, effort: validEnvironment.OPENROUTER_REASONING_EFFORT },
      max_tokens: DEFAULT_MAX_TOKENS,
    });
  });

  // Перевіряємо, що при відсутності кастомних налаштувань у запит підставляються глобальні дефолти.
  it("підставляє дефолтні model, effort і max_tokens у запит", async () => {
    const create = vi.fn().mockResolvedValue({ text: "Готово" });

    const environment = loadEnvironment({
      OPENROUTER_API_KEY: "test-only-value",
    });

    await requestAnswer({ create }, environment, "Короткий запит");

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_OPENROUTER_MODEL,
        reasoning: { enabled: true, effort: DEFAULT_REASONING_EFFORT },
        max_tokens: DEFAULT_MAX_TOKENS,
      }),
    );
  });
  it("відхиляє порожній text", async () => {
    await expect(
      requestAnswer(
        { create: vi.fn().mockResolvedValue({ text: "   " }) },
        validEnvironment,
        "Короткий запит",
      ),
    ).rejects.toThrow("без текстового output");
  });

  // Перевіряємо коректне прокидання помилок мережі для подальшої обробки у formatError.
  it("передає помилку mock-клієнта вище", async () => {
    const failure = new Error("mock network failure");

    await expect(
      requestAnswer(
        { create: vi.fn().mockRejectedValue(failure) },
        validEnvironment,
        "Короткий запит",
      ),
    ).rejects.toBe(failure);
  });
});
```

#### Пояснення коду по логічних блоках

1. `повертає текст через mock-клієнт` — підтверджує структуру запиту та відповіді.
2. `підставляє дефолтні model, effort і max_tokens` — перевіряє передачу дефолтних параметрів.
3. `відхиляє порожній text` — перевіряє валідацію отриманого контенту.
4. `передає помилку mock-клієнта вище` — перевіряє прокидання винятків для верхнього рівня.
5. `відхиляє порожній text` — перевіряє валідацію отриманого контенту.
6. `передає помилку mock-клієнта вище` — перевіряє прокидання винятків для верхнього рівня.

</details>

---

## Крок 7. Створення тестів безкоштовної моделі (tests/free-model.test.ts)

### Навіщо це робимо

У курсі важливо, щоб налаштована модель мала free-tier тариф, а lesson-local `my-dev/lesson-01-intro-openrouter/.env.example` не містив реального ключа й відповідав дефолтам коду. Цей тестовий файл перевіряє суфікс `:free`, reasoning effort і локальний конфігураційний шаблон.

### Файл

`my-dev/lesson-01-intro-openrouter/tests/free-model.test.ts`

### Де саме

Потрібно створити новий файл `my-dev/lesson-01-intro-openrouter/tests/free-model.test.ts`.

### Код для вставки

```ts
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_REASONING_EFFORT,
  OPENROUTER_REASONING_EFFORTS,
} from "../src/cli.js";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const environmentExamplePath = resolve(workspaceRoot, ".env.example");

describe("Безкоштовна модель з нульовою вартістю", () => {
  it("дефолтна модель помічена як безкоштовний тариф OpenRouter (:free)", () => {
    expect(DEFAULT_OPENROUTER_MODEL).toMatch(/:free$/u);
  });

  it("дефолтний рівень мислення належить до дозволених значень", () => {
    expect(OPENROUTER_REASONING_EFFORTS).toContain(DEFAULT_REASONING_EFFORT);
  });

  it("дефолтна модель у .env.example збігається з дефолтом у коді", async () => {
    const example = await readFile(environmentExamplePath, "utf8");
    const configuredModel = example
      .split(/\r?\n/u)
      .find((line) => line.startsWith("OPENROUTER_MODEL="))
      ?.split("=", 2)[1]
      ?.trim();

    expect(configuredModel).toBe(DEFAULT_OPENROUTER_MODEL);
  });

  it("дефолтний reasoning effort у .env.example збігається з дефолтом у коді", async () => {
    const example = await readFile(environmentExamplePath, "utf8");
    const configuredEffort = example
      .split(/\r?\n/u)
      .find((line) => line.startsWith("OPENROUTER_REASONING_EFFORT="))
      ?.split("=", 2)[1]
      ?.trim();

    expect(configuredEffort).toBe(DEFAULT_REASONING_EFFORT);
  });

  it(".env.example тримає OPENROUTER_API_KEY порожнім (без реального ключа)", async () => {
    const example = await readFile(environmentExamplePath, "utf8");
    const apiKeyValue = example
      .split(/\r?\n/u)
      .find((line) => line.startsWith("OPENROUTER_API_KEY="))
      ?.split("=", 2)[1]
      ?.trim();

    expect(apiKeyValue).toBe("");
  });
});
```

### Що тут важливо пояснити студентам

- Тести можуть перевіряти не лише код програми, а й lesson-local `.env.example`, щоб конфігурація конкретного заняття не залежала від налаштувань інших lessons у корені repository.
- Однаковий вираз `resolve(..., "..")` працює і в `solution/tests`, і в `my-dev/lesson-01-intro-openrouter/tests`: він завжди веде до `.env.example`, що лежить поруч із поточними `src/` та `tests/`.

### Перевірка

**Що перевіряємо:** дефолтну free-tier модель і lesson-local шаблон конфігурації.

**Навіщо:** підтвердити нульову вартість запитів та безпеку шаблонів конфігурації.

**Команда:**

```powershell
yarn vitest run my-dev/lesson-01-intro-openrouter/tests/free-model.test.ts
```

**Очікуємо:** 5 тестів пройшли успішно.

<details> <summary><b>Розгорнути: детальні пояснення коду</b></summary>

### Той самий код з поясненнями

```ts
// Імпортуємо модуль для асинхронного читання файлів з файлової системи.
import { readFile } from "node:fs/promises";
// Імпортуємо утиліти для роботи зі шляхами до файлів.
import { dirname, resolve } from "node:path";
// Імпортуємо функцію для конвертації file:// URL у шлях файлової системи.
import { fileURLToPath } from "node:url";
// Імпортуємо Vitest assertions.
import { describe, expect, it } from "vitest";
// Імпортуємо константи за замовчуванням із коду CLI.
import {
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_REASONING_EFFORT,
  OPENROUTER_REASONING_EFFORTS,
} from "../src/cli.js";

// Файл лежить у tests/, тому один рівень вгору веде до локального кореня
// кореня поточної студентської копії.
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const environmentExamplePath = resolve(workspaceRoot, ".env.example");

describe("Безкоштовна модель з нульовою вартістю", () => {
  // Перевіряємо, що основна модель має суфікс :free, що гарантує безкоштовність.
  it("дефолтна модель помічена як безкоштовний тариф OpenRouter (:free)", () => {
    expect(DEFAULT_OPENROUTER_MODEL).toMatch(/:free$/u);
  });

  // Перевіряємо валідність дефолтного рівня мислення.
  it("дефолтний рівень мислення належить до дозволених значень", () => {
    expect(OPENROUTER_REASONING_EFFORTS).toContain(DEFAULT_REASONING_EFFORT);
  });

  // Перевіряємо синхронізацію назви моделі у файлі .env.example та константі TypeScript.
  it("дефолтна модель у .env.example збігається з дефолтом у коді", async () => {
    const example = await readFile(environmentExamplePath, "utf8");
    const configuredModel = example
      .split(/\r?\n/u)
      .find((line) => line.startsWith("OPENROUTER_MODEL="))
      ?.split("=", 2)[1]
      ?.trim();

    expect(configuredModel).toBe(DEFAULT_OPENROUTER_MODEL);
  });

  // Перевіряємо синхронізацію значення reasoning effort у .env.example.
  it("дефолтний reasoning effort у .env.example збігається з дефолтом у коді", async () => {
    const example = await readFile(environmentExamplePath, "utf8");
    const configuredEffort = example
      .split(/\r?\n/u)
      .find((line) => line.startsWith("OPENROUTER_REASONING_EFFORT="))
      ?.split("=", 2)[1]
      ?.trim();

    expect(configuredEffort).toBe(DEFAULT_REASONING_EFFORT);
  });

  // Перевіряємо безпеку: шаблон .env.example ніколи не повинен містити справжнього ключа.
  it(".env.example тримає OPENROUTER_API_KEY порожнім (без реального ключа)", async () => {
    const example = await readFile(environmentExamplePath, "utf8");
    const apiKeyValue = example
      .split(/\r?\n/u)
      .find((line) => line.startsWith("OPENROUTER_API_KEY="))
      ?.split("=", 2)[1]
      ?.trim();

    expect(apiKeyValue).toBe("");
  });
});
```

### Пояснення коду по логічних блоках

1. `environmentExamplePath` — із `my-dev/lesson-01-intro-openrouter/tests/free-model.test.ts` піднімається на один рівень до `my-dev/lesson-01-intro-openrouter/.env.example`; той самий код у canonical solution читає `solution/.env.example`.
2. `дефолтна модель помічена як безкоштовний тариф` — перевірка regex `/:free$/`.
3. `дефолтна модель у .env.example` — перевірка синхронності коду з шаблоном конфігурації.
4. `дефолтний reasoning effort у .env.example` — перевірка синхронності конфігурації.
5. `.env.example тримає OPENROUTER_API_KEY порожнім` — перевірка відсутності витоку реальних ключів у репозиторій.

</details>

---

## Фінальна перевірка

Спершу завершіть усі кроки реалізації та пройдіть offline gate. Після виконання roadmap solution має 23 активні CLI тести та 5 free-tier configuration tests. Homework вимагає замінити 21 початковий `it.todo`; фактичні кількості звіряйте з runner output.

Виконуйте команди з кореня вашого fork після реалізації всіх вимог:

```powershell
yarn check:my:lesson01:openrouter
git diff --check -- my-dev/lesson-01-intro-openrouter
git status --short -- my-dev/lesson-01-intro-openrouter
```

Початковий starter навмисно містить 21 `it.todo`, тому `yarn test:my:lesson01:openrouter` і повний offline gate спочатку завершаться помилкою strict TODO gate. Щоб переглянути початковий стан без цього gate, запустіть:

```powershell
yarn vitest run my-dev/lesson-01-intro-openrouter/tests
```

Для незміненого starter очікуються `0 passed, 21 todo`. Після завершення всіх вимог `yarn check:my:lesson01:openrouter` має пройти typecheck, lint, форматування та тести без `todo` чи skipped test. Поточний solution має 28 активних тестів загалом: 23 CLI та 5 перевірок free-tier конфігурації. Автоматичні тести не звертаються до реального API.

Після успішних offline-перевірок виконайте один короткий ручний smoke test, якщо доступні ключ і мережа:

```powershell
yarn dev:my:lesson01:openrouter "Обчисли 37 * 19. Поверни лише число."
```

Перевірте, що термінал показує надісланий текст, непорожню відповідь і фактичний ID моделі. Не вставляйте секрети в запит або звіт. Якщо ключ чи мережа недоступні, зафіксуйте smoke test як `NOT RUN`; не подавайте його як успішний.

Для здачі роботи скористайтеся **Промптом 2** зі [STUDENTS.md](../STUDENTS.md). Перед здачею переконайтеся, що `.env` і ключі не входять до Git.

---

# Що отримали

- CLI-застосунок OpenRouter у вашій копії `my-dev/lesson-01-intro-openrouter/`.
- Валідацію конфігурації та аргументів командного рядка.
- Безпечне форматування мережевих/API-помилок без витоку ключів, заголовків або provider body.
- Налаштовану безкоштовну модель, reasoning effort і фактичний ID моделі у відповіді.
- Unit-тести, які перевіряють поведінку через mock без реальних API-викликів.

---

# Definition of Done

Робота готова до здачі, коли:

- реалізовані всі вимоги й тести з homework;
- `yarn check:my:lesson01:openrouter` завершується успішно без `todo` або skipped test;
- усі зміни практичної роботи розташовані у `my-dev/lesson-01-intro-openrouter/`;
- `.env` і ключі не додані до Git або deliverables;
- один ручний синтетичний smoke test підтвердив вивід запиту, відповіді та фактичної моделі, якщо доступні ключ і мережа.

Здайте роботу через **Промпт 2** зі [STUDENTS.md](../STUDENTS.md). Не змінюйте canonical `starter/` і `solution/` та викладацьку папку `dev/`.
