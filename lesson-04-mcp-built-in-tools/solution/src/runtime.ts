import OpenAI from "openai";
import { resolve } from "node:path";
import type { Environment } from "../../../lesson-03-function-calling/solution/src/config/env.js";
import { resolveModel } from "../../../lesson-03-function-calling/solution/src/config/models.js";
import { OpenAiDocumentAi } from "../../../lesson-03-function-calling/solution/src/services/openai-document-ai.js";
import {
  OpenAIResponsesClient,
  ResponsesToolCallingAgent,
} from "../../../lesson-03-function-calling/solution/src/services/tool-calling-agent.js";
import { EducationalRateProvider } from "../../../lesson-03-function-calling/solution/src/tools/currency.js";
import type { Lesson04AppDependencies } from "./app.js";
import { connectFilesystemMcp } from "./mcp/filesystem-client.js";
import { McpWebSearchAgent, OpenAIMcpResponsesClient } from "./services/mcp-web-search-agent.js";

export interface Lesson04Runtime {
  openai: OpenAI;
  dependencies: Lesson04AppDependencies;
  close(): Promise<void>;
}

export async function createLesson04Runtime(environment: Environment): Promise<Lesson04Runtime> {
  const openai = new OpenAI({
    apiKey: environment.OPENAI_API_KEY,
    timeout: environment.OPENAI_TIMEOUT_MS,
    maxRetries: 1,
  });
  const mainModel = resolveModel("main", environment);
  const ai = new OpenAiDocumentAi(openai, {
    fastModel: resolveModel("fast", environment),
    mainModel,
    maxOutputTokens: environment.OPENAI_MAX_OUTPUT_TOKENS,
  });
  const currencyResponsesClient = new OpenAIResponsesClient(openai, {
    modelName: mainModel,
    maxOutputTokens: environment.OPENAI_MAX_OUTPUT_TOKENS,
  });
  const toolAgent = new ResponsesToolCallingAgent(
    currencyResponsesClient,
    new EducationalRateProvider(),
  );
  const sandboxPath = resolve("lesson-04-mcp-built-in-tools", "solution", "sandbox");
  const mcpClient = await connectFilesystemMcp(sandboxPath);
  const mcpResponsesClient = new OpenAIMcpResponsesClient(openai, {
    modelName: mainModel,
    maxOutputTokens: environment.OPENAI_MAX_OUTPUT_TOKENS,
  });
  const mcpAgent = new McpWebSearchAgent(mcpResponsesClient, mcpClient);

  return {
    openai,
    dependencies: {
      ai,
      toolAgent,
      mcpAgent,
    },
    close: async () => {
      await mcpClient.close();
    },
  };
}
