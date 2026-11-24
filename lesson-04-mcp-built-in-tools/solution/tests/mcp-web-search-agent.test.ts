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
