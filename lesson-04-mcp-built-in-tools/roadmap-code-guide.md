# Lesson 04 – план реалізації (OpenAI)

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Завершити повний маршрут від валідованого research-запиту до відповіді з локальними або web джерелами.

### 💎 Практична цінність застосунку

Два канали пошуку мають різні політики доступу, але проходять один локально перевірений runtime.

### ⚙️ Що робить застосунок

Research agent вибирає доступні tools, обробляє один local MCP tool call, передає output моделі та завершується з sources або стабільною помилкою.

Виконуйте кроки послідовно в `my-dev/lesson-04-mcp-built-in-tools/`, а команди запускайте з кореня репозиторію. Обов’язкові критерії наведені в [homework.md](./homework.md); опис стартового стану є в [starter-code-guide.md](./starter-code-guide.md).

План містить дев’ять обов’язкових кодових payload-ів `P01`–`P09`. `P10` – необов’язковий smoke script для локального MCP. Створюйте або доповнюйте файли лише в `my-dev/lesson-04-mcp-built-in-tools/`, зберігаючи успадковані Lesson 03 tests та їхні assertions. Eval-файлів поточної теми в canonical starter немає; скопіюйте їх як reference з `solution/evals/` до `my-dev/evals/`, збережіть case ID й observations. Не копіюйте каталог `solution/` цілком і не змінюйте канонічні файли, залежності чи конфігурації.

## Крок 1 – зафіксуйте початковий стан

З кореня репозиторію перевірте `git status` та запустіть успадкований unit suite:

```powershell
yarn student:test 04 openai
```

На цьому етапі `student:test` перевіряє успадковану Lesson 03 основу й може пройти повністю. Це не підтверджує завершення MCP-функцій. Після створення п’яти Lesson 04 eval cases у `my-dev` запустіть `yarn student:eval 04 openai`; recorded replay не запускає live OpenAI запит.

## Крок 2 – додайте stdio filesystem client

Клієнт використовує Windows або POSIX launch form. Метод close закриває MCP-підключення й керує дочірнім процесом, створеним transport.

**Файл:** `my-dev/lesson-04-mcp-built-in-tools/src/mcp/filesystem-client.ts`. Повний payload P01:

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface ListedMcpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface LocalMcpClient {
  listTools(): Promise<ListedMcpTool[]>;
  callTool(request: { name: string; arguments?: Record<string, unknown> }): Promise<unknown>;
  close(): Promise<void>;
}

class FilesystemMcpClient implements LocalMcpClient {
  public constructor(private readonly client: Client) {}

  public async listTools(): Promise<ListedMcpTool[]> {
    const result = await this.client.listTools();

    return result.tools.map((tool) => ({
      name: tool.name,
      inputSchema: tool.inputSchema,
      ...(tool.description === undefined ? {} : { description: tool.description }),
    }));
  }

  public async callTool(request: {
    name: string;
    arguments?: Record<string, unknown>;
  }): Promise<unknown> {
    return this.client.callTool(request);
  }

  public async close(): Promise<void> {
    await this.client.close();
  }
}

export async function connectFilesystemMcp(sandboxPath: string): Promise<LocalMcpClient> {
  const isWindows = process.platform === "win32";
  const transport = new StdioClientTransport({
    command: isWindows ? "cmd.exe" : "npx",
    args: isWindows
      ? ["/c", "npx", "-y", "@modelcontextprotocol/server-filesystem", sandboxPath]
      : ["-y", "@modelcontextprotocol/server-filesystem", sandboxPath],
  });
  const client = new Client({ name: "course-mcp-agent", version: "1.0.0" }, { capabilities: {} });

  await client.connect(transport);

  return new FilesystemMcpClient(client);
}
```

**Перевірка:** `yarn student:build 04 openai`.

## Крок 3 – відфільтруйте локальні MCP tools

До моделі передавайте тільки read_text_file. Перед кожним callTool повторно перевіряйте allowlist, JSON-аргументи та формуйте безпечний function_call_output.

**Файл:** `my-dev/lesson-04-mcp-built-in-tools/src/mcp/filesystem-tools.ts`. Повний payload P02:

```ts
import type {
  FunctionTool,
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses";
import type { ListedMcpTool, LocalMcpClient } from "./filesystem-client.js";

export const LOCAL_MCP_TOOL_ALLOWLIST: ReadonlySet<string> = new Set(["read_text_file"]);

type McpToolErrorCode =
  "INVALID_TOOL_ARGUMENTS" | "MCP_ACCESS_DENIED" | "MCP_TOOL_ERROR" | "MCP_TOOL_NOT_ALLOWED";

interface McpToolOutput {
  status: "success" | "error";
  content?: string;
  code?: McpToolErrorCode;
  message?: string;
}

export function createMcpFunctionTools(listedTools: readonly ListedMcpTool[]): FunctionTool[] {
  return listedTools
    .filter((tool) => LOCAL_MCP_TOOL_ALLOWLIST.has(tool.name))
    .map((tool) => ({
      type: "function",
      name: tool.name,
      parameters: tool.inputSchema,
      strict: false,
      ...(tool.description === undefined ? {} : { description: tool.description }),
    }));
}

export async function executeMcpToolCall(
  call: ResponseFunctionToolCall,
  client: LocalMcpClient,
): Promise<ResponseInputItem.FunctionCallOutput> {
  if (!LOCAL_MCP_TOOL_ALLOWLIST.has(call.name)) {
    return createToolOutput(call.call_id, {
      status: "error",
      code: "MCP_TOOL_NOT_ALLOWED",
      message: "Інструмент заблоковано локальною політикою доступу.",
    });
  }

  let parsedArguments: unknown;

  try {
    parsedArguments = JSON.parse(call.arguments);
  } catch {
    return createToolOutput(call.call_id, {
      status: "error",
      code: "INVALID_TOOL_ARGUMENTS",
      message: "Аргументи інструмента не є валідним JSON-об’єктом.",
    });
  }

  if (!isRecord(parsedArguments)) {
    return createToolOutput(call.call_id, {
      status: "error",
      code: "INVALID_TOOL_ARGUMENTS",
      message: "Аргументи інструмента не є валідним JSON-об’єктом.",
    });
  }

  try {
    const result = await client.callTool({
      name: call.name,
      arguments: parsedArguments,
    });

    return createToolOutput(call.call_id, normalizeMcpResult(result));
  } catch (error: unknown) {
    console.error("[MCP Tool Error]", {
      toolName: call.name,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return createToolOutput(call.call_id, {
      status: "error",
      code: "MCP_TOOL_ERROR",
      message: "MCP-сервер не виконав операцію.",
    });
  }
}

function normalizeMcpResult(result: unknown): McpToolOutput {
  if (!isRecord(result) || !Array.isArray(result.content)) {
    return {
      status: "error",
      code: "MCP_TOOL_ERROR",
      message: "MCP-сервер повернув неочікуваний формат відповіді.",
    };
  }

  const text = result.content
    .flatMap((item) =>
      isRecord(item) && item.type === "text" && typeof item.text === "string" ? [item.text] : [],
    )
    .join("\n");

  if (result.isError === true) {
    const normalizedText = text.toLowerCase();
    const accessDenied =
      normalizedText.includes("access denied") ||
      normalizedText.includes("outside allowed directories") ||
      normalizedText.includes("not allowed");

    return accessDenied
      ? {
          status: "error",
          code: "MCP_ACCESS_DENIED",
          message: "Доступ до шляху поза навчальною sandbox-папкою заборонено.",
        }
      : {
          status: "error",
          code: "MCP_TOOL_ERROR",
          message: "MCP-сервер не виконав операцію.",
        };
  }

  return {
    status: "success",
    content: text,
  };
}

function createToolOutput(
  callId: string,
  payload: McpToolOutput,
): ResponseInputItem.FunctionCallOutput {
  return {
    type: "function_call_output",
    call_id: callId,
    output: JSON.stringify(payload),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

**Перевірка:** `yarn student:build 04 openai`.

## Крок 4 – реалізуйте обмежений Responses API agent

Hosted web_search передається разом із локальним function tool. Збережіть повний output першої відповіді, додайте локальні outputs із тими самими call_id і блокуйте другий локальний раунд.

**Файл:** `my-dev/lesson-04-mcp-built-in-tools/src/services/mcp-web-search-agent.ts`. Повний payload P03:

```ts
import type OpenAI from "openai";
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems";
import type {
  ResponseFunctionToolCall,
  ResponseInputItem,
  Tool,
} from "openai/resources/responses/responses";
import {
  extractUsageMetrics,
  sumUsageMetrics,
} from "../../../../lesson-03-function-calling/solution/src/lib/metrics.js";
import type {
  ResponseUsageLike,
  UsageMetrics,
} from "../../../../lesson-03-function-calling/solution/src/lib/metrics.js";
import type {
  AgentRunMetrics,
  AgentRunResult,
  ModelTurn,
  OpenAIResponsesClientOptions,
  ToolCallingAgent,
} from "../../../../lesson-03-function-calling/solution/src/services/tool-calling-agent.js";
import type { LocalMcpClient } from "../mcp/filesystem-client.js";
import { createMcpFunctionTools, executeMcpToolCall } from "../mcp/filesystem-tools.js";

export const MCP_AGENT_INSTRUCTIONS = [
  "Локальні матеріали курсу читаються лише через read_text_file.",
  "Актуальна або зовнішня інформація шукається лише через web_search.",
  "Шляхи поза дозволеною sandbox-папкою не запитуються повторно.",
  "Якщо локальний інструмент повертає MCP_ACCESS_DENIED, формується коротке пояснення відмови без розкриття системних шляхів.",
].join("\n");

export interface McpModelResponseRequest {
  input: ResponseInputItem[];
  tools: Tool[];
}

export interface McpModelResponsesClient {
  createResponse(request: McpModelResponseRequest): Promise<ModelTurn>;
}

export class OpenAIMcpResponsesClient implements McpModelResponsesClient {
  public constructor(
    private readonly client: OpenAI,
    private readonly options: Readonly<OpenAIResponsesClientOptions>,
  ) {}

  public async createResponse(request: McpModelResponseRequest): Promise<ModelTurn> {
    const response = await this.client.responses.create({
      model: this.options.modelName,
      instructions: MCP_AGENT_INSTRUCTIONS,
      input: request.input,
      tools: request.tools,
      tool_choice: "auto",
      parallel_tool_calls: false,
      include: ["reasoning.encrypted_content"],
      store: false,
      max_output_tokens: this.options.maxOutputTokens,
    });

    return {
      output: response.output,
      outputText: response.output_text,
      model: response.model || this.options.modelName,
      ...(response.usage === undefined ? {} : { usage: response.usage }),
    };
  }
}

export class McpWebSearchAgent implements ToolCallingAgent {
  public constructor(
    private readonly responsesClient: McpModelResponsesClient,
    private readonly mcpClient: LocalMcpClient,
    private readonly now: () => number = () => performance.now(),
  ) {}

  public async run(message: string): Promise<AgentRunResult> {
    const startedAt = this.now();
    const listedTools = await this.mcpClient.listTools();
    const mcpFunctionTools = createMcpFunctionTools(listedTools);

    if (mcpFunctionTools.length === 0) {
      throw new Error("MCP-сервер не надав жодного дозволеного інструмента.");
    }

    const tools: Tool[] = [...mcpFunctionTools, { type: "web_search" }];
    const input: ResponseInputItem[] = [{ role: "user", content: message }];
    let usage = extractUsageMetrics();
    let modelCallCount = 0;
    let toolCallCount = 0;

    const firstResponse = await this.responsesClient.createResponse({ input, tools });
    modelCallCount += 1;
    usage = addUsage(usage, firstResponse.usage);

    const firstFunctionCalls = findFunctionCalls(firstResponse);

    if (firstFunctionCalls.length === 0) {
      return createFinalResult(
        firstResponse,
        usage,
        modelCallCount,
        toolCallCount,
        startedAt,
        this.now,
      );
    }

    input.push(...toResponseInputItems(firstResponse.output));

    for (const call of firstFunctionCalls) {
      toolCallCount += 1;
      input.push(await executeMcpToolCall(call, this.mcpClient));
    }

    const finalResponse = await this.responsesClient.createResponse({ input, tools });
    modelCallCount += 1;
    usage = addUsage(usage, finalResponse.usage);

    if (findFunctionCalls(finalResponse).length > 0) {
      return {
        status: "error",
        code: "TOOL_CALL_LIMIT_REACHED",
        message: "Навчальний runtime зупинено після одного раунду локальних MCP-викликів.",
        model: finalResponse.model,
        usage,
        metrics: createMetrics(modelCallCount, toolCallCount, startedAt, this.now),
      };
    }

    return createFinalResult(
      finalResponse,
      usage,
      modelCallCount,
      toolCallCount,
      startedAt,
      this.now,
    );
  }
}

function findFunctionCalls(response: ModelTurn): ResponseFunctionToolCall[] {
  return response.output.filter(
    (item): item is ResponseFunctionToolCall => item.type === "function_call",
  );
}

function addUsage(current: UsageMetrics, next: ResponseUsageLike | null | undefined): UsageMetrics {
  return sumUsageMetrics(current, extractUsageMetrics(next));
}

function createFinalResult(
  response: ModelTurn,
  usage: UsageMetrics,
  modelCallCount: number,
  toolCallCount: number,
  startedAt: number,
  now: () => number,
): AgentRunResult {
  const outputText = response.outputText.trim();
  const metrics = createMetrics(modelCallCount, toolCallCount, startedAt, now);

  if (outputText === "") {
    return {
      status: "error",
      code: "EMPTY_MODEL_RESPONSE",
      message: "Модель не повернула фінальної відповіді.",
      model: response.model,
      usage,
      metrics,
    };
  }

  return {
    status: "success",
    text: outputText,
    model: response.model,
    usage,
    metrics,
  };
}

function createMetrics(
  modelCallCount: number,
  toolCallCount: number,
  startedAt: number,
  now: () => number,
): AgentRunMetrics {
  return {
    modelCallCount,
    toolCallCount,
    retryCount: 0,
    totalLatencyMs: Math.max(0, Math.round(now() - startedAt)),
  };
}
```

**Перевірка:** `yarn student:build 04 openai`.

## Крок 5 – підключіть research HTTP route

Збережіть попередні маршрути, перевіряйте вхід до виклику агента й маскуйте внутрішні помилки на HTTP межі.

**Файл:** `my-dev/lesson-04-mcp-built-in-tools/src/app.ts`. Повний payload P04:

```ts
import type { Express, Request, Response } from "express";
import {
  createApp as createLesson03App,
  type AppDependencies,
} from "../../../lesson-03-function-calling/solution/src/app.js";
import {
  createApiError,
  type ApiErrorResponse,
} from "../../../lesson-03-function-calling/solution/src/lib/errors.js";
import { AgentRequestSchema } from "../../../lesson-03-function-calling/solution/src/schemas/agent-request.js";
import type {
  AgentRunResult,
  ToolCallingAgent,
} from "../../../lesson-03-function-calling/solution/src/services/tool-calling-agent.js";

export interface Lesson04AppDependencies extends AppDependencies {
  mcpAgent?: ToolCallingAgent;
}

export function createApp(dependencies: Lesson04AppDependencies): Express {
  const app = createLesson03App(dependencies);

  app.post(
    "/api/agent/research",
    async (
      request: Request,
      response: Response<AgentRunResult | ApiErrorResponse>,
    ): Promise<void> => {
      const parsedRequest = AgentRequestSchema.safeParse(request.body);

      if (!parsedRequest.success) {
        response
          .status(400)
          .json(
            createApiError("INVALID_INPUT", "Невалідний запит.", parsedRequest.error.flatten()),
          );
        return;
      }

      if (!dependencies.mcpAgent) {
        response
          .status(503)
          .json(createApiError("SERVICE_UNAVAILABLE", "MCP runtime не налаштовано."));
        return;
      }

      try {
        response.json(await dependencies.mcpAgent.run(parsedRequest.data.message));
      } catch (error: unknown) {
        console.error("[MCP Agent Error]", {
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        response
          .status(502)
          .json(createApiError("MCP_AGENT_ERROR", "Не вдалося виконати MCP-запит."));
      }
    },
  );

  return app;
}
```

**Перевірка:** `yarn student:build 04 openai`.

## Крок 6 – створіть student runtime

Payload використовує успадковані сервіси Lesson 03, створює MCP runtime та вказує на sandbox саме в my-dev. Цей шлях уже адаптовано для студентської папки.

**Файл:** `my-dev/lesson-04-mcp-built-in-tools/src/runtime.ts`. Повний payload P05:

```ts
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
  const sandboxPath = resolve("my-dev", "lesson-04-mcp-built-in-tools", "sandbox");
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
```

**Перевірка:** `yarn student:build 04 openai`.

## Крок 7 – підключіть сервер і cleanup

Сервер використовує готову environment schema й закриває HTTP та MCP ресурси під час завершення або помилки bind.

**Файл:** `my-dev/lesson-04-mcp-built-in-tools/src/server.ts`. Повний payload P06:

```ts
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { createLesson04Runtime } from "./runtime.js";
import { loadEnvironment } from "../../../lesson-03-function-calling/solution/src/config/env.js";

dotenv.config({ quiet: true });

async function startServer(): Promise<void> {
  const environment = loadEnvironment(process.env);
  const runtime = await createLesson04Runtime(environment);

  try {
    const app = createApp(runtime.dependencies);
    const server = app.listen(environment.PORT);
    server.once("listening", () => {
      console.log(`Document, Tool та MCP API працює на http://localhost:${environment.PORT}`);
    });
    let closing = false;

    const closeRuntime = async (): Promise<void> => {
      try {
        await runtime.close();
      } catch (closeError: unknown) {
        console.error("Не вдалося коректно закрити MCP runtime.", {
          errorName: closeError instanceof Error ? closeError.name : "UnknownError",
        });
        process.exitCode = 1;
      }
    };

    const close = (reason?: unknown): void => {
      if (closing) {
        return;
      }

      closing = true;
      if (reason instanceof Error) {
        console.error("Не вдалося запустити HTTP сервер.", {
          errorName: reason.name,
        });
        process.exitCode = 1;
      }

      const finish = (): void => {
        void closeRuntime();
      };

      if (!server.listening) {
        finish();
        return;
      }

      server.close(() => {
        finish();
      });
    };

    server.once("error", (error: unknown) => close(error));
    process.once("SIGINT", () => close());
    process.once("SIGTERM", () => close());
  } catch (error) {
    await runtime.close();
    throw error;
  }
}

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Непередбачена помилка запуску.";
  console.error(`Не вдалося запустити сервер: ${message}`);
  process.exitCode = 1;
});
```

**Перевірка:** `yarn student:build 04 openai`.

## Крок 8 – додайте HTTP тести

Доповніть `my-dev` активними route tests і збережіть успадковані перевірки Lesson 03. Fakes не надсилають запитів до провайдера.

**Файл:** `my-dev/lesson-04-mcp-built-in-tools/tests/app.test.ts`. Повний payload P07:

```ts
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { DocumentAi } from "../../../lesson-03-function-calling/solution/src/services/document-ai.js";
import type { ToolCallingAgent } from "../../../lesson-03-function-calling/solution/src/services/tool-calling-agent.js";

const documentAi: DocumentAi = {
  extract: vi.fn(),
  async *streamSummary() {
    return;
  },
};

async function startServer(
  mcpAgent?: ToolCallingAgent,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const app = createApp({
    ai: documentAi,
    ...(mcpAgent === undefined ? {} : { mcpAgent }),
  });
  const server: Server = app.listen(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    },
  };
}

async function postJson(baseUrl: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}/api/agent/research`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/agent/research", () => {
  it("зберігає health endpoint попереднього проєкту", async () => {
    const server = await startServer();

    try {
      const response = await fetch(`${server.baseUrl}/health`);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ status: "ok" });
    } finally {
      await server.close();
    }
  });

  it("перевикористовує AgentRequestSchema до запуску MCP runtime", async () => {
    const run = vi.fn<ToolCallingAgent["run"]>();
    const server = await startServer({ run });

    try {
      const response = await postJson(server.baseUrl, { message: "   " });

      expect(response.status).toBe(400);
      expect(run).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "INVALID_INPUT" },
      });
    } finally {
      await server.close();
    }
  });

  it("передає нормалізований запит MCP-агенту", async () => {
    const run = vi.fn<ToolCallingAgent["run"]>().mockResolvedValue({
      status: "success",
      text: "Файл прочитано.",
      model: "configured-model",
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        cachedTokens: 0,
        cacheWriteTokens: 0,
      },
      metrics: {
        modelCallCount: 2,
        toolCallCount: 1,
        retryCount: 0,
        totalLatencyMs: 25,
      },
    });
    const server = await startServer({ run });

    try {
      const response = await postJson(server.baseUrl, {
        message: "  Прочитай notes.txt  ",
      });

      expect(response.status).toBe(200);
      expect(run).toHaveBeenCalledWith("Прочитай notes.txt");
      await expect(response.json()).resolves.toMatchObject({
        status: "success",
        metrics: {
          modelCallCount: 2,
          toolCallCount: 1,
        },
      });
    } finally {
      await server.close();
    }
  });

  it("маскує внутрішню помилку MCP runtime", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const run = vi
      .fn<ToolCallingAgent["run"]>()
      .mockRejectedValue(new Error("secret-upstream-details"));
    const server = await startServer({ run });

    try {
      const response = await postJson(server.baseUrl, { message: "Прочитай файл." });
      const serializedBody = JSON.stringify(await response.json());

      expect(response.status).toBe(502);
      expect(serializedBody).toContain("MCP_AGENT_ERROR");
      expect(serializedBody).not.toContain("secret-upstream-details");
      expect(errorLog).toHaveBeenCalledWith("[MCP Agent Error]", {
        errorName: "Error",
      });
    } finally {
      await server.close();
    }
  });
});
```

**Перевірка:** `yarn student:test 04 openai`. Збережіть фактичний runner output; успадковані тести мають залишатися активними.

## Крок 9 – активуйте тести MCP adapter

Додайте активні перевірки фільтрації, повторної allowlist перевірки, аргументів, читання та безпечної відмови sandbox.

**Файл:** `my-dev/lesson-04-mcp-built-in-tools/tests/filesystem-tools.test.ts`. Повний payload P08:

```ts
import type {
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses";
import { describe, expect, it, vi } from "vitest";
import type { ListedMcpTool, LocalMcpClient } from "../src/mcp/filesystem-client.js";
import { createMcpFunctionTools, executeMcpToolCall } from "../src/mcp/filesystem-tools.js";

function createClient(callToolResult: unknown = { content: [] }): LocalMcpClient {
  return {
    listTools: vi.fn().mockResolvedValue([]),
    callTool: vi.fn().mockResolvedValue(callToolResult),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function createFunctionCall(
  name: string,
  argumentsValue: unknown,
  callId: string = "call_1",
): ResponseFunctionToolCall {
  return {
    id: `fc_${callId}`,
    type: "function_call",
    status: "completed",
    call_id: callId,
    name,
    arguments: typeof argumentsValue === "string" ? argumentsValue : JSON.stringify(argumentsValue),
  };
}

function parseOutput(output: ResponseInputItem.FunctionCallOutput): Record<string, unknown> {
  if (typeof output.output !== "string") {
    throw new TypeError("У тесті очікується текстовий function_call_output.");
  }

  return JSON.parse(output.output) as Record<string, unknown>;
}

describe("MCP tool adapter", () => {
  it("передає моделі лише явно дозволений read-only tool", () => {
    const listedTools: ListedMcpTool[] = [
      {
        name: "read_text_file",
        description: "Read text",
        inputSchema: { type: "object", properties: { path: { type: "string" } } },
      },
      {
        name: "list_allowed_directories",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "write_file",
        inputSchema: { type: "object", properties: {} },
      },
    ];

    expect(createMcpFunctionTools(listedTools)).toEqual([
      {
        type: "function",
        name: "read_text_file",
        description: "Read text",
        parameters: listedTools[0]?.inputSchema,
        strict: false,
      },
    ]);
  });

  it("повторно блокує інструмент поза allowlist до MCP-виклику", async () => {
    const client = createClient();
    const output = await executeMcpToolCall(
      createFunctionCall("write_file", { path: "notes.txt", content: "secret" }),
      client,
    );

    expect(parseOutput(output)).toMatchObject({
      status: "error",
      code: "MCP_TOOL_NOT_ALLOWED",
    });
    expect(client.callTool).not.toHaveBeenCalled();
  });

  it("відхиляє невалідні аргументи до MCP-виклику", async () => {
    const client = createClient();
    const output = await executeMcpToolCall(createFunctionCall("read_text_file", "[]"), client);

    expect(parseOutput(output)).toMatchObject({
      status: "error",
      code: "INVALID_TOOL_ARGUMENTS",
    });
    expect(client.callTool).not.toHaveBeenCalled();
  });

  it("повертає текст дозволеного MCP-результату", async () => {
    const client = createClient({
      content: [{ type: "text", text: "Локальні нотатки курсу." }],
    });
    const output = await executeMcpToolCall(
      createFunctionCall("read_text_file", { path: "notes.txt" }),
      client,
    );

    expect(parseOutput(output)).toEqual({
      status: "success",
      content: "Локальні нотатки курсу.",
    });
    expect(client.callTool).toHaveBeenCalledWith({
      name: "read_text_file",
      arguments: { path: "notes.txt" },
    });
  });

  it("перетворює відмову sandbox на стабільну помилку без витоку шляху", async () => {
    const secretPath = "C:\\Users\\student\\.env";
    const client = createClient({
      isError: true,
      content: [
        {
          type: "text",
          text: `Access denied - path outside allowed directories: ${secretPath}`,
        },
      ],
    });
    const output = await executeMcpToolCall(
      createFunctionCall("read_text_file", { path: secretPath }),
      client,
    );
    const serialized = JSON.stringify(parseOutput(output));

    expect(serialized).toContain("MCP_ACCESS_DENIED");
    expect(serialized).not.toContain(secretPath);
  });
});
```

**Перевірка:** `yarn student:test 04 openai`. Збережіть фактичний runner output і перевірте, що нові перевірки не відключають успадковані тести.

## Крок 10 – активуйте тести Responses agent

Додайте активні перевірки scripted Responses turns. Тести мають охопити hosted search, збереження output items, один локальний раунд, usage та stateless OpenAI parameters.

**Файл:** `my-dev/lesson-04-mcp-built-in-tools/tests/mcp-web-search-agent.test.ts`. Повний payload P09:

```ts
import type OpenAI from "openai";
import type {
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses";
import { describe, expect, it, vi } from "vitest";
import type { LocalMcpClient } from "../src/mcp/filesystem-client.js";
import {
  McpWebSearchAgent,
  OpenAIMcpResponsesClient,
} from "../src/services/mcp-web-search-agent.js";
import type {
  McpModelResponseRequest,
  McpModelResponsesClient,
} from "../src/services/mcp-web-search-agent.js";
import type { ModelTurn } from "../../../lesson-03-function-calling/solution/src/services/tool-calling-agent.js";

function createFunctionCall(callId: string, path: string = "notes.txt"): ResponseFunctionToolCall {
  return {
    id: `fc_${callId}`,
    type: "function_call",
    status: "completed",
    call_id: callId,
    name: "read_text_file",
    arguments: JSON.stringify({ path }),
  };
}

function createTextTurn(text: string, usage?: ModelTurn["usage"]): ModelTurn {
  return {
    output: [],
    outputText: text,
    model: "configured-model",
    ...(usage === undefined ? {} : { usage }),
  };
}

function createToolTurn(callId: string, usage?: ModelTurn["usage"]): ModelTurn {
  return {
    output: [createFunctionCall(callId)],
    outputText: "",
    model: "configured-model",
    ...(usage === undefined ? {} : { usage }),
  };
}

class SequenceResponsesClient implements McpModelResponsesClient {
  public readonly requests: McpModelResponseRequest[] = [];

  public constructor(private readonly turns: ModelTurn[]) {}

  public async createResponse(request: McpModelResponseRequest): Promise<ModelTurn> {
    this.requests.push({
      input: [...request.input],
      tools: [...request.tools],
    });
    const turn = this.turns.shift();

    if (!turn) {
      throw new Error("Неочікуваний model call у тесті.");
    }

    return turn;
  }
}

function createMcpClient(): LocalMcpClient {
  return {
    listTools: vi.fn().mockResolvedValue([
      {
        name: "read_text_file",
        description: "Read text",
        inputSchema: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
      {
        name: "write_file",
        inputSchema: { type: "object", properties: {} },
      },
    ]),
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "MCP працює." }],
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function getInputItemTypes(input: ResponseInputItem[]): string[] {
  return input.map((item) => {
    if ("type" in item && typeof item.type === "string") {
      return item.type;
    }

    return "role" in item ? item.role : "unknown";
  });
}

describe("MCP + web search agent", () => {
  it("дозволяє hosted web_search завершити запит без локального tool call", async () => {
    const responsesClient = new SequenceResponsesClient([
      createTextTurn("Актуальну інформацію знайдено.", {
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
      }),
    ]);
    const mcpClient = createMcpClient();
    const agent = new McpWebSearchAgent(responsesClient, mcpClient, () => 100);
    const result = await agent.run("Знайди актуальні новини.");

    expect(result).toMatchObject({
      status: "success",
      text: "Актуальну інформацію знайдено.",
      metrics: {
        modelCallCount: 1,
        toolCallCount: 0,
      },
    });
    expect(responsesClient.requests[0]?.tools.map((tool) => tool.type)).toEqual([
      "function",
      "web_search",
    ]);
    expect(mcpClient.callTool).not.toHaveBeenCalled();
  });

  it("повертає MCP output моделі та зберігає всі response items", async () => {
    const responsesClient = new SequenceResponsesClient([
      createToolTurn("call_read", {
        input_tokens: 10,
        output_tokens: 2,
        total_tokens: 12,
      }),
      createTextTurn("У файлі зазначено, що MCP працює.", {
        input_tokens: 20,
        output_tokens: 5,
        total_tokens: 25,
      }),
    ]);
    const mcpClient = createMcpClient();
    const times = [100, 145];
    const agent = new McpWebSearchAgent(responsesClient, mcpClient, () => times.shift() ?? 145);
    const result = await agent.run("Прочитай notes.txt");

    expect(result).toMatchObject({
      status: "success",
      usage: {
        inputTokens: 30,
        outputTokens: 7,
        totalTokens: 37,
      },
      metrics: {
        modelCallCount: 2,
        toolCallCount: 1,
        retryCount: 0,
        totalLatencyMs: 45,
      },
    });
    expect(getInputItemTypes(responsesClient.requests[1]?.input ?? [])).toEqual([
      "user",
      "function_call",
      "function_call_output",
    ]);
  });

  it("блокує другий раунд локальних викликів без виконання нового tool call", async () => {
    const responsesClient = new SequenceResponsesClient([
      createToolTurn("call_1"),
      createToolTurn("call_2"),
    ]);
    const mcpClient = createMcpClient();
    const agent = new McpWebSearchAgent(responsesClient, mcpClient, () => 100);
    const result = await agent.run("Виконай два читання.");

    expect(result).toMatchObject({
      status: "error",
      code: "TOOL_CALL_LIMIT_REACHED",
      metrics: {
        modelCallCount: 2,
        toolCallCount: 1,
      },
    });
    expect(mcpClient.callTool).toHaveBeenCalledTimes(1);
  });

  it("зупиняється, якщо MCP-сервер не надав allowlisted tools", async () => {
    const responsesClient = new SequenceResponsesClient([]);
    const mcpClient = createMcpClient();
    vi.mocked(mcpClient.listTools).mockResolvedValue([
      {
        name: "write_file",
        inputSchema: { type: "object", properties: {} },
      },
    ]);
    const agent = new McpWebSearchAgent(responsesClient, mcpClient);

    await expect(agent.run("Прочитай файл.")).rejects.toThrow(
      "MCP-сервер не надав жодного дозволеного інструмента.",
    );
  });

  it("передає OpenAI SDK hosted і локальні tools із stateless-параметрами", async () => {
    const create = vi.fn().mockResolvedValue({
      output: [],
      output_text: "Готово.",
      model: "configured-model",
      usage: null,
    });
    const openai = { responses: { create } } as unknown as OpenAI;
    const client = new OpenAIMcpResponsesClient(openai, {
      modelName: "configured-model",
      maxOutputTokens: 800,
    });
    const tools: McpModelResponseRequest["tools"] = [
      {
        type: "function",
        name: "read_text_file",
        parameters: { type: "object" },
        strict: false,
      },
      { type: "web_search" },
    ];

    await client.createResponse({
      input: [{ role: "user", content: "Тест" }],
      tools,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "configured-model",
        tools,
        tool_choice: "auto",
        parallel_tool_calls: false,
        include: ["reasoning.encrypted_content"],
        store: false,
        max_output_tokens: 800,
      }),
    );
  });
});
```

**Перевірка:** `yarn student:test 04 openai`. Перевірте фактичний результат без `todo`, `skip`, `only` чи failed tests.

## Крок 11 – залиште recorded eval без змін

Скопіюйте з `solution/` файли `evals/mcp-tools.eval.ts`, `evals/recorded-results.ts`, `evals/scorer.ts`, `evals/run.ts` і `tests/evals.test.ts` до відповідних шляхів у `my-dev/`. Вони описують два локальні читання, два web search та одну відмову. Команда:

```powershell
yarn student:eval 04 openai
```

має надрукувати `Result: 5/5`. Це офлайн replay записаних даних, не реальний запуск агента.

## Крок 12 – відформатуйте й виконайте повний student check

Після вставлення payload-ів в Windows нормалізуйте формат лише в власній папці та запустіть фінальні gates:

```powershell
yarn prettier --write "my-dev/lesson-04-mcp-built-in-tools/**/*.{md,json,ts,tsx}"
yarn student:check 04 openai
git diff --check -- my-dev/lesson-04-mcp-built-in-tools
git status --short
```

`student:check` запускає completion gate, TypeScript, lint, format, unit suite, recorded eval і build для candidate. Переконайтеся, що змінені студентські файли залишилися в `my-dev/lesson-04-mcp-built-in-tools/`. Записаний replay не підтверджує доступність live-моделі чи реальний MCP transport.

## Необов’язково – перевірте реальний локальний MCP transport (P10)

Ця перевірка запускає filesystem subprocess, але не викликає OpenAI. Якщо хочете виконати окремий local smoke, створіть файл нижче.

**Файл:** `my-dev/lesson-04-mcp-built-in-tools/scripts/smoke-filesystem-mcp.ts`. Необов’язковий payload P10:

```ts
import { resolve } from "node:path";
import { connectFilesystemMcp } from "../src/mcp/filesystem-client.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isErrorResult(value: unknown): boolean {
  return isRecord(value) && value.isError === true;
}

function extractText(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.content)) {
    return "";
  }

  return value.content
    .flatMap((item) =>
      isRecord(item) && item.type === "text" && typeof item.text === "string" ? [item.text] : [],
    )
    .join("\n");
}

const sandboxPath = resolve("my-dev", "lesson-04-mcp-built-in-tools", "sandbox");
const client = await connectFilesystemMcp(sandboxPath);

try {
  const tools = await client.listTools();
  const toolNames = new Set(tools.map((tool) => tool.name));

  // Raw server discovery can expose service tools that the model-facing adapter filters out.
  if (!toolNames.has("read_text_file") || !toolNames.has("list_allowed_directories")) {
    throw new Error("Filesystem MCP server не надав очікувані service tools.");
  }

  const readResult = await client.callTool({
    name: "read_text_file",
    arguments: { path: "notes.txt" },
  });

  if (isErrorResult(readResult) || !extractText(readResult).includes("Model Context Protocol")) {
    throw new Error("Дозволений файл не прочитано через MCP.");
  }

  const deniedResult = await client.callTool({
    name: "read_text_file",
    arguments: { path: resolve(".env.example") },
  });

  if (!isErrorResult(deniedResult)) {
    throw new Error("Filesystem MCP server не заблокував шлях поза sandbox.");
  }

  console.log("PASS filesystem MCP: server discovery, sandbox read, outside-path denial");
} finally {
  await client.close();
}
```

Запускайте з кореня репозиторію:

```powershell
node scripts/run-tsx-entrypoint.mjs my-dev/lesson-04-mcp-built-in-tools/scripts/smoke-filesystem-mcp.ts
```

Smoke перевіряє discovery, читання файла з student sandbox, відмову для шляху поза sandbox і закриття client. Зафіксуйте результат окремо від offline unit tests і eval replay.

## Необов’язково – виконайте live-запит до OpenAI

Якщо вирішили витратити API квоту, задайте в кореневому `.env` значення, перелічені в [student-guide.md](./student-guide.md), запустіть `yarn dev:my:lesson04:openai` і надішліть синтетичний запит. Не додавайте credentials до Git. Live-результат фіксуйте окремо; якщо перевірку пропущено, вкажіть `NOT RUN`.
