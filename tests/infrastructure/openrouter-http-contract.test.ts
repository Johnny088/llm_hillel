import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync } from "node:fs";
import type { AddressInfo } from "node:net";
import OpenAI from "openai";
import { describe, expect, it } from "vitest";
import type { OpenRouterDocumentAi } from "../../lesson-02-llm-api-openrouter/solution/src/services/openrouter-document-ai.js";
import type { SummaryStreamEvent } from "../../lesson-02-llm-api-openrouter/solution/src/services/document-ai.js";

const adapterSource = new URL(
  "../../lesson-02-llm-api-openrouter/solution/src/services/openrouter-document-ai.ts",
  import.meta.url,
);

const MODEL = "~deepseek/deepseek-v4-flash-latest";
const MAX_COMPLETION_TOKENS = 733;
const INPUT = "Олена Коваль була в Львові 14 липня.";

interface CapturedRequest {
  method: string;
  url: string | undefined;
  body: Record<string, unknown>;
}

function writeSseResponse(response: ServerResponse): void {
  response.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  response.write(
    `data: ${JSON.stringify({
      id: "chatcmpl-local-stream",
      object: "chat.completion.chunk",
      created: 1,
      model: MODEL,
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: "Короткий підсумок." },
          finish_reason: null,
        },
      ],
    })}\n\n`,
  );
  response.write(
    `data: ${JSON.stringify({
      id: "chatcmpl-local-stream",
      object: "chat.completion.chunk",
      created: 1,
      model: MODEL,
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    })}\n\n`,
  );
  response.end("data: [DONE]\n\n");
}

function writeStructuredResponse(response: ServerResponse): void {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      id: "chatcmpl-local-extraction",
      object: "chat.completion",
      created: 1,
      model: MODEL,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              names: ["Олена Коваль"],
              dates: ["14 липня"],
              locations: ["Львові"],
              summary: INPUT,
            }),
          },
          finish_reason: "stop",
        },
      ],
    }),
  );
}

async function captureRequests<T>(
  run: (baseURL: string, requests: CapturedRequest[]) => Promise<T>,
): Promise<T> {
  const requests: CapturedRequest[] = [];
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    let bodyText = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      bodyText += chunk;
    });
    request.on("end", () => {
      requests.push({
        method: request.method ?? "",
        url: request.url,
        body: JSON.parse(bodyText) as Record<string, unknown>,
      });
      if ((requests.at(-1)?.body.stream as boolean | undefined) === true) {
        writeSseResponse(response);
      } else {
        writeStructuredResponse(response);
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  try {
    const address = server.address() as AddressInfo;
    return await run(`http://127.0.0.1:${address.port}/v1`, requests);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function createAdapter(baseURL: string): Promise<OpenRouterDocumentAi> {
  const { OpenRouterDocumentAi } = (await import(
    adapterSource.href
  )) as typeof import("../../lesson-02-llm-api-openrouter/solution/src/services/openrouter-document-ai.js");
  const client = new OpenAI({
    apiKey: "loopback-test-key",
    baseURL,
    maxRetries: 0,
  });
  return new OpenRouterDocumentAi(client, {
    fastModel: MODEL,
    mainModel: MODEL,
    maxOutputTokens: MAX_COMPLETION_TOKENS,
    reasoningEffort: "high",
  });
}

function expectCompletionTokenContract(body: Record<string, unknown>): void {
  expect(body.max_completion_tokens).toBe(MAX_COMPLETION_TOKENS);
  expect(body).not.toHaveProperty("max_tokens");
  expect(body.model).toBe(MODEL);
  expect(body.temperature).toBe(0);
  expect(body.reasoning).toEqual({ effort: "high", exclude: true });
}

describe.skipIf(!existsSync(adapterSource))("OpenRouter HTTP completion token contract", () => {
  it("serializes the streaming request through the installed OpenAI SDK", async () => {
    await captureRequests(async (baseURL, requests) => {
      const adapter = await createAdapter(baseURL);

      const events: SummaryStreamEvent[] = [];
      for await (const event of adapter.streamSummary(INPUT, new AbortController().signal)) {
        events.push(event);
      }

      expect(events).toContainEqual({ type: "delta", delta: "Короткий підсумок." });
      expect(events.at(-1)?.type).toBe("completed");
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({ method: "POST", url: "/v1/chat/completions" });
      expectCompletionTokenContract(requests[0]!.body);
      expect(requests[0]!.body.stream).toBe(true);
    });
  });

  it("serializes structured output with strict provider routing and the same budget", async () => {
    await captureRequests(async (baseURL, requests) => {
      const adapter = await createAdapter(baseURL);

      const result = await adapter.extract(INPUT);

      expect(result.data.names).toEqual(["Олена Коваль"]);
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({ method: "POST", url: "/v1/chat/completions" });
      expectCompletionTokenContract(requests[0]!.body);
      expect(requests[0]!.body.provider).toEqual({ require_parameters: true });
      expect(requests[0]!.body.response_format).toMatchObject({
        type: "json_schema",
        json_schema: { name: "document_extraction", strict: true },
      });
      expect(requests[0]!.body.stream).toBeUndefined();
    });
  });
});
