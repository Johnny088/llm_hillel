import { describe, expect, it } from "vitest";
import { loadEnvironment, readUserInput } from "../src/cli.js";
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
