import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  lesson15OpenRouter,
  withLesson15FoundationFixture,
} from "./lesson15-openrouter-contract.js";
import { verifyLesson14OpenRouterInheritedEvals } from "./verify-lesson14-openrouter-inherited-evals.js";

export async function verifyLesson15OpenRouterInheritedEvals(
  candidateInput = `${lesson15OpenRouter}/solution`,
): Promise<string[]> {
  return withLesson15FoundationFixture(candidateInput, (fixture) =>
    verifyLesson14OpenRouterInheritedEvals(fixture),
  );
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  try {
    const failures = await verifyLesson15OpenRouterInheritedEvals(process.argv[2]);
    if (failures.length > 0) {
      for (const failure of failures) console.error(`FAIL ${failure}`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Lesson 15 inherited evals failed.");
    process.exitCode = 1;
  }
}
