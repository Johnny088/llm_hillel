import { once } from "node:events";
import type { AddressInfo } from "node:net";
import dotenv from "dotenv";
import OpenAI from "openai";
import { z } from "zod";
import { createApp } from "./app.js";
import { loadEnvironment } from "./config/env.js";
import { resolveModel } from "./config/models.js";
import { OPENROUTER_BASE_URL } from "./config/openrouter.js";
import { ExtractionSchema } from "./schemas/extraction.js";
import { OpenRouterDocumentAi } from "./services/openrouter-document-ai.js";

const DEFAULT_TEXT = "14 липня 2026 року Олена Коваль представила демонстрацію у Львові.";

const UsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  cachedTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
});

const ExtractionApiResponseSchema = z.object({
  data: ExtractionSchema,
  usage: UsageSchema,
  metrics: z
    .object({
      model: z.string().min(1),
      totalLatencyMs: z.number().nonnegative(),
      estimatedCostUsd: z.number().nullable(),
    })
    .passthrough(),
});

const StreamUsagePayloadSchema = z.object({
  usage: UsageSchema,
  metrics: z
    .object({
      model: z.string().min(1),
      ttftMs: z.number().nonnegative().nullable(),
      totalLatencyMs: z.number().nonnegative(),
      estimatedCostUsd: z.number().nullable(),
    })
    .passthrough(),
});

interface SseEvent {
  event: string;
  data: unknown;
}

function formatValues(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "не знайдено";
}

function formatCost(cost: number | null): string {
  return cost === null ? "не визначено" : `$${cost.toFixed(6)}`;
}

function parseSseEvents(rawStream: string): SseEvent[] {
  return rawStream
    .trim()
    .split(/\r?\n\r?\n/u)
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\r?\n/u);
      const event = lines.find((line) => line.startsWith("event: "))?.slice("event: ".length);
      const data = lines.find((line) => line.startsWith("data: "))?.slice("data: ".length);

      if (!event || !data) {
        throw new Error("Отримано пошкоджену SSE-подію.");
      }

      return { event, data: JSON.parse(data) as unknown };
    });
}

async function readJson<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const body = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(body)}`);
  }

  return schema.parse(body);
}

async function main(): Promise<void> {
  dotenv.config({ quiet: true });
  const environment = loadEnvironment(process.env);
  const input = process.argv.slice(2).join(" ").trim() || DEFAULT_TEXT;
  const openai = new OpenAI({
    apiKey: environment.OPENROUTER_API_KEY,
    baseURL: OPENROUTER_BASE_URL,
    timeout: environment.OPENROUTER_TIMEOUT_MS,
    maxRetries: 0,
  });
  const ai = new OpenRouterDocumentAi(openai, {
    fastModel: resolveModel("fast", environment),
    mainModel: resolveModel("main", environment),
    reasoningEffort: environment.OPENROUTER_REASONING_EFFORT,
    maxOutputTokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
  });
  const app = createApp({ ai });
  const server = app.listen(0, "127.0.0.1");

  try {
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    console.log("=== ДЕМОНСТРАЦІЯ LESSON 02 ЧЕРЕЗ OPENROUTER ===");
    console.log(`Текст для перевірки: ${input}`);
    console.log(`Основна модель (summary): ${resolveModel("fast", environment)}`);
    console.log(`Основна модель (extraction): ${resolveModel("main", environment)}`);
    console.log(`Reasoning effort: ${environment.OPENROUTER_REASONING_EFFORT}`);
    console.log("Запускається тимчасовий локальний API. Після перевірки він зупиниться сам.\n");

    console.log("[1/3] Перевірка локального сервера");
    console.log("Надіслано: GET /health");
    const healthResponse = await fetch(`${baseUrl}/health`);
    const health = await readJson(healthResponse, z.object({ status: z.literal("ok") }));
    console.log(`Отримано: HTTP ${healthResponse.status}, status=${health.status}`);
    console.log("Висновок: локальний HTTP API працює.\n");

    console.log("[2/3] Структуроване вилучення даних");
    console.log("Надіслано: POST /api/documents/extract");
    console.log(`Тіло запиту: ${JSON.stringify({ content: input })}`);
    console.log("Очікування відповіді реальної моделі OpenRouter...");
    const extractionHttpResponse = await fetch(`${baseUrl}/api/documents/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ content: input }),
    });
    const extraction = await readJson(extractionHttpResponse, ExtractionApiResponseSchema);
    console.log(`Отримано: HTTP ${extractionHttpResponse.status}`);
    console.log(`  Імена: ${formatValues(extraction.data.names)}`);
    console.log(`  Дати: ${formatValues(extraction.data.dates)}`);
    console.log(`  Місця: ${formatValues(extraction.data.locations)}`);
    console.log(`  Підсумок: ${extraction.data.summary}`);
    console.log(`  Модель: ${extraction.metrics.model}`);
    console.log(`  Час: ${(extraction.metrics.totalLatencyMs / 1_000).toFixed(1)} с`);
    console.log(`  Токени: ${extraction.usage.totalTokens}`);
    console.log(`  Вартість: ${formatCost(extraction.metrics.estimatedCostUsd)}`);
    console.log("Висновок: модель повернула валідовані структуровані дані.\n");

    console.log("[3/3] Потоковий підсумок");
    console.log("Надіслано: POST /api/documents/summary/stream");
    console.log("Очікування потокової відповіді реальної моделі OpenRouter...");
    const streamHttpResponse = await fetch(`${baseUrl}/api/documents/summary/stream`, {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ content: input }),
    });

    if (!streamHttpResponse.ok) {
      throw new Error(`Потоковий маршрут повернув HTTP ${streamHttpResponse.status}.`);
    }

    const events = parseSseEvents(await streamHttpResponse.text());
    const errorEvent = events.find((event) => event.event === "error");

    if (errorEvent) {
      throw new Error(`Потоковий маршрут повернув помилку: ${JSON.stringify(errorEvent.data)}`);
    }

    const summary = events
      .filter((event) => event.event === "delta")
      .map((event) => z.object({ delta: z.string() }).parse(event.data).delta)
      .join("");
    const usageEvent = events.find((event) => event.event === "usage");
    const doneEvent = events.find((event) => event.event === "done");

    if (!usageEvent || !doneEvent) {
      throw new Error("Потік не містить завершальних подій usage і done.");
    }

    const streamUsage = StreamUsagePayloadSchema.parse(usageEvent.data);
    z.object({ status: z.literal("completed") }).parse(doneEvent.data);
    console.log(`Отримано: HTTP ${streamHttpResponse.status}`);
    console.log(`  Повний текст: ${summary}`);
    console.log(`  Модель: ${streamUsage.metrics.model}`);
    console.log(
      `  Час до першого фрагмента: ${
        streamUsage.metrics.ttftMs === null
          ? "не визначено"
          : `${(streamUsage.metrics.ttftMs / 1_000).toFixed(1)} с`
      }`,
    );
    console.log(`  Повний час: ${(streamUsage.metrics.totalLatencyMs / 1_000).toFixed(1)} с`);
    console.log(`  Токени: ${streamUsage.usage.totalTokens}`);
    console.log(`  Вартість: ${formatCost(streamUsage.metrics.estimatedCostUsd)}`);
    console.log("Висновок: SSE-потік завершився подією done зі статусом completed.\n");

    console.log("=== ПІДСУМОК: УСІ 3 ПЕРЕВІРКИ ПРОЙДЕНО, ПРОЄКТ ПРАЦЮЄ ===");
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
