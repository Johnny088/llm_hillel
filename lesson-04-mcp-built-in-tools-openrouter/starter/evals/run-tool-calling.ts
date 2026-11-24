import OpenAI from "openai";
import { loadEnvironment, loadRepositoryEnvFile } from "../src/config/env.js";
import { resolveModel } from "../src/config/models.js";
import {
  ChatCompletionsToolCallingAgent,
  OpenAIChatCompletionsClient,
} from "../src/services/tool-calling-agent.js";
import type { ToolCallTrace } from "../src/services/tool-calling-agent.js";
import { EducationalRateProvider } from "../src/tools/currency.js";
import { recordedToolResults } from "./recorded-tool-results.js";
import type { ToolCallingObservation } from "./recorded-tool-results.js";
import { classifyTextResponse, scoreToolCallingCase } from "./tool-calling-scorer.js";
import { toolCallingEvalCases } from "./tool-calling.eval.js";
import type { EvalCase, ToolCallExpectation } from "./tool-calling.eval.js";

type ToolOutputPayload = {
  status?: unknown;
  code?: unknown;
};

function parseObject(value: string | undefined): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function createLiveRunner(): (
  evalCase: EvalCase<ToolCallExpectation>,
) => Promise<ToolCallingObservation> {
  const environment = loadEnvironment(process.env);
  const primaryModel = resolveModel("main", environment);
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

  return async (evalCase) => {
    const toolCalls: ToolCallTrace[] = [];
    const toolOutputs: string[] = [];
    const chatClient = new OpenAIChatCompletionsClient(openai, {
      modelName: primaryModel,
      maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
      reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
    });
    const agent = new ChatCompletionsToolCallingAgent(chatClient, new EducationalRateProvider(), {
      onToolCall: (event) => toolCalls.push({ ...event }),
      onToolOutput: (output) => {
        if (typeof output.content === "string") {
          toolOutputs.push(output.content);
        }
      },
    });
    const result = await agent.run(evalCase.input);
    const firstToolCall = toolCalls[0];
    const observedArgs = parseObject(firstToolCall?.arguments);
    const toolPayload = parseObject(toolOutputs[0]) as ToolOutputPayload | undefined;
    const responseText = result.status === "success" ? result.text : result.message;
    const observedMode = firstToolCall === undefined ? classifyTextResponse(responseText) : "tool";

    return {
      id: evalCase.id,
      observedMode,
      ...(firstToolCall === undefined
        ? {}
        : {
            observedTool: firstToolCall.toolName,
          }),
      ...(observedArgs === undefined ? {} : { observedArgs }),
      ...(toolPayload?.status === "success" || toolPayload?.status === "error"
        ? { observedStatus: toolPayload.status }
        : {}),
      ...(typeof toolPayload?.code === "string" ? { observedErrorCode: toolPayload.code } : {}),
      latencyMs: result.metrics.totalLatencyMs,
      modelCallCount: result.metrics.modelCallCount,
      toolCallCount: result.metrics.toolCallCount,
      retryCount: result.metrics.retryCount,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      model: result.model,
      responseText,
    };
  };
}

function printLiveObservation(observation: ToolCallingObservation): void {
  const modeLabel =
    observation.observedMode === "tool"
      ? "⚙️  Tool Call"
      : observation.observedMode === "clarification"
        ? "❓ Clarification"
        : "💬 Direct Answer";

  console.log("  🤖 Отримано від моделі:");
  console.log(`     • Режим:      ${modeLabel}`);
  console.log(`     • Модель:     ${observation.model ?? "не вказано"}`);
  console.log(
    `     • Метрики:    model=${observation.modelCallCount}, tool=${observation.toolCallCount}, retry=${observation.retryCount} | ⏱️ ${(observation.latencyMs / 1_000).toFixed(1)} с | 🎫 ${observation.inputTokens + observation.outputTokens} токенів`,
  );
  console.log(`     • Інструмент: ${observation.observedTool ?? "не викликався"}`);

  if (observation.observedArgs) {
    console.log(`     • Аргументи:  ${JSON.stringify(observation.observedArgs)}`);
  }
  if (observation.observedStatus) {
    console.log(
      `     • Tool стан:  ${observation.observedStatus === "success" ? "✔ success" : "✖ error"}`,
    );
  }
  if (observation.observedErrorCode) {
    console.log(`     • Tool error: ⚠️ ${observation.observedErrorCode}`);
  }

  if (observation.responseText && observation.responseText.trim()) {
    console.log("     • Відповідь:");
    const lines = observation.responseText.trim().split("\n");
    for (const line of lines) {
      console.log(`       │ ${line}`);
    }
  } else {
    console.log("     • Відповідь:  (не отримано)");
  }
}

function formatFailure(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String((error as { code?: unknown }).code ?? "MODEL_REQUEST_FAILED");
    const message = error instanceof Error ? error.message : "Запит не виконано.";

    return `${code} — ${message}`;
  }

  return error instanceof Error ? `${error.name} — ${error.message}` : "Невідома помилка.";
}

async function main(): Promise<void> {
  const live = process.argv.includes("--live");

  if (live) {
    loadRepositoryEnvFile();
  }

  const liveRunner = live ? createLiveRunner() : undefined;
  const recordedById = new Map(
    recordedToolResults.map((observation) => [observation.id, observation]),
  );
  const observations: ToolCallingObservation[] = [];
  let passed = 0;

  if (live) {
    const environment = loadEnvironment(process.env);
    const primaryModel = resolveModel("main", environment);

    console.log("=================================================================");
    console.log("  🧪 LIVE EVAL SUITE: LESSON 03 (Tool Calling OpenRouter)");
    console.log("=================================================================");
    console.log(`  ● Основна модель:  ${primaryModel}`);
    console.log(`  ● Reasoning:       ${environment.OPENROUTER_REASONING_EFFORT}`);
    console.log("  ● Режим:           Живий запуск (Live OpenRouter API)");
    console.log("=================================================================");
  } else {
    console.log("=================================================================");
    console.log("  🧪 OFFLINE EVAL SUITE: LESSON 03 (Deterministic Replay)");
    console.log("=================================================================");
  }

  for (const [index, evalCase] of toolCallingEvalCases.entries()) {
    if (live) {
      console.log(`\n-----------------------------------------------------------------`);
      console.log(`  [${index + 1}/${toolCallingEvalCases.length}] 🎯 Тест: ${evalCase.id}`);
      console.log(`-----------------------------------------------------------------`);
      console.log(`  📥 Запит: "${evalCase.input}"`);
      console.log("  ⏳ Очікування відповіді моделі OpenRouter...\n");
    }

    try {
      const observation = live ? await liveRunner!(evalCase) : recordedById.get(evalCase.id);

      if (!observation) {
        throw new Error("Відсутнє записане спостереження.");
      }

      observations.push(observation);
      const score = scoreToolCallingCase(evalCase, observation);
      const details = score.reasons.length === 0 ? "" : ` — ${score.reasons.join(" ")}`;

      if (live) {
        printLiveObservation(observation);
      }

      console.log(score.passed ? `\n  ✔  PASS ${score.id}` : `\n  ✖  FAIL ${score.id}${details}`);
      if (score.passed) {
        passed += 1;
      }
    } catch (error) {
      console.log(`\n  ✖  FAIL ${evalCase.id} — ⚠️ ${formatFailure(error)}`);
    }
  }

  const total = toolCallingEvalCases.length;
  const successRate = total === 0 ? 0 : (passed / total) * 100;
  const averageLatencyMs =
    observations.length === 0
      ? 0
      : observations.reduce((sum, observation) => sum + observation.latencyMs, 0) /
        observations.length;
  const totals = observations.reduce(
    (accumulator, observation) => ({
      modelCallCount: accumulator.modelCallCount + observation.modelCallCount,
      toolCallCount: accumulator.toolCallCount + observation.toolCallCount,
      retryCount: accumulator.retryCount + observation.retryCount,
      inputTokens: accumulator.inputTokens + observation.inputTokens,
      outputTokens: accumulator.outputTokens + observation.outputTokens,
    }),
    {
      modelCallCount: 0,
      toolCallCount: 0,
      retryCount: 0,
      inputTokens: 0,
      outputTokens: 0,
    },
  );

  console.log("\n=================================================================");
  console.log("  📊 ПІДСУМОК ОЦІНЮВАННЯ (EVAL REPORT)");
  console.log("=================================================================");
  console.log(
    `  • Результат:             ${passed}/${total} ${passed === total ? "✔ (усі пройдено)" : "✖ (є помилки)"}`,
  );
  console.log(`  • Успішність:            ${successRate.toFixed(1)}%`);
  console.log(`  • Середня затримка:      ${Math.round(averageLatencyMs)} мс`);
  console.log(`  • Викликів моделей:      ${totals.modelCallCount}`);
  console.log(`  • Викликів інструментів: ${totals.toolCallCount}`);
  console.log(`  • Повторних спроб:       ${totals.retryCount}`);
  console.log(
    `  • Використано токенів:   ${totals.inputTokens + totals.outputTokens} (${totals.inputTokens} вхід + ${totals.outputTokens} вихід)`,
  );
  console.log("=================================================================\n");

  console.log(`Result: ${passed}/${total}`);
  console.log(`Success rate: ${successRate.toFixed(1)}%`);
  console.log(`Average latency: ${Math.round(averageLatencyMs)}ms`);
  console.log(
    `Calls: model=${totals.modelCallCount}, tool=${totals.toolCallCount}, retry=${totals.retryCount}`,
  );
  console.log(
    `Token usage: input=${totals.inputTokens}, output=${totals.outputTokens}, total=${totals.inputTokens + totals.outputTokens}`,
  );

  if (passed !== total) {
    process.exitCode = 1;
  }
}

void main();
