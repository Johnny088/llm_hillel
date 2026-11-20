import OpenAI from "openai";
import { loadEnvironment, loadRepositoryEnvFile } from "../src/config/env.js";
import { resolveModel } from "../src/config/models.js";
import { DocumentAiError } from "../src/lib/errors.js";
import { extractUsageMetrics, type UsageMetrics } from "../src/lib/metrics.js";
import type { Extraction } from "../src/schemas/extraction.js";
import { OpenRouterDocumentAi } from "../src/services/openrouter-document-ai.js";
import { extractionEvalCases } from "./extraction.eval.js";
import { recordedResults } from "./recorded-results.js";
import { scoreExtraction } from "./scorer.js";

const SUCCESS_THRESHOLD = 0.8;

interface EvalObservation {
  extraction: Extraction;
  latencyMs: number;
  model?: string;
  usage: UsageMetrics;
}

function emptyUsage(): UsageMetrics {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedTokens: 0,
    cacheWriteTokens: 0,
  };
}

function createOfflineRunner(): (id: string) => Promise<EvalObservation> {
  return async (id) => {
    const extraction = recordedResults[id];

    if (!extraction) {
      throw new Error(`Немає recorded result для eval case ${id}.`);
    }

    return { extraction, latencyMs: 0, usage: emptyUsage() };
  };
}

function createLiveRunner(): (id: string, input: string) => Promise<EvalObservation> {
  loadRepositoryEnvFile();
  const environment = loadEnvironment(process.env);
  const client = new OpenAI({
    apiKey: environment.OPENROUTER_API_KEY,
    baseURL: environment.OPENROUTER_BASE_URL,
    timeout: environment.OPENROUTER_TIMEOUT_MS,
    maxRetries: 0,
    defaultHeaders: {
      "HTTP-Referer": environment.OPENROUTER_HTTP_REFERER,
      "X-Title": environment.OPENROUTER_APP_TITLE,
    },
  });
  const ai = new OpenRouterDocumentAi(client, {
    fastModel: resolveModel("fast", environment),
    mainModel: resolveModel("main", environment),
    maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
    reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
  });

  return async (_id, input) => {
    const startedAt = performance.now();
    const result = await ai.extract(input);

    return {
      extraction: result.data,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      model: result.model,
      usage: extractUsageMetrics(result.usage),
    };
  };
}

function formatValues(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "не знайдено";
}

function formatRequestFailure(error: unknown): string {
  if (error instanceof DocumentAiError) {
    const upstreamStatus = (error.details as { status?: unknown } | undefined)?.status;
    const upstream =
      typeof upstreamStatus === "number" ? `, OpenRouter HTTP ${upstreamStatus}` : "";

    return `${error.code}: HTTP ${error.statusCode}${upstream} — ${error.message}`;
  }

  return `request_failed:${error instanceof Error ? error.name : "UnknownError"}`;
}

function printLiveObservation(
  observation: EvalObservation,
  passed: boolean,
  reasons: string[],
): void {
  console.log("  🤖 Отримано від моделі:");
  console.log(`     • Модель:      ${observation.model ?? "не вказано"}`);
  console.log(
    `     • Метрики:     ⏱️ ${(observation.latencyMs / 1_000).toFixed(1)} с | 🎫 ${observation.usage.totalTokens} токенів (${observation.usage.inputTokens} вхід + ${observation.usage.outputTokens} вихід)`,
  );
  console.log(`     • Імена:       ${formatValues(observation.extraction.names)}`);
  console.log(`     • Дати:        ${formatValues(observation.extraction.dates)}`);
  console.log(`     • Місця:       ${formatValues(observation.extraction.locations)}`);
  console.log("     • Підсумок:");
  const summaryLines = observation.extraction.summary.trim().split("\n");
  for (const line of summaryLines) {
    console.log(`       │ ${line}`);
  }
  console.log(
    passed
      ? "\n  ✔  PASS — відповідь відповідає очікуваному результату."
      : `\n  ✖  FAIL — ${reasons.join(", ")}`,
  );
}

async function main(): Promise<void> {
  const live = process.argv.includes("--live");
  const runCase = live ? createLiveRunner() : createOfflineRunner();
  let passed = 0;
  let totalLatencyMs = 0;
  const totalUsage = emptyUsage();
  const total = extractionEvalCases.length;

  if (live) {
    console.log("=================================================================");
    console.log("  🧪 LIVE EVAL SUITE: LESSON 03 (Document AI Extraction)");
    console.log("=================================================================");
  } else {
    console.log("=================================================================");
    console.log("  🧪 OFFLINE EVAL SUITE: LESSON 03 (Deterministic Extraction)");
    console.log("=================================================================");
  }

  for (const [index, testCase] of extractionEvalCases.entries()) {
    if (!testCase.expected) {
      console.log(`\n  ✖  FAIL ${testCase.id}: expected result is missing`);
      continue;
    }

    try {
      if (live) {
        console.log(`\n-----------------------------------------------------------------`);
        console.log(`  [${index + 1}/${total}] 🎯 Тест: ${testCase.id}`);
        console.log(`-----------------------------------------------------------------`);
        console.log(`  📥 Запит: "${testCase.input}"`);
        console.log("  ⏳ Очікування відповіді моделі OpenRouter...\n");
      }

      const observation = await runCase(testCase.id, testCase.input);
      const score = scoreExtraction(testCase.input, observation.extraction, testCase.expected);

      totalLatencyMs += observation.latencyMs;
      totalUsage.inputTokens += observation.usage.inputTokens;
      totalUsage.outputTokens += observation.usage.outputTokens;
      totalUsage.totalTokens += observation.usage.totalTokens;
      totalUsage.cachedTokens += observation.usage.cachedTokens;
      totalUsage.cacheWriteTokens += observation.usage.cacheWriteTokens;

      if (score.passed) {
        passed += 1;
        if (!live) {
          console.log(`  ✔  PASS ${testCase.id}`);
        }
      } else {
        if (!live) {
          console.log(`  ✖  FAIL ${testCase.id}: ${score.reasons.join(", ")}`);
        }
      }

      if (live) {
        printLiveObservation(observation, score.passed, score.reasons);
      }
    } catch (error) {
      console.log(`\n  ✖  FAIL ${testCase.id}: ⚠️ ${formatRequestFailure(error)}`);
    }
  }

  const successRate = total === 0 ? 0 : passed / total;
  const averageLatencyMs = total === 0 ? 0 : Math.round(totalLatencyMs / total);

  console.log("\n=================================================================");
  console.log("  📊 ПІДСУМОК ОЦІНЮВАННЯ (EXTRACTION EVAL REPORT)");
  console.log("=================================================================");
  console.log(
    `  • Результат:           ${passed}/${total} ${passed === total ? "✔ (усі пройдено)" : "✖ (є помилки)"}`,
  );
  console.log(`  • Успішність:          ${(successRate * 100).toFixed(1)}%`);
  console.log(`  • Середня затримка:    ${averageLatencyMs} мс`);
  console.log(`  • Використано токенів: ${totalUsage.totalTokens}`);
  console.log("=================================================================\n");

  console.log(`Result: ${passed}/${total}`);
  console.log(`Success rate: ${(successRate * 100).toFixed(1)}%`);
  console.log(`Average latency: ${averageLatencyMs}ms`);
  console.log(
    `Token usage: input=${totalUsage.inputTokens}, output=${totalUsage.outputTokens}, total=${totalUsage.totalTokens}`,
  );

  if (successRate < SUCCESS_THRESHOLD) {
    process.exitCode = 1;
  }
}

void main();
