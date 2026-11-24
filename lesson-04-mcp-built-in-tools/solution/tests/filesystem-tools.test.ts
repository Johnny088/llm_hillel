import type {
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses";
import { describe, expect, it, vi } from "vitest";
import type { ListedMcpTool, LocalMcpClient } from "../src/mcp/filesystem-client.js";
import { createMcpFunctionTools, executeMcpToolCall } from "../src/mcp/filesystem-tools.js";

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
): ResponseFunctionToolCall {
  return {
    id: `fc_${callId}`,
    type: "function_call",
    status: "completed",
    call_id: callId,
    name,
    arguments: typeof argumentsValue === "string" ? argumentsValue : JSON.stringify(argumentsValue),
  };
}

function parseOutput(output: ResponseInputItem.FunctionCallOutput): Record<string, unknown> {
  if (typeof output.output !== "string") {
    throw new TypeError("У тесті очікується текстовий function_call_output.");
  }

  return JSON.parse(output.output) as Record<string, unknown>;
}

describe("MCP tool adapter", () => {
  it("передає моделі лише явно дозволений read-only tool", () => {
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

    expect(createMcpFunctionTools(listedTools)).toEqual([
      {
        type: "function",
        name: "read_text_file",
        description: "Read text",
        parameters: listedTools[0]?.inputSchema,
        strict: false,
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
