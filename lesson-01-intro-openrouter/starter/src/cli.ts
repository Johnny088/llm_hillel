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

export function loadEnvironment(_env: Readonly<Record<string, string | undefined>>): Environment {
  // TODO 1: використати environmentSchema.safeParse.
  // TODO 2: сформувати безпечне повідомлення лише з назвами невалідних полів.
  throw new UserFacingError("TODO: потрібно реалізувати loadEnvironment(env).");
}

export function readUserInput(_args: readonly string[]): string {
  // TODO: об'єднати аргументи, застосувати trim() і відхилити порожній input.
  throw new UserFacingError("TODO: потрібно реалізувати readUserInput(args).");
}

export type SafeApiFailure = {
  name: string;
  status?: number;
  request_id?: string | null;
};

export function formatApiFailure(_error: SafeApiFailure): string {
  // TODO: окремо опрацювати timeout, network error і HTTP status.
  throw new UserFacingError("TODO: потрібно реалізувати formatApiFailure(error).");
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
  _client: ChatClient,
  _environment: Environment,
  _input: string,
): Promise<AnswerResult> {
  // TODO 1: викликати client.create з вибраною моделлю, повідомленнями,
  // reasoning і max_completion_tokens.
  // TODO 2: перевірити response.text.trim() і повернути фактичну модель відповіді.
  throw new UserFacingError("TODO: потрібно реалізувати requestAnswer(...).");
}
