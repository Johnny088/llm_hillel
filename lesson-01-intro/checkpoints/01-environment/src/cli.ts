import OpenAI from "openai";
import { z } from "zod";

export const environmentSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1, "Потрібно задати OPENAI_API_KEY."),
  OPENAI_MODEL_FAST: z.string().trim().min(1, "Потрібно задати OPENAI_MODEL_FAST."),
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

export function readUserInput(_args: readonly string[]): string {
  // TODO: об'єднайте аргументи, trim() і відхиліть порожній input.
  throw new UserFacingError("TODO: реалізуйте readUserInput(args).");
}

export type SafeApiFailure = {
  name: string;
  status?: number;
  request_id?: string | null;
};

export function formatApiFailure(_error: SafeApiFailure): string {
  // Checkpoint 5 додасть окремі повідомлення для HTTP, network error і timeout.
  return "Не вдалося виконати API-запит. Деталізацію додамо у Checkpoint 5.";
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

  return "Непередбачена помилка. Повторіть спробу або зверніться до викладача.";
}

export type ResponseRequest = {
  model: string;
  instructions: string;
  input: string;
  store: false;
};

export interface ResponsesClient {
  create(request: ResponseRequest): Promise<{ output_text: string }>;
}

export async function requestAnswer(
  _client: ResponsesClient,
  _environment: Environment,
  _input: string,
): Promise<string> {
  // TODO 1: викличте client.create з instructions, input і store: false.
  // TODO 2: перевірте response.output_text.trim().
  throw new UserFacingError("TODO: реалізуйте requestAnswer(...).");
}
