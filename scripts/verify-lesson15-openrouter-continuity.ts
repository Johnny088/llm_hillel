import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  inspectLesson15OpenRouterCandidate,
  lesson15OpenRouter,
} from "./lesson15-openrouter-contract.js";

export async function inspectLesson15OpenRouterContinuity(
  candidateInput = `${lesson15OpenRouter}/solution`,
): Promise<string[]> {
  return inspectLesson15OpenRouterCandidate(candidateInput, "structural");
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  const failures = await inspectLesson15OpenRouterContinuity(process.argv[2]);
  if (failures.length > 0) {
    console.error("FAIL Lesson 15 OpenRouter physical continuity:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else
    console.log("PASS Lesson 15 OpenRouter continuity: all 237 Lesson 14 foundation files match.");
}
