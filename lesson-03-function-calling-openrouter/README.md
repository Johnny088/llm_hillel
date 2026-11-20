# Lesson 03 (OpenRouter) – Function Calling

Практика додає `POST /api/agent` до готового застосунку Lesson 02. Модель може запропонувати виклик `convert_currency`, а сервер перевіряє аргументи, виконує дозволену локальну функцію та передає її результат моделі.

## Як побачити готовий результат

Відкрийте PowerShell у корені репозиторію, де розташований `package.json`. Один раз підготуйте залежності та локальний `.env`:

```powershell
yarn install --immutable
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Задайте `OPENROUTER_API_KEY` і вибрану `OPENROUTER_MODEL` у `.env`. Ключ залишається локальним і не додається до Git. Команда нижче запускає готову демонстрацію solution та робить реальний запит до OpenRouter:

```powershell
yarn demo:lesson03:openrouter:solution
```

Надсилається повідомлення `Конвертуй 250 USD у UAH`. Очікуваний хід – модель повертає `convert_currency` з аргументами, локальний інструмент обчислює суму за навчальним фіксованим курсом, а модель формує фінальну відповідь. Текст і фактичний ID моделі можуть різнитися. Це optional live-демонстрація, не offline-перевірка.

## Що успадковано і що додається

`starter/` фізично успадковує 25 source/test/eval файлів Lesson 02 `solution` без змін. Усі інші успадковані Markdown/data файли також ідентичні. Два необхідні документальні винятки: `starter/README.md` називає Lesson 03, а `starter/evals/README.md` містить правильні Lesson 03 шляхи й команди для успадкованого extraction eval. Другий файл потрібний, щоб його команди не запускали Lesson 02 target. Структурної міграції немає.

У початковому starter ще немає коду, маршрутів, тестів чи eval-файлів Lesson 03. Це завершена основа Lesson 02, а не завершена третя практика. Під час роботи створюються новий request schema, tool runtime, `POST /api/agent`, його тести та offline tool-calling eval. Документ [starter-code-guide.md](./starter-code-guide.md) пояснює успадковану поверхню, а [roadmap-code-guide.md](./roadmap-code-guide.md) проводить через створення кожного потрібного файла.

## Перевірки

З кореня репозиторію можна окремо запустити успадковані тести, готове рішення та фінальну перевірку:

```powershell
yarn test:lesson03:openrouter
yarn test:lesson03:openrouter:solution
yarn eval:lesson03:openrouter:solution
yarn build:lesson03:openrouter
yarn check:lesson03:openrouter:solution
```

`yarn test:lesson03:openrouter` та `yarn eval:lesson03:openrouter` перевіряють успадковану базу Lesson 02. `yarn verify:lesson03:openrouter` очікувано відхиляє canonical starter, у якому ще немає L03 delta. У student branch `yarn verify:my:lesson03:openrouter` має так само відхилити незмінену копію, а `yarn check:my:lesson03:openrouter` після виконання roadmap запускає completion gate і L03 acceptance tests проти фактичного `my-dev` source. Повні критерії наведені в [homework.md](./homework.md).

## Де виконувати роботу

Студент створює окрему гілку та одноразово запускає `yarn student:init 03 openrouter`, щоб отримати `my-dev/lesson-03-function-calling-openrouter/` з `starter/`. Канонічні `starter/` і `solution/` залишаються джерелами для читання. Викладацький маршрут для спільного `dev/` описаний окремо у приватному migration guide; студентський roadmap не змінює `dev/`.

- [Навігатор студента](./student-guide.md)
- [Домашнє завдання](./homework.md)
- [README навчальної основи](./starter/README.md)
- [README готового рішення](./solution/README.md)
