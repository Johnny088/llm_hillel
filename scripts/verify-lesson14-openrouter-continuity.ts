import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectLesson14OpenRouterCandidate } from "./lesson14-openrouter-contract.js";

export async function inspectLesson14OpenRouterContinuity(
  candidateInput = "lesson-14-react-sse-openrouter/solution",
): Promise<string[]> {
  // The flat Lesson 14 candidate is the source of truth for all imports. This
  // checks source-bound inheritance and exact delta membership without relying
  // on imports from the older lesson directory layout.
  return inspectLesson14OpenRouterCandidate(candidateInput, "solution");
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  const candidate = process.argv[2];
  const failures = await inspectLesson14OpenRouterContinuity(candidate);
  if (failures.length > 0) {
    console.error(`FAIL Lesson 14 OpenRouter continuity (${candidate ?? "canonical solution"}):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS Lesson 14 OpenRouter continuity (${candidate ?? "canonical solution"}).`);
  }
}
