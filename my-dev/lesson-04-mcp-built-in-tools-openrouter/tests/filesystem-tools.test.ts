import type {
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";
import { describe, expect, it, vi } from "vitest";
import type { ListedMcpTool, LocalMcpClient } from "../src/mcp/filesystem-client.js";
import { createMcpChatTools, executeMcpToolCall } from "../src/mcp/filesystem-tools.js";

function createClient(callToolResult: unknown = { content: [] }): LocalMcpClient {
  return {
    listTools: vi.fn().mockResolvedValue([]),
    callTool: vi.fn().mockResolvedValue(callToolResult),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function createFunctionCall(
  name: string,
  argumentsValue: unknown,
  callId: string = "call_1",
): ChatCompletionMessageFunctionToolCall {
  return {
    id: callId,
    type: "function",
    function: {
      name,
      arguments:
        typeof argumentsValue === "string" ? argumentsValue : JSON.stringify(argumentsValue),
    },
  };
}

function parseOutput(output: ChatCompletionToolMessageParam): Record<string, unknown> {
  if (typeof output.content !== "string") {
    throw new TypeError("У тесті очікується текстовий content у tool message.");
  }

  return JSON.parse(output.content) as Record<string, unknown>;
}

describe("MCP tool adapter (OpenRouter)", () => {
  it("передає моделі лише read_text_file та відфільтровує інші MCP tools", () => {
    const listedTools: ListedMcpTool[] = [
      {
        name: "read_text_file",
        description: "Read text",
        inputSchema: { type: "object", properties: { path: { type: "string" } } },
      },
      {
        name: "list_allowed_directories",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "write_file",
        inputSchema: { type: "object", properties: {} },
      },
    ];

    expect(createMcpChatTools(listedTools)).toEqual([
      {
        type: "function",
        function: {
          name: "read_text_file",
          description: "Read text",
          parameters: listedTools[0]?.inputSchema,
          strict: false,
        },
      },
    ]);
  });

  it("повторно блокує інструмент поза allowlist до MCP-виклику", async () => {
    const client = createClient();
    const output = await executeMcpToolCall(
      createFunctionCall("write_file", { path: "notes.txt", content: "secret" }),
      client,
    );

    expect(parseOutput(output)).toMatchObject({
      status: "error",
      code: "MCP_TOOL_NOT_ALLOWED",
    });
    expect(client.callTool).not.toHaveBeenCalled();
  });

  it("відхиляє невалідні аргументи до MCP-виклику", async () => {
    const client = createClient();
    const output = await executeMcpToolCall(createFunctionCall("read_text_file", "[]"), client);

    expect(parseOutput(output)).toMatchObject({
      status: "error",
      code: "INVALID_TOOL_ARGUMENTS",
    });
    expect(client.callTool).not.toHaveBeenCalled();
  });

  it.each([
    ["missing path", {}],
    ["blank path", { path: "   " }],
    ["negative head", { path: "notes.txt", head: -1 }],
    ["fractional tail", { path: "notes.txt", tail: 1.5 }],
    ["both head and tail", { path: "notes.txt", head: 1, tail: 1 }],
    ["unsupported option", { path: "notes.txt", encoding: "utf8" }],
  ])("rejects malformed read_text_file fields before RPC: %s", async (_caseName, args) => {
    const client = createClient();
    const output = await executeMcpToolCall(createFunctionCall("read_text_file", args), client);

    expect(parseOutput(output)).toMatchObject({
      status: "error",
      code: "INVALID_TOOL_ARGUMENTS",
    });
    expect(client.callTool).not.toHaveBeenCalled();
  });

  it("повертає текст дозволеного MCP-результату", async () => {
    const client = createClient({
      content: [{ type: "text", text: "Локальні нотатки курсу." }],
    });
    const output = await executeMcpToolCall(
      createFunctionCall("read_text_file", { path: "notes.txt" }),
      client,
    );

    expect(parseOutput(output)).toEqual({
      status: "success",
      content: "Локальні нотатки курсу.",
    });
    expect(client.callTool).toHaveBeenCalledWith({
      name: "read_text_file",
      arguments: { path: "notes.txt" },
    });
  });

  it("перетворює відмову sandbox на стабільну помилку без витоку шляху", async () => {
    const secretPath = "C:\\Users\\student\\.env";
    const client = createClient({
      isError: true,
      content: [
        {
          type: "text",
          text: `Access denied - path outside allowed directories: ${secretPath}`,
        },
      ],
    });
    const output = await executeMcpToolCall(
      createFunctionCall("read_text_file", { path: secretPath }),
      client,
    );
    const serialized = JSON.stringify(parseOutput(output));

    expect(serialized).toContain("MCP_ACCESS_DENIED");
    expect(serialized).not.toContain(secretPath);
  });
});
