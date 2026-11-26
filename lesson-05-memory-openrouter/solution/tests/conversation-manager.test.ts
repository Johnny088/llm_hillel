import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type OpenAI from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryConversationHistoryStore,
  JsonConversationHistoryStore,
  type StoredConversationTurn,
} from "../src/memory/conversation-history.js";
import { InMemoryUserFactStore } from "../src/memory/user-facts.js";
import {
  CONVERSATION_INSTRUCTIONS,
  ConversationManager,
  OpenRouterConversationChatClient,
} from "../src/services/conversation-manager.js";
import type {
  ConversationChatClient,
  ConversationModelRequest,
  ConversationModelTurn,
} from "../src/services/conversation-manager.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

class SequenceConversationClient implements ConversationChatClient {
  public readonly requests: ConversationModelRequest[] = [];

  public constructor(private readonly turns: ConversationModelTurn[]) {}

  public async createTurn(request: ConversationModelRequest): Promise<ConversationModelTurn> {
    this.requests.push({ ...request, history: structuredClone(request.history) });
    const turn = this.turns.shift();

    if (!turn) {
      throw new Error("Відсутня scripted відповідь.");
    }

    return turn;
  }
}

function createTurn(outputText: string): ConversationModelTurn {
  return {
    outputText,
    assistantMessage: { content: outputText },
    model: "configured-model",
    usage: {
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      cachedTokens: 0,
      cacheWriteTokens: 0,
    },
    modelCallCount: 1,
    toolCallCount: 0,
  };
}

describe("ConversationManager", () => {
  it("передає повну client-managed history лише в межах однієї session", async () => {
    const client = new SequenceConversationClient([
      createTurn("Відповідь 1"),
      createTurn("Відповідь 2"),
      createTurn("Інша session"),
    ]);
    const manager = new ConversationManager(client);

    await manager.send({ mode: "session", sessionId: "student-1", message: "Хід 1" });
    await manager.send({ mode: "session", sessionId: "student-1", message: "Хід 2" });
    await manager.send({ mode: "session", sessionId: "student-2", message: "Хід A" });

    expect(client.requests).toEqual([
      { history: [], message: "Хід 1" },
      {
        history: [
          {
            userMessage: "Хід 1",
            assistantMessage: { content: "Відповідь 1" },
          },
        ],
        message: "Хід 2",
      },
      { history: [], message: "Хід A" },
    ]);
  });

  it("очищає одну session history без зміни інших сесій", async () => {
    const client = new SequenceConversationClient([
      createTurn("S1"),
      createTurn("S2"),
      createTurn("S1 після reset"),
      createTurn("S2 продовження"),
    ]);
    const manager = new ConversationManager(client);

    await manager.send({ mode: "session", sessionId: "student-1", message: "A" });
    await manager.send({ mode: "session", sessionId: "student-2", message: "B" });
    expect(manager.resetSession("student-1")).toBe(true);
    expect(manager.resetSession("unknown")).toBe(false);
    await manager.send({ mode: "session", sessionId: "student-1", message: "C" });
    await manager.send({ mode: "session", sessionId: "student-2", message: "D" });

    expect(client.requests[2]?.history).toEqual([]);
    expect(client.requests[3]?.history).toHaveLength(1);
  });

  it("зберігає довготривалі факти після reset короткочасної session", async () => {
    const fact = { category: "preferredStack" as const, value: "TypeScript" };
    const factStore = new InMemoryUserFactStore([fact]);
    const providerCreate = vi.fn().mockResolvedValue(createChatResponse("Продовжуємо."));
    const manager = new ConversationManager(createOpenRouterClient(providerCreate, factStore));

    await manager.send({ mode: "session", sessionId: "student-1", message: "Продовжити." });
    expect(manager.resetSession("student-1")).toBe(true);

    await expect(factStore.list()).resolves.toEqual([fact]);
  });

  it("створює durable conversation і відновлює її за поверненим ID", async () => {
    const client = new SequenceConversationClient([createTurn("Перший"), createTurn("Другий")]);
    const historyStore = new InMemoryConversationHistoryStore(() => "conv_1");
    const manager = new ConversationManager(client, historyStore);

    const first = await manager.send({ mode: "conversation", message: "Хід 1" });
    const second = await manager.send({
      mode: "conversation",
      conversationId: first.mode === "conversation" ? first.conversationId : undefined,
      message: "Хід 2",
    });

    expect(first).toMatchObject({ mode: "conversation", conversationId: "conv_1" });
    expect(second).toMatchObject({
      mode: "conversation",
      conversationId: "conv_1",
      retainedTurns: 2,
    });
    expect(client.requests[1]?.history).toEqual([
      {
        userMessage: "Хід 1",
        assistantMessage: { content: "Перший" },
      },
    ]);
  });

  it("застосовує sliding window до завершених ходів", async () => {
    const client = new SequenceConversationClient([
      createTurn("A1"),
      createTurn("A2"),
      createTurn("A3"),
      createTurn("A4"),
    ]);
    const manager = new ConversationManager(client, new InMemoryConversationHistoryStore(), {
      maxHistoryTurns: 2,
    });

    for (const message of ["U1", "U2", "U3", "U4"]) {
      await manager.send({ mode: "session", sessionId: "student-1", message });
    }

    expect(client.requests[3]?.history.map((turn) => turn.userMessage)).toEqual(["U2", "U3"]);
  });

  it("не оновлює history, якщо модель не повернула текст", async () => {
    const client = new SequenceConversationClient([createTurn("   "), createTurn("Готово")]);
    const manager = new ConversationManager(client);

    await expect(
      manager.send({ mode: "session", sessionId: "student-1", message: "Порожньо" }),
    ).rejects.toThrow("Модель не повернула текстової відповіді.");
    await manager.send({ mode: "session", sessionId: "student-1", message: "Повтор" });

    expect(client.requests[1]?.history).toEqual([]);
  });

  it("не оновлює history, якщо доменна перевірка відхилила текст", async () => {
    const client = new SequenceConversationClient([createTurn("Без citation"), createTurn("OK")]);
    const manager = new ConversationManager(client);

    await expect(
      manager.send(
        { mode: "session", sessionId: "student-1", message: "RAG" },
        {
          validateOutput: () => {
            throw new Error("Citation validation failed.");
          },
        },
      ),
    ).rejects.toThrow("Citation validation failed.");
    await manager.send({ mode: "session", sessionId: "student-1", message: "Новий" });

    expect(client.requests[1]?.history).toEqual([]);
  });

  it("читає durable JSON conversation після повторної ініціалізації store", async () => {
    const directory = await mkdtemp(join(tmpdir(), "lesson-05-openrouter-history-"));
    temporaryDirectories.push(directory);
    const filePath = join(directory, "data", "conversation-history.json");
    const firstStore = new JsonConversationHistoryStore(filePath, () => "conv_json");
    const conversationId = await firstStore.create();
    const turns: StoredConversationTurn[] = [
      {
        userMessage: "Питання",
        assistantMessage: {
          content: "Відповідь",
          reasoningDetails: [{ type: "opaque-provider-item" }],
        },
      },
    ];
    await firstStore.save(conversationId, turns);

    const secondStore = new JsonConversationHistoryStore(filePath);
    await expect(secondStore.load("conv_json")).resolves.toEqual(turns);
  });

  it("повторно надсилає reasoning_details із JSON history після перезапуску manager", async () => {
    const directory = await mkdtemp(join(tmpdir(), "lesson-05-openrouter-restart-history-"));
    temporaryDirectories.push(directory);
    const filePath = join(directory, "data", "conversation-history.json");
    const reasoningDetails = [
      {
        type: "reasoning.encrypted",
        id: "opaque-reasoning-id",
        data: "opaque-provider-payload",
        signature: "opaque-signature",
        nested: { providerField: [1, { keep: true }] },
      },
      { type: "provider-extension", value: { untouched: "opaque-extension" } },
    ];
    const firstCreate = vi
      .fn()
      .mockResolvedValue(createChatResponse("Перша відповідь", { reasoningDetails }));
    const firstStore = new JsonConversationHistoryStore(filePath, () => "conv_restart");
    const firstManager = new ConversationManager(createOpenRouterClient(firstCreate), firstStore);

    const firstResult = await firstManager.send({
      mode: "conversation",
      message: "Початкове питання",
    });

    expect(firstResult).toMatchObject({
      mode: "conversation",
      retainedTurns: 1,
      text: "Перша відповідь",
    });
    expect(firstResult).not.toHaveProperty("reasoningDetails");
    expect(firstResult).not.toHaveProperty("reasoning_details");
    expect(JSON.stringify(firstResult)).not.toContain("opaque-provider-payload");
    if (firstResult.mode !== "conversation") {
      throw new Error("Очікувалася durable conversation.");
    }

    const secondCreate = vi.fn().mockResolvedValue(createChatResponse("Друга відповідь"));
    const secondStore = new JsonConversationHistoryStore(filePath);
    const secondManager = new ConversationManager(
      createOpenRouterClient(secondCreate),
      secondStore,
    );
    const secondResult = await secondManager.send({
      mode: "conversation",
      conversationId: firstResult.conversationId,
      message: "Уточнення після перезапуску",
    });

    expect(secondResult).toMatchObject({
      mode: "conversation",
      conversationId: firstResult.conversationId,
      retainedTurns: 2,
      text: "Друга відповідь",
    });
    expect(secondResult).not.toHaveProperty("reasoningDetails");
    expect(secondResult).not.toHaveProperty("reasoning_details");
    const request = secondCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(request).toMatchObject({
      messages: [
        { role: "system", content: CONVERSATION_INSTRUCTIONS },
        { role: "user", content: "Початкове питання" },
        {
          role: "assistant",
          content: "Перша відповідь",
          reasoning_details: reasoningDetails,
        },
        { role: "user", content: "Уточнення після перезапуску" },
      ],
    });
    await expect(secondStore.load(firstResult.conversationId)).resolves.toEqual([
      {
        userMessage: "Початкове питання",
        assistantMessage: { content: "Перша відповідь", reasoningDetails },
      },
      {
        userMessage: "Уточнення після перезапуску",
        assistantMessage: { content: "Друга відповідь" },
      },
    ]);
  });
});

describe("OpenRouterConversationChatClient", () => {
  it("передає повну історію без server-managed state параметрів", async () => {
    const create = vi.fn().mockResolvedValue(createChatResponse("Готово."));
    const client = createOpenRouterClient(create);
    const history: StoredConversationTurn[] = [
      {
        userMessage: "Перший хід",
        assistantMessage: {
          content: "Перша відповідь",
          reasoningDetails: [{ type: "opaque-provider-item" }],
        },
      },
    ];

    await client.createTurn({
      history,
      message: "Другий хід",
      turnOptions: { enableUserFactTool: false, includeUserFacts: false },
    });

    const request = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(request).toMatchObject({
      model: "configured-model",
      messages: [
        { role: "system", content: CONVERSATION_INSTRUCTIONS },
        { role: "user", content: "Перший хід" },
        {
          role: "assistant",
          content: "Перша відповідь",
          reasoning_details: [{ type: "opaque-provider-item" }],
        },
        { role: "user", content: "Другий хід" },
      ],
      provider: { require_parameters: true },
      stream: false,
    });
    expect(request).not.toHaveProperty("store");
    expect(request).not.toHaveProperty("previous_response_id");
    expect(request).not.toHaveProperty("conversation");
    expect(request).not.toHaveProperty("context_management");
    expect(request).not.toHaveProperty("models");
  });

  it("зберігає reasoning_details для виклику й приховує їх із публічного результату", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(
        createChatResponse("", {
          toolCalls: [createSaveFactCall("call_1")],
          reasoningDetails: [{ type: "opaque-provider-item", data: "keep-as-is" }],
          usage: { prompt_tokens: 20, completion_tokens: 4, total_tokens: 24 },
        }),
      )
      .mockResolvedValueOnce(
        createChatResponse("Факт збережено.", {
          reasoningDetails: [{ type: "final-private-reasoning", data: "never-public" }],
          usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
        }),
      );
    const store = new InMemoryUserFactStore();
    const client = createOpenRouterClient(create, store);
    const manager = new ConversationManager(client);

    const result = await manager.send(
      { mode: "session", sessionId: "student-1", message: "Збережи preferredStack TypeScript." },
      { toolChoice: "required" },
    );

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]?.[0]).toMatchObject({ tool_choice: "required" });
    expect(create.mock.calls[1]?.[0]).toMatchObject({ tool_choice: "auto" });
    expect(create.mock.calls[1]?.[0]).toMatchObject({
      messages: [
        expect.anything(),
        expect.anything(),
        {
          role: "assistant",
          tool_calls: [expect.objectContaining({ id: "call_1" })],
          reasoning_details: [{ type: "opaque-provider-item", data: "keep-as-is" }],
        },
        {
          role: "tool",
          tool_call_id: "call_1",
        },
      ],
    });
    expect(result).toMatchObject({
      text: "Факт збережено.",
      metrics: {
        modelCallCount: 2,
        toolCallCount: 1,
      },
      usage: {
        inputTokens: 32,
        outputTokens: 10,
        totalTokens: 42,
      },
    });
    expect(result).not.toHaveProperty("assistantMessage");
    expect(result).not.toHaveProperty("reasoningDetails");
    expect(JSON.stringify(result)).not.toContain("never-public");
    await expect(store.list()).resolves.toEqual([
      { category: "preferredStack", value: "TypeScript" },
    ]);
  });

  it("додає long-term facts як дані та дозволяє вимкнути memory tool", async () => {
    const create = vi.fn().mockResolvedValue(createChatResponse("Готово."));
    const client = createOpenRouterClient(
      create,
      new InMemoryUserFactStore([{ category: "learningGoal", value: "Навчитися будувати RAG" }]),
    );

    await client.createTurn({ history: [], message: "Яка навчальна ціль?" });
    await client.createTurn({
      history: [],
      message: "RAG_CONTEXT",
      turnOptions: {
        instructions: "Відповідай лише за RAG_CONTEXT.",
        enableUserFactTool: false,
        includeUserFacts: false,
      },
    });

    expect(create.mock.calls[0]?.[0]).toMatchObject({
      messages: [
        { role: "system", content: CONVERSATION_INSTRUCTIONS },
        { role: "user", content: expect.stringContaining("LONG_TERM_MEMORY_DATA") },
      ],
      tools: [
        expect.objectContaining({ function: expect.objectContaining({ name: "save_user_fact" }) }),
      ],
    });
    expect(create.mock.calls[1]?.[0]).toMatchObject({
      messages: [
        { role: "system", content: "Відповідай лише за RAG_CONTEXT." },
        { role: "user", content: "RAG_CONTEXT" },
      ],
    });
    expect(create.mock.calls[1]?.[0]).not.toHaveProperty("tools");
  });

  it("відхиляє кілька memory tool calls до запису", async () => {
    const create = vi.fn().mockResolvedValue(
      createChatResponse("", {
        toolCalls: [createSaveFactCall("call_1"), createSaveFactCall("call_2")],
      }),
    );
    const store = new InMemoryUserFactStore();
    const client = createOpenRouterClient(create, store);

    await expect(client.createTurn({ history: [], message: "Збережи два факти." })).rejects.toThrow(
      "Дозволено не більше одного виклику save_user_fact",
    );
    await expect(store.list()).resolves.toEqual([]);
  });
});

function createOpenRouterClient(
  create: ReturnType<typeof vi.fn>,
  store: InMemoryUserFactStore = new InMemoryUserFactStore(),
): OpenRouterConversationChatClient {
  const openai = { chat: { completions: { create } } } as unknown as OpenAI;
  return new OpenRouterConversationChatClient(
    openai,
    {
      modelName: "configured-model",
      maxOutputTokens: 800,
    },
    store,
  );
}

function createChatResponse(
  content: string,
  options: {
    toolCalls?: ReturnType<typeof createSaveFactCall>[];
    reasoningDetails?: unknown[];
    usage?: Record<string, number>;
  } = {},
) {
  return {
    id: "chatcmpl_1",
    object: "chat.completion",
    created: 0,
    model: "configured-model",
    choices: [
      {
        index: 0,
        finish_reason: options.toolCalls?.length ? "tool_calls" : "stop",
        message: {
          role: "assistant",
          content,
          refusal: null,
          ...(options.toolCalls === undefined ? {} : { tool_calls: options.toolCalls }),
          ...(options.reasoningDetails === undefined
            ? {}
            : { reasoning_details: options.reasoningDetails }),
        },
      },
    ],
    ...(options.usage === undefined ? {} : { usage: options.usage }),
  };
}

function createSaveFactCall(id: string) {
  return {
    id,
    type: "function" as const,
    function: {
      name: "save_user_fact",
      arguments: JSON.stringify({ category: "preferredStack", value: "TypeScript" }),
    },
  };
}
