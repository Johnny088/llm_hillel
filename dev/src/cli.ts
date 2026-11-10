import OpenAI from "openai";
import { z } from "zod";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";
export const OPENROUTER_REASONING_EFFORTS = ["medium", "low"] as const;
export const DEFAULT_REASONING_EFFORT = "medium";
export const DEFAULT_MAX_TOKENS = 800;

const environmentSchema = z.object({
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

export function loadEnvironment(env: Readonly<Record<string, string | undefined>>): Environment {
  const parsed = environmentSchema.safeParse(env);

  if (!parsed.success) {
    const fields = [
      ...new Set(parsed.error.issues.map((issue) => issue.path.join(".")).filter(Boolean)),
    ];

    throw new UserFacingError(`Потрібно задати: ${fields.join(", ")}. Значення не виводяться.`);
  }

  return parsed.data;
}

export function readUserInput(args: readonly string[]): string {
  const input = args.join(" ").trim();

  if (!input) {
    throw new UserFacingError(
      'Потрібно передати запит, наприклад: node scripts/run-tsx-entrypoint.mjs dev/src/index.ts "Що таке closure у JavaScript?"',
    );
  }

  return input;
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

export function formatApiFailure(error: SafeApiFailure): string {
  if (error.name === "APIConnectionTimeoutError") {
    return "Перевищено час очікування відповіді API.";
  }

  if (error.name === "APIConnectionError") {
    return "Не вдалося з'єднатися з API.";
  }

  if (error.status === 429 && error.freeModelDailyLimit) {
    return "Вичерпано спільну добову квоту безкоштовних моделей OpenRouter.";
  }

  const status = typeof error.status === "number" ? `HTTP ${error.status}` : error.name;
  const requestId = error.request_id ? `; request_id=${error.request_id}` : "";

  return `${status}${requestId}`;
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
  client: ChatClient,
  environment: Environment,
  input: string,
): Promise<AnswerResult> {
  const response = await client.create({
    model: environment.OPENROUTER_MODEL,
    messages: [
      {
        role: "system",
        content:
          "Роль: досвідчений TypeScript-розробник. Стиль: лаконічні, точні й практичні пояснення.",
      },
      { role: "user", content: input },
    ],
    reasoning: { enabled: true, effort: environment.OPENROUTER_REASONING_EFFORT },
    max_tokens: DEFAULT_MAX_TOKENS,
  });

  const answer = response.text.trim();

  if (!answer) {
    throw new UserFacingError("API повернув чат-відповідь без текстового output.");
  }

  const model = response.model?.trim() || environment.OPENROUTER_MODEL;

  return {
    text: answer,
    model,
  };
}
