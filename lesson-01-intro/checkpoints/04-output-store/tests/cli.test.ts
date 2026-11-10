import { describe, expect, it, vi } from "vitest";
import { loadEnvironment, readUserInput, requestAnswer } from "../src/cli.js";
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
});
