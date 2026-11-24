import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { DocumentAi } from "../../../lesson-03-function-calling/solution/src/services/document-ai.js";
import type { ToolCallingAgent } from "../../../lesson-03-function-calling/solution/src/services/tool-calling-agent.js";

const documentAi: DocumentAi = {
  extract: vi.fn(),
  async *streamSummary() {
    return;
  },
};

async function startServer(
  mcpAgent?: ToolCallingAgent,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const app = createApp({
    ai: documentAi,
    ...(mcpAgent === undefined ? {} : { mcpAgent }),
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

async function postJson(baseUrl: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}/api/agent/research`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/agent/research", () => {
  it("зберігає health endpoint попереднього проєкту", async () => {
    const server = await startServer();

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
    const server = await startServer({ run });

    try {
      const response = await postJson(server.baseUrl, { message: "   " });

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
    const server = await startServer({ run });

    try {
      const response = await postJson(server.baseUrl, {
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
    const server = await startServer({ run });

    try {
      const response = await postJson(server.baseUrl, { message: "Прочитай файл." });
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
