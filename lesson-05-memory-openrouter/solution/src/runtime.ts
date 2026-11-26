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
import type { LocalMcpClient } from "./mcp/filesystem-client.js";
import {
  McpWebSearchAgent,
  OpenAIMcpChatCompletionsClient,
} from "./services/mcp-web-search-agent.js";
import type { Lesson05OpenRouterAppDependencies } from "./app.js";
import { JsonConversationHistoryStore } from "./memory/conversation-history.js";
import { JsonUserFactStore } from "./memory/user-facts.js";
import {
  ConversationManager,
  OpenRouterConversationChatClient,
} from "./services/conversation-manager.js";

export interface Lesson04Runtime {
  openai: OpenAI;
  dependencies: Lesson04AppDependencies;
  close(): Promise<void>;
}

export interface Lesson04RuntimeOptions {
  allowedDirectory?: string;
  createFilesystemMcpClient?: (sandboxPath: string) => Promise<LocalMcpClient>;
}

export interface Lesson05OpenRouterRuntime extends Lesson04Runtime {
  dependencies: Lesson05OpenRouterAppDependencies;
  conversationManager: ConversationManager;
}

export interface Lesson05OpenRouterRuntimeOptions extends Lesson04RuntimeOptions {
  userFactsPath?: string;
  conversationHistoryPath?: string;
  maxHistoryTurns?: number;
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
  const createMcpClient = options.createFilesystemMcpClient ?? connectFilesystemMcp;
  const mcpClient = await createMcpClient(allowedDirectory);

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

export async function createLesson05Runtime(
  environment: Environment,
  options: Lesson05OpenRouterRuntimeOptions = {},
): Promise<Lesson05OpenRouterRuntime> {
  const lesson04Runtime = await createLesson04Runtime(environment, {
    ...(options.allowedDirectory === undefined
      ? {}
      : { allowedDirectory: options.allowedDirectory }),
    ...(options.createFilesystemMcpClient === undefined
      ? {}
      : { createFilesystemMcpClient: options.createFilesystemMcpClient }),
  });

  try {
    const moduleDirectory = dirname(fileURLToPath(import.meta.url));
    const userFactsPath =
      options.userFactsPath ?? resolve(moduleDirectory, "../data", "user-memory.json");
    const conversationHistoryPath =
      options.conversationHistoryPath ??
      resolve(moduleDirectory, "../data", "conversation-history.json");
    const conversationClient = new OpenRouterConversationChatClient(
      lesson04Runtime.openai,
      {
        modelName: resolveModel("main", environment),
        maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
        reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
      },
      new JsonUserFactStore(userFactsPath),
    );
    const conversationManager = new ConversationManager(
      conversationClient,
      new JsonConversationHistoryStore(conversationHistoryPath),
      options.maxHistoryTurns === undefined ? {} : { maxHistoryTurns: options.maxHistoryTurns },
    );

    return {
      openai: lesson04Runtime.openai,
      dependencies: {
        ...lesson04Runtime.dependencies,
        conversationManager,
      },
      conversationManager,
      close: lesson04Runtime.close,
    };
  } catch (error: unknown) {
    await lesson04Runtime.close().catch(() => undefined);
    throw error;
  }
}
