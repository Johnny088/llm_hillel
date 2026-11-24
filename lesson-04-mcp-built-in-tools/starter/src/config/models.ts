import type { Environment } from "./env.js";

export type ModelTask = "fast" | "main";

export function resolveModel(task: ModelTask, environment: Environment): string {
  return task === "fast" ? environment.OPENAI_MODEL_FAST : environment.OPENAI_MODEL_MAIN;
}
