import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { DocumentAi } from "../src/services/document-ai.js";
import type { ToolCallingAgent } from "../src/services/tool-calling-agent.js";

const openServers = new Set<Server>();

afterEach(async () => {
  await Promise.all(
    [...openServers].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        }),
    ),
  );
  openServers.clear();
});

const documentAi: DocumentAi = {
  extract: vi.fn(),
  async *streamSummary() {
    return;
  },
};

async function startServer(toolAgent?: ToolCallingAgent): Promise<string> {
  const app = createApp({
    ai: documentAi,
    ...(toolAgent === undefined ? {} : { toolAgent }),
  });
  const server = await new Promise<Server>((resolve) => {
    const listeningServer = app.listen(0, "127.0.0.1", () => resolve(listeningServer));
  });
  openServers.add(server);
  const address = server.address() as AddressInfo;

  return `http://127.0.0.1:${address.port}`;
}

describe("POST /api/agent", () => {
  it("валідує message до запуску tool-calling runtime", async () => {
    const run = vi.fn<ToolCallingAgent["run"]>();
    const baseUrl = await startServer({ run });
    const response = await fetch(`${baseUrl}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "   " }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "INVALID_INPUT" },
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("передає нормалізоване повідомлення агенту та повертає метрики", async () => {
    const run = vi.fn<ToolCallingAgent["run"]>().mockResolvedValue({
      status: "success",
      text: "100 USD дорівнюють 4 150 UAH.",
      model: "configured-model",
      usage: {
        inputTokens: 20,
        outputTokens: 10,
        totalTokens: 30,
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
    const baseUrl = await startServer({ run });
    const response = await fetch(`${baseUrl}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "  Конвертуй 100 USD у UAH  " }),
    });

    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledWith("Конвертуй 100 USD у UAH");
    expect(await response.json()).toMatchObject({
      status: "success",
      metrics: {
        modelCallCount: 2,
        toolCallCount: 1,
      },
    });
  });

  it("повертає 503, якщо runtime не підключено", async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Конвертуй 100 USD у UAH" }),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "SERVICE_UNAVAILABLE" },
    });
  });
});
