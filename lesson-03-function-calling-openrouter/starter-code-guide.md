# Lesson 03 (OpenRouter) – огляд starter

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Почати з перевіреної основи Lesson 02 і додати один зрозумілий цикл tool calling. Цей огляд пояснює межу роботи; точні дії, вставки та перевірки наведені в [roadmap](./roadmap-code-guide.md).

### 💎 Практична цінність застосунку

Інструмент корисний, коли відповідь має спиратися на контрольовану дію програми. Наприклад, модель може попросити конвертувати суму, але сама не має доступу до функції чи даних курсу. Сервер перевіряє її аргументи, виконує лише дозволену операцію і повертає результат в розмову.

### ⚙️ Що робить застосунок

Starter уже обробляє `/health`, вилучення даних із документа та потокове резюме. Ці можливості успадковані з Lesson 02. На початку роботи `/api/agent` і tool-calling runtime ще не існують. Після проходження roadmap новий маршрут керуватиме викликами `convert_currency`, а попередні маршрути продовжать працювати.

## Спосіб успадкування

Це фізичне успадкування: 25 source, test і eval файлів з `lesson-02-llm-api-openrouter/solution` та всі інші Markdown/data файли мають збігатися зі starter 03 байт в байт. Структурної міграції немає, імпортів з попереднього solution немає.

| Документальний виняток    | Необхідність                                            | Залежність і доказ                                                                                 |
| ------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `starter/README.md`       | Назвати Lesson 03 і її student entrypoint               | README є точкою входу; без адаптації він називає Lesson 02                                         |
| `starter/evals/README.md` | Спрямувати команди на Lesson 03 starter extraction eval | Inherited Lesson 02 README запускав би попередню папку; eval code й fixtures лишаються ідентичними |

Ці два документи не додають коду, маршрутів чи нових eval cases.

## Відмінності завершеного solution від успадкованої бази

Наведені нижче зміни належать завершеному `solution`, а не starter. Новий Lesson 03 tool flow використовує налаштовану модель; успадковані ролі, capability та pricing metadata залишаються окремими налаштуваннями.

| Файл в solution                          | Відмінність від Lesson 02                                             | Причина та межа Lesson 03                                                              |
| ---------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/lib/metrics.ts`                     | Додано `sumUsageMetrics`                                              | Підсумовує usage після кількох model calls в tool циклі.                               |
| `src/services/openrouter-document-ai.ts` | `mapOpenRouterError` експортовано                                     | Agent повторно використовує нормалізацію provider-помилок в спільному document client. |
| `src/app.ts`                             | Додано `POST /api/agent` і відповідь із метриками                     | Підключає новий agent route до наявного HTTP app.                                      |
| `src/server.ts`                          | Додано agent і wiring для Lesson 03                                   | Підключає route, зберігаючи успадкований Lesson 02 environment contract.               |
| `src/config/env.ts`                      | Збережено shared env loader і provider attribution                    | Дає Lesson 03 ту саму перевірену основу конфігурації.                                  |
| `src/config/model-capabilities.ts`       | Збережено model-capability дані                                       | Agent перевіряє заявлені можливості вибраної моделі перед запитом.                     |
| `src/config/models.ts`                   | Збережено resolver ролей fast і main                                  | Document AI та новий agent мають узгоджені model roles.                                |
| `src/config/openrouter.ts`               | Збережено shared endpoint, defaults та app metadata                   | Використовується успадкованими маршрутами й новим agent.                               |
| `src/config/pricing.ts`                  | Збережено model pricing entries                                       | Використовується для обчислення вартості за фактичною моделлю та usage.                |
| `src/demo.ts`                            | Додано локальний `/api/agent` demo                                    | Перевіряє tool trace та результат; запит до OpenRouter є live-provider перевіркою.     |
| `evals/run.ts`                           | Extraction runner лишається сумісним з успадкованим extraction replay | Кроки Lesson 03 додають окремі tool-calling evals.                                     |
| `evals/live-catalog.ts`                  | Lesson 03 catalog flow перевіряє налаштовану модель                   | Catalog доступність окрема від recorded replay.                                        |
| `tests/config-and-metrics.test.ts`       | Перевіряє shared config та pricing сумісність                         | Ці перевірки залишаються в solution для downstream API; starter їх не розширює.        |
| `tests/openrouter-document-ai.test.ts`   | Перевіряє успадкований document client                                | Регресійна перевірка зберігає роботу document routes після змін.                       |

Ця таблиця описує різницю з базою, а не додаткові кроки студента. Нові файли й зміни, які потрібно реалізувати в student copy, перелічені в roadmap.

## Що вже готово

- `src/app.ts` обслуговує успадковані health та Document API маршрути.
- `src/server.ts` створює HTTP сервер і готовий Document AI.
- `src/services/` містить provider-незалежний контракт і OpenRouter adapter.
- `src/config/`, `src/lib/` та `src/schemas/` містять налаштування, помилки, метрики, SSE та валідацію документів.
- `tests/` містить активні regression tests Lesson 02.
- `evals/` містить extraction scorer, recorded cases, runner та окрему перевірку каталогу.

Початкові тести перевіряють лише цей успадкований контракт. Вони не є completion gate для Lesson 03.

## Що потрібно створити для Lesson 03

Студентський маршрут створює request schema, tool schema та executor, стабільні помилки, bounded retry для дозволеної зовнішньої залежності, Chat Completions agent, нові активні unit/route/eval tests і нові tool-calling eval assets. В власній копії студент відкриває успадкований `mapOpenRouterError` як named export для повторного використання agent adapter, додає необхідне wiring до `src/app.ts` і `src/server.ts`, та окремим APPEND додає відсутній в базі `sumUsageMetrics` до `src/lib/metrics.ts`.

Створення кожного файла позначене `CREATE` і має шлях від `my-dev/lesson-03-function-calling-openrouter/`. Зміна наявного файла має окремий буквальний anchor. Якщо потрібного файла або anchor немає, зупиніться, звіртеся з цим контрактом та виправте початкову копію; не вставляйте код в схоже місце.

## Контракт завершення

Зелений `yarn test:lesson03:openrouter` засвідчує успадковані тести. Completion gate додатково вимагає фактичного `/api/agent` коду і запускає нові solution test sources проти source в студентській папці. Gate не імпортує завершений solution і має відхилити незмінений starter.

Записаний extraction replay і новий tool-calling replay працюють з фікстурами та не звертаються до провайдера. Live OpenRouter запит є окремою добровільною перевіркою. Повний набір команд і очікуваних результатів наведений в [homework](./homework.md) та в послідовних кроках [roadmap](./roadmap-code-guide.md).
