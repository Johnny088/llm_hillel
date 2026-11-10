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

export function loadEnvironment(_env: Readonly<Record<string, string | undefined>>): Environment {
  // TODO 1: використайте environmentSchema.safeParse.
  // TODO 2: сформуйте безпечне повідомлення лише з назвами невалідних полів.
  throw new UserFacingError("TODO: реалізуйте loadEnvironment(env).");
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
  // TODO: окремо опрацюйте timeout, network error і HTTP status.
  throw new UserFacingError("TODO: реалізуйте formatApiFailure(error).");
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
