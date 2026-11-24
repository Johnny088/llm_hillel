import { createServer, type Server } from "node:http";
import { pathToFileURL } from "node:url";
import { createApp } from "./app.js";

import { loadEnvironment, loadRepositoryEnvFile } from "./config/env.js";

import type { Environment } from "./config/env.js";
import { createLesson04Runtime } from "./runtime.js";
import type { Lesson04Runtime } from "./runtime.js";

export interface Lesson04ServerHandle {
  server: Server;
  close(): Promise<void>;
}

type RuntimeFactory = (environment: Environment) => Promise<Lesson04Runtime>;

export async function startLesson04Server(
  environment: Environment,
  createRuntime: RuntimeFactory = createLesson04Runtime,
): Promise<Lesson04ServerHandle> {
  const runtime = await createRuntime(environment);
  const server = createServer(createApp(runtime.dependencies));
  let startupErrorHandler: ((error: Error) => void) | undefined;

  try {
    const listening = new Promise<void>((resolve, reject) => {
      startupErrorHandler = reject;
      server.once("listening", resolve);
      server.once("error", startupErrorHandler);
    });

    server.listen(environment.PORT);
    await listening;
  } catch (error: unknown) {
    if (startupErrorHandler) {
      server.off("error", startupErrorHandler);
    }

    await closeHttpServer(server).catch(() => undefined);
    await runtime.close().catch(() => undefined);
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : undefined;

    if (errorCode === "EADDRINUSE") {
      throw new Error(`Порт ${environment.PORT} уже зайнятий іншим процесом.`);
    }

    throw new Error("Не вдалося запустити HTTP сервер.");
  }

  if (startupErrorHandler) {
    server.off("error", startupErrorHandler);
  }

  let closePromise: Promise<void> | undefined;
  const close = (): Promise<void> => {
    closePromise ??= (async () => {
      const failures: unknown[] = [];
      try {
        await closeHttpServer(server);
      } catch (error: unknown) {
        failures.push(error);
      }

      try {
        await runtime.close();
      } catch (error: unknown) {
        failures.push(error);
      }

      if (failures.length > 0) {
        throw new Error("Не вдалося коректно закрити Lesson 04 runtime.");
      }
    })();

    return closePromise;
  };

  server.on("error", (error: unknown) => {
    console.error("Помилка HTTP сервера.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    process.exitCode = 1;
    void close().catch(() => {
      process.exitCode = 1;
    });
  });

  return { server, close };
}

async function closeHttpServer(server: Server): Promise<void> {
  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
    server.closeAllConnections();
  });
}
async function main(): Promise<void> {
  loadRepositoryEnvFile();
  const environment = loadEnvironment(process.env);
  const handle = await startLesson04Server(environment);

  console.log(
    `Document, Tool та MCP (OpenRouter) API працює на http://localhost:${environment.PORT}`,
  );

  const shutdown = (): void => {
    void handle.close().catch((error: unknown) => {
      console.error("Не вдалося коректно закрити Lesson 04 runtime.", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });

      process.exitCode = 1;
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

function isDirectExecution(): boolean {
  const entrypoint = process.argv[1];
  return entrypoint !== undefined && import.meta.url === pathToFileURL(entrypoint).href;
}

if (isDirectExecution()) {
  void main().catch((error: unknown) => {
    console.error("Не вдалося запустити сервер.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    process.exitCode = 1;
  });
}
