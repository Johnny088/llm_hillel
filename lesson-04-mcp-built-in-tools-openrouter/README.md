# Lesson 04 OpenRouter – локальні дані та вебпошук

Практика розширює успадковану основу Lesson 03: агент читає дозволені текстові файли через локальний Model Context Protocol (MCP) сервер і може запитати в OpenRouter вбудований вебпошук. HTTP API повертає JSON; графічного інтерфейсу немає.

Команди нижче запускаються з кореня репозиторію, де лежить package.json.

## Студентський маршрут

1. Підготуйте окрему гілку за основною інструкцією курсу й одноразово виконайте `yarn student:init 04 openrouter`, щоб створити `my-dev/lesson-04-mcp-built-in-tools-openrouter/` із canonical starter.
2. Прочитайте [домашнє завдання](./homework.md) і [студентський маршрут](./student-guide.md).
3. Перевірте, що ваша папка є завершеною фізичною копією Lesson 04 starter. Пройдіть кроки [roadmap](./roadmap-code-guide.md) послідовно, виконуючи точні зміни лише у своїй робочій папці.
4. Запустіть повний локальний gate, перевірте README власної папки та підготуйте здачу за інструкцією курсу.

[Starter guide](./starter-code-guide.md) описує успадковані файли. [Dev migration guide](./dev-migration-guide.md) допомагає перейти з попереднього стану розробки. Вони не замінюють roadmap.

## Команди перевірки

Спочатку перевірте точну відповідність успадкованому baseline:

```powershell
yarn verify:lesson04:openrouter:scaffolding
```

Команда перевіряє канонічну Lesson 04 основу й фізичне успадкування. Фактичну копію my-dev перевірте за шляхом і SHA-256 у migration guide. Це не завершення Lesson 04.

Після реалізації запустіть:

```powershell
yarn check:my:lesson04:openrouter
```

Gate має пройти лише для завершеного коду у вашій папці. Він перевіряє форматування, типи, lint, тести без TODO та recorded eval. Для окремого перегляду тестів і eval доступні команди:

```powershell
yarn test:my:lesson04:openrouter
yarn eval:my:lesson04:openrouter
yarn typecheck:my:lesson04:openrouter
yarn lint:my:lesson04:openrouter
yarn format:check:my:lesson04:openrouter
```

Student completion gate запускає локальний filesystem MCP smoke: справжній stdio subprocess перевіряє синтетичний sandbox і cleanup, без OpenRouter запиту. Recorded eval також офлайн. Живий OpenRouter inference є окремою демонстрацією і для здачі не потрібен.

## Матеріали

- [Незавершений starter і його точний baseline](./starter/README.md)
- [Готове рішення для вивчення результату](./solution/README.md)
- [Вимоги й умови здачі](./homework.md)
