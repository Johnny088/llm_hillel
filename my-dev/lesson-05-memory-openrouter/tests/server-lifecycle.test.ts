import { createServer, type Server } from "node:http";
import { EventEmitter, once } from "node:events";
import { createConnection, type Socket } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadEnvironment } from "../src/config/env.js";
import { startLesson04Server } from "../src/server.js";
import type { Lesson04Runtime } from "../src/runtime.js";

const activeSockets = new Set<Socket>();
const reservedServers = new Set<Server>();
const socketCloseTimeoutMs = 5_000;

function waitForSocketClose(
  socket: Socket,
  isForcedTeardown: () => boolean,
  timeoutMs = socketCloseTimeoutMs,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      clearTimeout(timeout);
      socket.removeListener("close", onClose);
      socket.removeListener("error", onError);
    };
    const onClose = (): void => {
      cleanup();
      resolve();
    };
    const onError = (error: Error): void => {
      if ((error as NodeJS.ErrnoException).code === "ECONNRESET" && isForcedTeardown()) {
        return;
      }

      cleanup();
      reject(error);
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Socket did not close within ${timeoutMs} ms.`));
    }, timeoutMs);

    socket.once("close", onClose);
    socket.on("error", onError);
  });
}

afterEach(async () => {
  for (const socket of activeSockets) {
    socket.destroy();
  }
  activeSockets.clear();

  await Promise.all(
    [...reservedServers].map(
      (server) =>
        new Promise<void>((resolve) => {
          if (!server.listening) {
            resolve();
            return;
          }

          server.close(() => resolve());
          server.closeAllConnections();
        }),
    ),
  );
  reservedServers.clear();
});

function createEnvironment(port: number) {
  return loadEnvironment({
    OPENROUTER_API_KEY: "test-only-key",
    OPENROUTER_MODEL: "test-model",
    PORT: String(port),
  });
}

function createRuntime() {
  const close = vi.fn().mockResolvedValue(undefined);
  const runtime = {
    dependencies: {
      ai: {
        async *streamSummary() {
          return;
        },
        extract: vi.fn(),
      },
    },
    close,
  } as unknown as Lesson04Runtime;

  return { runtime, close };
}

async function reservePort(): Promise<{ port: number; server: Server }> {
  const server = createServer();
  server.listen(0);
  await once(server, "listening");
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Could not allocate a local test port.");
  }

  reservedServers.add(server);
  return { port: address.port, server };
}

async function releaseReservedPort(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

describe("Lesson 04 HTTP and runtime lifecycle", () => {
  it("waits for close after a connection reset", async () => {
    const socket = new EventEmitter() as unknown as Socket;
    let closed = false;
    const socketClosed = waitForSocketClose(socket, () => true).then(() => {
      closed = true;
    });

    socket.emit("error", Object.assign(new Error("Connection reset."), { code: "ECONNRESET" }));
    await Promise.resolve();
    expect(closed).toBe(false);

    socket.emit("close", true);
    await socketClosed;

    expect(closed).toBe(true);
    expect(socket.listenerCount("close")).toBe(0);
    expect(socket.listenerCount("error")).toBe(0);
  });

  it("rejects connection resets outside forced teardown", async () => {
    const socket = new EventEmitter() as unknown as Socket;
    const socketClosed = waitForSocketClose(socket, () => false);
    const error = Object.assign(new Error("Connection reset."), { code: "ECONNRESET" });

    socket.emit("error", error);

    await expect(socketClosed).rejects.toBe(error);
    expect(socket.listenerCount("close")).toBe(0);
    expect(socket.listenerCount("error")).toBe(0);
  });

  it("rejects unexpected socket errors", async () => {
    const socket = new EventEmitter() as unknown as Socket;
    const error = Object.assign(new Error("Unexpected socket error."), { code: "EPIPE" });
    const socketClosed = waitForSocketClose(socket, () => true);

    socket.emit("error", error);

    await expect(socketClosed).rejects.toBe(error);
    expect(socket.listenerCount("close")).toBe(0);
    expect(socket.listenerCount("error")).toBe(0);
  });

  it("rejects when the socket never closes", async () => {
    vi.useFakeTimers();

    try {
      const socket = new EventEmitter() as unknown as Socket;
      const socketClosed = waitForSocketClose(socket, () => true, 100);
      const rejection = expect(socketClosed).rejects.toThrow("Socket did not close within 100 ms.");

      await vi.advanceTimersByTimeAsync(100);
      await rejection;

      expect(socket.listenerCount("close")).toBe(0);
      expect(socket.listenerCount("error")).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes active HTTP connections and runtime exactly once", async () => {
    const { port, server: reservation } = await reservePort();
    await releaseReservedPort(reservation);
    const { runtime, close } = createRuntime();
    const handle = await startLesson04Server(createEnvironment(port), async () => runtime);
    const socket = createConnection({ host: "127.0.0.1", port });
    activeSockets.add(socket);
    await once(socket, "connect");
    let forcedTeardown = false;
    const socketClosed = waitForSocketClose(socket, () => forcedTeardown);

    forcedTeardown = true;
    const closing = handle.close();
    expect(handle.close()).toBe(closing);
    await Promise.all([closing, socketClosed]);

    expect(handle.server.listening).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes the newly created runtime when the requested port is already bound", async () => {
    const { port } = await reservePort();
    const { runtime, close } = createRuntime();

    await expect(startLesson04Server(createEnvironment(port), async () => runtime)).rejects.toThrow(
      `Порт ${port} уже зайнятий іншим процесом.`,
    );

    expect(close).toHaveBeenCalledTimes(1);
  });
});
