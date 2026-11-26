import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { DocumentAi } from "../src/services/document-ai.js";
import { createApp } from "../src/app.js";
import type { ConversationMessageRequest } from "../src/schemas/conversation-request.js";
import type { ConversationService } from "../src/services/conversation-manager.js";

const documentAi: DocumentAi = {
  async extract() {
    throw new Error("Document AI не повинен викликатися під час Lesson 05 OpenRouter smoke test.");
  },
  async *streamSummary() {
    return;
  },
};

let lastRequest: ConversationMessageRequest | undefined;
const conversationManager: ConversationService = {
  async send(request) {
    lastRequest = request;
    const resultBase = {
      status: "success" as const,
      text: "Контекст збережено.",
      model: "smoke-model",
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
        totalLatencyMs: 1,
      },
      retainedTurns: 1,
    };

    return request.mode === "session"
      ? {
          ...resultBase,
          mode: "session",
          sessionId: request.sessionId,
        }
      : {
          ...resultBase,
          mode: "conversation",
          conversationId: request.conversationId ?? "conv_smoke",
        };
  },
  resetSession() {
    return true;
  },
};

const server: Server = createApp({ ai: documentAi, conversationManager }).listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address() as AddressInfo;
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const healthResponse = await fetch(`${baseUrl}/health`);
  assert.equal(healthResponse.status, 200);

  const researchResponse = await postJson("/api/agent/research", {
    message: "Прочитай notes.txt.",
  });
  assert.equal(researchResponse.status, 503);

  const conversationResponse = await postJson("/api/agent/conversation", {
    mode: "session",
    sessionId: " student-1 ",
    message: " Продовжити розмову. ",
  });
  assert.equal(conversationResponse.status, 200);
  assert.deepEqual(lastRequest, {
    mode: "session",
    sessionId: "student-1",
    message: "Продовжити розмову.",
  });
  assert.deepEqual(await conversationResponse.json(), {
    status: "success",
    text: "Контекст збережено.",
    model: "smoke-model",
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
      totalLatencyMs: 1,
    },
    retainedTurns: 1,
    mode: "session",
    sessionId: "student-1",
  });

  const resetResponse = await postJson("/api/agent/conversation/reset", {
    sessionId: "student-1",
  });
  assert.equal(resetResponse.status, 200);
  assert.deepEqual(await resetResponse.json(), { status: "success", reset: true });

  const invalidResponse = await postJson("/api/agent/conversation", {
    mode: "session",
    message: "Відсутній sessionId.",
  });
  assert.equal(invalidResponse.status, 400);

  console.log(
    "PASS Lesson 05 OpenRouter HTTP smoke: inherited routes, conversation, reset and validation",
  );
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
