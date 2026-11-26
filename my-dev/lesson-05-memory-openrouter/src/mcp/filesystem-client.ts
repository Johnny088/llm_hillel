import { createRequire } from "node:module";
import { dirname, isAbsolute, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const require = createRequire(import.meta.url);
const filesystemPackageJson =
  require.resolve("@modelcontextprotocol/server-filesystem/package.json");
const filesystemServerEntrypoint = resolve(dirname(filesystemPackageJson), "dist", "index.js");

export interface ListedMcpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface LocalMcpClient {
  readonly processId?: number | undefined;
  listTools(): Promise<ListedMcpTool[]>;
  callTool(request: { name: string; arguments?: Record<string, unknown> }): Promise<unknown>;
  close(): Promise<void>;
}

class FilesystemMcpClient implements LocalMcpClient {
  public constructor(
    private readonly client: Client,
    private readonly transport: StdioClientTransport,
    private readonly sandboxPath: string,
  ) {}

  public get processId(): number | undefined {
    return this.transport.pid ?? undefined;
  }

  public async listTools(): Promise<ListedMcpTool[]> {
    const result = await this.client.listTools();

    return result.tools.map((tool) => ({
      name: tool.name,
      inputSchema: tool.inputSchema,
      ...(tool.description === undefined ? {} : { description: tool.description }),
    }));
  }

  public async callTool(request: {
    name: string;
    arguments?: Record<string, unknown>;
  }): Promise<unknown> {
    const args = { ...(request.arguments ?? {}) };

    if (
      request.name === "read_text_file" &&
      typeof args.path === "string" &&
      !isAbsolute(args.path)
    ) {
      args.path = resolve(this.sandboxPath, args.path);
    }

    return this.client.callTool({
      name: request.name,
      arguments: args,
    });
  }

  public async close(): Promise<void> {
    const errors: unknown[] = [];

    try {
      await this.client.close();
    } catch (error: unknown) {
      errors.push(error);
    }

    try {
      await this.transport.close();
    } catch (error: unknown) {
      errors.push(error);
    }

    if (errors.length > 0) {
      throw new Error("Не вдалося коректно закрити локальний filesystem MCP server.");
    }
  }
}

export async function connectFilesystemMcp(sandboxPath: string): Promise<LocalMcpClient> {
  const absoluteSandboxPath = resolve(sandboxPath);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [filesystemServerEntrypoint, absoluteSandboxPath],
    stderr: "pipe",
  });
  const client = new Client({ name: "course-mcp-agent", version: "1.0.0" }, { capabilities: {} });

  try {
    await client.connect(transport);
    return new FilesystemMcpClient(client, transport, absoluteSandboxPath);
  } catch {
    await closeAfterFailedConnect(client, transport);
    throw new Error("Не вдалося під’єднатися до локального filesystem MCP server.");
  }
}

async function closeAfterFailedConnect(
  client: Client,
  transport: StdioClientTransport,
): Promise<void> {
  try {
    await client.close();
  } catch {
    // The transport is closed independently below if client shutdown fails.
  }

  try {
    await transport.close();
  } catch {
    // Do not expose transport details or local paths during startup cleanup.
  }
}
