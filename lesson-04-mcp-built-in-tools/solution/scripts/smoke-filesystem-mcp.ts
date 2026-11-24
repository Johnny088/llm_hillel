import { resolve } from "node:path";
import { connectFilesystemMcp } from "../src/mcp/filesystem-client.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isErrorResult(value: unknown): boolean {
  return isRecord(value) && value.isError === true;
}

function extractText(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.content)) {
    return "";
  }

  return value.content
    .flatMap((item) =>
      isRecord(item) && item.type === "text" && typeof item.text === "string" ? [item.text] : [],
    )
    .join("\n");
}

const sandboxPath = resolve("lesson-04-mcp-built-in-tools", "solution", "sandbox");
const client = await connectFilesystemMcp(sandboxPath);

try {
  const tools = await client.listTools();
  const toolNames = new Set(tools.map((tool) => tool.name));

  // Raw server discovery can expose service tools that the model-facing adapter filters out.
  if (!toolNames.has("read_text_file") || !toolNames.has("list_allowed_directories")) {
    throw new Error("Filesystem MCP server не надав очікувані service tools.");
  }

  const readResult = await client.callTool({
    name: "read_text_file",
    arguments: { path: "notes.txt" },
  });

  if (isErrorResult(readResult) || !extractText(readResult).includes("Model Context Protocol")) {
    throw new Error("Дозволений файл не прочитано через MCP.");
  }

  const deniedResult = await client.callTool({
    name: "read_text_file",
    arguments: { path: resolve(".env.example") },
  });

  if (!isErrorResult(deniedResult)) {
    throw new Error("Filesystem MCP server не заблокував шлях поза sandbox.");
  }

  console.log("PASS filesystem MCP: server discovery, sandbox read, outside-path denial");
} finally {
  await client.close();
}
