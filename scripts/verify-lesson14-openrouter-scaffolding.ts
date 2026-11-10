import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  inspectLesson14OpenRouterCandidate,
  lesson14OpenRouter,
  type Lesson14CandidateKind,
} from "./lesson14-openrouter-contract.js";

export async function verifyLesson14OpenRouterScaffolding(
  candidateInput?: string,
  kind?: Lesson14CandidateKind,
): Promise<string[]> {
  if (candidateInput !== undefined) {
    const resolvedKind = kind ?? (candidateInput.endsWith("/starter") ? "starter" : "solution");
    return inspectLesson14OpenRouterCandidate(candidateInput, resolvedKind);
  }

  return [
    ...(await inspectLesson14OpenRouterCandidate(`${lesson14OpenRouter}/starter`, "starter")),
    ...(await inspectLesson14OpenRouterCandidate(`${lesson14OpenRouter}/solution`, "solution")),
  ];
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  const candidate = process.argv[2];
  const kindArgument = process.argv[3];
  const kind = kindArgument === "starter" || kindArgument === "solution" ? kindArgument : undefined;
  const failures = await verifyLesson14OpenRouterScaffolding(candidate, kind);
  if (failures.length > 0) {
    console.error(`FAIL Lesson 14 OpenRouter scaffolding (${candidate ?? "canonical variants"}):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS Lesson 14 OpenRouter scaffolding (${candidate ?? "starter + solution"}).`);
  }
}
