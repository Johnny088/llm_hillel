import dotenv from "dotenv";
import OpenAI from "openai";
import { createApp } from "./app.js";
import { loadEnvironment } from "./config/env.js";
import { resolveModel } from "./config/models.js";
import { OpenAiDocumentAi } from "./services/openai-document-ai.js";

dotenv.config({ quiet: true });

function startServer(): void {
  const environment = loadEnvironment(process.env);
  const fastModel = resolveModel("fast", environment);
  const mainModel = resolveModel("main", environment);
  const openai = new OpenAI({
    apiKey: environment.OPENAI_API_KEY,
    timeout: environment.OPENAI_TIMEOUT_MS,
    maxRetries: 1,
  });
  const ai = new OpenAiDocumentAi(openai, {
    fastModel,
    mainModel,
    maxOutputTokens: environment.OPENAI_MAX_OUTPUT_TOKENS,
  });
  const app = createApp({ ai });

  app.listen(environment.PORT, () => {
    console.log(`Document API запущено на порту ${environment.PORT}.`);
    console.log(`Перевірка стану: http://localhost:${environment.PORT}/health`);
    console.log("Графічного веб-інтерфейсу немає. Приклади API-запитів наведено в README.");
    console.log(`Модель для summary: ${fastModel}`);
    console.log(`Модель для extraction: ${mainModel}`);
    console.log("Для зупинки сервера: Ctrl+C");
  });
}

try {
  startServer();
} catch (error) {
  const message = error instanceof Error ? error.message : "Непередбачена помилка конфігурації.";
  console.error(`Не вдалося запустити сервер: ${message}`);
  process.exitCode = 1;
}
