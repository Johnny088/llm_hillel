import { pathToFileURL } from "node:url";
import { verifyLesson13OpenRouterCompletion } from "./lesson13-openrouter-contract.js";

async function main(): Promise<void> {
  if (process.argv.length > 3)
    throw new Error("Usage: verify-lesson13-openrouter-completion.ts [candidate-root]");
  await verifyLesson13OpenRouterCompletion(
    process.argv[2] ?? "lesson-13-databases-openrouter/solution",
  );
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
    console.error(error instanceof Error ? error.message : "Lesson 13 completion failed.");
    process.exitCode = 1;
  });

export { verifyLesson13OpenRouterCompletion };
