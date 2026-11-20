# Lesson 03 (OpenRouter) – підготовка студентської папки

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Створити чисту робочу копію Lesson 03 starter для власної реалізації tool calling.

### 💎 Практична цінність застосунку

Окрема папка дає змогу зберегти незмінним перевірений Lesson 02 baseline і бачити тільки зміни, які додають `POST /api/agent`, тести та eval Lesson 03.

### ⚙️ Що робить застосунок

Starter містить готові `/health`, extraction та summary-stream маршрути. Студентська копія починається без нового маршруту й поступово отримує його за [roadmap](./roadmap-code-guide.md). Цей student migration guide не готує викладацький `dev/`.

## Підготуйте чисту гілку

У Промпті 1 зі [STUDENTS.md](../STUDENTS.md) виберіть Lesson `03` та трек `OpenRouter`. Створіть окрему гілку `lesson-03-function-calling-openrouter` від актуального `main`. Команди нижче виконуються з кореня репозиторію, де є `package.json`.

Спочатку перевірте, що гілка не містить попередньої роботи цього заняття, а student destination ще не існує:

```powershell
git status --short --branch
Test-Path my-dev/lesson-03-function-calling-openrouter
```

`Test-Path` має вивести `False`. Якщо папка вже існує, не запускайте init повторно: команда відмовиться перезаписувати наявну роботу. Чистий Git status не доводить, що ignored `my-dev/` порожня.

## Скопіюйте вміст starter

Після підтвердження, що папка відсутня, створіть student-копію:

```powershell
yarn student:init 03 openrouter
```

Команда створює `my-dev/lesson-03-function-calling-openrouter/` із канонічного starter та відмовляється перезаписувати наявну папку. Starter є завершеною основою попереднього заняття; робота Lesson 03 додається в student-копії. Канонічні `starter/` і `solution/` залишаються read-only reference snapshots.

## Перевірте початкову копію

Власна папка має містити `src/`, `tests/`, `evals/`, `README.md` та `final-project-ideas.md` у корені. Вона успадковує базу Lesson 02, тому source, тести й evals Lesson 02 вже готові. Там не повинно бути L03 `agent-request.ts`, tool runtime, `POST /api/agent`, tool-calling tests або tool-calling eval files.

Запустіть unit-тести та початковий completion check:

```powershell
yarn student:test 03 openrouter
yarn student:check 03 openrouter
```

Успадковані тести підтверджують базу попереднього заняття, а не завершення Lesson 03. Початковий `student:check` очікувано відмовляє, доки нова поведінка не реалізована. Після цього проходьте [roadmap](./roadmap-code-guide.md) послідовно. Усі нові файли створюються в `my-dev/lesson-03-function-calling-openrouter/`, а наявні файли змінюються за наведеними точними anchors.

## Змінні середовища

Для inherited offline tests і recorded eval ключ OpenRouter не потрібен. Якщо пізніше запускається власний сервер або добровільна live-демонстрація, використовуйте кореневий `./.env`, створений за `.env.example`; ключ введіть локально й ніколи не додавайте до Git. Tool-calling live request є окремою демонстрацією і не входить до Definition of Done.
