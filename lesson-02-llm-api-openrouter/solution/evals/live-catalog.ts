import dotenv from "dotenv";
import { loadEnvironment } from "../src/config/env.js";
import { MODEL_CAPABILITIES } from "../src/config/model-capabilities.js";
import { OPENROUTER_BASE_URL } from "../src/config/openrouter.js";
import { MODEL_PRICES } from "../src/config/pricing.js";
import { resolveModel } from "../src/config/models.js";

dotenv.config({ quiet: true });

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
  const environment = loadEnvironment({
    ...process.env,
    OPENROUTER_API_KEY:
      process.env.OPENROUTER_API_KEY?.trim() || "public-catalog-check-does-not-use-a-key",
  });
  const fastModel = resolveModel("fast", environment);
  const mainModel = resolveModel("main", environment);

  console.log(`Перевірка публічного каталогу OpenRouter (${new Date().toISOString()})`);
  console.log(`Fast model: ${fastModel}`);
  console.log(`Main model: ${mainModel}`);

  const response = await fetch(`${OPENROUTER_BASE_URL}/models`);

  if (!response.ok) {
    listFailure(`публічний каталог OpenRouter повернув HTTP ${response.status}`);
  }

  const models = (await response.json()) as { data?: CatalogModel[] };

  if (!Array.isArray(models.data)) {
    listFailure("публічний каталог OpenRouter не містить масиву data");
  }

  const catalog = new Map<string, CatalogModel>(
    models.data.map((model) => [model.id ?? "", model]),
  );

  const configuredModels = new Set([fastModel, mainModel]);

  for (const modelId of configuredModels) {
    const catalogModel = catalog.get(modelId);

    if (!catalogModel) {
      listFailure(`модель ${modelId} відсутня в публічному каталозі OpenRouter`);
    }
    console.log(`PASS ${modelId} існує в публічному каталозі`);

    const usageCost = requiredPrice(modelId, "prompt", catalogModel.pricing?.prompt);
    const completionCost = requiredPrice(modelId, "completion", catalogModel.pricing?.completion);
    const requestCost =
      catalogModel.pricing?.request == null
        ? 0
        : requiredPrice(modelId, "request", catalogModel.pricing.request);

    const registeredPrice = MODEL_PRICES[modelId];
    const isFreeModel =
      registeredPrice !== undefined &&
      registeredPrice.inputCostPerMillion === 0 &&
      registeredPrice.outputCostPerMillion === 0;

    if (isFreeModel) {
      if (usageCost !== 0 || completionCost !== 0 || requestCost !== 0) {
        listFailure(
          `модель ${modelId} має ненульову ціну в каталозі: prompt=${catalogModel.pricing?.prompt}, completion=${catalogModel.pricing?.completion}`,
        );
      }
      console.log(`PASS ${modelId} має нульову ціну в публічному каталозі`);
    } else {
      const inputCostPerMillion = usageCost * 1_000_000;
      const outputCostPerMillion = completionCost * 1_000_000;
      const cachedInputCostPerMillion =
        catalogModel.pricing?.input_cache_read == null
          ? undefined
          : requiredPrice(modelId, "input_cache_read", catalogModel.pricing.input_cache_read) *
            1_000_000;

      if (
        registeredPrice &&
        (Math.abs(registeredPrice.inputCostPerMillion - inputCostPerMillion) > 1e-9 ||
          Math.abs(registeredPrice.outputCostPerMillion - outputCostPerMillion) > 1e-9 ||
          (registeredPrice.cachedInputCostPerMillion !== undefined &&
            (cachedInputCostPerMillion === undefined ||
              Math.abs(registeredPrice.cachedInputCostPerMillion - cachedInputCostPerMillion) >
                1e-9)))
      ) {
        listFailure(
          `зареєстрована ціна ${modelId} не збігається з каталогом: ` +
            `registered=${registeredPrice.inputCostPerMillion}/${registeredPrice.cachedInputCostPerMillion ?? "n/a"}/${registeredPrice.outputCostPerMillion}, ` +
            `catalog=${inputCostPerMillion}/${cachedInputCostPerMillion ?? "n/a"}/${outputCostPerMillion}`,
        );
      }

      console.log(
        `PASS ${modelId} ціна в каталозі: prompt=$${inputCostPerMillion.toFixed(4)}/M, ` +
          `cache-read=${cachedInputCostPerMillion === undefined ? "n/a" : `$${cachedInputCostPerMillion.toFixed(4)}/M`}, ` +
          `completion=$${outputCostPerMillion.toFixed(4)}/M`,
      );
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
      console.log(`PASS ${modelId} декларує підтримку response_format`);
    }

    if (capabilities?.reasoning && !supported.includes("reasoning")) {
      listFailure(`модель ${modelId} не декларує підтримку reasoning у каталозі`);
    }
    if (capabilities?.reasoning) {
      console.log(`PASS ${modelId} декларує підтримку reasoning`);
    }

    if (capabilities?.reasoningEfforts.length) {
      if (!supported.includes("reasoning_effort")) {
        listFailure(`модель ${modelId} не декларує підтримку reasoning_effort у каталозі`);
      }

      const supportedEfforts = catalogModel.reasoning?.supported_efforts;
      if (!Array.isArray(supportedEfforts)) {
        listFailure(`модель ${modelId} не містить перевірюваного списку reasoning efforts`);
      }

      const missingEfforts = capabilities.reasoningEfforts.filter(
        (effort) => !supportedEfforts.includes(effort),
      );

      if (missingEfforts.length > 0) {
        listFailure(
          `модель ${modelId} не підтримує зареєстровані reasoning efforts: ${missingEfforts.join(", ")}`,
        );
      }

      if (!supportedEfforts.includes(environment.OPENROUTER_REASONING_EFFORT)) {
        listFailure(
          `модель ${modelId} не підтримує reasoning effort ${environment.OPENROUTER_REASONING_EFFORT}`,
        );
      }

      console.log(`PASS ${modelId} декларує підтримку reasoning_effort`);
    }

    if (
      isFreeModel &&
      registeredPrice &&
      (registeredPrice.inputCostPerMillion !== 0 ||
        registeredPrice.outputCostPerMillion !== 0 ||
        (registeredPrice.cachedInputCostPerMillion ?? 0) !== 0 ||
        (registeredPrice.cacheWriteCostPerMillion ?? 0) !== 0)
    ) {
      listFailure(`модель ${modelId} зареєстрована з ненульовою ціною в MODEL_PRICES`);
    }

    if (!registeredPrice) {
      console.log(`INFO ${modelId} не зареєстрована в MODEL_PRICES: ціна вважається неперевіреною`);
    }
  }

  console.log("PASS live catalog check: налаштовані моделі підтримують заявлені параметри");
}

main().catch((error) => {
  const rawMessage = error instanceof Error ? error.message : "невідома помилка";
  const message = rawMessage.replace(/sk-[A-Za-z0-9_-]+/g, "sk-***");
  console.error(`Помилка live-перевірки каталогу: ${message}`);
  process.exitCode = 1;
});
