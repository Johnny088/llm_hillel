# Lesson 05 OpenRouter – карта успадкованого starter

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Зафіксувати походження starter і межу між уже готовою основою та новою роботою Conversation State і Memory. Ця карта допомагає перевірити baseline до того, як з’являться файли Lesson 05.

### 💎 Практична цінність застосунку

Готовий API заняття 04 поєднує Document API, Function Calling, локальний filesystem MCP і hosted web search. Lesson 05 додає окреме керування розмовами й відібраними фактами, зберігаючи ці успадковані можливості.

### ⚙️ Що робить застосунок

На початку Lesson 05 всі успадковані маршрути, сервіси, конфігурація, тести, evals і sandbox уже є. Conversation routes, history stores, long-term facts, їхні тести й evals створюються студентом за roadmap.

## Канонічне джерело та спосіб переходу

Джерелом є Git-відстежуваний `lesson-04-mcp-built-in-tools-openrouter/solution` поточної гілки. Спосіб переходу – **фізичне успадкування** без структурної міграції та без імпортів із canonical Lesson 03/04.

В Lesson 04 solution є 52 відстежувані файли. В Lesson 05 starter 51 успадкований файл збігається з джерелом за відносним шляхом і байтами. Єдиний дозволений виняток – `starter/README.md`, який описує базу й маршрут Lesson 05. Зокрема, `starter/evals/README.md` і `starter/final-project-ideas.md` залишаються байтовими копіями джерела. Файли `solution/evals/README.md` і `solution/final-project-ideas.md` також зберігають успадкований текст.

| Відносний шлях      | Відмінність      | Причина                                                          | Перевірка                                                                                      |
| ------------------- | ---------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `starter/README.md` | Замінений README | Пояснює точну успадковану основу та навчальний маршрут Lesson 05 | `yarn verify:lesson05:openrouter:scaffolding` звіряє інші 51 файли й допускає лише цей виняток |

Зовнішні до starter документи `lesson-05-memory-openrouter/README.md`, `homework.md` та solution README можуть пояснювати Lesson 05. Вони не розширюють виняток starter.

## Що вже готово

Стартова копія має успадковані маршрути `/health`, `/api/agent`, `/api/agent/research`, `/api/documents/extract` і `/api/documents/summary/stream`, а також конфігурацію OpenRouter, безпечну обробку помилок, usage metrics, MCP client, sandbox, активні тести та записані eval. Це готовий API Lesson 04, а не часткова реалізація пам’яті.

В starter немає `conversation-request` schema, conversation manager, in-memory session store, JSON history store, user-fact store, двох нових routes, memory tests або memory eval. Їх не можна вважати прихованими передумовами: roadmap створює кожний потрібний файл або доповнює точний існуючий файл.

## Контракт нового шару

Короткочасна history ізолюється за `sessionId`; reset очищає лише вибрану history. Durable conversation використовує локальний `conversationId` і JSON history, що переживає повторне створення store. Окреме сховище зберігає лише `displayName`, `preferredStack` і `learningGoal`. Long-term facts і durable conversation зберігаються після reset короткочасної session.

OpenRouter отримує повну client-managed Chat Completions `messages` history. Локальні JSON шляхи задаються в runtime, а тести передають синтетичні тимчасові шляхи. За замовчуванням sliding window зберігає до восьми завершених ходів і не розриває повідомлення одного ходу. Якщо провайдер повернув opaque `reasoning_details`, вони зберігаються й повторно передаються без змін під час function-tool loop та JSON restore. Обов’язковий manager regression з’єднує всі кроки: перший публічний `send()` записує відповідь в тимчасовий JSON, нові store, SDK client і manager відновлюють той самий `conversationId`, а наступний mocked SDK request отримує точні дані; публічний результат manager їх не розкриває.

Цей варіант не використовує provider-side `store`, `previous_response_id`, OpenAI Conversation object або `context_management`.

## Перевірити baseline

Команди запускаються з кореня репозиторію, де лежить `package.json`:

```powershell
yarn verify:lesson05:openrouter:scaffolding
yarn test:lesson05:openrouter
yarn eval:lesson05:openrouter
yarn build:lesson05:openrouter:starter
```

Scaffolding gate звіряє відстежувану Lesson 04 поверхню й перевіряє відсутність зайвих файлів та незавершених маркерів. Starter tests і recorded eval підтверджують успадковану основу без мережевих запитів до моделі. Вони не підтверджують completion Lesson 05.

Незмінена копія starter має бути відхилена командою `yarn verify:lesson05:openrouter`, оскільки вона не містить нових memory-файлів та поведінки. Після роботи gate запускається проти фактичної студентської папки командою `yarn verify:my:lesson05:openrouter`.

## Де продовжити

Студентська копія готується в `my-dev/lesson-05-memory-openrouter/`. Далі виконайте кожний крок `roadmap-code-guide.md`; не переносіть готову реалізацію з `solution/` і не імпортуйте source інших занять. Після фінальних кроків запустіть `yarn check:my:lesson05:openrouter`.
