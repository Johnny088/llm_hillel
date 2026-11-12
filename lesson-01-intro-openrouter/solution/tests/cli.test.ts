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
  OPENROUTER_MAX_OUTPUT_TOKENS: 1_600,
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
      OPENROUTER_MAX_OUTPUT_TOKENS: DEFAULT_MAX_TOKENS,
    });
  });

  it("відхиляє рівень мислення поза спільною конфігурацією", () => {
    expect(() =>
      loadEnvironment({
        OPENROUTER_API_KEY: "test-only-value",
        OPENROUTER_REASONING_EFFORT: "medium",
      }),
    ).toThrow("OPENROUTER_REASONING_EFFORT");
  });

  it("приймає спільні reasoning levels і output token budget", () => {
    for (const effort of ["low", "high", "max"] as const) {
      expect(
        loadEnvironment({
          OPENROUTER_API_KEY: "test-only-value",
          OPENROUTER_REASONING_EFFORT: effort,
          OPENROUTER_MAX_OUTPUT_TOKENS: "2400",
        }),
      ).toMatchObject({ OPENROUTER_REASONING_EFFORT: effort, OPENROUTER_MAX_OUTPUT_TOKENS: 2400 });
    }
  });

  it("повертає лише перевірені поля", () => {
    expect(
      loadEnvironment({
        ...validEnvironment,
        OPENROUTER_MAX_OUTPUT_TOKENS: "1600",
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

  it("форматує generic HTTP 429 без provider payload", () => {
    expect(
      formatApiFailure({
        name: "RateLimitError",
        status: 429,
        request_id: "req_rate_limit",
      }),
    ).toBe("HTTP 429; request_id=req_rate_limit");
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

  it("форматує реальну RateLimitError без витоку provider payload", () => {
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
                message: "Rate limit exceeded: private provider text",
              },
            ],
          },
        },
      },
      undefined,
      new Headers(),
    );

    expect(formatError(error)).toBe("HTTP 429");
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
      max_completion_tokens: DEFAULT_MAX_TOKENS,
    });
  });

  it("підставляє дефолтні model, effort і max_completion_tokens у запит", async () => {
    const create = vi.fn().mockResolvedValue({ text: "Готово" });

    const environment = loadEnvironment({
      OPENROUTER_API_KEY: "test-only-value",
    });

    await requestAnswer({ create }, environment, "Короткий запит");

    const request = create.mock.calls[0]?.[0];
    expect(request).toHaveProperty("max_completion_tokens", DEFAULT_MAX_TOKENS);
    expect(request).not.toHaveProperty("max_tokens");

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_OPENROUTER_MODEL,
        reasoning: { enabled: true, effort: DEFAULT_REASONING_EFFORT },
        max_completion_tokens: DEFAULT_MAX_TOKENS,
      }),
    );
  });

  it("передає налаштований OPENROUTER_MAX_OUTPUT_TOKENS в запит", async () => {
    const create = vi.fn().mockResolvedValue({ text: "Готово" });
    const environment = loadEnvironment({
      OPENROUTER_API_KEY: "test-only-value",
      OPENROUTER_MAX_OUTPUT_TOKENS: "2400",
    });

    await requestAnswer({ create }, environment, "Короткий запит");

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ max_completion_tokens: 2_400 }));
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty("max_tokens");
  });

  it("повертає фактичну модель, на яку відповів OpenRouter", async () => {
    const create = vi.fn().mockResolvedValue({
      text: "Готово",
      model: "deepseek/deepseek-v4-flash",
    });

    await expect(requestAnswer({ create }, validEnvironment, "Короткий запит")).resolves.toEqual({
      text: "Готово",
      model: "deepseek/deepseek-v4-flash",
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
