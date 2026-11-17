import { z } from "zod";
import {
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_REASONING_EFFORT,
  OPENROUTER_REASONING_EFFORTS,
} from "./openrouter.js";

function optionalNonEmptyString(message: string) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1, message).optional(),
  );
}

export const environmentSchema = z.object({
  OPENROUTER_API_KEY: z.string().trim().min(1, "Потрібно задати OPENROUTER_API_KEY."),
  OPENROUTER_MODEL: optionalNonEmptyString("Невірне значення OPENROUTER_MODEL."),
  OPENROUTER_MODEL_FAST: optionalNonEmptyString("Невірне значення OPENROUTER_MODEL_FAST."),
  OPENROUTER_MODEL_MAIN: optionalNonEmptyString("Невірне значення OPENROUTER_MODEL_MAIN."),
  OPENROUTER_REASONING_EFFORT: z
    .enum(
      OPENROUTER_REASONING_EFFORTS,
      "Потрібно задати OPENROUTER_REASONING_EFFORT: max, high або low.",
    )
    .default(DEFAULT_REASONING_EFFORT),
  OPENROUTER_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(30_000),
  OPENROUTER_MAX_OUTPUT_TOKENS: z.coerce
    .number()
    .int()
    .min(1)
    .max(32_000)
    .default(DEFAULT_MAX_OUTPUT_TOKENS),
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
