# Навігатор студента – Lesson 03: Function Calling (OpenRouter)

## Маршрут роботи

1. Прочитайте [INSTRUCTION.md](../INSTRUCTION.md) і дотримуйтеся правил [STUDENTS.md](../STUDENTS.md). В Промпті 1 виберіть Lesson `03` і трек `OpenRouter`. Промпт 1 вже запускає `yarn student:init 03 openrouter` і створює `my-dev/lesson-03-function-calling-openrouter/` з canonical starter. Далі продовжуйте роботу в цій папці без повторної ініціалізації. Лише якщо папка відсутня, одноразово виконайте цю команду з кореня репозиторію; вона відмовляється перезаписувати наявну роботу.
2. Виконуйте роботу лише в `my-dev/lesson-03-function-calling-openrouter/`. Канонічні `starter/` і `solution/` призначені для читання. Маршрут викладача через спільний `dev/` описаний в приватному dev-migration guide й не потрібен студенту.
3. Прочитайте [homework.md](./homework.md), а потім [starter-code-guide.md](./starter-code-guide.md). Стартова копія містить 25 inherited source/test/eval files Lesson 02 `solution` і попередні Markdown/data файли; два README адаптовані до Lesson 03. В ній немає реалізації, тестів чи eval для нового маршруту.
4. Пройдіть усі обов'язкові створення файлів і зміни успадкованих файлів в [roadmap-code-guide.md](./roadmap-code-guide.md). Не копіюйте папку solution цілком. Кожен крок містить точний шлях, дію, anchor або позначку `CREATE`, очікувану перевірку та наступну дію в разі помилки.
5. Із кореня репозиторію запускайте перевірки власної копії:

   ```powershell
   yarn student:test 03 openrouter
   yarn student:eval 03 openrouter
   yarn student:check 03 openrouter
   ```

   Успадковані тести перевіряють основу Lesson 02, але самі по собі не доводять завершення Lesson 03. Completion gate відхиляє незмінений destination; після roadmap acceptance tests запускаються проти фактичного student source. Student eval запускає потрібні offline оцінювання без мережевих запитів.

6. Перед здачею звірте результат із Definition of Done в [homework.md](./homework.md), перевірте `git status --short` і скористайтеся Промптом 2 зі [STUDENTS.md](../STUDENTS.md). Не комітьте `.env`, ключі або повні вхідні документи.

## Ручний HTTP запуск

Для локальної перевірки власного сервера спочатку підготуйте `.env` за кореневим `.env.example`, а ключ OpenRouter введіть лише локально. `GET /health` перевіряє сервер без запиту до моделі. `POST /api/agent` може створити платний запит, тому live-запуск не входить до обов'язкових перевірок. Очікуваний контракт, приклади помилок і спосіб зупинити сервер описані в roadmap та README власної папки після відповідного кроку.
