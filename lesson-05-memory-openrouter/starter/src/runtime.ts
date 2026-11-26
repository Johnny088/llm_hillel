import OpenAI from "openai";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Environment } from "./config/env.js";
import { resolveModel } from "./config/models.js";
import { OpenRouterDocumentAi } from "./services/openrouter-document-ai.js";
import {
  ChatCompletionsToolCallingAgent,
  OpenAIChatCompletionsClient,
} from "./services/tool-calling-agent.js";
import { EducationalRateProvider } from "./tools/currency.js";
import type { Lesson04AppDependencies } from "./app.js";
import { connectFilesystemMcp } from "./mcp/filesystem-client.js";
import {
  McpWebSearchAgent,
  OpenAIMcpChatCompletionsClient,
} from "./services/mcp-web-search-agent.js";

export interface Lesson04Runtime {
  openai: OpenAI;
  dependencies: Lesson04AppDependencies;
  close(): Promise<void>;
}

export interface Lesson04RuntimeOptions {
  allowedDirectory?: string;
}

export async function createLesson04Runtime(
  environment: Environment,
  options: Lesson04RuntimeOptions = {},
): Promise<Lesson04Runtime> {
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
  const mainModel = resolveModel("main", environment);
  const ai = new OpenRouterDocumentAi(openai, {
    fastModel: resolveModel("fast", environment),
    mainModel,
    maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
    reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
  });
  const currencyChatClient = new OpenAIChatCompletionsClient(openai, {
    modelName: mainModel,
    maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
    reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
  });
  const toolAgent = new ChatCompletionsToolCallingAgent(
    currencyChatClient,
    new EducationalRateProvider(),
  );
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  const allowedDirectory = resolve(moduleDirectory, options.allowedDirectory ?? "../sandbox");
  const mcpClient = await connectFilesystemMcp(allowedDirectory);

  try {
    const mcpChatClient = new OpenAIMcpChatCompletionsClient(openai, {
      modelName: mainModel,
      maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
      reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
    });
    const mcpAgent = new McpWebSearchAgent(mcpChatClient, mcpClient);
    let closed = false;

    return {
      openai,
      dependencies: {
        ai,
        toolAgent,
        mcpAgent,
      },
      close: async () => {
        if (closed) {
          return;
        }

        closed = true;
        await mcpClient.close();
      },
    };
  } catch {
    await mcpClient.close().catch(() => undefined);
    throw new Error("Не вдалося налаштувати локальний MCP runtime.");
  }
}
