import type {
  FunctionTool,
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses";
import type { ListedMcpTool, LocalMcpClient } from "./filesystem-client.js";

export const LOCAL_MCP_TOOL_ALLOWLIST: ReadonlySet<string> = new Set(["read_text_file"]);

type McpToolErrorCode =
  "INVALID_TOOL_ARGUMENTS" | "MCP_ACCESS_DENIED" | "MCP_TOOL_ERROR" | "MCP_TOOL_NOT_ALLOWED";

interface McpToolOutput {
  status: "success" | "error";
  content?: string;
  code?: McpToolErrorCode;
  message?: string;
}

export function createMcpFunctionTools(listedTools: readonly ListedMcpTool[]): FunctionTool[] {
  return listedTools
    .filter((tool) => LOCAL_MCP_TOOL_ALLOWLIST.has(tool.name))
    .map((tool) => ({
      type: "function",
      name: tool.name,
      parameters: tool.inputSchema,
      strict: false,
      ...(tool.description === undefined ? {} : { description: tool.description }),
    }));
}

export async function executeMcpToolCall(
  call: ResponseFunctionToolCall,
  client: LocalMcpClient,
): Promise<ResponseInputItem.FunctionCallOutput> {
  if (!LOCAL_MCP_TOOL_ALLOWLIST.has(call.name)) {
    return createToolOutput(call.call_id, {
      status: "error",
      code: "MCP_TOOL_NOT_ALLOWED",
      message: "Інструмент заблоковано локальною політикою доступу.",
    });
  }

  let parsedArguments: unknown;

  try {
    parsedArguments = JSON.parse(call.arguments);
  } catch {
    return createToolOutput(call.call_id, {
      status: "error",
      code: "INVALID_TOOL_ARGUMENTS",
      message: "Аргументи інструмента не є валідним JSON-об’єктом.",
    });
  }

  if (!isRecord(parsedArguments)) {
    return createToolOutput(call.call_id, {
      status: "error",
      code: "INVALID_TOOL_ARGUMENTS",
      message: "Аргументи інструмента не є валідним JSON-об’єктом.",
    });
  }

  try {
    const result = await client.callTool({
      name: call.name,
      arguments: parsedArguments,
    });

    return createToolOutput(call.call_id, normalizeMcpResult(result));
  } catch (error: unknown) {
    console.error("[MCP Tool Error]", {
      toolName: call.name,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return createToolOutput(call.call_id, {
      status: "error",
      code: "MCP_TOOL_ERROR",
      message: "MCP-сервер не виконав операцію.",
    });
  }
}

function normalizeMcpResult(result: unknown): McpToolOutput {
  if (!isRecord(result) || !Array.isArray(result.content)) {
    return {
      status: "error",
      code: "MCP_TOOL_ERROR",
      message: "MCP-сервер повернув неочікуваний формат відповіді.",
    };
  }

  const text = result.content
    .flatMap((item) =>
      isRecord(item) && item.type === "text" && typeof item.text === "string" ? [item.text] : [],
    )
    .join("\n");

  if (result.isError === true) {
    const normalizedText = text.toLowerCase();
    const accessDenied =
      normalizedText.includes("access denied") ||
      normalizedText.includes("outside allowed directories") ||
      normalizedText.includes("not allowed");

    return accessDenied
      ? {
          status: "error",
          code: "MCP_ACCESS_DENIED",
          message: "Доступ до шляху поза навчальною sandbox-папкою заборонено.",
        }
      : {
          status: "error",
          code: "MCP_TOOL_ERROR",
          message: "MCP-сервер не виконав операцію.",
        };
  }

  return {
    status: "success",
    content: text,
  };
}

function createToolOutput(
  callId: string,
  payload: McpToolOutput,
): ResponseInputItem.FunctionCallOutput {
  return {
    type: "function_call_output",
    call_id: callId,
    output: JSON.stringify(payload),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
