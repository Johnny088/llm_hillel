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
