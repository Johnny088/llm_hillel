# Lesson 05 OpenRouter – успадкований starter

Цей starter є готовою основою Lesson 04 OpenRouter. Він проходить успадковані тести й не містить штучних `TODO` чи HTTP 501-заглушок Lesson 05. Зелений baseline підтверджує лише стару функціональність, а не завершення нової практики.

## Що вже успадковано

Усі 51 успадковані файли збігаються за шляхом і байтами з поточним Git-відстежуваним `lesson-04-mcp-built-in-tools-openrouter/solution`. Єдиний виняток у наборі starter – цей `README.md`. Успадковані HTTP та MCP маршрути, конфігурація, тести, evals і sandbox уже працюють.

У starter ще немає жодного Lesson 05 route, conversation manager, history store, user-fact store, memory test чи memory eval. Усі такі файли створюються під час практики.

## Запустити готову основу

Команди виконуються з кореня клонованого репозиторію, де розташований `package.json`.

```powershell
yarn dev:lesson05:openrouter:solution
```

Точний HTTP приклад і поведінка memory наведені в [README практики](../README.md). Запуск еталона потребує кореневого `.env` з `OPENROUTER_API_KEY` і звертається до налаштованої моделі.

## Перевірити початковий стан

```powershell
yarn verify:lesson05:openrouter:scaffolding
yarn test:lesson05:openrouter
yarn eval:lesson05:openrouter
yarn build:lesson05:openrouter:starter
```

Перший gate звіряє starter зі спадковою Git-відстежуваною поверхнею. Тести й записаний eval перевіряють успадковану основу; вони не звертаються до провайдера. `yarn verify:lesson05:openrouter` запускає completion gate на канонічному starter і має відхилити його через відсутні файли Lesson 05. Це очікувана негативна перевірка.

## Продовжити у власній папці

Одноразово створіть окрему копію starter командою `yarn student:init 05 openrouter`, що підготує `my-dev/lesson-05-memory-openrouter/`. Далі виконуйте кроки [roadmap](../roadmap-code-guide.md). Не редагуйте `starter/` чи `solution/`. Roadmap створює всі нові source-файли, JSON схеми, маршрути й runtime wiring, тести, evals та синтетичні приклади, а після кожного кроку запускає вказану перевірку.

Після завершення виконайте `yarn check:my:lesson05:openrouter`. Completion gate перевіряє фактичний код у `my-dev/lesson-05-memory-openrouter/`, а не імпортує еталонне solution.
