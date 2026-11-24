import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import type { ChatCompletionMessageFunctionToolCall } from "openai/resources/chat/completions";
import type { LocalMcpClient } from "../src/mcp/filesystem-client.js";
import { connectFilesystemMcp } from "../src/mcp/filesystem-client.js";
import { createMcpChatTools, executeMcpToolCall } from "../src/mcp/filesystem-tools.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOutput(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || typeof value.content !== "string") {
    throw new Error("MCP tool returned an invalid result.");
  }

  return JSON.parse(value.content) as Record<string, unknown>;
}

function createCall(
  name: string,
  args: Record<string, unknown>,
): ChatCompletionMessageFunctionToolCall {
  return {
    id: `smoke-${name}`,
    type: "function",
    function: { name, arguments: JSON.stringify(args) },
  };
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForProcessExit(processId: number): Promise<void> {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    try {
      process.kill(processId, 0);
    } catch (error: unknown) {
      if (isRecord(error) && error.code === "ESRCH") {
        return;
      }

      throw new Error("Could not verify filesystem MCP subprocess shutdown.");
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }

  throw new Error("Filesystem MCP subprocess did not exit after close.");
}

const fixtureParent = resolve(process.cwd(), ".tmp", "lesson04-mcp-smoke");
await mkdir(fixtureParent, { recursive: true });
const fixturePath = await mkdtemp(join(fixtureParent, "run-"));
const fixtureRoot = resolve(fixturePath);
const fixtureParentWithSeparator = `${resolve(fixtureParent)}${sep}`;

assert(
  fixtureRoot.startsWith(fixtureParentWithSeparator),
  "Synthetic MCP fixture escaped its dedicated temporary folder.",
);

const allowedDirectory = join(fixtureRoot, "allowed");
const outsideDirectory = join(fixtureRoot, "outside");
let client: LocalMcpClient | undefined;
let processId: number | undefined;
let clientClosed = false;

try {
  await mkdir(allowedDirectory, { recursive: true });
  await mkdir(outsideDirectory, { recursive: true });
  await writeFile(join(allowedDirectory, "allowed.txt"), "Synthetic allowed note.", "utf8");
  await writeFile(join(outsideDirectory, "outside.txt"), "Synthetic outside note.", "utf8");

  client = await connectFilesystemMcp(allowedDirectory);
  processId = client.processId;
  assert(processId !== undefined, "Filesystem MCP subprocess PID was unavailable.");

  const discoveredTools = await client.listTools();
  const modelTools = createMcpChatTools(discoveredTools);
  const [onlyModelTool] = modelTools;
  assert(
    modelTools.length === 1 &&
      onlyModelTool?.type === "function" &&
      onlyModelTool.function.name === "read_text_file",
    "Model-facing MCP tools did not match the read-only allowlist.",
  );

  let dispatchCount = 0;
  const countedClient: LocalMcpClient = {
    processId,
    listTools: () => client!.listTools(),
    callTool: (request) => {
      dispatchCount += 1;
      return client!.callTool(request);
    },
    close: () => client!.close(),
  };

  const allowedOutput = parseOutput(
    await executeMcpToolCall(createCall("read_text_file", { path: "allowed.txt" }), countedClient),
  );
  assert(
    allowedOutput.status === "success" && allowedOutput.content === "Synthetic allowed note.",
    "Allowed synthetic file was not read through MCP.",
  );

  const deniedPaths = [join(outsideDirectory, "outside.txt"), "../outside/outside.txt"];

  for (const deniedPath of deniedPaths) {
    const deniedOutput = parseOutput(
      await executeMcpToolCall(createCall("read_text_file", { path: deniedPath }), countedClient),
    );
    const serialized = JSON.stringify(deniedOutput);

    assert(
      deniedOutput.code === "MCP_ACCESS_DENIED" && !serialized.includes(fixtureRoot),
      "Outside or traversal path was not safely denied.",
    );
  }

  const beforeForbiddenTool = dispatchCount;
  const forbiddenOutput = parseOutput(
    await executeMcpToolCall(
      createCall("write_file", { path: "allowed.txt", content: "should not dispatch" }),
      countedClient,
    ),
  );
  assert(
    forbiddenOutput.code === "MCP_TOOL_NOT_ALLOWED" && dispatchCount === beforeForbiddenTool,
    "Forbidden MCP tool reached the subprocess before local rejection.",
  );

  await client.close();
  clientClosed = true;
  await waitForProcessExit(processId);
  console.log(
    "PASS filesystem MCP: synthetic read, boundary denial, allowlist, subprocess cleanup",
  );
} finally {
  let cleanupFailure: unknown;

  try {
    if (client !== undefined && !clientClosed) {
      await client.close();
    }

    if (processId !== undefined) {
      await waitForProcessExit(processId);
    }
  } catch (error: unknown) {
    cleanupFailure = error;
  } finally {
    if (fixtureRoot.startsWith(fixtureParentWithSeparator)) {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  }

  if (cleanupFailure !== undefined) {
    throw cleanupFailure;
  }
}
