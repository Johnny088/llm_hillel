import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  inspectLesson15OpenRouterCandidate,
  lesson15OpenRouter,
  type Lesson15CandidateKind,
} from "./lesson15-openrouter-contract.js";

export async function verifyLesson15OpenRouterScaffolding(
  candidateInput?: string,
  kind?: Lesson15CandidateKind,
): Promise<string[]> {
  if (candidateInput !== undefined)
    return inspectLesson15OpenRouterCandidate(
      candidateInput,
      kind ?? (candidateInput.endsWith("/starter") ? "starter" : "solution"),
    );
  return [
    ...(await inspectLesson15OpenRouterCandidate(`${lesson15OpenRouter}/starter`, "starter")),
    ...(await inspectLesson15OpenRouterCandidate(`${lesson15OpenRouter}/solution`, "solution")),
  ];
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  const kindArgument = process.argv[3];
  const kind =
    kindArgument === "starter" || kindArgument === "solution" || kindArgument === "structural"
      ? kindArgument
      : undefined;
  const failures = await verifyLesson15OpenRouterScaffolding(process.argv[2], kind);
  if (failures.length > 0) {
    console.error("FAIL Lesson 15 OpenRouter scaffolding:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else
    console.log(
      "PASS Lesson 15 scaffolding: unchanged 237-file foundation; six documents are the only delta.",
    );
}
