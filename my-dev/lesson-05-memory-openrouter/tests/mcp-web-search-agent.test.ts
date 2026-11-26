import type OpenAI from "openai";
import type {
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { describe, expect, it, vi } from "vitest";
import type { LocalMcpClient } from "../src/mcp/filesystem-client.js";
import {
  McpWebSearchAgent,
  OpenAIMcpChatCompletionsClient,
} from "../src/services/mcp-web-search-agent.js";
import type {
  McpModelTurn,
  McpModelResponseRequest,
  McpModelResponsesClient,
} from "../src/services/mcp-web-search-agent.js";
import type { ModelTurn } from "../src/services/tool-calling-agent.js";
import { DEFAULT_OPENROUTER_MODEL } from "../src/config/openrouter.js";

function createFunctionCall(
  callId: string,
  path: string = "notes.txt",
): ChatCompletionMessageFunctionToolCall {
  return {
    id: callId,
    type: "function",
    function: {
      name: "read_text_file",
      arguments: JSON.stringify({ path }),
    },
  };
}

function createTextTurn(
  text: string,
  usage?: ModelTurn["usage"],
  details: Partial<
    Pick<McpModelTurn, "reasoning" | "reasoningDetails" | "webSearchRequestCount" | "webSearchUsed">
  > = {},
): McpModelTurn {
  return {
    outputText: text,
    toolCalls: [],
    model: "configured-model",
    ...(usage === undefined ? {} : { usage }),
    ...details,
  };
}

function createToolTurn(
  callId: string,
  usage?: ModelTurn["usage"],
  details: Partial<Pick<McpModelTurn, "reasoning" | "reasoningDetails">> = {},
): McpModelTurn {
  return {
    outputText: "",
    toolCalls: [createFunctionCall(callId)],
    model: "configured-model",
    ...(usage === undefined ? {} : { usage }),
    ...details,
  };
}

class SequenceResponsesClient implements McpModelResponsesClient {
  public readonly requests: McpModelResponseRequest[] = [];

  public constructor(private readonly turns: McpModelTurn[]) {}

  public async createResponse(request: McpModelResponseRequest): Promise<McpModelTurn> {
    this.requests.push({
      messages: [...request.messages],
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

function getMessageRoles(messages: ChatCompletionMessageParam[]): string[] {
  return messages.map((item) => item.role);
}

describe("MCP + web search agent (OpenRouter)", () => {
  it("дозволяє hosted web_search завершити запит без локального tool call", async () => {
    const responsesClient = new SequenceResponsesClient([
      createTextTurn(
        "Актуальну інформацію знайдено через веб-пошук.",
        {
          input_tokens: 10,
          output_tokens: 5,
          total_tokens: 15,
        },
        {
          webSearchRequestCount: 1,
          webSearchUsed: true,
        },
      ),
    ]);
    const mcpClient = createMcpClient();
    const agent = new McpWebSearchAgent(responsesClient, mcpClient, () => 100);
    const result = await agent.run("Знайди актуальні новини.");

    expect(result).toMatchObject({
      status: "success",
      text: "Актуальну інформацію знайдено через веб-пошук.",
      metrics: {
        modelCallCount: 1,
        toolCallCount: 0,
        webSearchRequestCount: 1,
        webSearchUsed: true,
      },
    });
    expect(responsesClient.requests[0]?.tools.map((tool) => tool.type)).toEqual(["function"]);
    expect(mcpClient.callTool).not.toHaveBeenCalled();
  });

  it("повертає MCP output моделі та зберігає всі повідомлення розмови", async () => {
    const responsesClient = new SequenceResponsesClient([
      createToolTurn(
        "call_read",
        {
          input_tokens: 10,
          output_tokens: 2,
          total_tokens: 12,
        },
        {
          reasoningDetails: [{ type: "reasoning.encrypted", data: "opaque-test-value" }],
        },
      ),
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
    expect(getMessageRoles(responsesClient.requests[1]?.messages ?? [])).toEqual([
      "user",
      "assistant",
      "tool",
    ]);
    expect(responsesClient.requests[1]?.messages[1]).toMatchObject({
      role: "assistant",
      reasoning_details: [{ type: "reasoning.encrypted", data: "opaque-test-value" }],
    });
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

  it("передає OpenRouter server tool для model-controlled web search", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            role: "assistant",
            content: "Готово.",
            annotations: [
              {
                type: "url_citation",
                url_citation: { url: "https://modelcontextprotocol.io/", title: "MCP" },
              },
            ],
          },
          finish_reason: "stop",
        },
      ],
      model: "configured-model",
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
        server_tool_use: { web_search_requests: 1 },
      },
    });
    const openai = {
      chat: { completions: { create } },
    } as unknown as OpenAI;
    const client = new OpenAIMcpChatCompletionsClient(openai, {
      modelName: DEFAULT_OPENROUTER_MODEL,
      maxOutputTokens: 800,
      reasoningEffort: "high",
    });
    const tools = [
      {
        type: "function" as const,
        function: {
          name: "read_text_file",
          parameters: { type: "object" },
          strict: false,
        },
      },
    ];

    const result = await client.createResponse({
      messages: [{ role: "user", content: "Тест" }],
      tools,
    });

    const sentRequest = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_OPENROUTER_MODEL,
        tools: [
          ...tools,
          {
            type: "openrouter:web_search",
            parameters: { max_results: 5, max_uses: 1 },
          },
        ],
        tool_choice: "auto",
        max_completion_tokens: 800,
        temperature: 0,
        provider: { require_parameters: true },
        reasoning: { effort: "high", exclude: false },
        stream: false,
      }),
    );
    expect(sentRequest).not.toHaveProperty("plugins");
    expect(result).toMatchObject({
      outputText: "Готово.\n\nДжерела:\n- https://modelcontextprotocol.io/",
      webSearchRequestCount: 1,
      webSearchUsed: true,
    });
  });
});
