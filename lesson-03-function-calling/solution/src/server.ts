import dotenv from "dotenv";
import OpenAI from "openai";
import { createApp } from "./app.js";
import { loadEnvironment } from "./config/env.js";
import { resolveModel } from "./config/models.js";
import { OpenAiDocumentAi } from "./services/openai-document-ai.js";
import { OpenAIResponsesClient, ResponsesToolCallingAgent } from "./services/tool-calling-agent.js";
import { EducationalRateProvider } from "./tools/currency.js";

dotenv.config({ quiet: true });

function startServer(): void {
  const environment = loadEnvironment(process.env);
  const openai = new OpenAI({
    apiKey: environment.OPENAI_API_KEY,
    timeout: environment.OPENAI_TIMEOUT_MS,
    maxRetries: 1,
  });
  const ai = new OpenAiDocumentAi(openai, {
    fastModel: resolveModel("fast", environment),
    mainModel: resolveModel("main", environment),
    maxOutputTokens: environment.OPENAI_MAX_OUTPUT_TOKENS,
  });
  const responsesClient = new OpenAIResponsesClient(openai, {
    modelName: resolveModel("main", environment),
    maxOutputTokens: environment.OPENAI_MAX_OUTPUT_TOKENS,
  });
  const toolAgent = new ResponsesToolCallingAgent(responsesClient, new EducationalRateProvider());
  const app = createApp({ ai, toolAgent });

  app.listen(environment.PORT, () => {
    console.log(`Document and Tool API працює на http://localhost:${environment.PORT}`);
  });
}

try {
  startServer();
} catch (error) {
  const message = error instanceof Error ? error.message : "Непередбачена помилка конфігурації.";
  console.error(`Не вдалося запустити сервер: ${message}`);
  process.exitCode = 1;
}
