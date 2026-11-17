import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { createApp, type AppDependencies } from "../src/app.js";
import { DocumentAiError } from "../src/lib/errors.js";
import type { DocumentAi, SummaryStreamEvent } from "../src/services/document-ai.js";

const successfulStream: SummaryStreamEvent[] = [
  { type: "delta", delta: "Короткий підсумок." },
  {
    type: "completed",
    model: "test-fast",
    usage: {
      input_tokens: 100,
      output_tokens: 20,
      total_tokens: 120,
      input_tokens_details: { cached_tokens: 25, cache_write_tokens: 0 },
    },
  },
];

function createFakeAi(options?: {
  stream?: readonly SummaryStreamEvent[];
  streamError?: Error;
}): DocumentAi {
  return {
    extract: async () => {
      throw new DocumentAiError("NOT_IMPLEMENTED", "Не реалізовано.", 501);
    },
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
  dependencies: AppDependencies,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server: Server = createApp(dependencies).listen(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
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

describe("streaming checkpoint", () => {
  it("keeps health working and extraction explicitly pending", async () => {
    const server = await startTestServer({ ai: createFakeAi() });

    try {
      const health = await fetch(`${server.baseUrl}/health`);
      const extraction = await postJson(server.baseUrl, "/api/documents/extract", {
        content: "Синтетичний документ.",
      });

      await expect(health.json()).resolves.toEqual({ status: "ok" });
      expect(extraction.status).toBe(501);
      await expect(extraction.json()).resolves.toMatchObject({
        error: { code: "NOT_IMPLEMENTED" },
      });
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

      expect(response.headers.get("content-type")).toContain("text/event-stream");
      expect(body).toContain('event: delta\ndata: {"delta":"Короткий підсумок."}');
      expect(body).toContain('"ttftMs":25');
      expect(body).toContain('"totalLatencyMs":80');
      expect(body).toContain('event: done\ndata: {"status":"completed"}');
    } finally {
      await server.close();
    }
  });

  it.each([
    {
      label: "incomplete",
      events: [{ type: "incomplete", reason: "max_output_tokens" }] as const,
      code: "INCOMPLETE_RESPONSE",
    },
    {
      label: "refusal",
      events: [{ type: "refused" }, { type: "completed", model: "test-fast" }] as const,
      code: "REQUEST_REFUSED",
    },
    {
      label: "missing terminal event",
      events: [{ type: "delta", delta: "Незавершено" }] as const,
      code: "STREAM_ENDED_UNEXPECTEDLY",
    },
  ])("emits error without done for $label", async ({ events, code }) => {
    const server = await startTestServer({
      ai: createFakeAi({ stream: events }),
    });

    try {
      const response = await postJson(server.baseUrl, "/api/documents/summary/stream", {
        content: "Синтетичний документ.",
      });
      const body = await response.text();

      expect(body).toContain(`"code":"${code}"`);
      expect(body).not.toContain("event: done");
    } finally {
      await server.close();
    }
  });

  it("maps a typed stream exception to SSE error", async () => {
    const server = await startTestServer({
      ai: createFakeAi({
        streamError: new DocumentAiError(
          "GATEWAY_TIMEOUT",
          "Перевищено час очікування відповіді OpenAI API.",
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
});
