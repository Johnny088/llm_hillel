# Lesson 04 OpenRouter – успадкована основа starter

Ця папка фізично походить від готового Lesson 03 OpenRouter solution. Усі успадковані файли збережено зі своїми шляхами та вмістом; спеціальний файл final-project-ideas.md описує напрямок цієї практики. У starter немає прихованого готового MCP runtime чи lesson-specific 501 scaffold. Одноразово створіть кандидат командою `yarn student:init 04 openrouter`; canonical baseline gate нижче перевіряє тільки канонічний starter.

## Підготовка та baseline

Команди запускаються з кореня репозиторію, де лежить package.json:

```powershell
yarn verify:lesson04:openrouter:scaffolding
```

Очікується підтвердження exact Lesson 04 OpenRouter inheritance. Gate перевіряє канонічну копію, а не виконує нову функцію. Успішні успадковані тести та eval лише підтверджують, що стартова основа справна.

Для перегляду цієї основи використовується окрема solution папка:

```powershell
yarn demo:lesson04:openrouter:solution
```

Демонстрація робить live provider-запити. Вона необов'язкова і може витратити баланс. Для offline і local перевірок дивіться README готового solution.

## Що потрібно додати у власній папці

Roadmap веде від робочої успадкованої основи до Lesson 04 поведінки:

- local filesystem Model Context Protocol (MCP) client через stdio із доступом лише до потрібного текстового інструмента;
- перевірку model-facing tool allowlist та sandbox-relative path;
- hosted OpenRouter web search;
- research-agent і локальний endpoint, що поєднує успадковану HTTP основу з новими інструментами;
- offline unit сценарії для помилок, tool routing, метрик і завершення;
- local Model Context Protocol (MCP) smoke, що запускає справжній subprocess і підтверджує cleanup.

Поточний starter не має прихованої Lesson 04 реалізації: цей код створюється покроково лише в my-dev/lesson-04-mcp-built-in-tools-openrouter/. Не замінюйте його готовим solution і не додавайте залежностей на файли з sibling-папки під час виконання.

## Команди у власній папці

До завершення роботи використовуйте команду завершеності:

```powershell
yarn check:my:lesson04:openrouter
```

Окремий baseline gate і окремий completion gate мають різні цілі. Те, що inherited tests проходять, не доводить появу MCP client, research endpoint чи нових тестів. Дивіться [roadmap](../roadmap-code-guide.md) для точних змін і проміжних очікувань.
