import { once } from "node:events";
import type { AddressInfo } from "node:net";
import OpenAI from "openai";
import { z } from "zod";
import { createApp } from "./app.js";
import { loadEnvironment, loadRepositoryEnvFile } from "./config/env.js";
import { resolveModel } from "./config/models.js";
import { OpenRouterDocumentAi } from "./services/openrouter-document-ai.js";
import {
  ChatCompletionsToolCallingAgent,
  OpenAIChatCompletionsClient,
} from "./services/tool-calling-agent.js";
import type { ToolCallTrace } from "./services/tool-calling-agent.js";
import { ConvertCurrencyArgsSchema, EducationalRateProvider } from "./tools/currency.js";

const DEFAULT_MESSAGE = "Конвертуй 250 USD у UAH";

const UsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  cachedTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
});

const AgentApiResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  text: z.string().min(1).optional(),
  model: z.string().min(1),
  usage: UsageSchema,
  metrics: z
    .object({
      modelCallCount: z.number().int().nonnegative(),
      toolCallCount: z.number().int().nonnegative(),
      retryCount: z.number().int().nonnegative(),
      totalLatencyMs: z.number().nonnegative(),
    })
    .passthrough(),
});

const SuccessfulToolOutputSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    amount: z.number().positive(),
    from: z.string().regex(/^[A-Z]{3}$/),
    to: z.string().regex(/^[A-Z]{3}$/),
    rate: z.number().positive(),
    convertedAmount: z.number().nonnegative(),
  }),
});

async function readJson<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const body = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(body)}`);
  }

  return schema.parse(body);
}

function normalizedNumber(value: number | string): string {
  return String(value).replace(/\D/gu, "");
}

async function main(): Promise<void> {
  loadRepositoryEnvFile();
  const environment = loadEnvironment(process.env);
  const message = process.argv.slice(2).join(" ").trim() || DEFAULT_MESSAGE;
  const primaryModel = resolveModel("main", environment);
  const toolCalls: ToolCallTrace[] = [];
  const toolOutputs: string[] = [];
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
  const ai = new OpenRouterDocumentAi(openai, {
    fastModel: resolveModel("fast", environment),
    mainModel: primaryModel,
    maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
    reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
  });
  const chatClient = new OpenAIChatCompletionsClient(openai, {
    modelName: primaryModel,
    maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
    reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
  });
  const toolAgent = new ChatCompletionsToolCallingAgent(chatClient, new EducationalRateProvider(), {
    onToolCall: (event) => toolCalls.push(event),
    onToolOutput: (output) => {
      if (output.role === "tool" && typeof output.content === "string") {
        toolOutputs.push(output.content);
      }
    },
  });
  const app = createApp({ ai, toolAgent });
  const server = app.listen(0, "127.0.0.1");

  try {
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    console.log("=================================================================");
    console.log("  🚀 ДЕМОНСТРАЦІЯ LESSON 03: TOOL CALLING (OpenRouter)");
    console.log("=================================================================");
    console.log(`  👤 Повідомлення:   "${message}"`);
    console.log(`  🤖 Основна модель:  ${primaryModel}`);
    console.log(`  🧠 Reasoning:       ${environment.OPENROUTER_REASONING_EFFORT}`);
    console.log("-----------------------------------------------------------------\n");

    console.log("[1/2] 🔍 Перевірка локального сервера");
    console.log("  ➜ GET /health");
    const healthResponse = await fetch(`${baseUrl}/health`);
    const health = await readJson(healthResponse, z.object({ status: z.literal("ok") }));
    console.log(`  ✔ Отримано: HTTP ${healthResponse.status} (status: ${health.status})\n`);

    console.log("[2/2] ⚡ Реальний цикл Tool Calling");
    console.log("  ➜ POST /api/agent");
    console.log(`  ➜ Тіло запиту: ${JSON.stringify({ message })}`);
    console.log("  ⏳ Очікування відповіді моделі OpenRouter...\n");

    const agentHttpResponse = await fetch(`${baseUrl}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ message }),
    });
    const agent = await readJson(agentHttpResponse, AgentApiResponseSchema);

    if (agent.status !== "success" || agent.text === undefined || agent.text.trim() === "") {
      throw new Error(`Агент не повернув фінальної відповіді: ${JSON.stringify(agent)}`);
    }
    if (toolCalls.length !== 1 || toolOutputs.length !== 1) {
      throw new Error(
        `Очікувався один tool call і один tool output, отримано ${toolCalls.length}/${toolOutputs.length}.`,
      );
    }

    const toolCall = toolCalls[0];
    const serializedToolOutput = toolOutputs[0];

    if (!toolCall || serializedToolOutput === undefined) {
      throw new Error("Не вдалося прочитати фактичний tool call або tool output.");
    }

    const toolArguments = ConvertCurrencyArgsSchema.parse(JSON.parse(toolCall.arguments));
    const toolOutput = SuccessfulToolOutputSchema.parse(JSON.parse(serializedToolOutput));

    if (
      toolOutput.data.amount !== toolArguments.amount ||
      toolOutput.data.from !== toolArguments.from ||
      toolOutput.data.to !== toolArguments.to
    ) {
      throw new Error("Tool output не відповідає аргументам, які повернула модель.");
    }

    const expectedNumber = normalizedNumber(toolOutput.data.convertedAmount);
    const answerNumber = normalizedNumber(agent.text);

    if (expectedNumber === "" || !answerNumber.includes(expectedNumber)) {
      throw new Error(
        `Фінальна відповідь не містить обчислений результат ${toolOutput.data.convertedAmount}.`,
      );
    }

    console.log("-----------------------------------------------------------------");
    console.log("  📋 Хід виконання запиту");
    console.log("-----------------------------------------------------------------");
    console.log(`  1. 🤖 Модель ініціювала Tool Call: ${toolCall.toolName}`);
    console.log(`     Аргументи: ${toolCall.arguments}`);
    console.log("  2. ⚙️  Локальне виконання функції:");
    console.log(`     Результат: ${serializedToolOutput}`);
    console.log("  3. 💬 Фінальна відповідь моделі (після отримання результату інструменту):");
    const agentLines = agent.text.trim().split("\n");
    for (const line of agentLines) {
      console.log(`     │ ${line}`);
    }
    console.log("-----------------------------------------------------------------");
    console.log("  📊 Метрики та статистика:");
    console.log(`     • Фактична модель:   ${agent.model}`);
    console.log(
      `     • Кількість викликів: model=${agent.metrics.modelCallCount}, tool=${agent.metrics.toolCallCount}, retry=${agent.metrics.retryCount}`,
    );
    console.log(`     • Загальний час:     ${(agent.metrics.totalLatencyMs / 1_000).toFixed(1)} с`);
    console.log(`     • Використано токенів: ${agent.usage.totalTokens}`);
    console.log("=================================================================");
    console.log("  ✨ ПІДСУМОК: УСІ ПЕРЕВІРКИ LESSON 03 ПРОЙДЕНО, TOOL CALLING ПРАЦЮЄ!");
    console.log("=================================================================\n");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Невідома помилка.";
  console.error(`=== ДЕМОНСТРАЦІЮ НЕ ПРОЙДЕНО: ${message} ===`);
  process.exitCode = 1;
});
