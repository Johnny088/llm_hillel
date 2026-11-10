import OpenAI from "openai";
import { z } from "zod";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";
export const OPENROUTER_REASONING_EFFORTS = ["medium", "low"] as const;
export const DEFAULT_REASONING_EFFORT = "medium";
export const DEFAULT_MAX_TOKENS = 800;

export const environmentSchema = z.object({
  OPENROUTER_API_KEY: z.string().trim().min(1),
  OPENROUTER_MODEL: z.string().trim().min(1).default(DEFAULT_OPENROUTER_MODEL),
  OPENROUTER_REASONING_EFFORT: z
    .enum(OPENROUTER_REASONING_EFFORTS)
    .default(DEFAULT_REASONING_EFFORT),
});

export type Environment = z.infer<typeof environmentSchema>;

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
  freeModelDailyLimit?: boolean;
};

type OpenRouterErrorExtension = {
  message?: unknown;
  metadata?: {
    previous_errors?: Array<{ message?: unknown }>;
  };
};

function isFreeModelDailyLimit(payload: unknown): boolean {
  const extension = payload as OpenRouterErrorExtension | undefined;
  const previousErrors = extension?.metadata?.previous_errors;
  const messages = [
    extension?.message,
    ...(Array.isArray(previousErrors) ? previousErrors : []).map((entry) =>
      entry && typeof entry === "object" ? entry.message : undefined,
    ),
  ];

  return messages.some(
    (message) => typeof message === "string" && message.includes("free-models-per-day"),
  );
}

export function formatApiFailure(_error: SafeApiFailure): string {
  // TODO: окремо опрацювати timeout, network error, добову free-квоту й HTTP status.
  throw new UserFacingError("TODO: потрібно реалізувати formatApiFailure(error).");
}

export function formatError(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    return formatApiFailure({
      name: error.constructor.name,
      ...(typeof error.status === "number" ? { status: error.status } : {}),
      ...(error.requestID ? { request_id: error.requestID } : {}),
      freeModelDailyLimit: isFreeModelDailyLimit(error.error),
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
  max_tokens: number;
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
  // reasoning і max_tokens.
  // TODO 2: перевірити response.text.trim() і повернути фактичну модель відповіді.
  throw new UserFacingError("TODO: потрібно реалізувати requestAnswer(...).");
}
