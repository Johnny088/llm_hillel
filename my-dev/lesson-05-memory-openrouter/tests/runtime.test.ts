import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadEnvironment } from "../src/config/env.js";
import type { LocalMcpClient } from "../src/mcp/filesystem-client.js";
import { createLesson05Runtime } from "../src/runtime.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "lesson05-runtime-"));
  temporaryDirectories.push(directory);
  return directory;
}

function createEnvironment() {
  return loadEnvironment({
    OPENROUTER_API_KEY: "synthetic-test-key",
    OPENROUTER_MODEL: "synthetic-test-model",
    PORT: "3000",
  });
}

function createMcpClient(close: () => Promise<void>): LocalMcpClient {
  return {
    processId: 12345,
    listTools: async () => [],
    callTool: async () => ({ content: [] }),
    close,
  };
}

describe("Lesson 05 OpenRouter runtime lifecycle", () => {
  it("resolves default JSON paths beside its own runtime module", async () => {
    const close = vi.fn(async () => undefined);
    const runtime = await createLesson05Runtime(createEnvironment(), {
      createFilesystemMcpClient: async () => createMcpClient(close),
    });
    const manager = runtime.conversationManager as unknown as {
      historyStore: { filePath: string };
      chatClient: { userFactStore: { filePath: string } };
    };
    const runtimeDirectory = dirname(fileURLToPath(new URL("../src/runtime.ts", import.meta.url)));

    expect(manager.historyStore.filePath).toBe(
      resolve(runtimeDirectory, "../data", "conversation-history.json"),
    );
    expect(manager.chatClient.userFactStore.filePath).toBe(
      resolve(runtimeDirectory, "../data", "user-memory.json"),
    );
    await runtime.close();
  });

  it("closes the connected MCP client when memory manager setup rejects invalid configuration", async () => {
    const directory = await createTemporaryDirectory();
    const close = vi.fn(async () => undefined);
    const createFilesystemMcpClient = vi.fn(async () => createMcpClient(close));

    await expect(
      createLesson05Runtime(createEnvironment(), {
        userFactsPath: join(directory, "facts.json"),
        conversationHistoryPath: join(directory, "history.json"),
        maxHistoryTurns: 0,
        createFilesystemMcpClient,
      }),
    ).rejects.toThrow("maxHistoryTurns має бути додатним цілим числом.");

    expect(createFilesystemMcpClient).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("creates local conversation dependencies and closes the inherited MCP runtime once", async () => {
    const directory = await createTemporaryDirectory();
    const close = vi.fn(async () => undefined);
    const runtime = await createLesson05Runtime(createEnvironment(), {
      userFactsPath: join(directory, "facts.json"),
      conversationHistoryPath: join(directory, "history.json"),
      maxHistoryTurns: 2,
      createFilesystemMcpClient: async () => createMcpClient(close),
    });

    expect(runtime.dependencies.conversationManager).toBe(runtime.conversationManager);
    await runtime.close();
    await runtime.close();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
