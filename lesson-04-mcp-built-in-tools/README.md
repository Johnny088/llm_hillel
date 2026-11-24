# Lesson 04 – MCP та вбудовані інструменти (OpenAI)

Практика додає до застосунку Lesson 03 локальний filesystem MCP-клієнт лише для читання та hosted tool `web_search` у OpenAI Responses API.

## Робота студента

Запустіть Prompt 1 зі [STUDENTS.md](../STUDENTS.md) і виберіть Lesson 04, OpenAI. Prompt 1 вже створює `my-dev/lesson-04-mcp-built-in-tools/`; після нього робота продовжується в цій папці без повторного init. Лише якщо папка ще не створена, одноразово виконується `yarn student:init 04 openai`; команда відмовляється перезаписувати наявну роботу. Усі зміни робіть лише в цій папці. Канонічні `starter/`, `solution/` і спільний `dev/` залишайте без змін.

Спершу прочитайте [homework.md](./homework.md), далі виконуйте короткий маршрут у [student-guide.md](./student-guide.md). [dev-migration-guide.md](./dev-migration-guide.md) і [starter-code-guide.md](./starter-code-guide.md) відкривайте за потреби. [roadmap-code-guide.md](./roadmap-code-guide.md) містить повний план і кодові payload-и.

## Швидка офлайн-перевірка

Команду запускайте з кореня репозиторію:

```powershell
yarn student:test 04 openai
yarn student:eval 04 openai
yarn student:build 04 openai
yarn student:check 04 openai
```

`student:test` і `student:eval` запускаються для candidate workspace; успадкований baseline може бути зеленим до реалізації Lesson 04. `student:check` є повним gate для поточної дельти. Канонічний `starter/` є байтово тотожним non-Markdown snapshot Lesson 03 solution. Успадковані Document API та currency agent працюють; MCP і hosted search реалізуються лише в `my-dev/lesson-04-mcp-built-in-tools/`.

## Файли практики

```text
lesson-04-mcp-built-in-tools/
├── starter/       # джерело для студентської my-dev-папки
├── solution/      # еталон, не редагувати
├── README.md
├── homework.md
├── student-guide.md
├── dev-migration-guide.md
├── starter-code-guide.md
└── roadmap-code-guide.md
```

Еталонне рішення перевіряється окремими solution-командами. Offline replay підтверджує узгодженість збережених даних і scorer, але не реальний запит до OpenAI. Live-перевірка OpenAI необов’язкова; умови наведено в student-guide.

## Детальні інструкції

- [Маршрут і команди студента](./student-guide.md)
- [Критерії домашнього завдання](./homework.md)
- [Успадкування від Lesson 03 і шляхи workspace](./dev-migration-guide.md)
- [Початковий стан starter](./starter-code-guide.md)
- [Покрокова реалізація з payload-ами](./roadmap-code-guide.md)

## Навчальні матеріали

- [Інструкція студента](student-guide.md)
- [Карта starter](starter-code-guide.md)
- [Roadmap коду](roadmap-code-guide.md)
- [Сценарій викладача](instructor-guide.md)
