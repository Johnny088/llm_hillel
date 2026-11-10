import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const targetRoot = "lesson-12-security";
const failures: string[] = [];
const requiredMarkers = new Map<string, readonly string[]>([
  [
    `${targetRoot}/solution/src/secure-content-review-agent.ts`,
    [
      "lesson-10-langgraph/solution/src/services/content-review-graph.js",
      "ContentReviewService",
      "this.reviews.start(",
      "this.reviews.resume(",
    ],
  ],
  [
    `${targetRoot}/solution/evals/runner.ts`,
    [
      "lesson-11-evals-observability/solution/src/agent-adapter.js",
      "lesson12EvalDataset",
      "runEvaluation(",
      "runSecurityEvaluation(",
    ],
  ],
]);

for (const [path, markers] of requiredMarkers) {
  const source = await readFile(path, "utf8");
  for (const marker of markers) {
    if (!source.includes(marker)) {
      failures.push(`${path}: відсутній continuity marker ${JSON.stringify(marker)}.`);
    }
  }
}

for (const path of await listTypeScriptFiles(targetRoot)) {
  const source = await readFile(path, "utf8");
  if (
    path.includes("/solution/") &&
    /\b(?:describe|it|test)\.(?:todo|skip|only|skipIf|runIf)\s*\(/u.test(source)
  ) {
    failures.push(`${path}: solution містить todo/skip/only test declaration.`);
  }
}

if (failures.length > 0) {
  console.error("FAIL Lesson 12 OpenAI continuity:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `PASS Lesson 12 OpenAI continuity: inherited=Lesson 11 and Lesson 10 OpenAI, ` +
      `checked=${(await listTypeScriptFiles(targetRoot)).length} TypeScript files`,
  );
}

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await listTypeScriptFiles(path)));
    else if (entry.isFile() && entry.name.endsWith(".ts")) {
      result.push(relative(".", path).replaceAll("\\", "/"));
    }
  }
  return result.sort();
}
