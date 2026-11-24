import OpenAI from "openai";
import { createApp } from "./app.js";
import { loadEnvironment, loadRepositoryEnvFile } from "./config/env.js";
import { resolveModel } from "./config/models.js";
import { OpenRouterDocumentAi } from "./services/openrouter-document-ai.js";
import {
  ChatCompletionsToolCallingAgent,
  OpenAIChatCompletionsClient,
} from "./services/tool-calling-agent.js";
import { EducationalRateProvider } from "./tools/currency.js";

loadRepositoryEnvFile();

function startServer(): void {
  const environment = loadEnvironment(process.env);
  const openai = new OpenAI({
    apiKey: environment.OPENROUTER_API_KEY,
    baseURL: environment.OPENROUTER_BASE_URL,
    timeout: environment.OPENROUTER_TIMEOUT_MS,
    maxRetries: 0,
    defaultHeaders: {
      "HTTP-Referer": environment.OPENROUTER_HTTP_REFERER,
      "X-Title": environment.OPENROUTER_APP_TITLE,
    },
  });
  const ai = new OpenRouterDocumentAi(openai, {
    fastModel: resolveModel("fast", environment),
    mainModel: resolveModel("main", environment),
    maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
    reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
  });
  const chatClient = new OpenAIChatCompletionsClient(openai, {
    modelName: resolveModel("main", environment),
    maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
    reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
  });
  const toolAgent = new ChatCompletionsToolCallingAgent(chatClient, new EducationalRateProvider());
  const app = createApp({ ai, toolAgent });

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

    const fastModel = resolveModel("fast", environment);
    const mainModel = resolveModel("main", environment);
    console.log(
      [
        "=================================================================",
        "  🚀 Document & Tool Calling API (Lesson 03 — OpenRouter)",
        "=================================================================",
        `  ● Сервер:         http://localhost:${environment.PORT}`,
        `  ● Health Check:   http://localhost:${environment.PORT}/health`,
        `  ● Doc Моделі:     ${fastModel} (fast) / ${mainModel} (main)`,
        `  ● Tool Модель:    ${mainModel}`,
        `  ● Reasoning:      ${environment.OPENROUTER_REASONING_EFFORT}`,
        "-----------------------------------------------------------------",
        "  💡 Як перевірити роботу (виконайте в іншому терміналі):",
        "",
        "  [PowerShell]:",
        `    Invoke-RestMethod -Uri http://localhost:${environment.PORT}/api/agent -Method Post -ContentType "application/json" -Body '{"message":"Конвертуй 250 USD у UAH"}' | ConvertTo-Json -Depth 5`,
        "",
        "  [curl]:",
        `    curl.exe -X POST http://localhost:${environment.PORT}/api/agent -H "Content-Type: application/json" -d "{\\"message\\":\\"Конвертуй 250 USD у UAH\\"}"`,
        "-----------------------------------------------------------------",
        "  ✨ Або запустіть готову демонстрацію: yarn demo:lesson03:openrouter:solution",
        "  🛑 Для зупинки сервера: Ctrl+C",
        "=================================================================",
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
