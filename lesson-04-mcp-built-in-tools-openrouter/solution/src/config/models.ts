import type { Environment } from "./env.js";
import { DEFAULT_OPENROUTER_MODEL } from "./openrouter.js";

export type ModelTask = "fast" | "main";

export function resolveModel(task: ModelTask, environment: Environment): string {
  const defaultModel = environment.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL;

  if (task === "fast") {
    return environment.OPENROUTER_MODEL_FAST ?? defaultModel;
  }

  return environment.OPENROUTER_MODEL_MAIN ?? defaultModel;
}
