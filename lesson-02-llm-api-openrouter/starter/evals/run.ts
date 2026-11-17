import dotenv from "dotenv";
import OpenAI from "openai";
import { loadEnvironment } from "../src/config/env.js";
import { resolveModel } from "../src/config/models.js";
import { OPENROUTER_BASE_URL } from "../src/config/openrouter.js";
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

function formatRequestFailure(error: unknown): string {
  if (error instanceof DocumentAiError) {
    const upstreamStatus = (error.details as { status?: unknown } | undefined)?.status;
    const upstream =
      typeof upstreamStatus === "number" ? `, OpenRouter HTTP ${upstreamStatus}` : "";

    return `${error.code}: HTTP ${error.statusCode}${upstream} — ${error.message}`;
  }

  return `request_failed:${error instanceof Error ? error.name : "UnknownError"}`;
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
  dotenv.config({ quiet: true });
  const environment = loadEnvironment(process.env);
  const client = new OpenAI({
    apiKey: environment.OPENROUTER_API_KEY,
    baseURL: OPENROUTER_BASE_URL,
    timeout: environment.OPENROUTER_TIMEOUT_MS,
    maxRetries: 0,
  });
  const ai = new OpenRouterDocumentAi(client, {
    fastModel: resolveModel("fast", environment),
    mainModel: resolveModel("main", environment),
    reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
    maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
  });

  return async (_id, input) => {
    const startedAt = performance.now();
    const result = await ai.extract(input);

    return {
      extraction: result.data,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      usage: extractUsageMetrics(result.usage),
    };
  };
}

async function main(): Promise<void> {
  const live = process.argv.includes("--live");
  const runCase = live ? createLiveRunner() : createOfflineRunner();
  let passed = 0;
  let totalLatencyMs = 0;
  const totalUsage = emptyUsage();

  console.log(live ? "Eval mode: live OpenRouter API" : "Eval mode: deterministic recorded replay");

  for (const testCase of extractionEvalCases) {
    if (!testCase.expected) {
      console.log(`FAIL ${testCase.id}: expected result is missing`);
      continue;
    }

    try {
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
        console.log(`PASS ${testCase.id}`);
      } else {
        console.log(`FAIL ${testCase.id}: ${score.reasons.join(", ")}`);
      }
    } catch (error) {
      console.log(`FAIL ${testCase.id}: ${formatRequestFailure(error)}`);
    }
  }

  const total = extractionEvalCases.length;
  const successRate = total === 0 ? 0 : passed / total;
  const averageLatencyMs = total === 0 ? 0 : Math.round(totalLatencyMs / total);

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
