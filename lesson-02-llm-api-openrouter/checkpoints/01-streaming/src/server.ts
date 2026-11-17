import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import OpenAI from "openai";
import { createApp } from "./app.js";
import { loadEnvironment } from "./config/env.js";
import { resolveModel } from "./config/models.js";
import { OPENROUTER_BASE_URL } from "./config/openrouter.js";
import { OpenRouterDocumentAi } from "./services/openrouter-document-ai.js";

function loadRepositoryEnvFile(): void {
  let directory = dirname(fileURLToPath(import.meta.url));

  for (;;) {
    if (existsSync(join(directory, "package.json"))) {
      dotenv.config({ path: join(directory, ".env"), quiet: true });
      return;
    }

    const parentDirectory = dirname(directory);

    if (parentDirectory === directory) {
      return;
    }

    directory = parentDirectory;
  }
}

loadRepositoryEnvFile();

function startServer(): void {
  const environment = loadEnvironment(process.env);
  const openai = new OpenAI({
    apiKey: environment.OPENROUTER_API_KEY,
    baseURL: OPENROUTER_BASE_URL,
    timeout: environment.OPENROUTER_TIMEOUT_MS,
    maxRetries: 0,
  });
  const ai = new OpenRouterDocumentAi(openai, {
    fastModel: resolveModel("fast", environment),
    mainModel: resolveModel("main", environment),
    reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
    maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
  });
  const app = createApp({ ai });

  app.listen(environment.PORT, (error?: Error) => {
    if (error) {
      const listenError = error as NodeJS.ErrnoException;

      if (listenError.code === "EADDRINUSE") {
        console.error(
          `Не вдалося запустити сервер: порт ${environment.PORT} уже зайнятий іншим процесом.`,
        );
      } else {
        console.error(`Не вдалося запустити сервер: ${listenError.message}`);
      }

      process.exitCode = 1;
      return;
    }

    console.log(
      [
        `Document API запущено на порту ${environment.PORT}.`,
        `Перевірка стану: http://localhost:${environment.PORT}/health`,
        `Основна модель (summary): ${resolveModel("fast", environment)}`,
        `Основна модель (extraction): ${resolveModel("main", environment)}`,
        "Графічного веб-інтерфейсу немає. Приклади API-запитів наведено в README.",
        "Для зупинки сервера: Ctrl+C",
      ].join("\n"),
    );
  });
}

try {
  startServer();
} catch (error) {
  const message = error instanceof Error ? error.message : "Непередбачена помилка конфігурації.";
  console.error(`Не вдалося запустити сервер: ${message}`);
  process.exitCode = 1;
}
