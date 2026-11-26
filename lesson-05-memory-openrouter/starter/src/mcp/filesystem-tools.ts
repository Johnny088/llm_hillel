import type {
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";
import type { ListedMcpTool, LocalMcpClient } from "./filesystem-client.js";

export const LOCAL_MCP_TOOL_ALLOWLIST: ReadonlySet<string> = new Set(["read_text_file"]);

export type McpToolErrorCode =
  "INVALID_TOOL_ARGUMENTS" | "MCP_ACCESS_DENIED" | "MCP_TOOL_ERROR" | "MCP_TOOL_NOT_ALLOWED";

export interface McpToolOutput {
  status: "success" | "error";
  content?: string;
  code?: McpToolErrorCode;
  message?: string;
}

export function createMcpChatTools(listedTools: readonly ListedMcpTool[]): ChatCompletionTool[] {
  return listedTools
    .filter((tool) => LOCAL_MCP_TOOL_ALLOWLIST.has(tool.name))
    .map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        parameters: tool.inputSchema,
        strict: false,
        ...(tool.description === undefined ? {} : { description: tool.description }),
      },
    }));
}

export async function executeMcpToolCall(
  call: ChatCompletionMessageFunctionToolCall,
  client: LocalMcpClient,
): Promise<ChatCompletionToolMessageParam> {
  if (!LOCAL_MCP_TOOL_ALLOWLIST.has(call.function.name)) {
    return createToolOutput(call.id, {
      status: "error",
      code: "MCP_TOOL_NOT_ALLOWED",
      message: "Інструмент заблоковано локальною політикою доступу.",
    });
  }

  let parsedArguments: unknown;

  try {
    parsedArguments = JSON.parse(call.function.arguments);
  } catch {
    return createToolOutput(call.id, {
      status: "error",
      code: "INVALID_TOOL_ARGUMENTS",
      message: "Аргументи інструмента не є валідним JSON-об’єктом.",
    });
  }

  if (!isRecord(parsedArguments)) {
    return createToolOutput(call.id, {
      status: "error",
      code: "INVALID_TOOL_ARGUMENTS",
      message: "Аргументи інструмента не є валідним JSON-об’єктом.",
    });
  }

  if (call.function.name === "read_text_file" && !isReadTextFileArguments(parsedArguments)) {
    return createToolOutput(call.id, {
      status: "error",
      code: "INVALID_TOOL_ARGUMENTS",
      message: "Аргументи read_text_file мають містити path та лише підтримувані поля.",
    });
  }

  try {
    const result = await client.callTool({
      name: call.function.name,
      arguments: parsedArguments,
    });

    return createToolOutput(call.id, normalizeMcpResult(result));
  } catch (error: unknown) {
    console.error("[MCP Tool Error]", {
      toolName: call.function.name,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return createToolOutput(call.id, {
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

function createToolOutput(callId: string, payload: McpToolOutput): ChatCompletionToolMessageParam {
  return {
    role: "tool",
    tool_call_id: callId,
    content: JSON.stringify(payload),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReadTextFileArguments(value: Record<string, unknown>): boolean {
  const allowedKeys = new Set(["path", "head", "tail"]);

  if (
    Object.keys(value).some((key) => !allowedKeys.has(key)) ||
    typeof value.path !== "string" ||
    value.path.trim() === ""
  ) {
    return false;
  }

  const hasHead = Object.hasOwn(value, "head");
  const hasTail = Object.hasOwn(value, "tail");

  if (hasHead && hasTail) {
    return false;
  }

  return [value.head, value.tail].every(
    (lineCount) =>
      lineCount === undefined ||
      (typeof lineCount === "number" && Number.isSafeInteger(lineCount) && lineCount >= 0),
  );
}
