import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import OpenAI from "openai";
import { z } from "zod";

const environmentSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1, "Потрібно задати OPENAI_API_KEY."),
  OPENAI_MODEL_FAST: z.string().trim().min(1, "Потрібно задати OPENAI_MODEL_FAST."),
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
      'Потрібно передати запит, наприклад: yarn dev:lesson01:solution "Що таке closure у JavaScript?"',
    );
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
    return "Перевищено час очікування відповіді API.";
  }

  if (error.name === "APIConnectionError") {
    return "Не вдалося з'єднатися з API.";
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
  client: ResponsesClient,
  environment: Environment,
  input: string,
): Promise<string> {
  const response = await client.create({
    model: environment.OPENAI_MODEL_FAST,
    instructions:
      "Роль: досвідчений TypeScript-розробник. Стиль: лаконічні, точні й практичні пояснення.",
    input,
    store: false,
  });

  const answer = response.output_text.trim();

  if (!answer) {
    throw new UserFacingError("API повернув Response без текстового output.");
  }

  return answer;
}
