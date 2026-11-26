import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const filesystemMcpMocks = vi.hoisted(() => ({
  connect: vi.fn(),
  clientClose: vi.fn(),
  listTools: vi.fn(),
  callTool: vi.fn(),
  transportClose: vi.fn(),
  transportConstructor: vi.fn(),
}));

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class {
    public constructor(..._args: unknown[]) {}

    public connect(transport: unknown): Promise<void> {
      return filesystemMcpMocks.connect(transport) as Promise<void>;
    }

    public close(): Promise<void> {
      return filesystemMcpMocks.clientClose() as Promise<void>;
    }

    public listTools(): Promise<unknown> {
      return filesystemMcpMocks.listTools() as Promise<unknown>;
    }

    public callTool(request: unknown): Promise<unknown> {
      return filesystemMcpMocks.callTool(request) as Promise<unknown>;
    }
  },
}));

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: class {
    public readonly pid = 4242;

    public constructor(options: unknown) {
      filesystemMcpMocks.transportConstructor(options);
    }

    public close(): Promise<void> {
      return filesystemMcpMocks.transportClose() as Promise<void>;
    }
  },
}));

import { connectFilesystemMcp } from "../src/mcp/filesystem-client.js";

beforeEach(() => {
  vi.resetAllMocks();
  filesystemMcpMocks.connect.mockResolvedValue(undefined);
  filesystemMcpMocks.clientClose.mockResolvedValue(undefined);
  filesystemMcpMocks.listTools.mockResolvedValue({ tools: [] });
  filesystemMcpMocks.callTool.mockResolvedValue({ content: [] });
  filesystemMcpMocks.transportClose.mockResolvedValue(undefined);
});

describe("filesystem MCP client lifecycle", () => {
  it("uses the installed server with the current Node executable", async () => {
    const sandbox = "D:/synthetic/allowed";
    const client = await connectFilesystemMcp(sandbox);
    const options = filesystemMcpMocks.transportConstructor.mock.calls[0]?.[0] as {
      command: string;
      args: string[];
    };

    expect(options.command).toBe(process.execPath);
    expect(options.args[0]).toContain("server-filesystem");
    expect(options.args[1]).toBe(resolve(sandbox));
    expect(client.processId).toBe(4242);
  });

  it("closes client and transport after connection failure without leaking details", async () => {
    const localPath = "private-synthetic-directory";
    filesystemMcpMocks.connect.mockRejectedValue(new Error(localPath));
    filesystemMcpMocks.clientClose.mockRejectedValue(new Error(localPath));
    filesystemMcpMocks.transportClose.mockRejectedValue(new Error(localPath));

    let publicError: unknown;
    try {
      await connectFilesystemMcp(localPath);
    } catch (error: unknown) {
      publicError = error;
    }

    expect(publicError).toBeInstanceOf(Error);
    expect((publicError as Error).message).toBe(
      "Не вдалося під’єднатися до локального filesystem MCP server.",
    );
    expect((publicError as Error).message).not.toContain(localPath);
    expect(filesystemMcpMocks.clientClose).toHaveBeenCalledTimes(1);
    expect(filesystemMcpMocks.transportClose).toHaveBeenCalledTimes(1);
  });

  it("still closes transport when client shutdown fails and exposes a safe error", async () => {
    const localPath = "private-synthetic-directory";
    const client = await connectFilesystemMcp(localPath);
    filesystemMcpMocks.clientClose.mockRejectedValue(new Error(localPath));
    filesystemMcpMocks.transportClose.mockRejectedValue(new Error(localPath));

    let publicError: unknown;
    try {
      await client.close();
    } catch (error: unknown) {
      publicError = error;
    }

    expect(publicError).toBeInstanceOf(Error);
    expect((publicError as Error).message).toBe(
      "Не вдалося коректно закрити локальний filesystem MCP server.",
    );
    expect((publicError as Error).message).not.toContain(localPath);
    expect(filesystemMcpMocks.clientClose).toHaveBeenCalledTimes(1);
    expect(filesystemMcpMocks.transportClose).toHaveBeenCalledTimes(1);
  });
});
