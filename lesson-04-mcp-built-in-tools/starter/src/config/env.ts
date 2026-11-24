import { z } from "zod";

export const environmentSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1, "Потрібно задати OPENAI_API_KEY."),
  OPENAI_MODEL_FAST: z.string().trim().min(1, "Потрібно задати OPENAI_MODEL_FAST."),
  OPENAI_MODEL_MAIN: z.string().trim().min(1, "Потрібно задати OPENAI_MODEL_MAIN."),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(30_000),
  OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(1).max(32_000).default(800),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
});

export type Environment = z.infer<typeof environmentSchema>;

export class EnvironmentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EnvironmentError";
  }
}

export function loadEnvironment(source: Readonly<Record<string, string | undefined>>): Environment {
  const parsed = environmentSchema.safeParse(source);

  if (!parsed.success) {
    const fields = [
      ...new Set(parsed.error.issues.map((issue) => issue.path.join(".")).filter(Boolean)),
    ];

    throw new EnvironmentError(
      `Некоректна конфігурація: ${fields.join(", ")}. Значення не виводяться.`,
    );
  }

  return parsed.data;
}
