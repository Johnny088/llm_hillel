# Lesson 03 – Function Calling (OpenAI)

Для виконання домашньої роботи почніть із [INSTRUCTION.md](../INSTRUCTION.md), підготуйте гілку Промптом 1 зі [STUDENTS.md](../STUDENTS.md), а реалізацію ведіть у my-dev/lesson-03-function-calling/. Не редагуйте канонічні starter, solution чи dev.

Матеріали студента:

- [Покроковий маршрут](./student-guide.md)
- [Roadmap реалізації та перевірок](./roadmap-code-guide.md)
- [Огляд початкового starter](./starter-code-guide.md)
- [Перехід від Lesson 02](./dev-migration-guide.md)
- [Вимоги та Definition of Done](./homework.md)

## Що реалізується

До успадкованого Document API додається POST /api/agent. OpenAI Responses API може запропонувати strict-інструмент convert_currency. Локальний код перевіряє аргументи, виконує інструмент, повертає його результат моделі та завершує контрольований цикл. Обов'язкові межі описані у homework.md.

## Student-команди

Після Prompt 1 запускайте команди з кореня репозиторію. Офлайн-перевірки не потребують API key і не роблять live-запитів:

```powershell
yarn student:test 03 openai
yarn student:eval 03 openai
yarn student:check 03 openai
```

Повний check охоплює типи, lint, форматування, тести з no-TODO gate і записані eval-набори. Recorded replay перевіряє scorer та fixtures, але не доводить доступність OpenAI або якість live-відповідей.

## Необов'язковий локальний live smoke

Ручний запит до OpenAI не входить до основного Definition of Done. Він може бути платним і потребує власного ключа та model IDs у локальному кореневому .env. Не додавайте секрети до Git.

```powershell
yarn student:dev 03 openai
```

З іншого вікна PowerShell надішліть синтетичне повідомлення:

```powershell
$body = @{ message = "Конвертуй 250 USD у UAH" } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri http://localhost:3000/api/agent -Method Post -ContentType "application/json; charset=utf-8" -Body $body
```

Зафіксуйте live-результат окремо від офлайн-тестів і recorded evals. Зупиніть сервер через Ctrl+C.

## Навігація по вихідному коду

Канонічний `starter/` містить байтово тотожний non-Markdown snapshot Lesson 02 solution; Function Calling реалізується тільки в `my-dev/lesson-03-function-calling/`.

- `solution/` – довідкова реалізація Lesson 03 та її тести; використовуйте її для звірки вимог.
- README у `starter/` і `solution/` описують reference стани. Для виконання ДЗ працюйте в `my-dev/` та користуйтеся наведеними вище гідами.

## Навчальні матеріали

- [Інструкція студента](student-guide.md)
- [Карта starter](starter-code-guide.md)
- [Roadmap коду](roadmap-code-guide.md)
- [Сценарій викладача](instructor-guide.md)
