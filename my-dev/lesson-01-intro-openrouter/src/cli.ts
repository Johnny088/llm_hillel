import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import OpenAI from "openai";
import { z } from "zod";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const DEFAULT_OPENROUTER_MODEL = "~deepseek/deepseek-v4-flash-latest";
export const OPENROUTER_REASONING_EFFORTS = ["max", "high", "low"] as const;
export const DEFAULT_REASONING_EFFORT = "low";
export const DEFAULT_MAX_TOKENS = 1_600;

export const environmentSchema = z.object({
  OPENROUTER_API_KEY: z.string().trim().min(1),
  OPENROUTER_MODEL: z.string().trim().min(1).default(DEFAULT_OPENROUTER_MODEL),
  OPENROUTER_REASONING_EFFORT: z
    .enum(OPENROUTER_REASONING_EFFORTS)
    .default(DEFAULT_REASONING_EFFORT),
  OPENROUTER_MAX_OUTPUT_TOKENS: z.coerce
    .number()
    .int()
    .min(1)
    .max(32_000)
    .default(DEFAULT_MAX_TOKENS),
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadRootEnvironment(
  moduleUrl: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Record<string, string> {
  let directory = dirname(fileURLToPath(moduleUrl));

  for (;;) {
    if (existsSync(resolve(directory, "package.json"))) {
      const envPath = resolve(directory, ".env");
      const fileEnvironment = existsSync(envPath)
        ? dotenv.parse(readFileSync(envPath, "utf8"))
        : {};
      const processEnvironment = Object.fromEntries(
        Object.entries(environment).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      );

      return { ...fileEnvironment, ...processEnvironment };
    }

    const parentDirectory = dirname(directory);

    if (parentDirectory === directory) {
      throw new UserFacingError("Не вдалося знайти корінь репозиторію.");
    }

    directory = parentDirectory;
  }
}

export class UserFacingError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export function loadEnvironment(env: Readonly<Record<string, string | undefined>>): Environment {
  const parsed = environmentSchema.safeParse(env);

  if (!parsed.success) {
    const invalidFields = [
      ...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "environment"))),
    ];

    throw new UserFacingError(
      `Перевірте змінні середовища: ${invalidFields.join(", ")}. Значення не виводяться.`,
    );
  }

  return parsed.data;
}

export function readUserInput(args: readonly string[]): string {
  const input = args.join(" ").trim();

  if (input.length === 0) {
    throw new UserFacingError("Введіть текст запиту.");
  }

  return input;
}

export type SafeApiFailure = {
  name: string;
  status?: number;
  request_id?: string | null;
};

export function formatApiFailure(error: SafeApiFailure): string {
  if (error.name === "APIConnectionTimeoutError") {
    return "Час очікування відповіді вичерпано. Спробуйте ще раз.";
  }

  if (error.name === "APIConnectionError") {
    return "Не вдалося з'єднатися з OpenRouter. Перевірте мережу.";
  }

  if (error.status === 429) {
    return "OpenRouter обмежив частоту запитів. Зачекайте й повторіть.";
  }

  if (typeof error.status === "number") {
    const requestId = error.request_id ? ` (request_id: ${error.request_id})` : "";
    return `OpenRouter повернув HTTP ${error.status}${requestId}.`;
  }

  return "Не вдалося виконати запит до OpenRouter.";
}

export function formatError(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    return formatApiFailure({
      name: error.constructor.name,
      ...(typeof error.status === "number" ? { status: error.status } : {}),
      ...(error.requestID ? { request_id: error.requestID } : {}),
    });
  }

  if (error instanceof UserFacingError) {
    return error.message;
  }

  return "Сталася непередбачена помилка. Спробу можна повторити або повідомити викладача.";
}

export type ChatMessage = { role: "system"; content: string } | { role: "user"; content: string };

export type ReasoningEffort = (typeof OPENROUTER_REASONING_EFFORTS)[number];

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  reasoning: { enabled: boolean; effort: ReasoningEffort };
  max_completion_tokens: number;
};

export interface ChatClient {
  create(request: ChatRequest): Promise<{ text: string; model?: string }>;
}

export interface AnswerResult {
  text: string;
  model: string;
}

export async function requestAnswer(
  client: ChatClient,
  environment: Environment,
  input: string,
): Promise<AnswerResult> {
  const response = await client.create({
    model: environment.OPENROUTER_MODEL,
    messages: [
      { role: "system", content: "Ти — стислий і точний асистент." },
      { role: "user", content: input },
    ],
    reasoning: { enabled: true, effort: environment.OPENROUTER_REASONING_EFFORT },
    max_completion_tokens: environment.OPENROUTER_MAX_OUTPUT_TOKENS,
  });

  const text = response.text.trim();

  if (text.length === 0) {
    throw new UserFacingError("OpenRouter повернув порожню відповідь.");
  }

  return { text, model: response.model ?? environment.OPENROUTER_MODEL };
}
