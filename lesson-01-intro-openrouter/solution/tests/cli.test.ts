import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_REASONING_EFFORT,
  UserFacingError,
  formatApiFailure,
  formatError,
  loadEnvironment,
  readUserInput,
  requestAnswer,
} from "../src/cli.js";

const validEnvironment = {
  OPENROUTER_API_KEY: "test-only-value",
  OPENROUTER_MODEL: "configured-for-test",
  OPENROUTER_REASONING_EFFORT: "low",
} as const;

describe("loadEnvironment", () => {
  it("відхиляє відсутній OpenRouter API key", () => {
    expect(() => loadEnvironment({})).toThrow("OPENROUTER_API_KEY");
  });

  it("підставляє дефолтну модель та effort, якщо вони не задані", () => {
    expect(loadEnvironment({ OPENROUTER_API_KEY: "test-only-value" })).toEqual({
      OPENROUTER_API_KEY: "test-only-value",
      OPENROUTER_MODEL: DEFAULT_OPENROUTER_MODEL,
      OPENROUTER_REASONING_EFFORT: DEFAULT_REASONING_EFFORT,
    });
  });

  it("відхиляє рівень мислення, який модель не підтримує", () => {
    expect(() =>
      loadEnvironment({
        OPENROUTER_API_KEY: "test-only-value",
        OPENROUTER_REASONING_EFFORT: "high",
      }),
    ).toThrow("OPENROUTER_REASONING_EFFORT");
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
    expect(() => readUserInput([])).toThrow("yarn dev:lesson01:openrouter:solution");
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

  it("форматує невідомий статус лише за ім'ям помилки", () => {
    expect(formatApiFailure({ name: "RateLimitError" })).toBe("RateLimitError");
  });

  it("пояснює спільний добовий ліміт безкоштовних моделей", () => {
    expect(
      formatApiFailure({
        name: "RateLimitError",
        status: 429,
        freeModelDailyLimit: true,
      }),
    ).toBe("Вичерпано спільну добову квоту безкоштовних моделей OpenRouter.");
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

  it("розпізнає маркер добового free-ліміту в реальній APIError", () => {
    const error = OpenAI.APIError.generate(
      429,
      {
        error: {
          code: 429,
          message: "private aggregate message",
          metadata: {
            previous_errors: [
              {
                code: 429,
                message: "Rate limit exceeded: free-models-per-day. private provider text",
              },
            ],
          },
        },
      },
      undefined,
      new Headers(),
    );

    expect(formatError(error)).toBe(
      "Вичерпано спільну добову квоту безкоштовних моделей OpenRouter.",
    );
  });

  it("пропускає повідомлення UserFacingError без витоку секретів", () => {
    expect(formatError(new UserFacingError("Внутрішній user-facing стан"))).toBe(
      "Внутрішній user-facing стан",
    );
  });

  it("безпечно маскує непередбачену помилку", () => {
    expect(formatError(new Error("raw secret-bearing stack"))).toBe(
      "Сталася непередбачена помилка. Спробу можна повторити або повідомити викладача.",
    );
  });

  it("безпечно обробляє пошкоджений metadata.previous_errors", () => {
    const error = OpenAI.APIError.generate(
      429,
      {
        error: {
          message: "opaque provider payload",
          metadata: { previous_errors: { message: "opaque provider payload" } },
        },
      },
      undefined,
      new Headers(),
    );

    expect(formatError(error)).toBe("HTTP 429");
  });
});

describe("requestAnswer", () => {
  it("повертає текст через mock-клієнт", async () => {
    const create = vi.fn().mockResolvedValue({ text: "Готово", model: "configured-for-test" });

    const answer = await requestAnswer({ create }, validEnvironment, "Короткий запит");

    expect(answer).toEqual({
      text: "Готово",
      model: "configured-for-test",
    });
    expect(create).toHaveBeenCalledWith({
      model: validEnvironment.OPENROUTER_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Роль: досвідчений TypeScript-розробник. Стиль: лаконічні, точні й практичні пояснення.",
        },
        { role: "user", content: "Короткий запит" },
      ],
      reasoning: { enabled: true, effort: validEnvironment.OPENROUTER_REASONING_EFFORT },
      max_tokens: DEFAULT_MAX_TOKENS,
    });
  });

  it("підставляє дефолтні model, effort і max_tokens у запит", async () => {
    const create = vi.fn().mockResolvedValue({ text: "Готово" });

    const environment = loadEnvironment({
      OPENROUTER_API_KEY: "test-only-value",
    });

    await requestAnswer({ create }, environment, "Короткий запит");

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_OPENROUTER_MODEL,
        reasoning: { enabled: true, effort: DEFAULT_REASONING_EFFORT },
        max_tokens: DEFAULT_MAX_TOKENS,
      }),
    );
  });

  it("повертає фактичну модель, на яку відповів OpenRouter", async () => {
    const create = vi.fn().mockResolvedValue({
      text: "Готово",
      model: "upstage/solar-pro-3:free",
    });

    await expect(requestAnswer({ create }, validEnvironment, "Короткий запит")).resolves.toEqual({
      text: "Готово",
      model: "upstage/solar-pro-3:free",
    });
  });

  it("відхиляє порожній text", async () => {
    await expect(
      requestAnswer(
        { create: vi.fn().mockResolvedValue({ text: "   " }) },
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
