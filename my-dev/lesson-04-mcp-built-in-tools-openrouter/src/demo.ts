import { once } from "node:events";
import type { AddressInfo } from "node:net";
// import OpenAI from "openai";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";
import { createApp } from "./app.js";
// import { loadEnvironment, loadRepositoryEnvFile } from "./config/env.js";
import { createLesson04Runtime } from "./runtime.js";
import { loadEnvironment } from "./config/env.js";
import { resolveModel } from "./config/models.js";
// import { OpenRouterDocumentAi } from "./services/openrouter-document-ai.js";
// import {
//   ChatCompletionsToolCallingAgent,
//   OpenAIChatCompletionsClient,
// } from "./services/tool-calling-agent.js";
// import type { ToolCallTrace } from "./services/tool-calling-agent.js";
// import { ConvertCurrencyArgsSchema, EducationalRateProvider } from "./tools/currency.js";

// const DEFAULT_MESSAGE = "Конвертуй 250 USD у UAH";

// const UsageSchema = z.object({
//   inputTokens: z.number().int().nonnegative(),
//   outputTokens: z.number().int().nonnegative(),
//   totalTokens: z.number().int().nonnegative(),
//   cachedTokens: z.number().int().nonnegative(),
//   cacheWriteTokens: z.number().int().nonnegative(),
// });

const AgentApiResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  //   text: z.string().min(1).optional(),
  //   model: z.string().min(1),
  //   usage: UsageSchema,
  //   metrics: z
  //     .object({
  //       modelCallCount: z.number().int().nonnegative(),
  //       toolCallCount: z.number().int().nonnegative(),
  //       retryCount: z.number().int().nonnegative(),
  //       totalLatencyMs: z.number().nonnegative(),
  //     })
  //     .passthrough(),
  // });

  // const SuccessfulToolOutputSchema = z.object({
  //   status: z.literal("success"),
  //   data: z.object({
  //     amount: z.number().positive(),
  //     from: z.string().regex(/^[A-Z]{3}$/),
  //     to: z.string().regex(/^[A-Z]{3}$/),
  //     rate: z.number().positive(),
  //     convertedAmount: z.number().nonnegative(),
  text: z.string().optional(),
  code: z.string().optional(),
  message: z.string().optional(),
  model: z.string(),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  }),
  metrics: z.object({
    modelCallCount: z.number().int().nonnegative(),
    toolCallCount: z.number().int().nonnegative(),
    webSearchRequestCount: z.number().int().nonnegative(),
    webSearchUsed: z.boolean(),
    retryCount: z.number().int().nonnegative(),
    totalLatencyMs: z.number().int().nonnegative(),
  }),
});

async function readJson<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const body = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(body)}`);
  }

  return schema.parse(body);
}

// function normalizedNumber(value: number | string): string {
//   return String(value).replace(/\D/gu, "");
// }
function truncateText(text: string, maxLength: number = 320): string {
  const clean = text.trim();
  if (clean.length <= maxLength) {
    return clean;
  }
  return clean.slice(0, maxLength) + "\n...(повну відповідь див. вище або в клієнті)";
}

async function fetchWithProgress<T>(
  url: string,
  body: unknown,
  schema: z.ZodType<T>,
  stepLabel: string,
): Promise<{ data: T; latencyMs: number; status: number }> {
  process.stdout.write(`⏳ Звернення до OpenRouter API [${stepLabel}] `);
  const startedAt = performance.now();
  const interval = setInterval(() => {
    process.stdout.write(".");
  }, 1000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    clearInterval(interval);
    const latencyMs = Math.round(performance.now() - startedAt);
    process.stdout.write(` готово (${(latencyMs / 1000).toFixed(1)} с)\n`);
    const data = await readJson(response, schema);
    return { data, latencyMs, status: response.status };
  } catch (error) {
    clearInterval(interval);
    process.stdout.write(` помилка!\n`);
    throw error;
  }
}

// async function main(): Promise<void> {
//   loadRepositoryEnvFile();
export async function runLiveDemo(): Promise<void> {
  dotenv.config({ quiet: true });

  const environment = loadEnvironment(process.env);

  // const message = process.argv.slice(2).join(" ").trim() || DEFAULT_MESSAGE;

  const primaryModel = resolveModel("main", environment);

  // const toolCalls: ToolCallTrace[] = [];
  // const toolOutputs: string[] = [];
  // const openai = new OpenAI({
  //   apiKey: environment.OPENROUTER_API_KEY,
  //   baseURL: environment.OPENROUTER_BASE_URL,
  //   timeout: environment.OPENROUTER_TIMEOUT_MS,
  //   maxRetries: 0,
  //   defaultHeaders: {
  //     "HTTP-Referer": environment.OPENROUTER_HTTP_REFERER,
  //     "X-Title": environment.OPENROUTER_APP_TITLE,
  //   },
  // });
  // const ai = new OpenRouterDocumentAi(openai, {
  //   fastModel: resolveModel("fast", environment),
  //   mainModel: primaryModel,
  //   maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
  //   reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
  // });
  // const chatClient = new OpenAIChatCompletionsClient(openai, {
  //   modelName: primaryModel,
  //   maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
  //   reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
  // });
  // const toolAgent = new ChatCompletionsToolCallingAgent(chatClient, new EducationalRateProvider(), {
  //   onToolCall: (event) => toolCalls.push(event),
  //   onToolOutput: (output) => {
  //     if (output.role === "tool" && typeof output.content === "string") {
  //       toolOutputs.push(output.content);
  //     }
  //   },
  // });
  // const app = createApp({ ai, toolAgent });
  // const server = app.listen(0, "127.0.0.1");
  console.log("==================================================================");
  console.log("   ДЕМОНСТРАЦІЯ LESSON 04: MODEL CONTEXT PROTOCOL ТА WEB SEARCH   ");
  console.log("==================================================================");
  console.log(`Основна модель: ${primaryModel}`);
  console.log(`MCP-сервер: @modelcontextprotocol/server-filesystem (локальний stdio підпроцес)`);
  console.log("Ініціалізація локального runtime...\n");

  const runtime = await createLesson04Runtime(environment);

  try {
    const app = createApp(runtime.dependencies);
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    // console.log("=================================================================");
    // console.log("  🚀 ДЕМОНСТРАЦІЯ LESSON 03: TOOL CALLING (OpenRouter)");
    // console.log("=================================================================");
    // console.log(`  👤 Повідомлення:   "${message}"`);
    // console.log(`  🤖 Основна модель:  ${primaryModel}`);
    // console.log(`  🧠 Reasoning:       ${environment.OPENROUTER_REASONING_EFFORT}`);
    // console.log("-----------------------------------------------------------------\n");

    // console.log("[1/2] 🔍 Перевірка локального сервера");
    // console.log("  ➜ GET /health");
    // const healthResponse = await fetch(`${baseUrl}/health`);
    // const health = await readJson(healthResponse, z.object({ status: z.literal("ok") }));
    // console.log(`  ✔ Отримано: HTTP ${healthResponse.status} (status: ${health.status})\n`);

    // console.log("[2/2] ⚡ Реальний цикл Tool Calling");
    // console.log("  ➜ POST /api/agent");
    // console.log(`  ➜ Тіло запиту: ${JSON.stringify({ message })}`);
    // console.log("  ⏳ Очікування відповіді моделі OpenRouter...\n");

    // const agentHttpResponse = await fetch(`${baseUrl}/api/agent`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json; charset=utf-8" },
    //   body: JSON.stringify({ message }),
    // });
    // const agent = await readJson(agentHttpResponse, AgentApiResponseSchema);

    // if (agent.status !== "success" || agent.text === undefined || agent.text.trim() === "") {
    //   throw new Error(`Агент не повернув фінальної відповіді: ${JSON.stringify(agent)}`);
    // }
    // if (toolCalls.length !== 1 || toolOutputs.length !== 1) {
    //   throw new Error(
    //     `Очікувався один tool call і один tool output, отримано ${toolCalls.length}/${toolOutputs.length}.`,
    try {
      // [1/3] Health check
      console.log("------------------------------------------------------------------");
      console.log("[1/3] Перевірка працездатності локального HTTP-сервера");
      console.log("------------------------------------------------------------------");
      console.log("Надіслано: GET /health");
      const healthResponse = await fetch(`${baseUrl}/health`);
      const health = await readJson(healthResponse, z.object({ status: z.literal("ok") }));
      console.log(`Отримано: HTTP ${healthResponse.status}, status="${health.status}"`);
      console.log("Результат: Локальний API активний та готовий приймати запити.\n");

      // [2/3] Scenario 1: Local MCP Read
      console.log("------------------------------------------------------------------");
      console.log("[2/3] Сценарій 1: Читання локальних даних через Model Context Protocol (MCP)");
      console.log("------------------------------------------------------------------");
      const mcpPrompt = "Прочитай notes.txt у локальній sandbox-папці";
      console.log(`Користувацький запит: "${mcpPrompt}"`);
      console.log("Дії runtime:");
      console.log("  1. Підключення до локального MCP filesystem-сервера через stdio.");
      console.log("  2. Передача моделі лише дозволеного інструмента read_text_file.");
      console.log("  3. Модель обирає read_text_file(path: 'notes.txt').");
      console.log("  4. MCP-сервер безпечно читає вміст sandbox/notes.txt і повертає його агенту.");
      console.log("  5. Модель аналізує результат та формує українськомовну відповідь.\n");

      const { data: mcpData, status: mcpStatus } = await fetchWithProgress(
        `${baseUrl}/api/agent/research`,
        { message: mcpPrompt },
        AgentApiResponseSchema,
        "виконання MCP tool call",
      );

      // const toolCall = toolCalls[0];
      // const serializedToolOutput = toolOutputs[0];

      // if (!toolCall || serializedToolOutput === undefined) {
      //   throw new Error("Не вдалося прочитати фактичний tool call або tool output.");
      // }

      // const toolArguments = ConvertCurrencyArgsSchema.parse(JSON.parse(toolCall.arguments));
      // const toolOutput = SuccessfulToolOutputSchema.parse(JSON.parse(serializedToolOutput));
      if (mcpData.status !== "success" || !mcpData.text) {
        throw new Error(`Сценарій 1 завершився з помилкою: ${mcpData.message ?? mcpData.code}`);
      }
      if (mcpData.metrics.toolCallCount < 1) {
        throw new Error("Сценарій 1 не виконав локальний MCP tool call.");
      }

      // if (
      //   toolOutput.data.amount !== toolArguments.amount ||
      //   toolOutput.data.from !== toolArguments.from ||
      //   toolOutput.data.to !== toolArguments.to
      // ) {
      //   throw new Error("Tool output не відповідає аргументам, які повернула модель.");
      // }
      console.log(`\nСтатус відповіді: HTTP ${mcpStatus} [${mcpData.status.toUpperCase()}]`);
      console.log(`Відповіла модель: ${mcpData.model}`);
      console.log(
        `Виклики: modelCalls=${mcpData.metrics.modelCallCount}, toolCalls=${mcpData.metrics.toolCallCount}`,
      );
      console.log(
        `Час виконання: ${(mcpData.metrics.totalLatencyMs / 1000).toFixed(1)} с | Токени: ${mcpData.usage.totalTokens}`,
      );
      console.log("\nТекст відповіді агента:");
      console.log("┌─────────────────────────────────────────────────────────────────");
      console.log(
        mcpData.text
          .split("\n")
          .map((line) => `│ ${line}`)
          .join("\n"),
      );
      console.log("└─────────────────────────────────────────────────────────────────");
      console.log("Результат: Локальний MCP filesystem-сервер успішно підключено та прочитано.\n");

      // [3/3] Scenario 2: Web Search
      console.log("------------------------------------------------------------------");
      console.log("[3/3] Сценарій 2: Пошук актуальних даних через Web Search Server Tool");
      console.log("------------------------------------------------------------------");
      const webPrompt = "Знайди актуальну інформацію про MCP TypeScript SDK";
      console.log(`Користувацький запит: "${webPrompt}"`);
      console.log("Дії runtime:");
      console.log("  1. Додавання server tool openrouter:web_search до масиву tools.");
      console.log("  2. Модель самостійно визначає, чи потрібен пошук у реальному часі.");
      console.log("  3. OpenRouter виконує пошук і повертає url_citation annotations.");
      console.log("  4. Runtime додає URL джерел до фінальної відповіді.\n");

      const { data: webData, status: webStatus } = await fetchWithProgress(
        `${baseUrl}/api/agent/research`,
        { message: webPrompt },
        AgentApiResponseSchema,
        "веб-пошук у мережі",
      );

      // const expectedNumber = normalizedNumber(toolOutput.data.convertedAmount);
      // const answerNumber = normalizedNumber(agent.text);
      if (webData.status !== "success" || !webData.text) {
        throw new Error(`Сценарій 2 завершився з помилкою: ${webData.message ?? webData.code}`);
      }
      if (!webData.metrics.webSearchUsed) {
        throw new Error("Сценарій 2 не виконав OpenRouter web search server tool.");
      }

      // if (expectedNumber === "" || !answerNumber.includes(expectedNumber)) {
      //   throw new Error(
      //     `Фінальна відповідь не містить обчислений результат ${toolOutput.data.convertedAmount}.`,
      console.log(`\nСтатус відповіді: HTTP ${webStatus} [${webData.status.toUpperCase()}]`);
      console.log(`Відповіла модель: ${webData.model}`);
      console.log(
        `Виклики: modelCalls=${webData.metrics.modelCallCount}, ` +
          `localToolCalls=${webData.metrics.toolCallCount}, ` +
          `webSearchUsed=${webData.metrics.webSearchUsed}, ` +
          `webSearchRequests=${webData.metrics.webSearchRequestCount}`,
      );
      console.log(
        `Час виконання: ${(webData.metrics.totalLatencyMs / 1000).toFixed(1)} с | Токени: ${webData.usage.totalTokens}`,
      );
      console.log("\nТекст відповіді агента (витяг):");
      console.log("┌─────────────────────────────────────────────────────────────────");
      console.log(
        truncateText(webData.text, 400)
          .split("\n")
          .map((line) => `│ ${line}`)
          .join("\n"),
      );
      console.log("└─────────────────────────────────────────────────────────────────");
      console.log(
        "Результат: Вбудований веб-пошук успішно виконав онлайн-пошук та надав актуальні дані.\n",
      );

      // console.log("-----------------------------------------------------------------");
      // console.log("  📋 Хід виконання запиту");
      // console.log("-----------------------------------------------------------------");
      // console.log(`  1. 🤖 Модель ініціювала Tool Call: ${toolCall.toolName}`);
      // console.log(`     Аргументи: ${toolCall.arguments}`);
      // console.log("  2. ⚙️  Локальне виконання функції:");
      // console.log(`     Результат: ${serializedToolOutput}`);
      // console.log("  3. 💬 Фінальна відповідь моделі (після отримання результату інструменту):");
      // const agentLines = agent.text.trim().split("\n");
      // for (const line of agentLines) {
      //   console.log(`     │ ${line}`);
      console.log("==================================================================");
      console.log("   УСІ ПЕРЕВІРКИ LESSON 04 ПРОЙДЕНО УСПІШНО: MCP ТА WEB SEARCH ПРАЦЮЮТЬ!   ");
      console.log("==================================================================");
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
    //   console.log("-----------------------------------------------------------------");
    //   console.log("  📊 Метрики та статистика:");
    //   console.log(`     • Фактична модель:   ${agent.model}`);
    //   console.log(
    //     `     • Кількість викликів: model=${agent.metrics.modelCallCount}, tool=${agent.metrics.toolCallCount}, retry=${agent.metrics.retryCount}`,
    //   );
    //   console.log(`     • Загальний час:     ${(agent.metrics.totalLatencyMs / 1_000).toFixed(1)} с`);
    //   console.log(`     • Використано токенів: ${agent.usage.totalTokens}`);
    //   console.log("=================================================================");
    //   console.log("  ✨ ПІДСУМОК: УСІ ПЕРЕВІРКИ LESSON 03 ПРОЙДЕНО, TOOL CALLING ПРАЦЮЄ!");
    //   console.log("=================================================================\n");
  } finally {
    //   await new Promise<void>((resolve, reject) => {
    //     server.close((error) => {
    //       if (error) {
    //         reject(error);
    //         return;
    //       }

    //       resolve();
    //     });
    //   });
    await runtime.close();
  }
}

// main().catch((error: unknown) => {
//   const message = error instanceof Error ? error.message : "Невідома помилка.";
//   console.error(`=== ДЕМОНСТРАЦІЮ НЕ ПРОЙДЕНО: ${message} ===`);
//   process.exitCode = 1;
// });
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runLiveDemo().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Непередбачена помилка.";
    console.error(`\n❌ Помилка під час виконання демо: ${message}`);
    process.exitCode = 1;
  });
}
