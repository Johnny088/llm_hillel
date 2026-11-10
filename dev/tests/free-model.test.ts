import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_REASONING_EFFORT,
  OPENROUTER_REASONING_EFFORTS,
} from "../src/cli.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const environmentExamplePath = resolve(root, ".env.example");

describe("Безкоштовна модель з нульовою вартістю", () => {
  it("дефолтна модель помічена як безкоштовний тариф OpenRouter (:free)", () => {
    expect(DEFAULT_OPENROUTER_MODEL).toMatch(/:free$/u);
  });

  it("дефолтний рівень мислення належить до дозволених значень", () => {
    expect(OPENROUTER_REASONING_EFFORTS).toContain(DEFAULT_REASONING_EFFORT);
  });

  it("дефолтна модель у .env.example збігається з дефолтом у коді", async () => {
    const example = await readFile(environmentExamplePath, "utf8");
    const configuredModel = example
      .split(/\r?\n/u)
      .find((line) => line.startsWith("OPENROUTER_MODEL="))
      ?.split("=", 2)[1]
      ?.trim();

    expect(configuredModel).toBe(DEFAULT_OPENROUTER_MODEL);
  });

  it("дефолтний reasoning effort у .env.example збігається з дефолтом у коді", async () => {
    const example = await readFile(environmentExamplePath, "utf8");
    const configuredEffort = example
      .split(/\r?\n/u)
      .find((line) => line.startsWith("OPENROUTER_REASONING_EFFORT="))
      ?.split("=", 2)[1]
      ?.trim();

    expect(configuredEffort).toBe(DEFAULT_REASONING_EFFORT);
  });

  it(".env.example тримає OPENROUTER_API_KEY порожнім (без реального ключа)", async () => {
    const example = await readFile(environmentExamplePath, "utf8");
    const apiKeyValue = example
      .split(/\r?\n/u)
      .find((line) => line.startsWith("OPENROUTER_API_KEY="))
      ?.split("=", 2)[1]
      ?.trim();

    expect(apiKeyValue).toBe("");
  });
});
