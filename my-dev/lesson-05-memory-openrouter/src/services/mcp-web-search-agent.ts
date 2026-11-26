import type OpenAI from "openai";
import type {
  ChatCompletion,
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { resolveModelCapabilities } from "../config/model-capabilities.js";
import { DEFAULT_REASONING_EFFORT, type ReasoningEffort } from "../config/openrouter.js";
import { DocumentAiError } from "../lib/errors.js";
import { extractUsageMetrics, normalizeChatUsage, sumUsageMetrics } from "../lib/metrics.js";
import type { ResponseUsageLike, UsageMetrics } from "../lib/metrics.js";
import { mapOpenRouterError } from "./openrouter-document-ai.js";
import type {
  AgentRunMetrics,
  AgentRunResult,
  ModelTurn,
  OpenAIChatCompletionsClientOptions,
  ToolCallingAgent,
} from "./tool-calling-agent.js";
import type { LocalMcpClient } from "../mcp/filesystem-client.js";
import { createMcpChatTools, executeMcpToolCall } from "../mcp/filesystem-tools.js";

export const MCP_AGENT_INSTRUCTIONS = [
  "Локальні матеріали курсу читаються через read_text_file; передавай відносну назву файлу, наприклад 'notes.txt'.",
  "Актуальна або зовнішня інформація шукається в мережі за допомогою веб-пошуку; у відповіді наводяться посилання на джерела.",
  "Шляхи поза дозволеною sandbox-папкою не запитуються повторно.",
  "Якщо локальний інструмент повертає MCP_ACCESS_DENIED, формується коротке пояснення відмови без розкриття системних шляхів.",
].join("\n");

export interface McpModelResponseRequest {
  messages: ChatCompletionMessageParam[];
  tools: ChatCompletionTool[];
}

export interface McpModelTurn extends ModelTurn {
  webSearchRequestCount?: number;
  webSearchUsed?: boolean;
}

export interface McpModelResponsesClient {
  createResponse(request: McpModelResponseRequest): Promise<McpModelTurn>;
}

interface OpenRouterWebSearchTool {
  type: "openrouter:web_search";
  parameters: {
    max_results: 5;
    max_uses: 1;
  };
}

interface OpenRouterMcpRequest {
  model: string;
  messages: ChatCompletionMessageParam[];
  tools: Array<ChatCompletionTool | OpenRouterWebSearchTool>;
  tool_choice?: "auto";
  max_completion_tokens: number;
  temperature: number;
  provider: { require_parameters: true };
  reasoning?: { effort: ReasoningEffort; exclude: false };
  stream?: false;
}

export class OpenAIMcpChatCompletionsClient implements McpModelResponsesClient {
  public constructor(
    private readonly client: OpenAI,
    private readonly options: Readonly<OpenAIChatCompletionsClientOptions>,
  ) {}

  public async createResponse(request: McpModelResponseRequest): Promise<McpModelTurn> {
    const capabilities = resolveModelCapabilities(this.options.modelName);

    try {
      const openRouterRequest: OpenRouterMcpRequest = {
        model: this.options.modelName,
        messages: [{ role: "system", content: MCP_AGENT_INSTRUCTIONS }, ...request.messages],
        tools: [
          ...request.tools,
          {
            type: "openrouter:web_search",
            parameters: { max_results: 5, max_uses: 1 },
          },
        ],
        tool_choice: "auto",
        max_completion_tokens: this.options.maxOutputTokens,
        temperature: 0,
        provider: { require_parameters: true },
        ...(capabilities.reasoning
          ? {
              reasoning: {
                effort: this.options.reasoningEffort ?? DEFAULT_REASONING_EFFORT,
                exclude: false as const,
              },
            }
          : {}),
        stream: false,
      };

      const response = (await this.client.chat.completions.create(
        openRouterRequest as unknown as Parameters<typeof this.client.chat.completions.create>[0],
      )) as ChatCompletion;
      const choice = response.choices[0];

      if (!choice) {
        throw new DocumentAiError(
          "RESPONSE_FAILED",
          "Модель не повернула результат генерації.",
          502,
        );
      }

      if (choice.finish_reason === "length") {
        throw new DocumentAiError("INCOMPLETE_RESPONSE", "Генерацію не було завершено.", 502, {
          reason: "max_tokens",
        });
      }

      if (choice.finish_reason === "content_filter" || choice.message.refusal) {
        throw new DocumentAiError("REQUEST_REFUSED", "Модель відхилила запит.", 422);
      }

      const toolCalls = (choice.message.tool_calls ?? []).filter(
        (call): call is ChatCompletionMessageFunctionToolCall => call.type === "function",
      );
      const openRouterMessage = choice.message as typeof choice.message & {
        annotations?: unknown;
        reasoning?: unknown;
        reasoning_details?: unknown;
      };
      const reasoning =
        typeof openRouterMessage.reasoning === "string" ? openRouterMessage.reasoning : undefined;
      const reasoningDetails = Array.isArray(openRouterMessage.reasoning_details)
        ? openRouterMessage.reasoning_details
        : undefined;

      const citationUrls = extractCitationUrls(openRouterMessage.annotations);
      const webSearchRequestCount = extractWebSearchRequestCount(response.usage);
      const webSearchUsed = webSearchRequestCount > 0 || citationUrls.length > 0;

      return {
        outputText: appendCitationUrls(choice.message.content ?? "", citationUrls),
        toolCalls,
        model: response.model || this.options.modelName,
        ...(response.usage === undefined ? {} : { usage: normalizeChatUsage(response.usage) }),
        webSearchRequestCount,
        webSearchUsed,
        ...(reasoning === undefined ? {} : { reasoning }),
        ...(reasoningDetails === undefined ? {} : { reasoningDetails }),
      };
    } catch (error) {
      throw mapOpenRouterError(error);
    }
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
    const tools = createMcpChatTools(listedTools);

    if (tools.length === 0) {
      throw new Error("MCP-сервер не надав жодного дозволеного інструмента.");
    }

    const messages: ChatCompletionMessageParam[] = [{ role: "user", content: message }];
    let usage = extractUsageMetrics();
    let modelCallCount = 0;
    let toolCallCount = 0;
    let webSearchRequestCount = 0;
    let webSearchUsed = false;

    const firstTurn = await this.responsesClient.createResponse({ messages, tools });
    modelCallCount += 1;
    usage = addUsage(usage, firstTurn.usage);
    webSearchRequestCount += firstTurn.webSearchRequestCount ?? 0;
    webSearchUsed ||= firstTurn.webSearchUsed ?? false;

    if (firstTurn.toolCalls.length === 0) {
      return createFinalResult(
        firstTurn,
        usage,
        modelCallCount,
        toolCallCount,
        webSearchRequestCount,
        webSearchUsed,
        startedAt,
        this.now,
      );
    }

    messages.push({
      role: "assistant",
      ...(firstTurn.outputText.length > 0 ? { content: firstTurn.outputText } : { content: null }),
      tool_calls: firstTurn.toolCalls,
      ...(firstTurn.reasoning === undefined ? {} : { reasoning: firstTurn.reasoning }),
      ...(firstTurn.reasoningDetails === undefined
        ? {}
        : { reasoning_details: firstTurn.reasoningDetails }),
    } as ChatCompletionMessageParam);

    for (const call of firstTurn.toolCalls) {
      toolCallCount += 1;
      messages.push(await executeMcpToolCall(call, this.mcpClient));
    }

    const finalTurn = await this.responsesClient.createResponse({ messages, tools });
    modelCallCount += 1;
    usage = addUsage(usage, finalTurn.usage);
    webSearchRequestCount += finalTurn.webSearchRequestCount ?? 0;
    webSearchUsed ||= finalTurn.webSearchUsed ?? false;

    if (finalTurn.toolCalls.length > 0) {
      return {
        status: "error",
        code: "TOOL_CALL_LIMIT_REACHED",
        message: "Навчальний runtime зупинено після одного раунду локальних MCP-викликів.",
        model: finalTurn.model,
        usage,
        metrics: createMetrics(
          modelCallCount,
          toolCallCount,
          webSearchRequestCount,
          webSearchUsed,
          startedAt,
          this.now,
        ),
      };
    }

    return createFinalResult(
      finalTurn,
      usage,
      modelCallCount,
      toolCallCount,
      webSearchRequestCount,
      webSearchUsed,
      startedAt,
      this.now,
    );
  }
}

function addUsage(current: UsageMetrics, next: ResponseUsageLike | null | undefined): UsageMetrics {
  return sumUsageMetrics(current, extractUsageMetrics(next));
}

function createFinalResult(
  turn: McpModelTurn,
  usage: UsageMetrics,
  modelCallCount: number,
  toolCallCount: number,
  webSearchRequestCount: number,
  webSearchUsed: boolean,
  startedAt: number,
  now: () => number,
): AgentRunResult {
  const outputText = turn.outputText.trim();
  const metrics = createMetrics(
    modelCallCount,
    toolCallCount,
    webSearchRequestCount,
    webSearchUsed,
    startedAt,
    now,
  );

  if (outputText === "") {
    return {
      status: "error",
      code: "EMPTY_MODEL_RESPONSE",
      message: "Модель не повернула фінальної відповіді.",
      model: turn.model,
      usage,
      metrics,
    };
  }

  return {
    status: "success",
    text: outputText,
    model: turn.model,
    usage,
    metrics,
  };
}

function createMetrics(
  modelCallCount: number,
  toolCallCount: number,
  webSearchRequestCount: number,
  webSearchUsed: boolean,
  startedAt: number,
  now: () => number,
): AgentRunMetrics & { webSearchRequestCount: number; webSearchUsed: boolean } {
  return {
    modelCallCount,
    toolCallCount,
    webSearchRequestCount,
    webSearchUsed,
    retryCount: 0,
    totalLatencyMs: Math.max(0, Math.round(now() - startedAt)),
  };
}

function extractWebSearchRequestCount(usage: unknown): number {
  if (typeof usage !== "object" || usage === null || !("server_tool_use" in usage)) {
    return 0;
  }

  const serverToolUse = usage.server_tool_use;
  if (
    typeof serverToolUse !== "object" ||
    serverToolUse === null ||
    !("web_search_requests" in serverToolUse)
  ) {
    return 0;
  }

  const value = serverToolUse.web_search_requests;
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function extractCitationUrls(annotations: unknown): string[] {
  if (!Array.isArray(annotations)) {
    return [];
  }

  return annotations
    .map((annotation): string | null => {
      if (
        typeof annotation !== "object" ||
        annotation === null ||
        !("url_citation" in annotation) ||
        typeof annotation.url_citation !== "object" ||
        annotation.url_citation === null ||
        !("url" in annotation.url_citation) ||
        typeof annotation.url_citation.url !== "string"
      ) {
        return null;
      }

      try {
        const url = new URL(annotation.url_citation.url);
        return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
      } catch {
        return null;
      }
    })
    .filter((url): url is string => url !== null)
    .filter((url, index, all) => all.indexOf(url) === index);
}

function appendCitationUrls(text: string, citationUrls: string[]): string {
  const urls = citationUrls.filter((url) => !text.includes(url));

  if (urls.length === 0) {
    return text;
  }

  const sourceList = urls.map((url) => `- ${url}`).join("\n");
  return `${text.trim()}\n\nДжерела:\n${sourceList}`;
}
