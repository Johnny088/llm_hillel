import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface ListedMcpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface LocalMcpClient {
  listTools(): Promise<ListedMcpTool[]>;
  callTool(request: { name: string; arguments?: Record<string, unknown> }): Promise<unknown>;
  close(): Promise<void>;
}

class FilesystemMcpClient implements LocalMcpClient {
  public constructor(private readonly client: Client) {}

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
    return this.client.callTool(request);
  }

  public async close(): Promise<void> {
    await this.client.close();
  }
}

export async function connectFilesystemMcp(sandboxPath: string): Promise<LocalMcpClient> {
  const isWindows = process.platform === "win32";
  const transport = new StdioClientTransport({
    command: isWindows ? "cmd.exe" : "npx",
    args: isWindows
      ? ["/c", "npx", "-y", "@modelcontextprotocol/server-filesystem", sandboxPath]
      : ["-y", "@modelcontextprotocol/server-filesystem", sandboxPath],
  });
  const client = new Client({ name: "course-mcp-agent", version: "1.0.0" }, { capabilities: {} });

  await client.connect(transport);

  return new FilesystemMcpClient(client);
}
