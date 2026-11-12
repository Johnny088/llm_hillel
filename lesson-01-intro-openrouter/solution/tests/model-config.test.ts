import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_REASONING_EFFORT,
  OPENROUTER_REASONING_EFFORTS,
} from "../src/cli.js";

const solutionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootEnvironmentExample = resolve(solutionRoot, "../../.env.example");

describe("спільні налаштування OpenRouter", () => {
  it("використовує модель і параметри з кореневого .env.example", async () => {
    const example = await readFile(rootEnvironmentExample, "utf8");
    const value = (key: string) =>
      example
        .split(/\r?\n/u)
        .find((line) => line.startsWith(`${key}=`))
        ?.split("=", 2)[1]
        ?.trim();

    expect(value("OPENROUTER_MODEL")).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(value("OPENROUTER_REASONING_EFFORT")).toBe(DEFAULT_REASONING_EFFORT);
    expect(Number(value("OPENROUTER_MAX_OUTPUT_TOKENS"))).toBe(DEFAULT_MAX_TOKENS);
    expect(value("OPENROUTER_API_KEY")).toBe("");
  });

  it("приймає всі reasoning values із shared env", () => {
    expect(OPENROUTER_REASONING_EFFORTS).toEqual(["max", "high", "low"]);
  });
});
