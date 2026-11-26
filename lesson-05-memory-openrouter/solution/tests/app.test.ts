import type {
  ConversationRunResult,
  ConversationService,
} from "../src/services/conversation-manager.js";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createApp, type Lesson04AppDependencies } from "../src/app.js";
import { DocumentAiError } from "../src/lib/errors.js";
import type {
  DocumentAi,
  ExtractionResult,
  SummaryStreamEvent,
} from "../src/services/document-ai.js";
import type { ToolCallingAgent } from "../src/services/tool-calling-agent.js";

const successfulExtraction: ExtractionResult = {
  data: {
    names: ["Олена Коваль"],
    dates: ["14 липня"],
    locations: ["Львова"],
    summary: "Олена Коваль приїхала до Львова 14 липня.",
  },
  model: "test-main",
  usage: {
    input_tokens: 1_000,
    output_tokens: 500,
    total_tokens: 1_500,
    input_tokens_details: {
      cached_tokens: 200,
      cache_write_tokens: 100,
    },
  },
};

const successfulStream: SummaryStreamEvent[] = [
  { type: "delta", delta: "Короткий " },
  { type: "delta", delta: "підсумок." },
  {
    type: "completed",
    model: "test-fast",
    usage: {
      input_tokens: 100,
      output_tokens: 20,
      total_tokens: 120,
      input_tokens_details: {
        cached_tokens: 25,
        cache_write_tokens: 0,
      },
    },
  },
];

function createFakeAi(options?: {
  extraction?: () => Promise<ExtractionResult>;
  stream?: readonly SummaryStreamEvent[];
  streamError?: Error;
}): DocumentAi {
  return {
    extract: options?.extraction ?? (async () => successfulExtraction),
    streamSummary: async function* () {
      if (options?.streamError) {
        throw options.streamError;
      }

      for (const event of options?.stream ?? successfulStream) {
        yield event;
      }
    },
  };
}

async function startTestServer(
  dependencies: Lesson04AppDependencies,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server: Server = createApp(dependencies).listen(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    },
  };
}

async function postJson(baseUrl: string, path: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("document API", () => {
  it("exposes a health endpoint", async () => {
    const server = await startTestServer({ ai: createFakeAi() });

    try {
      const response = await fetch(`${server.baseUrl}/health`);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ status: "ok" });
    } finally {
      await server.close();
    }
  });

  it("rejects invalid input before calling the extraction service", async () => {
    const extract = vi.fn(async () => successfulExtraction);
    const server = await startTestServer({
      ai: createFakeAi({ extraction: extract }),
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/extract", { content: "   " });

      expect(response.status).toBe(400);
      expect(extract).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "INVALID_INPUT" },
      });
    } finally {
      await server.close();
    }
  });

  it("returns a stable error for malformed JSON", async () => {
    const server = await startTestServer({ ai: createFakeAi() });

    try {
      const response = await fetch(`${server.baseUrl}/api/documents/extract`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"content":"test",}',
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "MALFORMED_JSON",
          message: "Тіло запиту містить невалідний JSON.",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("rejects an oversized JSON body before model invocation", async () => {
    const extract = vi.fn(async () => successfulExtraction);
    const server = await startTestServer({
      ai: createFakeAi({ extraction: extract }),
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/extract", {
        content: "x".repeat(40_000),
      });

      expect(response.status).toBe(413);
      expect(extract).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "PAYLOAD_TOO_LARGE" },
      });
    } finally {
      await server.close();
    }
  });

  it("returns typed extraction data, usage and measured cost", async () => {
    const times = [100, 145];
    const server = await startTestServer({
      ai: createFakeAi(),
      now: () => times.shift() ?? 145,
      prices: {
        "test-main": {
          inputCostPerMillion: 10,
          cachedInputCostPerMillion: 1,
          cacheWriteCostPerMillion: 12.5,
          outputCostPerMillion: 20,
        },
      },
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/extract", {
        content: "14 липня Олена Коваль приїхала до Львова.",
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        data: successfulExtraction.data,
        usage: {
          inputTokens: 1_000,
          outputTokens: 500,
          cachedTokens: 200,
          cacheWriteTokens: 100,
        },
        metrics: {
          model: "test-main",
          totalLatencyMs: 45,
          cacheHitRate: 0.2,
          pricingAvailable: true,
        },
      });
    } finally {
      await server.close();
    }
  });

  it("returns unknown-model pricing signals instead of fake zero cost", async () => {
    const server = await startTestServer({ ai: createFakeAi() });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/extract", {
        content: "Синтетичний документ.",
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.metrics).toMatchObject({
        model: "test-main",
        estimatedCostUsd: null,
        pricingAvailable: false,
        pricingUnavailableReason: "MODEL_NOT_CONFIGURED",
      });
    } finally {
      await server.close();
    }
  });

  it("maps typed provider errors to a stable JSON contract", async () => {
    const server = await startTestServer({
      ai: createFakeAi({
        extraction: async () => {
          throw new DocumentAiError("REQUEST_REFUSED", "Модель відхилила запит.", 422);
        },
      }),
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/extract", {
        content: "Синтетичний документ.",
      });

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "REQUEST_REFUSED",
          message: "Модель відхилила запит.",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("does not leak provider details into the public error contract", async () => {
    const server = await startTestServer({
      ai: createFakeAi({
        extraction: async () => {
          throw new DocumentAiError(
            "UPSTREAM_RATE_LIMITED",
            "OpenRouter тимчасово обмежив частоту запитів.",
            429,
            {
              status: 429,
              requestId: "req_secret_123",
            },
          );
        },
      }),
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/extract", {
        content: "Синтетичний документ.",
      });
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body.error.code).toBe("UPSTREAM_RATE_LIMITED");
      expect(JSON.stringify(body)).not.toContain("req_secret_123");
      expect(JSON.stringify(body)).not.toContain("sk-");
    } finally {
      await server.close();
    }
  });

  it("streams named delta, usage and done events", async () => {
    const times = [100, 125, 180];
    const server = await startTestServer({
      ai: createFakeAi(),
      now: () => times.shift() ?? 180,
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/summary/stream", {
        content: "Синтетичний документ.",
      });
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/event-stream");
      expect(body).toContain('event: delta\ndata: {"delta":"Короткий "}\n\n');
      expect(body).toContain('"ttftMs":25');
      expect(body).toContain('"totalLatencyMs":80');
      expect(body).toContain('"cacheHitRate":0.25');
      expect(body).toContain('event: done\ndata: {"status":"completed"}\n\n');
    } finally {
      await server.close();
    }
  });

  it("emits an SSE error and no done event for incomplete generation", async () => {
    const server = await startTestServer({
      ai: createFakeAi({
        stream: [
          { type: "delta", delta: "Початок" },
          { type: "incomplete", reason: "max_output_tokens" },
        ],
      }),
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/summary/stream", {
        content: "Синтетичний документ.",
      });
      const body = await response.text();

      expect(body).toContain('"code":"INCOMPLETE_RESPONSE"');
      expect(body).toContain('"reason":"max_output_tokens"');
      expect(body).not.toContain("event: done");
    } finally {
      await server.close();
    }
  });

  it("maps a mid-stream OpenRouter rate limit to a stable SSE error", async () => {
    const server = await startTestServer({
      ai: createFakeAi({
        stream: [{ type: "failed", reason: "rate_limit_exceeded" }],
      }),
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/summary/stream", {
        content: "Синтетичний документ.",
      });
      const body = await response.text();

      expect(body).toContain('"code":"UPSTREAM_RATE_LIMITED"');
      expect(body).toContain('"reason":"rate_limit_exceeded"');
      expect(body).not.toContain("event: done");
    } finally {
      await server.close();
    }
  });

  it("emits an SSE refusal after receiving the terminal response", async () => {
    const server = await startTestServer({
      ai: createFakeAi({
        stream: [{ type: "refused" }, { type: "completed", model: "test-fast" }],
      }),
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/summary/stream", {
        content: "Синтетичний документ.",
      });
      const body = await response.text();

      expect(body).toContain('"code":"REQUEST_REFUSED"');
      expect(body).not.toContain("event: done");
    } finally {
      await server.close();
    }
  });

  it("detects a stream that ends without a terminal event", async () => {
    const server = await startTestServer({
      ai: createFakeAi({ stream: [{ type: "delta", delta: "Незавершено" }] }),
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/summary/stream", {
        content: "Синтетичний документ.",
      });
      const body = await response.text();

      expect(body).toContain('"code":"STREAM_ENDED_UNEXPECTEDLY"');
      expect(body).not.toContain("event: done");
    } finally {
      await server.close();
    }
  });

  it("maps a thrown stream error to the named SSE error contract", async () => {
    const server = await startTestServer({
      ai: createFakeAi({
        streamError: new DocumentAiError(
          "GATEWAY_TIMEOUT",
          "Перевищено час очікування відповіді OpenRouter API.",
          504,
        ),
      }),
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/summary/stream", {
        content: "Синтетичний документ.",
      });
      const body = await response.text();

      expect(body).toContain('"code":"GATEWAY_TIMEOUT"');
      expect(body).not.toContain("event: done");
    } finally {
      await server.close();
    }
  });

  it("aborts the upstream stream after the HTTP client disconnects", async () => {
    let upstreamSignal: AbortSignal | undefined;
    let markStreamStarted: (() => void) | undefined;
    const streamStarted = new Promise<void>((resolve) => {
      markStreamStarted = resolve;
    });
    const ai: DocumentAi = {
      extract: async () => successfulExtraction,
      streamSummary: async function* (_content, signal) {
        upstreamSignal = signal;
        markStreamStarted?.();
        yield { type: "delta", delta: "Початок" };
        await new Promise<void>((resolve) => {
          if (signal.aborted) {
            resolve();
            return;
          }

          signal.addEventListener("abort", () => resolve(), { once: true });
        });
      },
    };
    const server = await startTestServer({ ai });
    const clientController = new AbortController();

    try {
      const response = await fetch(`${server.baseUrl}/api/documents/summary/stream`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "Синтетичний документ." }),
        signal: clientController.signal,
      });
      const reader = response.body?.getReader();

      expect(response.status).toBe(200);
      expect(reader).toBeDefined();
      await streamStarted;
      await reader?.read();
      clientController.abort();

      await vi.waitFor(() => expect(upstreamSignal?.aborted).toBe(true));
    } finally {
      clientController.abort();
      await server.close();
    }
  });
});

describe("POST /api/agent/research (OpenRouter)", () => {
  it("зберігає health endpoint попереднього проєкту", async () => {
    const server = await startTestServer({ ai: createFakeAi() });

    try {
      const response = await fetch(`${server.baseUrl}/health`);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ status: "ok" });
    } finally {
      await server.close();
    }
  });

  it("перевикористовує AgentRequestSchema до запуску MCP runtime", async () => {
    const run = vi.fn<ToolCallingAgent["run"]>();
    const server = await startTestServer({ ai: createFakeAi(), mcpAgent: { run } });

    try {
      const response = await postJson(server.baseUrl, "/api/agent/research", { message: "   " });

      expect(response.status).toBe(400);
      expect(run).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "INVALID_INPUT" },
      });
    } finally {
      await server.close();
    }
  });

  it("передає нормалізований запит MCP-агенту", async () => {
    const run = vi.fn<ToolCallingAgent["run"]>().mockResolvedValue({
      status: "success",
      text: "Файл прочитано.",
      model: "configured-model",
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        cachedTokens: 0,
        cacheWriteTokens: 0,
      },
      metrics: {
        modelCallCount: 2,
        toolCallCount: 1,
        retryCount: 0,
        totalLatencyMs: 25,
      },
    });
    const server = await startTestServer({ ai: createFakeAi(), mcpAgent: { run } });

    try {
      const response = await postJson(server.baseUrl, "/api/agent/research", {
        message: "  Прочитай notes.txt  ",
      });

      expect(response.status).toBe(200);
      expect(run).toHaveBeenCalledWith("Прочитай notes.txt");
      await expect(response.json()).resolves.toMatchObject({
        status: "success",
        metrics: {
          modelCallCount: 2,
          toolCallCount: 1,
        },
      });
    } finally {
      await server.close();
    }
  });

  it("маскує внутрішню помилку MCP runtime", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const run = vi
      .fn<ToolCallingAgent["run"]>()
      .mockRejectedValue(new Error("secret-upstream-details"));
    const server = await startTestServer({ ai: createFakeAi(), mcpAgent: { run } });

    try {
      const response = await postJson(server.baseUrl, "/api/agent/research", {
        message: "Прочитай файл.",
      });
      const serializedBody = JSON.stringify(await response.json());

      expect(response.status).toBe(502);
      expect(serializedBody).toContain("MCP_AGENT_ERROR");
      expect(serializedBody).not.toContain("secret-upstream-details");
      expect(errorLog).toHaveBeenCalledWith("[MCP Agent Error]", {
        errorName: "Error",
      });
    } finally {
      await server.close();
    }
  });
});

const documentAi: DocumentAi = {
  extract: vi.fn(),
  async *streamSummary() {
    return;
  },
};

function createSuccessfulRun(): ConversationRunResult {
  return {
    status: "success",
    mode: "session",
    sessionId: "student-1",
    text: "Контекст збережено.",
    model: "configured-model",
    usage: {
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      cachedTokens: 0,
      cacheWriteTokens: 0,
    },
    metrics: {
      modelCallCount: 1,
      toolCallCount: 0,
      totalLatencyMs: 25,
    },
    retainedTurns: 1,
  };
}

function createConversationService(): ConversationService {
  return {
    send: vi.fn().mockResolvedValue(createSuccessfulRun()),
    resetSession: vi.fn().mockReturnValue(true),
  };
}

async function startServer(
  conversationManager?: ConversationService,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const app = createApp({
    ai: documentAi,
    ...(conversationManager === undefined ? {} : { conversationManager }),
  });
  const server: Server = app.listen(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    },
  };
}

async function postConversationJson(
  baseUrl: string,
  path: string,
  body: unknown,
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Lesson 05 OpenRouter app", () => {
  it("зберігає health endpoint і research route попередніх лекцій", async () => {
    const server = await startServer();

    try {
      const healthResponse = await fetch(`${server.baseUrl}/health`);
      const researchResponse = await postConversationJson(server.baseUrl, "/api/agent/research", {
        message: "Прочитай notes.txt.",
      });

      expect(healthResponse.status).toBe(200);
      await expect(healthResponse.json()).resolves.toEqual({ status: "ok" });
      expect(researchResponse.status).toBe(503);
      await expect(researchResponse.json()).resolves.toMatchObject({
        error: { code: "SERVICE_UNAVAILABLE" },
      });
    } finally {
      await server.close();
    }
  });

  it("валідує discriminated request до запуску Conversation Manager", async () => {
    const manager = createConversationService();
    const server = await startServer(manager);

    try {
      const response = await postConversationJson(server.baseUrl, "/api/agent/conversation", {
        mode: "session",
        message: "Відсутній sessionId.",
      });

      expect(response.status).toBe(400);
      expect(manager.send).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("передає нормалізований session-запит сервісу", async () => {
    const manager = createConversationService();
    const server = await startServer(manager);

    try {
      const response = await postConversationJson(server.baseUrl, "/api/agent/conversation", {
        mode: "session",
        sessionId: " student-1 ",
        message: "  Продовжити розмову.  ",
      });

      expect(response.status).toBe(200);
      expect(manager.send).toHaveBeenCalledWith({
        mode: "session",
        sessionId: "student-1",
        message: "Продовжити розмову.",
      });
      await expect(response.json()).resolves.toMatchObject({
        mode: "session",
        retainedTurns: 1,
      });
    } finally {
      await server.close();
    }
  });

  it("очищає короткочасну session history через окремий endpoint", async () => {
    const manager = createConversationService();
    const server = await startServer(manager);

    try {
      const response = await postConversationJson(server.baseUrl, "/api/agent/conversation/reset", {
        sessionId: "student-1",
      });

      expect(response.status).toBe(200);
      expect(manager.resetSession).toHaveBeenCalledWith("student-1");
      await expect(response.json()).resolves.toEqual({
        status: "success",
        reset: true,
      });
    } finally {
      await server.close();
    }
  });

  it("відхиляє невалідний reset без виклику Conversation Manager", async () => {
    const manager = createConversationService();
    const server = await startServer(manager);

    try {
      const response = await postConversationJson(server.baseUrl, "/api/agent/conversation/reset", {
        sessionId: " ",
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "INVALID_INPUT" },
      });
      expect(manager.resetSession).not.toHaveBeenCalled();
      expect(manager.send).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("повертає 503 для reset без Conversation runtime", async () => {
    const server = await startServer();

    try {
      const response = await postConversationJson(server.baseUrl, "/api/agent/conversation/reset", {
        sessionId: "student-1",
      });

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "SERVICE_UNAVAILABLE" },
      });
    } finally {
      await server.close();
    }
  });

  it("повертає 503, якщо Conversation runtime не налаштовано", async () => {
    const server = await startServer();

    try {
      const response = await postConversationJson(server.baseUrl, "/api/agent/conversation", {
        mode: "conversation",
        message: "Створити Conversation.",
      });

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "SERVICE_UNAVAILABLE" },
      });
    } finally {
      await server.close();
    }
  });

  it("маскує внутрішню помилку Conversation runtime", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const manager = createConversationService();
    vi.mocked(manager.send).mockRejectedValue(new Error("secret-upstream-details"));
    const server = await startServer(manager);

    try {
      const response = await postConversationJson(server.baseUrl, "/api/agent/conversation", {
        mode: "conversation",
        message: "Продовжити Conversation.",
      });
      const serializedBody = JSON.stringify(await response.json());

      expect(response.status).toBe(502);
      expect(serializedBody).toContain("CONVERSATION_ERROR");
      expect(serializedBody).not.toContain("secret-upstream-details");
      expect(errorLog).toHaveBeenCalledWith("[OpenRouter Conversation Error]", {
        errorName: "Error",
      });
    } finally {
      await server.close();
    }
  });
});
