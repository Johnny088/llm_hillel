// import OpenAI from "openai";
import { createServer, type Server } from "node:http";
import { pathToFileURL } from "node:url";
import { createApp } from "./app.js";

import { loadEnvironment, loadRepositoryEnvFile } from "./config/env.js";

// import { resolveModel } from "./config/models.js";
// import { OpenRouterDocumentAi } from "./services/openrouter-document-ai.js";
// import {
//   ChatCompletionsToolCallingAgent,
//   OpenAIChatCompletionsClient,
// } from "./services/tool-calling-agent.js";
// import { EducationalRateProvider } from "./tools/currency.js";
import type { Environment } from "./config/env.js";
import { createLesson04Runtime } from "./runtime.js";
import type { Lesson04Runtime } from "./runtime.js";

// loadRepositoryEnvFile();
export interface Lesson04ServerHandle {
  server: Server;
  close(): Promise<void>;
}

// function startServer(): void {
//   const environment = loadEnvironment(process.env);
//   const openai = new OpenAI({
//     apiKey: environment.OPENROUTER_API_KEY,
//     baseURL: environment.OPENROUTER_BASE_URL,
//     timeout: environment.OPENROUTER_TIMEOUT_MS,
//     maxRetries: 0,
//     defaultHeaders: {
//       "HTTP-Referer": environment.OPENROUTER_HTTP_REFERER,
//       "X-Title": environment.OPENROUTER_APP_TITLE,
//     },
//   });
//   const ai = new OpenRouterDocumentAi(openai, {
//     fastModel: resolveModel("fast", environment),
//     mainModel: resolveModel("main", environment),
//     maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
//     reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
//   });
//   const chatClient = new OpenAIChatCompletionsClient(openai, {
//     modelName: resolveModel("main", environment),
//     maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
//     reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
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
  // const toolAgent = new ChatCompletionsToolCallingAgent(chatClient, new EducationalRateProvider());
  // const app = createApp({ ai, toolAgent });

  // app.listen(environment.PORT, (error?: Error) => {
  //   if (error) {
  //     const listenError = error as NodeJS.ErrnoException;
  return { server, close };
}

async function closeHttpServer(server: Server): Promise<void> {
  if (!server.listening) {
    return;
  }
  // if (listenError.code === "EADDRINUSE") {
  //   console.error(
  //     `Не вдалося запустити сервер: порт ${environment.PORT} уже зайнятий іншим процесом.`,
  //   );
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        // console.error(`Не вдалося запустити сервер: ${listenError.message}`);
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

  //   const fastModel = resolveModel("fast", environment);
  //   const mainModel = resolveModel("main", environment);
  //   console.log(
  //     [
  //       "=================================================================",
  //       "  🚀 Document & Tool Calling API (Lesson 03 — OpenRouter)",
  //       "=================================================================",
  //       `  ● Сервер:         http://localhost:${environment.PORT}`,
  //       `  ● Health Check:   http://localhost:${environment.PORT}/health`,
  //       `  ● Doc Моделі:     ${fastModel} (fast) / ${mainModel} (main)`,
  //       `  ● Tool Модель:    ${mainModel}`,
  //       `  ● Reasoning:      ${environment.OPENROUTER_REASONING_EFFORT}`,
  //       "-----------------------------------------------------------------",
  //       "  💡 Як перевірити роботу (виконайте в іншому терміналі):",
  //       "",
  //       "  [PowerShell]:",
  //       `    Invoke-RestMethod -Uri http://localhost:${environment.PORT}/api/agent -Method Post -ContentType "application/json" -Body '{"message":"Конвертуй 250 USD у UAH"}' | ConvertTo-Json -Depth 5`,
  //       "",
  //       "  [curl]:",
  //       `    curl.exe -X POST http://localhost:${environment.PORT}/api/agent -H "Content-Type: application/json" -d "{\\"message\\":\\"Конвертуй 250 USD у UAH\\"}"`,
  //       "-----------------------------------------------------------------",
  //       "  ✨ Або запустіть готову демонстрацію: yarn demo:lesson03:openrouter:solution",
  //       "  🛑 Для зупинки сервера: Ctrl+C",
  //       "=================================================================",
  //     ].join("\n"),
  //   );
  // });
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

function isDirectExecution(): boolean {
  const entrypoint = process.argv[1];
  return entrypoint !== undefined && import.meta.url === pathToFileURL(entrypoint).href;
}

// try {
//   startServer();
// } catch (error) {
//   const message = error instanceof Error ? error.message : "Непередбачена помилка конфігурації.";
//   console.error(`Не вдалося запустити сервер: ${message}`);
//   process.exitCode = 1;
// }
if (isDirectExecution()) {
  void main().catch((error: unknown) => {
    console.error("Не вдалося запустити сервер.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    process.exitCode = 1;
  });
}
