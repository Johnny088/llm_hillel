import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  inspectLesson15OpenRouterCandidate,
  lesson15OpenRouter,
  repositoryRoot,
} from "./lesson15-openrouter-contract.js";
import { findModelFallbackViolations } from "./verify-no-model-fallback.js";

export async function inspectLesson15OpenRouterModel(
  candidateInput = `${lesson15OpenRouter}/solution`,
): Promise<string[]> {
  const failures = await inspectLesson15OpenRouterCandidate(candidateInput, "structural");
  if (failures.length > 0) return failures;
  return findModelFallbackViolations(resolve(repositoryRoot, candidateInput)).map(
    ({ file, line, rule }) => `${file}:${line} ${rule}`,
  );
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  const failures = await inspectLesson15OpenRouterModel(process.argv[2]);
  if (failures.length > 0) {
    console.error("FAIL Lesson 15 inherited OpenRouter model policy:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else
    console.log(
      "PASS Lesson 15 model policy: unchanged Lesson 14 configuration and no model fallback.",
    );
}
