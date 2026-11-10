import { pathToFileURL } from "node:url";
import { inspectLesson13OpenRouterScaffolding } from "./lesson13-openrouter-contract.js";

async function main(): Promise<void> {
  if (process.argv.length > 3)
    throw new Error("Usage: verify-lesson13-openrouter-scaffolding.ts [candidate-root]");
  const candidateRoot = process.argv[2] ?? "lesson-13-databases-openrouter/starter";
  const failures = await inspectLesson13OpenRouterScaffolding(candidateRoot);
  if (failures.length > 0) {
    console.error("FAIL Lesson 13 OpenRouter scaffolding:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(
      `PASS Lesson 13 OpenRouter scaffolding: 170 byte-identical inherited files and zero database delta in ${candidateRoot}.`,
    );
  }
}

function isDirectExecution(): boolean {
  const entrypoint = process.argv[1];
  if (entrypoint === undefined) return false;
  const expected = pathToFileURL(entrypoint).href;
  const actual = new URL(import.meta.url);
  actual.search = "";
  actual.hash = "";
  return process.platform === "win32"
    ? actual.href.toLocaleLowerCase("en-US") === expected.toLocaleLowerCase("en-US")
    : actual.href === expected;
}

if (isDirectExecution())
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Lesson 13 scaffolding failed.");
    process.exitCode = 1;
  });
