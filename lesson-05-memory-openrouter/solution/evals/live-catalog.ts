import OpenAI from "openai";
import { loadEnvironment, loadRepositoryEnvFile } from "../src/config/env.js";
import { MODEL_CAPABILITIES } from "../src/config/model-capabilities.js";
import { MODEL_PRICES } from "../src/config/pricing.js";
import { resolveModel } from "../src/config/models.js";

loadRepositoryEnvFile();

interface CatalogModel {
  id?: string;
  pricing?: {
    prompt?: string | null;
    completion?: string | null;
    input_cache_read?: string | null;
    request?: string | null;
    image?: string | null;
    web_search?: string | null;
  };
  supported_parameters?: string[];
  reasoning?: {
    supported_efforts?: string[] | null;
  };
}

function listFailure(message: string): never {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

function requiredPrice(modelId: string, label: string, value: string | null | undefined): number {
  if (typeof value !== "string" || value.trim() === "") {
    listFailure(`модель ${modelId} не містить перевірюваної ціни ${label} у каталозі`);
  }

  const price = Number(value);

  if (!Number.isFinite(price)) {
    listFailure(`модель ${modelId} містить невалідну ціну ${label} у каталозі`);
  }

  return price;
}

async function main(): Promise<void> {
  const environment = loadEnvironment(process.env);
  const fastModel = resolveModel("fast", environment);
  const mainModel = resolveModel("main", environment);

  console.log("=================================================================");
  console.log("  📋 ПЕРЕВІРКА ПУБЛІЧНОГО КАТАЛОГУ OPENROUTER");
  console.log("=================================================================");
  console.log(`  ● Час перевірки:   ${new Date().toLocaleTimeString("uk-UA")}`);
  console.log(`  ● Fast Model:      ${fastModel}`);
  console.log(`  ● Main Model:      ${mainModel}`);
  console.log(`  ● Reasoning:       ${environment.OPENROUTER_REASONING_EFFORT}`);
  console.log("-----------------------------------------------------------------");

  const client = new OpenAI({
    apiKey: environment.OPENROUTER_API_KEY,
    baseURL: environment.OPENROUTER_BASE_URL,
    maxRetries: 0,
  });
  const models = await client.models.list();
  const catalog = new Map<string, CatalogModel>(
    (models.data as unknown as CatalogModel[]).map((model) => [model.id ?? "", model]),
  );

  const configuredModels = new Set([fastModel, mainModel]);
  const toolCallingModels = new Set([mainModel]);

  for (const modelId of configuredModels) {
    const catalogModel = catalog.get(modelId);

    if (!catalogModel) {
      listFailure(`модель ${modelId} відсутня в публічному каталозі OpenRouter`);
    }
    console.log(`  ✔  PASS [${modelId}] існує в публічному каталозі`);

    const usageCost = requiredPrice(modelId, "prompt", catalogModel.pricing?.prompt);
    const completionCost = requiredPrice(modelId, "completion", catalogModel.pricing?.completion);
    const requestCost =
      catalogModel.pricing?.request == null
        ? 0
        : requiredPrice(modelId, "request", catalogModel.pricing.request);

    const registeredPrice = MODEL_PRICES[modelId];
    const isFreeModel =
      modelId.endsWith(":free") ||
      (registeredPrice !== undefined &&
        registeredPrice.inputCostPerMillion === 0 &&
        registeredPrice.outputCostPerMillion === 0);

    if (isFreeModel) {
      if (usageCost !== 0 || completionCost !== 0 || requestCost !== 0) {
        listFailure(
          `модель ${modelId} має ненульову ціну в каталозі: prompt=${catalogModel.pricing?.prompt}, completion=${catalogModel.pricing?.completion}`,
        );
      }
      console.log(`  ✔  PASS [${modelId}] має нульову ціну (Free Model)`);
    } else {
      const inputCostPerMillion = usageCost * 1_000_000;
      const outputCostPerMillion = completionCost * 1_000_000;

      console.log(
        `  ✔  PASS [${modelId}] ціна в каталозі: prompt=$${inputCostPerMillion.toFixed(4)}/M, completion=$${outputCostPerMillion.toFixed(4)}/M`,
      );

      if (
        registeredPrice &&
        (Math.abs(registeredPrice.inputCostPerMillion - inputCostPerMillion) > 1e-9 ||
          Math.abs(registeredPrice.outputCostPerMillion - outputCostPerMillion) > 1e-9)
      ) {
        listFailure(
          `зареєстрована ціна ${modelId} не збігається з каталогом: registered=${registeredPrice.inputCostPerMillion}/${registeredPrice.outputCostPerMillion}, catalog=${inputCostPerMillion}/${outputCostPerMillion}`,
        );
      }

      if (registeredPrice?.cachedInputCostPerMillion !== undefined) {
        const cacheReadCost =
          requiredPrice(modelId, "input_cache_read", catalogModel.pricing?.input_cache_read) *
          1_000_000;

        if (Math.abs(registeredPrice.cachedInputCostPerMillion - cacheReadCost) > 1e-9) {
          listFailure(
            `зареєстрована cache-read ціна ${modelId} не збігається з каталогом: registered=${registeredPrice.cachedInputCostPerMillion}, catalog=${cacheReadCost}`,
          );
        }

        console.log(`  ✔  PASS [${modelId}] cache read у каталозі: $${cacheReadCost.toFixed(4)}/M`);
      }
    }

    const supported = catalogModel.supported_parameters ?? [];
    // Catalog metadata may retain the legacy label for this supported budget.
    if (!supported.includes("max_completion_tokens") && !supported.includes("max_tokens")) {
      listFailure(
        "модель " + modelId + " не декларує підтримку ліміту completion-токенів у каталозі",
      );
    }
    const capabilities = MODEL_CAPABILITIES[modelId];

    if (capabilities?.responseFormat && !supported.includes("response_format")) {
      listFailure(`модель ${modelId} не декларує підтримку response_format у каталозі`);
    }
    if (capabilities?.responseFormat) {
      console.log(`  ✔  PASS [${modelId}] підтримує response_format`);
    }

    if (capabilities?.reasoning && !supported.includes("reasoning")) {
      listFailure(`модель ${modelId} не декларує підтримку reasoning у каталозі`);
    }
    if (capabilities?.reasoning) {
      console.log(`  ✔  PASS [${modelId}] підтримує reasoning`);
    }

    if (capabilities?.reasoningEfforts.length) {
      const supportedEfforts = catalogModel.reasoning?.supported_efforts;

      if (supportedEfforts === null) {
        console.log(`  ✔  PASS [${modelId}] приймає всі gateway reasoning efforts`);
      } else if (Array.isArray(supportedEfforts)) {
        if (supportedEfforts.includes(environment.OPENROUTER_REASONING_EFFORT)) {
          console.log(
            `  ✔  PASS [${modelId}] нативно підтримує reasoning=${environment.OPENROUTER_REASONING_EFFORT}`,
          );
        } else {
          console.log(
            `  ℹ️  INFO [${modelId}] reasoning=${environment.OPENROUTER_REASONING_EFFORT} буде нормалізовано OpenRouter до підтримуваного рівня (${supportedEfforts.join(", ")})`,
          );
        }
      } else {
        console.log(`  ℹ️  INFO [${modelId}] каталог не публікує список reasoning efforts`);
      }
    }

    if (toolCallingModels.has(modelId) && !supported.includes("tools")) {
      listFailure(`tool-calling модель ${modelId} не декларує підтримку tools у каталозі`);
    }
    if (toolCallingModels.has(modelId) && !supported.includes("tool_choice")) {
      listFailure(`tool-calling модель ${modelId} не декларує підтримку tool_choice у каталозі`);
    }
    if (toolCallingModels.has(modelId)) {
      console.log(`  ✔  PASS [${modelId}] підтримує tools та tool_choice`);
    }

    if (
      isFreeModel &&
      registeredPrice &&
      (registeredPrice.inputCostPerMillion !== 0 ||
        registeredPrice.outputCostPerMillion !== 0 ||
        (registeredPrice.cachedInputCostPerMillion ?? 0) !== 0 ||
        (registeredPrice.cacheWriteCostPerMillion ?? 0) !== 0)
    ) {
      listFailure(`free модель ${modelId} зареєстрована з ненульовою ціною в MODEL_PRICES`);
    }

    if (!registeredPrice) {
      console.log(
        `  ℹ️  INFO [${modelId}] не зареєстрована в MODEL_PRICES: ціна вважається неперевіреною`,
      );
    }
  }

  console.log("-----------------------------------------------------------------");
  console.log("  ✨ ПЕРЕВІРКУ КАТАЛОГУ ПРОЙДЕНО: моделі існують і підтримують заявлені параметри.");
  console.log("=================================================================\n");
}

main().catch((error) => {
  const rawMessage = error instanceof Error ? error.message : "невідома помилка";
  const message = rawMessage.replace(/sk-[A-Za-z0-9_-]+/g, "sk-***");
  console.error(`Помилка live-перевірки каталогу: ${message}`);
  process.exitCode = 1;
});
