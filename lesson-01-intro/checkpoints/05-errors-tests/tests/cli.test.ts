import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import {
  formatApiFailure,
  formatError,
  loadEnvironment,
  readUserInput,
  requestAnswer,
} from "../src/cli.js";

const validEnvironment = {
  OPENAI_API_KEY: "test-only-value",
  OPENAI_MODEL_FAST: "configured-for-test",
};

describe("loadEnvironment", () => {
  it("відхиляє відсутній API key", () => {
    expect(() => loadEnvironment({ OPENAI_MODEL_FAST: "configured-for-test" })).toThrow(
      "OPENAI_API_KEY",
    );
  });

  it("відхиляє відсутню model variable", () => {
    expect(() => loadEnvironment({ OPENAI_API_KEY: "test-only-value" })).toThrow(
      "OPENAI_MODEL_FAST",
    );
  });

  it("повертає лише перевірені поля", () => {
    expect(
      loadEnvironment({
        ...validEnvironment,
        EXTRA_VALUE: "not-returned",
      }),
    ).toEqual(validEnvironment);
  });
});

describe("readUserInput", () => {
  it("об'єднує аргументи CLI", () => {
    expect(readUserInput(["Що", "таке", "closure?"])).toBe("Що таке closure?");
  });

  it("відхиляє порожній CLI input", () => {
    expect(() => readUserInput([])).toThrow("Передайте запит");
  });
});

describe("formatApiFailure", () => {
  it("форматує лише безпечні поля HTTP-помилки", () => {
    expect(
      formatApiFailure({
        name: "AuthenticationError",
        status: 401,
        request_id: "req_test",
      }),
    ).toBe("HTTP 401; request_id=req_test");
  });

  it("форматує network error", () => {
    expect(formatApiFailure({ name: "APIConnectionError" })).toBe("Не вдалося з'єднатися з API.");
  });

  it("форматує timeout", () => {
    expect(formatApiFailure({ name: "APIConnectionTimeoutError" })).toBe(
      "Перевищено час очікування відповіді API.",
    );
  });
});

describe("formatError", () => {
  it("форматує реальний AuthenticationError без витоку body або headers", () => {
    const error = new OpenAI.AuthenticationError(
      401,
      { message: "synthetic secret-bearing body" },
      undefined,
      new Headers({ "x-request-id": "req_test" }),
    );

    expect(formatError(error)).toBe("HTTP 401; request_id=req_test");
  });

  it("розпізнає реальний APIConnectionError", () => {
    expect(formatError(new OpenAI.APIConnectionError({}))).toBe("Не вдалося з'єднатися з API.");
  });

  it("розпізнає реальний APIConnectionTimeoutError", () => {
    expect(formatError(new OpenAI.APIConnectionTimeoutError())).toBe(
      "Перевищено час очікування відповіді API.",
    );
  });
});

describe("requestAnswer", () => {
  it("повертає текст через mock-клієнт", async () => {
    const create = vi.fn().mockResolvedValue({ output_text: "Готово" });

    const answer = await requestAnswer({ create }, validEnvironment, "Короткий запит");

    expect(answer).toBe("Готово");
    expect(create).toHaveBeenCalledWith({
      model: validEnvironment.OPENAI_MODEL_FAST,
      instructions:
        "Роль: досвідчений TypeScript-розробник. Стиль: лаконічні, точні й практичні пояснення.",
      input: "Короткий запит",
      store: false,
    });
  });

  it("відхиляє порожній output_text", async () => {
    await expect(
      requestAnswer(
        { create: vi.fn().mockResolvedValue({ output_text: "   " }) },
        validEnvironment,
        "Короткий запит",
      ),
    ).rejects.toThrow("без текстового output");
  });

  it("передає помилку mock-клієнта вище", async () => {
    const failure = new Error("mock network failure");

    await expect(
      requestAnswer(
        { create: vi.fn().mockRejectedValue(failure) },
        validEnvironment,
        "Короткий запит",
      ),
    ).rejects.toBe(failure);
  });
});
