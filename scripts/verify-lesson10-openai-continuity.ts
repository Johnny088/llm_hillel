import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const targetRoot = "lesson-10-langgraph";
const failures: string[] = [];

const requiredMarkers = new Map<string, readonly string[]>([
  [
    `${targetRoot}/solution/src/app.ts`,
    [
      "createLesson09App",
      "ContentReviewWorkflow",
      "ContentReviewRun",
      '"/api/workflows/content-review"',
      '"/api/workflows/content-review/:threadId/decision"',
      "../../../lesson-09-openai-agents-sdk/solution/src/app.js",
    ],
  ],
  [
    `${targetRoot}/solution/src/server.ts`,
    [
      "createLesson09Runtime",
      "../../../lesson-09-openai-agents-sdk/solution/src/runtime.js",
      "OpenAIDraftGenerator",
      "resolveModel",
      "...runtime.dependencies",
    ],
  ],
  [
    `${targetRoot}/solution/src/services/content-review-graph.ts`,
    [
      "StateSchema",
      'addNode("generator"',
      'addNode("reviewer"',
      'addNode("humanApproval"',
      "MemorySaver",
      "interrupt<ContentReviewInterrupt",
      "new Command",
      "DEFAULT_RECURSION_LIMIT",
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

const targetTypeScriptFiles = await listTypeScriptFiles(targetRoot);
for (const path of targetTypeScriptFiles) {
  const source = await readFile(path, "utf8");

  if (/lesson-10-langgraph-openrouter/u.test(source)) {
    failures.push(`${path}: знайдено залежність від OpenRouter Lesson 10.`);
  }

  if (/openrouter/i.test(source)) {
    failures.push(`${path}: знайдено OpenRouter namespace в OpenAI Lesson 10 continuity.`);
  }
}

if (failures.length > 0) {
  console.error("FAIL Lesson 10 OpenAI continuity:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `PASS Lesson 10 OpenAI continuity: inherited=Lesson 09 OpenAI solution, ` +
      `adapted=LangGraph StateGraph, checked=${targetTypeScriptFiles.length} TypeScript files`,
  );
}

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const result: string[] = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await listTypeScriptFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      result.push(relative(".", path).replaceAll("\\", "/"));
    }
  }

  return result.sort();
}
