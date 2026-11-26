# Lesson 05 OpenRouter – покрокова реалізація

## Мета, цінність і поведінка застосунку

### 🎯 Мета проєкту

Додати session history, durable conversation, reset, sliding window і окреме сховище user facts до готової Lesson 04 основи.

### 💎 Практична цінність застосунку

Ця практика допомагає розрізнити короткочасний контекст запиту, відновлювану історію та контрольовані факти користувача, а також перевірити ізоляцію між сесіями.

### ⚙️ Що робить застосунок

Новий `POST /api/agent/conversation` приймає session або conversation ID, застосовує sliding window до завершених turns і зберігає conversation та user facts окремо. Reset очищує лише вказану session.

Цей roadmap починається з підготовленої повної Lesson 04 OpenRouter основи в `my-dev/lesson-05-memory-openrouter/`. Створіть копію поточного starter за [необов’язковою довідкою](./dev-migration-guide.md), звірте її до першої зміни та виконуйте кроки послідовно. Усі шляхи нижче наведені від кореня репозиторію. Працюйте лише в власній папці `my-dev/lesson-05-memory-openrouter/`.

На початку доступні успадковані маршрути `/health`, `/api/agent`, `/api/agent/research`, `/api/documents/extract` і `/api/documents/summary/stream`. В starter ще немає memory schemas, stores, manager, нових routes, tests або memory eval. Успадковані зелені перевірки підтверджують Lesson 04, але не завершення Lesson 05.

## Кроки

### 1. Додайте request schemas

**Файл:** створіть `my-dev/lesson-05-memory-openrouter/src/schemas/conversation-request.ts`.

Опишіть строгий discriminated union за полем `mode`: `session` вимагає `sessionId` і `message`, а `conversation` приймає необов’язковий `conversationId` і `message`. Повторно використайте лише форму `message` з локального `agent-request.ts`. Обмежте `sessionId` 1–64 символами `[A-Za-z0-9_-]`, `conversationId` – 1–128 символами. Експортуйте також строгий reset schema з єдиним `sessionId`.

**Перевірка:** `yarn typecheck:my:lesson05:openrouter`. Очікується успіх без імпортів з інших lesson folders.

Створіть модуль із таким базовим контрактом:

```typescript
import { z } from "zod";
import { AgentRequestSchema } from "./agent-request.js";

export const SessionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

const ConversationIdSchema = z.string().trim().min(1).max(128);

export const ConversationMessageRequestSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("session"),
      sessionId: SessionIdSchema,
      message: AgentRequestSchema.shape.message,
    })
    .strict(),
  z
    .object({
      mode: z.literal("conversation"),
      conversationId: ConversationIdSchema.optional(),
      message: AgentRequestSchema.shape.message,
    })
    .strict(),
]);

export const ConversationResetRequestSchema = z.object({ sessionId: SessionIdSchema }).strict();
export type ConversationMessageRequest = z.infer<typeof ConversationMessageRequestSchema>;
export type ConversationResetRequest = z.infer<typeof ConversationResetRequestSchema>;
```

Якщо потрібно зберегти наявні українські повідомлення помилок Zod, додайте їх до відповідних `.min`, `.max` і `.regex` правил. Не послаблюйте strict object та не додавайте поле provider state.

### 2. Створіть ізольований шар JSON-файлів

Перед stores створіть `src/memory/json-file.ts` із двома експортами: `withJsonFileLock<T>(filePath, operation)` і `writeJsonFileAtomically(filePath, contents)`. Перший нормалізує абсолютний шлях (на Windows також регістр), ставить повну async-операцію в чергу процесу й звільняє її в `finally`. Другий створює parent directory, записує в `${filePath}.${randomUUID()}.tmp` з прапорцем `wx`, а потім виконує `rename`. При write-помилці `EEXIST` не видаляйте чужий temp-файл; інші write-помилки та rename-помилки прибирають свій temp-файл і повторно кидають початкову помилку. Якщо cleanup сам падає, повертається `AggregateError`. Черга є спільною для store instances одного процесу, не для окремих процесів.

**Файл:** створіть `my-dev/lesson-05-memory-openrouter/src/memory/conversation-history.ts`.

Експортуйте тип завершеного ходу `{ userMessage, assistantMessage }`, in-memory store та JSON store з операціями `create`, `load`, `save`. JSON має бути перевірений strict schema до використання; лише `ENOENT` означає нове порожнє сховище. Інші помилки читання, пошкоджений JSON, невалідна схема та помилка запису мають завершувати операцію контрольованою помилкою. Store не мутує переданий caller-в масив. `withJsonFileLock(filePath, operation)` серіалізує повний read-modify-write одного шляху в межах процесу, а `writeJsonFileAtomically(filePath, contents)` записує в сусідній унікальний тимчасовий файл і перейменовує його на цільовий. Цей механізм не координує інші процеси й не гарантує транзакцію після раптового вимкнення живлення.

**Перевірка:** далі в кроці 8 створіть `tests/json-stores.test.ts` з synthetic `mkdtemp`-кейсами для створення, повторного завантаження, пошкоджених даних і реальних I/O failures від тимчасових файлів. Зареєструйте папки в cleanup-масиві та видаляйте їх в `afterEach`; не пишіть до canonical `solution/data`.

В новому файлі спочатку опишіть форму одного завершеного ходу та інтерфейс store:

```typescript
export type StoredAssistantMessage = {
  content: string;
  reasoning?: string;
  reasoningDetails?: unknown[];
};

export type StoredConversationTurn = {
  userMessage: string;
  assistantMessage: StoredAssistantMessage;
};

export interface ConversationHistoryStore {
  create(): Promise<string>;
  load(conversationId: string): Promise<StoredConversationTurn[]>;
  save(conversationId: string, turns: StoredConversationTurn[]): Promise<void>;
}
```

Додайте `StoredAssistantMessageSchema`, `StoredConversationTurnSchema` та file schema `{ conversations: Record<string, StoredConversationTurn[]> }` через `z.strictObject`. Потім вставте `InMemoryConversationHistoryStore`: він тримає `Map<string, StoredConversationTurn[]>`, генерує ID через injectable `randomUUID`, клонує при `load` і `save`, а для невідомого ID кидає помилку. Кожний `save` спершу виконує lookup, щоб заборонити створення history для невідомого ID.

Вставте методи in-memory класу під його constructor:

```typescript
public async create(): Promise<string> {
  const id = this.createId();
  this.conversations.set(id, []);
  return id;
}

public async load(id: string): Promise<StoredConversationTurn[]> {
  return structuredClone(this.requireConversation(id));
}

public async save(id: string, turns: StoredConversationTurn[]): Promise<void> {
  this.requireConversation(id);
  this.conversations.set(id, structuredClone(turns));
}
```

Додайте приватний `requireConversation(id)` нижче: прочитайте map, киньте `Error` якщо значення відсутнє, інакше поверніть turns. Перевірте інтерфейс командою `yarn typecheck:my:lesson05:openrouter` до JSON store.

Після успішної in-memory перевірки додайте `JsonConversationHistoryStore(filePath, createId = randomUUID)`. Його `create()` зчитує state, створює порожній список і повторює генерацію при колізії ID; `load()` і `save()` відхиляють невідомий ID. `readState()` повертає порожню map лише для `ENOENT`, інакше виконує `JSON.parse` та strict schema parse. `writeState()` передає pretty JSON із кінцевим newline до `writeJsonFileAtomically()`. В `create()` та `save()` обгорніть повну послідовність читання, зміни state і запису в `withJsonFileLock(filePath, async () => ...)`, щоб паралельні store instances в одному процесі не втрачали оновлення.

В `readState()` застосуйте такий catch – інші винятки обов’язково виходять назовні:

```typescript
try {
  source = await readFile(this.filePath, "utf8");
} catch (error: unknown) {
  if (error instanceof Error && "code" in error && error.code === "ENOENT") {
    return { conversations: {} };
  }
  throw error;
}
return ConversationHistoryFileSchema.parse(JSON.parse(source));
```

`writeState(state)` серіалізує state в pretty JSON із кінцевим newline та передає його до `writeJsonFileAtomically(filePath, contents)`. Helper сам створює parent directory, записує в тимчасовий файл з прапорцем `wx`, а після успішного запису виконує `rename`. Якщо write або rename завершується помилкою, тимчасовий файл видаляється, помилка передається виклику, а попередній фінальний JSON залишається незмінним. В `create()` унікальність ID перевіряйте циклом `while (state.conversations[id] !== undefined)`; в `save()` відмовте, якщо ID відсутній, інакше збережіть `structuredClone(turns)`.

### 3. Реалізуйте окреме сховище дозволених фактів

**Файли:** створіть `my-dev/lesson-05-memory-openrouter/src/memory/user-facts.ts` і `my-dev/lesson-05-memory-openrouter/tests/user-facts.test.ts`.

Дозвольте лише категорії `displayName`, `preferredStack`, `learningGoal`. Обрізайте пробіли, забороняйте порожнє значення та довжину понад 120 символів. Відхиляйте рядки схожі на API key, password/token або номер платіжної картки. Експортуйте сумісні in-memory і JSON stores та `save_user_fact` function tool. Tool має приймати не більше одного виклику на хід; некоректні аргументи повертають безпечний tool error, не записуючи вміст. В tests перевірте allowlist, межі, дубль категорії, чутливі значення й збереження після створення нового store.

**Перевірка:** `yarn test:my:lesson05:openrouter`. Очікується, що нові facts-тести активні й усі проходять.

В `user-facts.ts` почніть з `UserFactCategorySchema = z.enum(["displayName", "preferredStack", "learningGoal"])` і strict `{ category, value }` schema. Значення обріжте, обмежте 1–120 символами й перевірте regex, що відхиляє `sk-...`, пари `api key/password/token: value` та 13–19 цифр із розділювачами. Далі створіть `UserFactStore` з `list()`/`save()`, `InMemoryUserFactStore` на `Map` за категорією та `JsonUserFactStore(filePath)`. JSON schema має бути strict `{ facts: UserFact[] }`; `ENOENT` повертає порожній список, помилки JSON/schema/I/O виходять як помилка без тексту вмісту. `save()` замінює попередній факт тієї самої категорії.

Вставте regex після category schema, а його `.refine()` одразу після `.max(120, ...)`:

```typescript
const SensitiveValuePattern =
  /(?:(?<![\p{L}\p{N}_])sk-[a-z0-9_-]{8,}(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])(?:api[ _-]?key|password|парол\p{L}*|token|токен\p{L}*)(?![\p{L}\p{N}_])\s*[:=]\s*\S+|(?:\d[ -]*?){13,19})/iu;

export const SaveUserFactArgsSchema = z.strictObject({
  category: UserFactCategorySchema,
  value: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .refine((value) => !SensitiveValuePattern.test(value)),
});
```

Експортуйте `saveUserFactTool` через `zodFunction` та `executeSaveUserFactToolCall(call, store)`. Перевірте назву інструмента й JSON args; поверніть безпечне `UNKNOWN_TOOL` або `INVALID_TOOL_ARGUMENTS` з тим самим `call.id` як `tool_call_id`; валідний аргумент зберігає fact і повертає `role: "tool"` із JSON status. Дозволяйте менеджеру зробити лише один tool call на хід.

JSON store будуйте на `readFile` та helper-ах із `json-file.ts`. `list()` повертає `[]` лише для `ENOENT`; інші помилки віддає назовні. `save(fact)` виконує під `withJsonFileLock(filePath, async () => ...)` читання, оновлення Map за категорією та атомарний запис `{ facts }` pretty JSON із newline через `writeJsonFileAtomically()`. Після strict schema parse зберігайте тільки нормалізовані дозволені значення.

Окремий executor почніть із безпечного guard і parse:

```typescript
if (call.function.name !== "save_user_fact") return createToolError(call.id, "UNKNOWN_TOOL");
let args: unknown;
try {
  args = JSON.parse(call.function.arguments);
} catch {
  return createToolError(call.id, "INVALID_TOOL_ARGUMENTS");
}
const parsed = SaveUserFactArgsSchema.safeParse(args);
if (!parsed.success) return createToolError(call.id, "INVALID_TOOL_ARGUMENTS");
await store.save(parsed.data);
return {
  role: "tool",
  tool_call_id: call.id,
  content: JSON.stringify({ status: "success", saved: parsed.data }),
};
```

`createToolError` повертає той самий `role` і `tool_call_id`; `content` містить лише status/code і загальне повідомлення `Невідомий інструмент.` або `Факт не відповідає правилам навчального сховища.`. Не записуйте raw arguments або validation issue в JSON чи log.

В `tests/user-facts.test.ts` використайте три allowed categories, межі 120/121 символ, пробіли, невалідну категорію, схожі на секрет рядки, дубль категорії та повторне створення JSON store. Для кожного негативного кейсу перевірте, що список facts лишився без забороненого значення.

`tests/json-stores.test.ts` має виконати щонайменше ці дві повні операції:

```typescript
const directory = await mkdtemp(join(tmpdir(), "lesson05-history-"));
temporaryDirectories.push(directory);
const filePath = join(directory, "data", "conversation-history.json");
const first = new JsonConversationHistoryStore(filePath, () => "conv-test");
const id = await first.create();
await first.save(id, [{ userMessage: "Питання", assistantMessage: { content: "Відповідь" } }]);
const restored = new JsonConversationHistoryStore(filePath);
await expect(restored.load("conv-test")).resolves.toEqual([
  { userMessage: "Питання", assistantMessage: { content: "Відповідь" } },
]);
```

Другий test створює в тимчасовій директорії файл із синтаксично невалідним JSON та очікує rejection на `load`/`list`; окремо запишіть валідний JSON з невалідним schema і також очікуйте rejection. Для не-`ENOENT` read failure створіть directory за file path і очікуйте rejection на `create()`. Для write failure замокайте `writeFile` або `rename`, щоб helper отримав контрольовану помилку на окремому temp-шляху. Перевірте rejection операції, незмінність попереднього фінального snapshot та відсутність тимчасового файла. Не імітуйте запис часткового JSON в фінальний файл, не змінюйте його permissions і не пишіть в runtime data folders. В `tests/user-facts.test.ts` зафіксуйте allowlist і контроль відмови:

```typescript
const store = new InMemoryUserFactStore();
const fact = SaveUserFactArgsSchema.parse({ category: "preferredStack", value: "  TypeScript  " });
await store.save(fact);
await expect(store.list()).resolves.toEqual([{ category: "preferredStack", value: "TypeScript" }]);
expect(
  SaveUserFactArgsSchema.safeParse({ category: "learningGoal", value: "sk-abcdefgh12345678" })
    .success,
).toBe(false);
expect(
  SaveUserFactArgsSchema.safeParse({ category: "preferredStack", value: "x".repeat(121) }).success,
).toBe(false);
```

В `tests/user-facts.test.ts` додайте `it.each(["EACCES", "ENOSPC"])` для помилки запису тимчасового snapshot. Перевірте rejection прямого `JsonUserFactStore.save()` і `executeSaveUserFactToolCall()`, незмінність попереднього валідного файла, cleanup тимчасового файла та відсутність успішного tool result. Перевірка не має псувати фінальний JSON навіть тимчасово.

### 4. Створіть Conversation Manager та OpenRouter Chat Completions adapter

**Файл:** створіть `my-dev/lesson-05-memory-openrouter/src/services/conversation-manager.ts`.

Експортуйте інтерфейси model client, request/result і manager. Session history зберігайте в пам’яті окремо за `sessionId`; durable conversation читайте і записуйте через `ConversationHistoryStore`. `resetSession(id)` видаляє лише вказану коротку history й повертає, чи існувала вона. Long-term facts та JSON conversation після reset залишаються.

Вікно за замовчуванням – 8 **завершених ходів**. Додавайте user та assistant частини одним записом і обрізайте лише список цілих ходів. Валідовуйте порожній output і доменний результат до збереження. Для нового durable conversation створюйте ID лише після успішної відповіді та збережіть повернений ID для наступного запиту.

OpenRouter adapter щоразу будує повний `messages` із system, попередніх user/assistant пар і нового user message. Він викликає Chat Completions, проводить максимум один `save_user_fact`, додає assistant tool call і tool result з тим самим `tool_call_id`, а потім робить один фінальний model call. Якщо відповідь містить `reasoning` чи `reasoning_details`, зберігайте їх як opaque дані й відновлюйте в наступній історії без нормалізації. Не додавайте server-managed Responses параметри.

**Перевірка:** крок 8 додає `tests/conversation-manager.test.ts` для ізоляції двох session, reset однієї session, facts-після-reset, durable create/resume, window цілих ходів, persistence restore, tool call pairing та `reasoning_details` round-trip. Тест проходить через публічний `ConversationManager.send()`: результат не розкриває reasoning fields, а наступний provider call зберігає їх без змін і повторює відповідний `tool_call_id`.

Розбийте модуль на три вставки. Першою додайте imports до локальних модулів та OpenAI Chat Completions типів, константу `DEFAULT_MAX_HISTORY_TURNS = 8`, `ConversationTurnOptions`, `ConversationModelRequest`, `ConversationModelTurn` і `ConversationChatClient`. `ConversationTurnOptions` має дозволити `instructions`, `enableUserFactTool`, `includeUserFacts`, `toolChoice` (`"auto" | "required"`) та callback `validateOutput`. Запустіть typecheck до наступної вставки.

Відразу під інтерфейсом client вставте mode-specific result contract:

```typescript
export interface ConversationRunMetrics {
  modelCallCount: number;
  toolCallCount: number;
  totalLatencyMs: number;
}

interface ConversationRunBase {
  status: "success";
  text: string;
  model: string;
  usage: UsageMetrics;
  metrics: ConversationRunMetrics;
  retainedTurns: number;
}

export type ConversationRunResult =
  | (ConversationRunBase & { mode: "session"; sessionId: string })
  | (ConversationRunBase & { mode: "conversation"; conversationId: string });

export interface ConversationService {
  send(
    request: ConversationMessageRequest,
    turnOptions?: ConversationTurnOptions,
  ): Promise<ConversationRunResult>;
  resetSession(sessionId: string): boolean;
}
```

Другою вставкою додайте manager result contracts і клас. Центральна гілка `send()` має виконувати такі операції в зазначеному порядку:

```typescript
const history = this.sessionHistories.get(request.sessionId) ?? [];
const turn = await this.chatClient.createTurn({ history, message: request.message, turnOptions });
const result = createResultBase(turn, startedAt, this.now);
turnOptions?.validateOutput?.(result.text);
const nextHistory = this.limitHistory(history, request.message, turn.assistantMessage);
this.sessionHistories.set(request.sessionId, nextHistory);
```

Для `mode === "conversation"` спершу завантажте попередні turns за наявним ID або використайте `[]`, потім запросіть turn і перевірте output так само. Лише після успішної валідації створіть ID, якщо його не було, запишіть `nextHistory` в store та поверніть цей ID. Обидві гілки повертають `status`, text/model/usage/metrics, `retainedTurns` і тільки відповідний mode ID. `resetSession()` виконує лише `sessionHistories.delete(sessionId)`. Приватний `limitHistory()` додає `{ userMessage, assistantMessage }` одним елементом і застосовує `.slice(-maxHistoryTurns)`; constructor відхиляє неціле або менше 1 значення.

Після constructor вставте `send()` як окремий блок. Тип третього аргументу constructor – `{ maxHistoryTurns?: number }`; значення за замовчуванням 8, а 0, від’ємне та неціле значення дають `RangeError`. Четвертий аргумент `now` лишіть injectable function для детермінованих тестів. Перед кодом підготуйте `createResultBase(turn, startedAt, now)`, який повертає success, trimmed text, model/usage та три metrics поля:

```typescript
public async send(
  request: ConversationMessageRequest,
  turnOptions?: ConversationTurnOptions,
): Promise<ConversationRunResult> {
  const startedAt = this.now();

  if (request.mode === "session") {
    const history = this.sessionHistories.get(request.sessionId) ?? [];
    const turn = await this.chatClient.createTurn({
      history,
      message: request.message,
      ...(turnOptions === undefined ? {} : { turnOptions }),
    });
    const result = createResultBase(turn, startedAt, this.now);
    turnOptions?.validateOutput?.(result.text);
    const nextHistory = this.limitHistory(history, request.message, turn.assistantMessage);
    this.sessionHistories.set(request.sessionId, nextHistory);
    return { ...result, retainedTurns: nextHistory.length, mode: "session", sessionId: request.sessionId };
  }

  const history = request.conversationId === undefined ? [] : await this.historyStore.load(request.conversationId);
  const turn = await this.chatClient.createTurn({
    history,
    message: request.message,
    ...(turnOptions === undefined ? {} : { turnOptions }),
  });
  const result = createResultBase(turn, startedAt, this.now);
  turnOptions?.validateOutput?.(result.text);
  const nextHistory = this.limitHistory(history, request.message, turn.assistantMessage);
  const conversationId = request.conversationId ?? (await this.historyStore.create());
  await this.historyStore.save(conversationId, nextHistory);
  return { ...result, retainedTurns: nextHistory.length, mode: "conversation", conversationId };
}
```

Не переміщуйте `save()` вище за output validation. Після цього вставте ці малі методи як окремі блоки:

```typescript
public resetSession(sessionId: string): boolean {
  return this.sessionHistories.delete(sessionId);
}

private limitHistory(
  history: StoredConversationTurn[],
  userMessage: string,
  assistantMessage: StoredAssistantMessage,
): StoredConversationTurn[] {
  return [...history, { userMessage, assistantMessage }].slice(-this.maxHistoryTurns);
}
```

В `send()` використайте `performance.now()` для latency і не пишіть history, поки `createResultBase()` та optional `validateOutput()` не завершились успішно. Складіть response через mode-specific discriminated union: session повертає `sessionId`; conversation повертає `conversationId`.

Третьою вставкою додайте `createResultBase()`, що обрізає output і кидає помилку на порожньому тексті, а також adapter message helpers. `createHistoryMessages()` формує `system`, далі кожен завершений user/assistant turn, потім поточний user. Assistant message переносить `reasoning` та raw `reasoningDetails` в provider field `reasoning_details`. `createUserMessage()` додає facts як JSON-блок `LONG_TERM_MEMORY_DATA` окремо від `USER_MESSAGE`; якщо facts порожні, повертає вхідне повідомлення без обгортки.

Додайте `createResultBase()` внизу файла:

```typescript
function createResultBase(
  turn: ConversationModelTurn,
  startedAt: number,
  now: () => number,
): Omit<ConversationRunBase, "retainedTurns"> {
  const text = turn.outputText.trim();
  if (text === "") throw new Error("Модель не повернула текстової відповіді.");
  return {
    status: "success",
    text,
    model: turn.model,
    usage: turn.usage,
    metrics: {
      modelCallCount: turn.modelCallCount,
      toolCallCount: turn.toolCallCount,
      totalLatencyMs: Math.max(0, Math.round(now() - startedAt)),
    },
  };
}
```

Також додайте `createHistoryMessages(history, currentMessage, instructions)`: створіть масив із system item, циклом додайте кожний stored user/assistant pair, потім current user. Для assistant item умовно перенесіть `reasoning` та `reasoningDetails` в поля `reasoning` і `reasoning_details` відповідно; типізуйте завершений item як `ChatCompletionMessageParam`. `createAssistantMessage(providerTurn)` повертає role `assistant`, `tool_calls` оригінальною послідовністю та ті самі reasoning поля; якщо output порожній в tool-call відповіді, content має бути `null`. `addUsage(current, next)` повертає `sumUsageMetrics(current, extractUsageMetrics(next))`. Ці helpers мають бути pure, без файлового I/O.

В `ConversationManager` тримайте `sessionHistories` в приватному `Map`. Для durable mode не кешуйте JSON contents між запитами: кожен `send` читає store за `conversationId`, а `save` виконується після validation. Перевірте це окремим `yarn typecheck:my:lesson05:openrouter`.

В тому самому файлі додайте `OpenRouterConversationChatClient` як окремий клас. `createTurn()` читає facts за опцією, збирає повні history messages і робить перший provider call. Якщо повернуто більше одного tool call – відмовте до запису; якщо рівно один дозволений tool call – додайте до масиву messages assistant message з оригінальним `tool_calls`, потім tool result із тим самим `tool_call_id`, зробіть рівно один другий call і відмовте на додатковий tool call. Складіть usage обох provider calls та поверніть кінцеві `modelCallCount` і `toolCallCount`. Реалізуйте цикл окремим методом тіла `createTurn()` за цією послідовністю:

```typescript
const enabled = request.turnOptions?.enableUserFactTool ?? true;
const facts =
  (request.turnOptions?.includeUserFacts ?? enabled) ? await this.userFactStore.list() : [];
const messages = createHistoryMessages(
  request.history,
  createUserMessage(request.message, facts),
  request.turnOptions?.instructions ?? CONVERSATION_INSTRUCTIONS,
);
let calls = 1;
let tools = 0;
let providerTurn = await this.createProviderTurn(
  messages,
  enabled,
  request.turnOptions?.toolChoice ?? "auto",
);
let usage = addUsage(extractUsageMetrics(), providerTurn.usage);
```

Після цього перевірте кількість tool calls. Для одного call додайте `createAssistantMessage(providerTurn)` і `await executeSaveUserFactToolCall(call, this.userFactStore)` до `messages`, зробіть один `createProviderTurn(messages, enabled, "auto")`, підсумуйте usage і відхиліть будь-який наступний tool call. Поверніть `outputText`, assistant content разом із provider-даними, фінальну model/usage та counters. Перевірте тестом, що дві відповіді від провайдера дають сумарний usage, але зберігається лише завершений assistant turn.

`createProviderTurn()` надсилає `model`, повну `messages`, optional `tools`/`tool_choice`/`parallel_tool_calls: false`, `max_completion_tokens`, `temperature: 0`, `provider.require_parameters: true`, optional model capability reasoning і `stream: false`. Не передавайте `store`, `previous_response_id`, `conversation` чи `context_management`. Порожня choices array, truncation і refusal стають типізованими помилками; provider failure іде через успадкований `mapOpenRouterError()`. Прочитайте `reasoning_details` як масив невідомих елементів і не переписуйте його поля.

Усередині методу створіть request лише з цими полями:

```typescript
const capabilities = resolveModelCapabilities(this.options.modelName);
const request: OpenRouterConversationRequest = {
  model: this.options.modelName,
  messages,
  ...(enableUserFactTool
    ? { tools: [saveUserFactTool], tool_choice: toolChoice, parallel_tool_calls: false as const }
    : {}),
  max_completion_tokens: this.options.maxOutputTokens,
  temperature: 0,
  provider: { require_parameters: true },
  ...(capabilities.reasoning
    ? { reasoning: { effort: this.options.reasoningEffort ?? DEFAULT_REASONING_EFFORT } }
    : {}),
  stream: false,
};
```

Викличте `client.chat.completions.create(request as unknown as Parameters<typeof client.chat.completions.create>[0])`. Перевірте наявність `choices[0]`; `finish_reason === "length"` має стати `INCOMPLETE_RESPONSE`, `content_filter`/refusal – `REQUEST_REFUSED`. Відфільтруйте лише `type === "function"` tool calls. Прочитайте assistant `reasoning` лише якщо це string, а `reasoning_details` лише якщо це array; поверніть їх як opaque values разом із content/model/normalized usage. В `catch` викличте `mapOpenRouterError(error)`, не додаючи текст помилки або prompt до log.

### 5. Під’єднайте два HTTP маршрути

**Файл:** змініть `my-dev/lesson-05-memory-openrouter/src/app.ts`.

Вставте маршрути після успадкованого `POST /api/documents/summary/stream` і перед загальним error middleware. `POST /api/agent/conversation` перевіряє `ConversationMessageRequestSchema`, передає нормалізоване тіло до manager і повертає його result; некоректне тіло дає 400, відсутній manager – 503, помилка service – стабільний 502 без приватних даних. `POST /api/agent/conversation/reset` перевіряє reset schema та повертає `{ status: "success", reset: boolean }`. Переконайтеся, що попередні п’ять маршрутів залишилися доступними.

**Перевірка:** в наявному `my-dev/lesson-05-memory-openrouter/tests/app.test.ts`, одразу після `describe("POST /api/agent/research (OpenRouter)")`, додайте або розширте окремий `describe("Lesson 05 OpenRouter app")`. Активно перевірте успадкований health/research, schema rejection, session call, reset, відсутній manager та маскування помилок. Перевірте conversation route для `200`, `400`, `503` і `502`, а reset route – для валідного `200`, невалідного `400` та відсутнього runtime `503`.

В `app.ts` додайте імпорт двох request schemas та типів `ConversationRunResult` і `ConversationService`. Залиште успадкований `Lesson04AppDependencies` без змін, створіть `Lesson05OpenRouterAppDependencies extends Lesson04AppDependencies` з необов’язковим `conversationManager`, а наявну функцію `createApp(dependencies)` типізуйте новим інтерфейсом. Не створюйте другу app-функцію. Перед існуючим `app.use((error, ...` middleware вставте два handlers із таким порядком:

```typescript
const parsed = ConversationMessageRequestSchema.safeParse(request.body);
if (!parsed.success) {
  response.status(400).json(createApiError("INVALID_INPUT", "Невалідний запит."));
  return;
}
if (!dependencies.conversationManager) {
  response
    .status(503)
    .json(createApiError("SERVICE_UNAVAILABLE", "Conversation runtime не налаштовано."));
  return;
}
response.json(await dependencies.conversationManager.send(parsed.data));
```

Для першого handler обгорніть `send` в `try/catch`, запишіть в log лише `errorName` і поверніть `502` з кодом `CONVERSATION_ERROR`. Другий handler валідовує `ConversationResetRequestSchema` і віддає `{ status: "success", reset: manager.resetSession(sessionId) }`. Не з’єднуйте reset із JSON stores.

Зразу після `POST /api/agent/conversation` додайте другий handler:

```typescript
app.post("/api/agent/conversation/reset", (request, response) => {
  const parsed = ConversationResetRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json(createApiError("INVALID_INPUT", "Невалідний запит."));
    return;
  }
  if (!dependencies.conversationManager) {
    response
      .status(503)
      .json(createApiError("SERVICE_UNAVAILABLE", "Conversation runtime не налаштовано."));
    return;
  }
  response.json({
    status: "success",
    reset: dependencies.conversationManager.resetSession(parsed.data.sessionId),
  });
});
```

В `tests/app.test.ts` створіть mock manager із `send` і `resetSession`, передайте його в `createApp`, та перевірте точні виклики. Для conversation route перевірте валідний `200`, bad mode `400` без `send`, відсутній manager `503` і помилку service `502` без private message. Для reset перевірте валідний `200` із `reset: true`, невалідне тіло `400` без викликів manager та відсутній runtime `503`.

### 6. Під’єднайте JSON stores в runtime

**Файл:** змініть `my-dev/lesson-05-memory-openrouter/src/runtime.ts`.

Збережіть усі залежності Lesson 04. Побудуйте JSON stores і Conversation Manager поруч із наявним runtime factory та додайте manager до app dependencies. Значення за замовчуванням мають бути module-relative `../data/user-memory.json` і `../data/conversation-history.json`; опції `userFactsPath`, `conversationHistoryPath` та `maxHistoryTurns` мають дозволяти ізольовані тести. Помилка memory setup повинна закрити вже відкритий MCP client і не вивести вміст JSON.

**Перевірка:** starter не містить `tests/runtime.test.ts`, тому створіть цей файл. Імпортуйте `loadEnvironment`, `LocalMcpClient`, `createLesson05Runtime`, `mkdtemp`, `rm`, `tmpdir`, `dirname`, `join`, `resolve`, `fileURLToPath`, Vitest `afterEach/describe/expect/it/vi`. Додайте cleanup-масив і `afterEach`, що видаляє всі temp directories; synthetic environment використає `OPENROUTER_API_KEY: "synthetic-test-key"`, `OPENROUTER_MODEL: "synthetic-test-model"`, `PORT: "3000"`. Fake MCP client повертайте з `processId: 12345`, `listTools: async () => []`, `callTool: async () => ({ content: [] })`, `close` callback. Перший test викликає runtime без store path overrides, знаходить каталоги через `dirname(fileURLToPath(new URL("../src/runtime.ts", import.meta.url)))` і перевіряє `resolve(runtimeDirectory, "../data", "conversation-history.json")` та `user-memory.json`. В другому test передайте обидва store paths під окремою `mkdtemp`, плюс `createFilesystemMcpClient` з fake client; перевірте `runtime.dependencies.conversationManager === runtime.conversationManager`, викличте `close()` двічі й очікуйте один виклик close. В третьому передайте `maxHistoryTurns: 0`, дві synthetic paths і `createFilesystemMcpClient`; очікуйте rejection та один виклик close вже створеного fake MCP runtime. Це безпечна failure injection без live provider call. Очікується, що production-like запуск писатиме лише до своєї папки `data/`, а tests – лише до тимчасової директорії.

Використайте цей каркас для cleanup та обох життєвих циклів; створюйте store paths усередині temp папки, а не canonical `solution/data`:

```typescript
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function tempDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "lesson05-runtime-"));
  directories.push(path);
  return path;
}

function createClient(close: () => Promise<void>): LocalMcpClient {
  return {
    processId: 12345,
    listTools: async () => [],
    callTool: async () => ({ content: [] }),
    close,
  };
}

const environment = () =>
  loadEnvironment({
    OPENROUTER_API_KEY: "synthetic-test-key",
    OPENROUTER_MODEL: "synthetic-test-model",
    PORT: "3000",
  });

it("creates local memory dependencies and closes MCP once", async () => {
  const directory = await tempDirectory();
  const close = vi.fn(async () => undefined);
  const runtime = await createLesson05Runtime(environment(), {
    userFactsPath: join(directory, "facts.json"),
    conversationHistoryPath: join(directory, "history.json"),
    createFilesystemMcpClient: async () => createClient(close),
  });
  expect(runtime.dependencies.conversationManager).toBe(runtime.conversationManager);
  await runtime.close();
  await runtime.close();
  expect(close).toHaveBeenCalledTimes(1);
});

it("closes MCP when manager configuration is invalid", async () => {
  const directory = await tempDirectory();
  const close = vi.fn(async () => undefined);
  const createFilesystemMcpClient = vi.fn(async () => createClient(close));
  await expect(
    createLesson05Runtime(environment(), {
      userFactsPath: join(directory, "facts.json"),
      conversationHistoryPath: join(directory, "history.json"),
      maxHistoryTurns: 0,
      createFilesystemMcpClient,
    }),
  ).rejects.toThrow();
  expect(createFilesystemMcpClient).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
});
```

Перед цими двома tests додайте default-path test, що інспектує лише фактичні file path options і не створює runtime JSON:

```typescript
const runtime = await createLesson05Runtime(environment(), {
  createFilesystemMcpClient: async () => createClient(vi.fn(async () => undefined)),
});
const manager = runtime.conversationManager as unknown as {
  historyStore: { filePath: string };
  chatClient: { userFactStore: { filePath: string } };
};
const runtimeDirectory = dirname(fileURLToPath(new URL("../src/runtime.ts", import.meta.url)));
expect(manager.historyStore.filePath).toBe(
  resolve(runtimeDirectory, "../data", "conversation-history.json"),
);
expect(manager.chatClient.userFactStore.filePath).toBe(
  resolve(runtimeDirectory, "../data", "user-memory.json"),
);
await runtime.close();
```

В `runtime.ts` імпортуйте `dirname`, `resolve`, `fileURLToPath`, тип `LocalMcpClient`, обидва JSON stores та `ConversationManager`/`OpenRouterConversationChatClient`. Залиште `Lesson04Runtime` і `Lesson04AppDependencies` та типізуйте Lesson 05 runtime як extends-и з власними dependencies. Одразу після `allowedDirectory?` в `Lesson04RuntimeOptions` додайте `createFilesystemMcpClient?: (sandboxPath: string) => Promise<LocalMcpClient>`; в `createLesson04Runtime()` замініть прямий `connectFilesystemMcp(allowedDirectory)` на `const createMcpClient = options.createFilesystemMcpClient ?? connectFilesystemMcp` і викличте `createMcpClient(allowedDirectory)`. Це дає tests локальний fake MCP client без мережі. В `createLesson05Runtime()` передайте той самий callback до `createLesson04Runtime()`. Експортуйте `Lesson05OpenRouterRuntimeOptions extends Lesson04RuntimeOptions` із `userFactsPath?`, `conversationHistoryPath?`, `maxHistoryTurns?`; збережіть `Lesson04Runtime` і додайте `conversationManager` в Lesson 05 runtime result. Додайте factory після `createLesson04Runtime()`:

```typescript
const lesson04Runtime = await createLesson04Runtime(environment, {
  ...(options.allowedDirectory === undefined ? {} : { allowedDirectory: options.allowedDirectory }),
  ...(options.createFilesystemMcpClient === undefined
    ? {}
    : { createFilesystemMcpClient: options.createFilesystemMcpClient }),
});
const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const factsPath = options.userFactsPath ?? resolve(moduleDirectory, "../data/user-memory.json");
const historyPath =
  options.conversationHistoryPath ?? resolve(moduleDirectory, "../data/conversation-history.json");
const facts = new JsonUserFactStore(factsPath);
const history = new JsonConversationHistoryStore(historyPath);
```

Створіть chat client з тим самим `lesson04Runtime.openai`, `resolveModel("main", environment)`, output token limit та reasoning effort. Створіть `ConversationManager(chatClient, history, options.maxHistoryTurns === undefined ? {} : { maxHistoryTurns: options.maxHistoryTurns })`. Поверніть Lesson 04 dependencies разом із manager та передайте `lesson04Runtime.close` без створення другого OpenAI client. Якщо налаштування пам’яті кидає помилку – дочекайтеся `lesson04Runtime.close()` і повторно киньте помилку. Tests inject temporary paths та fake MCP client, після чого перевіряють, що runtime exposes manager, шляхи розділені й close викликаний один раз.

### 7. Під’єднайте manager до успадкованого server lifecycle

**Файл:** змініть `my-dev/lesson-05-memory-openrouter/src/server.ts`.

Збережіть `startLesson04Server` без змін. Він уже закриває HTTP з’єднання та успадковані MCP/runtime ресурси, зокрема під час startup failure. Lesson 05 додає типізований wrapper, який передає `createLesson05Runtime` в готову L04 server factory; саме її `createApp(runtime.dependencies)` підключає Conversation Manager до наявних маршрутів. Другий OpenAI/OpenRouter client не створюйте.

В `server.ts` імпортуйте `createLesson05Runtime` з `./runtime.js` і розширте наявний type import з цього модуля, додавши `Lesson05OpenRouterRuntime` та зберігши `Lesson04Runtime`. Одразу після інтерфейсу `Lesson04ServerHandle` додайте type alias:

```ts
export type Lesson05ServerHandle = Lesson04ServerHandle;
```

Після повного блоку `startLesson04Server` і перед `closeHttpServer` додайте wrapper:

```ts
export function startLesson05Server(
  environment: Environment,
  createRuntime: (
    environment: Environment,
  ) => Promise<Lesson05OpenRouterRuntime> = createLesson05Runtime,
): Promise<Lesson05ServerHandle> {
  return startLesson04Server(environment, createRuntime);
}
```

В наявній `main()` замініть лише виклик `startLesson04Server(environment)` на `startLesson05Server(environment)`. Збережіть direct-execution guard та успадковану обробку shutdown.

**Перевірка:** залиште успадкований `tests/server-lifecycle.test.ts` без змін. В ньому активні шість успадкованих сценаріїв: обробка reset до фактичного `close`, відхилення reset поза teardown і неочікуваних socket errors, тайм-аут без `close`, закриття активного HTTP з’єднання з одноразовим runtime cleanup, а також cleanup при зайнятому порті. Три нові сценарії Lesson 05 runtime перевіряються в `tests/runtime.test.ts`: стандартні JSON-шляхи, cleanup MCP при помилці memory configuration та одноразове закриття успадкованого runtime. Усі перевірки працюють без model calls.

### 8. Активуйте поведінкові тести

**Файли:** створіть `tests/conversation-manager.test.ts`, `tests/json-stores.test.ts`, `tests/user-facts.test.ts` і `tests/runtime.test.ts`; оновіть успадкований `tests/app.test.ts` в своїй копії. `tests/server-lifecycle.test.ts` залишається без змін із шістьма активними успадкованими сценаріями; нові три memory runtime сценарії зосередьте в `tests/runtime.test.ts`. Успадкований `tests/evals.test.ts` змінюйте разом із memory eval на кроці 9, щоб до його імпортів уже існували всі eval модулі.

Використовуйте scripted Chat Completions responses і синтетичні JSON. Обов’язково зафіксуйте: різні `sessionId` не бачать чужої history; reset очищає лише вибрану session; durable conversation відновлюється після нового store; window зберігає цілі завершені turns; facts переживають reset; `tool_call_id` збережений в парі; пошкоджений файл і помилка запису не розкривають вміст; помилки `EACCES` і `ENOSPC` під час запису тимчасового snapshot відхиляють прямий save і tool execution, залишають попередній валідний файл без змін та прибирають тимчасовий файл; паралельні зміни одного JSON шляху серіалізуються між store instances в одному процесі. Ці тести не доводять координацію між процесами чи транзакцію після втрати живлення; попередні API/MCP тести залишаються активними.

Для `reasoning_details` додайте **один наскрізний regression через публічний manager**, окремо від unit-перевірок store та function-tool loop. Перший `ConversationManager.send()` має записати provider response до реального тимчасового JSON. Потім створіть нові `JsonConversationHistoryStore`, mocked OpenRouter SDK client і `ConversationManager`, передайте той самий `conversationId` та перевірте наступний SDK request: assistant history містить точне opaque значення `reasoning_details` без нормалізації. Перевірте також, що публічний результат першого `send()` цих полів не розкриває. Такий сценарій має довести ланцюг від public API до фактичного JSON і далі до наступного provider request після перезапуску об’єктів.

**Перевірка:** `yarn test:my:lesson05:openrouter`. Очікується успіх без `it.todo`, skipped чи порожніх потрібних suites.

В `tests/conversation-manager.test.ts` імпортуйте Vitest, manager та store. Перед тестами створіть helper `createTurn(outputText)` з `assistantMessage: { content: outputText }`, model `configured-model`, usage `inputTokens: 10`, `outputTokens: 5`, `totalTokens: 15`, нульовими cached tokens і `modelCallCount`/`toolCallCount` зі значенням 1/0. Для сценарію передайте ці відповіді в scripted client:

```typescript
const requests: ConversationModelRequest[] = [];
const replies = [createTurn("A1"), createTurn("A2"), createTurn("B1")];
const createTurnRequest = vi.fn<ConversationChatClient["createTurn"]>(async (request) => {
  requests.push({ ...request, history: structuredClone(request.history) });
  const reply = replies.shift();
  if (!reply) throw new Error("Відсутня scripted відповідь.");
  return reply;
});
const manager = new ConversationManager({ createTurn: createTurnRequest });
```

Відправте два повідомлення в `student-1`, одне в `student-2`, а потім перевірте ізоляцію:

```typescript
expect(requests[0]?.history).toEqual([]);
expect(requests[1]?.history.map((turn) => turn.userMessage)).toEqual(["A"]);
expect(requests[2]?.history).toEqual([]);
```

Додайте другий test з відповідями `S1`, `S2`, `S1 reset`, `S2 continue`: після двох session-викликів `expect(manager.resetSession("student-1")).toBe(true)`, невідомий ID повертає `false`; наступний запит `student-1` отримує `history: []`, а `student-2` усе ще має один turn. Для window тесту передайте `maxHistoryTurns: 2`, надішліть `U1…U4` і перевірте, що четвертий запит отримав `history.map(({userMessage}) => userMessage) === ["U2", "U3"]`.

Окремо seed-ніть `InMemoryUserFactStore` фактом `{ category: "preferredStack", value: "TypeScript" }`, виконайте session send/reset і після reset перевірте `await factStore.list()` дорівнює тому самому факту. Для durable незалежності створіть conversation через `JsonConversationHistoryStore`, виконайте ще одну session з тим самим тестовим ID, reset-ніть лише цю session і перевірте, що `historyStore.load(conversationId)` як і раніше містить лише durable turn.

В durable test створіть `JsonConversationHistoryStore` на `join(tempDirectory, "conversation-history.json")`, надішліть перший запит без ID, передайте отриманий `conversationId` в другий manager send, потім створіть новий JSON store на тому самому шляху й перевірте два завершені turns. Для обов’язкового restart regression викличте перший send через публічний manager з mocked OpenRouter SDK client, перевірте відсутність `reasoning_details` в публічному результаті й запис opaque response до цього тимчасового JSON; після цього створіть нові store, SDK client і manager, продовжте той самий `conversationId` та перевірте exact deep equality поля `reasoning_details` в наступному SDK request. Окремий unit test store може перевірити читання raw значення, але не замінює цей наскрізний сценарій. Для tool loop задайте дві scripted Chat Completions responses, перша з `tool_call_id: "call_1"` та opaque `reasoning_details`; перевірте, що другий provider request містить assistant `tool_calls` і tool result із таким самим ID, raw details збігаються, `modelCallCount` дорівнює 2, `toolCallCount` дорівнює 1, а token counters є сумою обох responses. Додайте окремий manager test, в якому `validateOutput` кидає помилку; перевірте, що durable store не створив conversation і history не змінилась.

В `tests/json-stores.test.ts` зареєструйте кожен `mkdtemp(join(tmpdir(), "lesson05-memory-"))` шлях в масиві й видаляйте його в `afterEach` через `rm(..., { recursive: true, force: true })`. Тести мають окремо перевіряти: missing file → empty/create; save → новий store може load; malformed JSON/schema → rejected promise; read-only file через `chmod` → реальна write failure та збереження старих даних. Кожен error case має завершуватися помилкою, а не fallback на порожній store. Для facts повторіть save/recreate/read і негативні allowlist cases в `tests/user-facts.test.ts`.

В `tests/app.test.ts` користуйтеся Supertest helper, що вже імпортований для успадкованих маршрутів. Додайте до імпортів `Lesson05OpenRouterAppDependencies` і `ConversationService`, а аргумент існуючого `startTestServer()` розширте з `Lesson04AppDependencies` до нового Lesson 05 dependency type. Додайте матрицю `POST /api/agent/conversation`: valid session → `200` і `mode/sessionId`; valid conversation без ID → `200` із conversationId; invalid mode/body → `400`; manager absent → `503`; manager throws приватну помилку → `502` без її message в JSON. Для reset очікуйте `200`, `{ status: "success", reset: true }` та єдиний виклик manager з надісланим `sessionId`. Кожен endpoint перевіряйте окремим HTTP запитом і завжди закривайте test server в `finally`.

### 9. Додайте memory eval до успадкованого eval runner

**Файли:** створіть `my-dev/lesson-05-memory-openrouter/evals/memory.eval.ts`; доповніть `evals/recorded-results.ts`, `evals/scorer.ts`, `evals/run.ts` і `tests/evals.test.ts`.

Опишіть записані синтетичні спостереження для session follow-up/reset, durable create/resume, allowed fact persistence і sensitive-data rejection. Scorer перевіряє спостереження, а runner друкує кожний case та загальний лічильник. Залиште попередні extraction і MCP evals доступними. Recorded replay має бути детермінованим і не викликати OpenRouter.

**Перевірка:** `yarn eval:my:lesson05:openrouter`. Скрипт запускає memory replay за замовчуванням, успадковані extraction + MCP cases через `--mode=all`, потім tool-calling replay. Усі результати мають пройти. Це offline evidence, не live inference.

В `memory.eval.ts` створіть два експортування масиви з унікальними ID. Перший містить: `session-first-turn` (session, без client history, без durable create), `session-follow-up` (session, з client history), `session-after-reset` (session, без client history), `conversation-create` (conversation, без client history, durable create) і `conversation-resume` (conversation, з client history). Кожен очікує `windowingEnabled: true`. Другий містить `in-session-recall`, `session-reset`, `long-term-persistence`, `no-false-tool-invocation`, `sensitive-data-refusal`; поля очікування – `usesClientManagedHistory`, `resetsShortTermState`, `invokesSaveUserFactTool`, `persistsUserFact`, `refusesSensitiveData`. `no-false-tool-invocation` має очікувати відсутність tool call. `sensitive-data-refusal` фіксує спробу tool call (`invokesSaveUserFactTool: true`), відмову в збереженні (`persistsUserFact: false`) та відхилення чутливого значення (`refusesSensitiveData: true`).

Під типами eval case розмістіть такі мінімальні expectations:

```typescript
export interface MemoryEvalExpectation {
  mode: "session" | "conversation";
  usesClientManagedHistory: boolean;
  createsDurableConversation: boolean;
  windowingEnabled: true;
}

export interface LongTermMemoryEvalExpectation {
  usesClientManagedHistory: boolean;
  resetsShortTermState: boolean;
  invokesSaveUserFactTool: boolean;
  persistsUserFact: boolean;
  refusesSensitiveData: boolean;
}
```

Кожен case також має `id`, український synthetic `input` і non-empty `tags`. Зафіксуйте саме п’ять case ID на кожен набір; `session-after-reset` очікує порожню client history, `conversation-resume` – наявну, `long-term-persistence` – збережений fact після reset, `sensitive-data-refusal` – жодного persisted fact.

В `recorded-results.ts` додайте observation interfaces з `id`, поведінковими booleans/mode та синтетичними `latencyMs`, `inputTokens`, `outputTokens`. Поля для довготривалих спостережень назвіть рівно `usedClientManagedHistory`, `resetShortTermState`, `invokedSaveUserFactTool`, `persistedUserFact`, `refusedSensitiveData`; expectations залишаються `usesClientManagedHistory`, `resetsShortTermState`, `invokesSaveUserFactTool`, `persistsUserFact`, `refusesSensitiveData`. Додайте по одному observation на кожен eval ID. Recorded values є фіксованою офлайн вибіркою, а не свіжим запуском моделі; поведінкові booleans мають відповідати expected contract. Вставте кожне observation за його case ID, наприклад:

```typescript
{
  id: "conversation-resume",
  mode: "conversation",
  usedClientManagedHistory: true,
  createdDurableConversation: false,
  windowingEnabled: true,
  latencyMs: 235,
  inputTokens: 58,
  outputTokens: 12,
}
```

В `scorer.ts` додайте два scorer-и `scoreMemoryCase(evalCase, observation)` і `scoreLongTermMemoryCase(evalCase, observation)`. Кожен приймає повний eval case та observation, порівнює observation із `evalCase.expected` і повертає `{ id: evalCase.id, passed: reasons.length === 0, reasons }`; відсутнє observation runner трактує як fail, а не пропускає. Для порівняння використайте helper:

```typescript
function compare(
  reasons: string[],
  field: string,
  actual: string | boolean,
  expected: string | boolean,
): void {
  if (actual !== expected) reasons.push(`Очікувався ${field}=${expected}, отримано ${actual}.`);
}
```

Перший scorer порівнює `mode`, `usedClientManagedHistory`, `createdDurableConversation`, `windowingEnabled`; другий – п’ять long-term booleans. В `run.ts` перетворіть observations в `Map(id → observation)`, для кожного eval case створіть fail score з причиною `Відсутнє записане спостереження.` якщо ключа немає, інакше викличте scorer. Надрукуйте всі scores і `Result: passed/total`; на будь-якому fail задайте `process.exitCode = 1`.

В `run.ts` додайте імпорти цих двох масивів, observations і scorer-ів. Перед існуючим MCP runner додайте `runMemoryEvaluation()`: індексуйте recorded observations за ID, оцініть кожен case, надрукуйте `PASS|FAIL <id>`, `Result: <passed>/<total>` і виставте `process.exitCode = 1`, якщо будь-який кейс не пройшов. В CLI `--mode=memory` є default; залиште успадковані `--mode=all` extraction + MCP та live extraction режим без змін. В `tests/evals.test.ts` додайте перевірку 5+5 унікальних IDs, позитивних/негативних очікувань і `every(score.passed) === true` для обох масивів.

### 10. Перевірте data path та приклади

**Файли:** створіть `my-dev/lesson-05-memory-openrouter/data/user-memory.example.json` із `{ "facts": [{ "category": "preferredStack", "value": "TypeScript та Node.js" }] }` і `my-dev/lesson-05-memory-openrouter/data/conversation-history.example.json` із `{ "conversations": { "synthetic-conversation-id": [{ "userMessage": "Який стек вивчається?", "assistantMessage": { "content": "TypeScript та Node.js." } }] } }`. Це приклади синтетичних JSON форм, а не runtime state. В `tests/json-stores.test.ts` використовуйте лише `mkdtemp` шляхи.

Не створюйте runtime `user-memory.json` або `conversation-history.json` в Git. Root ignore rules уже охоплюють студентську й teacher data папки.

**Перевірка:** виконайте `git check-ignore my-dev/lesson-05-memory-openrouter/data/user-memory.json my-dev/lesson-05-memory-openrouter/data/conversation-history.json`. Очікується, що обидва runtime шляхи ігноруються, а tracked `.example.json` не потрапляє під ці правила. Перевірте `git status --short` і переконайтеся, що в diff немає реальних даних.

### 11. Пройдіть completion gate і весь student check

**Команди:** спочатку `yarn verify:my:lesson05:openrouter`, потім `yarn check:my:lesson05:openrouter`.

Перший gate перевіряє фактичну папку `my-dev/lesson-05-memory-openrouter/`: необхідні локальні файли, активні тести, поведінку й відсутність incomplete markers/cross-lesson imports. Другий запускає typecheck, lint, форматування, tests, eval та той самий completion gate. Очікується, що обидві команди завершуються успішно. Якщо одна з них падає, виправте конкретний файл зі звіту й повторіть її.

Перед останнім запуском оновіть **файл** `my-dev/lesson-05-memory-openrouter/README.md`. Знайдіть точний heading `## Продовжити у власній папці` з успадкованого starter README і замініть його секцію до наступного `##` на цей готовий результат:

```markdown
## Результат Lesson 05

Проєкт зберігає успадковані Lesson 04 OpenRouter маршрути та додає `POST /api/agent/conversation` і `POST /api/agent/conversation/reset`. Session history є короткочасною й ізолюється за `sessionId`; reset очищає лише одну session. Durable history зберігається у `data/conversation-history.json`, а дозволені Long-term facts – у `data/user-memory.json`.

За замовчуванням зберігаються вісім завершених ходів. Chat Completions отримує client-managed `messages`; `reasoning_details` та відповідні `tool_call_id` не губляться при tool loop і відновленні. Runtime JSON є локальними даними й не додається до Git.

Перевірка результату: `yarn check:my:lesson05:openrouter`. Цей offline набір не виконує live provider inference.
```

Збережіть решту загального README, якщо вона лишається коректною. Очікується, що README називає нові endpoints, обидва data files та student command без обіцянки live перевірки.

Якщо `check:my` повідомляє про форматування, застосуйте Prettier лише до змінених на попередніх кроках файлів, залишивши байти успадкованих файлів без змін:

```powershell
yarn prettier --write my-dev/lesson-05-memory-openrouter/README.md my-dev/lesson-05-memory-openrouter/data/user-memory.example.json my-dev/lesson-05-memory-openrouter/data/conversation-history.example.json my-dev/lesson-05-memory-openrouter/src/schemas/conversation-request.ts my-dev/lesson-05-memory-openrouter/src/memory/conversation-history.ts my-dev/lesson-05-memory-openrouter/src/memory/user-facts.ts my-dev/lesson-05-memory-openrouter/src/services/conversation-manager.ts my-dev/lesson-05-memory-openrouter/src/app.ts my-dev/lesson-05-memory-openrouter/src/runtime.ts my-dev/lesson-05-memory-openrouter/src/server.ts my-dev/lesson-05-memory-openrouter/tests/conversation-manager.test.ts my-dev/lesson-05-memory-openrouter/tests/json-stores.test.ts my-dev/lesson-05-memory-openrouter/tests/user-facts.test.ts my-dev/lesson-05-memory-openrouter/tests/runtime.test.ts my-dev/lesson-05-memory-openrouter/tests/app.test.ts my-dev/lesson-05-memory-openrouter/tests/evals.test.ts my-dev/lesson-05-memory-openrouter/evals/memory.eval.ts my-dev/lesson-05-memory-openrouter/evals/recorded-results.ts my-dev/lesson-05-memory-openrouter/evals/scorer.ts my-dev/lesson-05-memory-openrouter/evals/run.ts
```

### 12. Перевірте локальний API без inference

`yarn dev:my:lesson05:openrouter` запускає локальний сервер. Для стандартної offline перевірки використовуйте лише синтетичний environment і `GET /health`; зупиніть сервер після відповіді. Scripted HTTP тести кроку 8 перевіряють обидва conversation routes без звернення до провайдера. Не надсилайте валідний `POST /api/agent/conversation` під час стандартного audit/replay.

Ручні session і durable приклади нижче потребують реального runtime та credential і викликають provider inference, тому вони є окремим opt-in запуском поза стандартною перевіркою. В такому запуску session body має вигляд `{"mode":"session","sessionId":"demo-1","message":"Поясни різницю між станом розмови й фактом."}`; durable body – `{"mode":"conversation","message":"Створи локальну розмову."}`, після чого можна повторити запит із `conversationId`. Reset для `demo-1` очищує лише коротку session, не JSON conversation чи facts. Усі manual POST запити можуть надіслати дані провайдеру й не є offline доказом.

## Успіх роботи

Фінальна умова – успішний `yarn check:my:lesson05:openrouter`, чисті синтетичні дані й збереження успадкованих Lesson 04 tests/routes. Completion не визначається кількістю TODO: базовий starter може пройти успадковані тести, але gate відхиляє його через відсутні memory-файли та поведінку. Live-запит до провайдера не потрібен для стандартного завдання.
