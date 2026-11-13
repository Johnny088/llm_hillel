import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_REASONING_EFFORT,
  formatApiFailure,
  formatError,
  loadEnvironment,
  readUserInput,
  requestAnswer,
  UserFacingError,
  type ChatClient,
  type Environment,
} from "../src/cli.js";

const examplePath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env.example");

function validEnvironment(overrides: Record<string, string | undefined> = {}): Environment {
  return loadEnvironment({ OPENROUTER_API_KEY: "sk-or-v1-test-key", ...overrides });
}

describe("loadEnvironment", () => {
  it("відхиляє відсутній OPENROUTER_API_KEY", () => {
    expect(() => loadEnvironment({})).toThrow(UserFacingError);
    expect(() => loadEnvironment({})).toThrow(/OPENROUTER_API_KEY/);
  });

  it("підставляє основну модель та effort за замовчуванням", () => {
    const environment = validEnvironment();

    expect(environment.OPENROUTER_MODEL).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(environment.OPENROUTER_REASONING_EFFORT).toBe(DEFAULT_REASONING_EFFORT);
    expect(environment.OPENROUTER_MAX_OUTPUT_TOKENS).toBe(DEFAULT_MAX_TOKENS);
  });

  it("відхиляє рівень мислення, якого немає в метаданих моделі", () => {
    let message = "";

    try {
      loadEnvironment({
        OPENROUTER_API_KEY: "sk-or-v1-test-key",
        OPENROUTER_REASONING_EFFORT: "turbo-secret-value",
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("OPENROUTER_REASONING_EFFORT");
    expect(message).not.toContain("turbo-secret-value");
  });
});

describe("readUserInput", () => {
  it("об'єднує аргументи CLI", () => {
    expect(readUserInput(["Обчисли", "37", "*", "19"])).toBe("Обчисли 37 * 19");
    expect(readUserInput(["  один ", " два  "])).toBe("один   два");
  });

  it("відхиляє порожній CLI input", () => {
    expect(() => readUserInput([])).toThrow(UserFacingError);
    expect(() => readUserInput(["   ", ""])).toThrow(/текст запиту/);
  });
});

describe("formatApiFailure", () => {
  it("безпечно форматує HTTP 401", () => {
    const message = formatApiFailure({
      name: "AuthenticationError",
      status: 401,
      request_id: "req_auth_123",
    });

    expect(message).toContain("401");
    expect(message).toContain("req_auth_123");
  });

  it("безпечно форматує network error", () => {
    expect(formatApiFailure({ name: "APIConnectionError" })).toMatch(/мереж/i);
  });

  it("безпечно форматує timeout", () => {
    expect(formatApiFailure({ name: "APIConnectionTimeoutError" })).toMatch(/очікування/i);
  });

  it("форматує невідомий статус лише за ім'ям помилки", () => {
    const message = formatApiFailure({ name: "MysteryProviderError" });

    expect(message).toBe("Не вдалося виконати запит до OpenRouter.");
    expect(message).not.toContain("MysteryProviderError");
  });

  it("форматує generic HTTP 429 без provider payload", () => {
    const message = formatApiFailure({ name: "RateLimitError", status: 429 });

    expect(message).toMatch(/частот/i);
    expect(message).not.toContain("provider");
    expect(message).not.toContain("429");
  });
});

describe("formatError", () => {
  it("розпізнає реальний AuthenticationError через formatError", () => {
    const error = new OpenAI.AuthenticationError(
      401,
      { error: { message: "Incorrect API key provided: sk-or-v1-LEAKED" } },
      "401 Unauthorized",
      new Headers({ "x-request-id": "req_auth_real" }),
    );

    const message = formatError(error);

    expect(message).toContain("401");
    expect(message).toContain("req_auth_real");
    expect(message).not.toContain("LEAKED");
    expect(message).not.toContain("sk-or-v1");
  });

  it("розпізнає реальний APIConnectionError через formatError", () => {
    const error = new OpenAI.APIConnectionError({ message: "fetch failed: ECONNREFUSED" });

    expect(formatError(error)).toMatch(/мереж/i);
    expect(formatError(error)).not.toContain("ECONNREFUSED");
  });

  it("розпізнає реальний APIConnectionTimeoutError через formatError", () => {
    const error = new OpenAI.APIConnectionTimeoutError({ message: "Request timed out." });

    expect(formatError(error)).toMatch(/очікування/i);
  });

  it("безпечно форматує HTTP 429 через formatError", () => {
    const error = new OpenAI.RateLimitError(
      429,
      { error: { message: "upstream provider overloaded" } },
      "429 Too Many Requests",
      new Headers(),
    );

    const message = formatError(error);

    expect(message).toMatch(/частот/i);
    expect(message).not.toContain("upstream provider overloaded");
  });

  it("пропускає повідомлення UserFacingError через formatError", () => {
    expect(formatError(new UserFacingError("Своє безпечне повідомлення."))).toBe(
      "Своє безпечне повідомлення.",
    );
  });

  it("безпечно маскує непередбачену помилку через formatError", () => {
    const message = formatError(new Error("ENOENT: /home/johnny/secret/.env"));

    expect(message).toMatch(/непередбачена/i);
    expect(message).not.toContain("/home/johnny");
    expect(message).not.toContain(".env");
  });
});

describe("requestAnswer", () => {
  it("повертає текст і фактичну модель відповіді через mock", async () => {
    const client: ChatClient = {
      create: async () => ({ text: "  703  ", model: "actual/model-returned" }),
    };

    await expect(requestAnswer(client, validEnvironment(), "Обчисли 37 * 19")).resolves.toEqual({
      text: "703",
      model: "actual/model-returned",
    });
  });

  it("підставляє дефолтні model, effort і max_completion_tokens у запит", async () => {
    const create = vi.fn(async () => ({ text: "ok", model: "some/model" }));

    await requestAnswer({ create }, validEnvironment(), "привіт");

    expect(create).toHaveBeenCalledWith({
      model: DEFAULT_OPENROUTER_MODEL,
      messages: [
        { role: "system", content: expect.any(String) },
        { role: "user", content: "привіт" },
      ],
      reasoning: { enabled: true, effort: DEFAULT_REASONING_EFFORT },
      max_completion_tokens: DEFAULT_MAX_TOKENS,
    });
  });

  it("відхиляє порожній text через mock", async () => {
    const client: ChatClient = {
      create: async () => ({ text: "   ", model: "some/model" }),
    };

    await expect(requestAnswer(client, validEnvironment(), "привіт")).rejects.toBeInstanceOf(
      UserFacingError,
    );
  });
});

describe("конфігурація кореневого .env.example", () => {
  it("перевіряє синхронізацію з конфігурацією кореневого .env.example", async () => {
    const example = await readFile(examplePath, "utf8");
    const value = (key: string): string | undefined =>
      example
        .split(/\r?\n/u)
        .find((line) => line.startsWith(`${key}=`))
        ?.split("=")
        .slice(1)
        .join("=")
        .trim();

    expect(examplePath).toContain(".env.example");
    expect(value("OPENROUTER_MODEL")).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(value("OPENROUTER_REASONING_EFFORT")).toBe(DEFAULT_REASONING_EFFORT);
    expect(value("OPENROUTER_MAX_OUTPUT_TOKENS")).toBe(String(DEFAULT_MAX_TOKENS));
    expect(value("OPENROUTER_API_KEY")).toBe("");
  });
});
