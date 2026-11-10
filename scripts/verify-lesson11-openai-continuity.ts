import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import * as ts from "typescript";

const targetRoot = "lesson-11-evals-observability";
const failures: string[] = [];
const requiredMarkers = new Map<string, readonly string[]>([
  [
    `${targetRoot}/solution/src/agent-adapter.ts`,
    [
      "lesson-10-langgraph/solution/src/services/content-review-graph.js",
      "ContentReviewService",
      "service.start(",
      "service.resume(",
    ],
  ],
  [
    `${targetRoot}/solution/src/judge.ts`,
    ["zodTextFormat", "qualityJudgeResultSchema.safeParse", "responses.parse", "store: false"],
  ],
  [
    `${targetRoot}/solution/src/evaluator.ts`,
    [
      "gradeContentReviewCase",
      '"passed"',
      '"failed"',
      '"errored"',
      "summarizeModelObservations",
      "calculateObservationCost",
    ],
  ],
  [
    `${targetRoot}/solution/src/model-observation.ts`,
    ["isCompleteResponseUsage", "cached_tokens", "cache_write_tokens", "serviceTier"],
  ],
  [
    `${targetRoot}/solution/src/pricing.ts`,
    ["STANDARD_MODEL_PRICES", "PRICING_SNAPSHOT_DATE", "calculateObservationCost"],
  ],
  [
    `${targetRoot}/solution/evals/run.ts`,
    [
      "lesson-03-function-calling/solution/src/config/env.js",
      "lesson-10-langgraph/solution/src/services/openai-draft-generator.js",
      "--offline",
      "--live",
      "assertStandardPricingAvailable",
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
  if (/lesson-11-evals-observability-openrouter/u.test(source)) {
    failures.push(`${path}: знайдено runtime-залежність від OpenRouter Lesson 11.`);
  }
  if (/lesson-10-langgraph-openrouter/u.test(source)) {
    failures.push(`${path}: знайдено runtime-залежність від OpenRouter Lesson 10.`);
  }
  if (/openrouter/i.test(source)) {
    failures.push(`${path}: знайдено OpenRouter namespace в OpenAI Lesson 11.`);
  }
  if (path.includes("/solution/") && hasDisabledOrFocusedTestDeclaration(source, path)) {
    failures.push(`${path}: solution містить todo/skip/only test declaration.`);
  }
}

if (failures.length > 0) {
  console.error("FAIL Lesson 11 OpenAI continuity:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `PASS Lesson 11 OpenAI continuity: imported=Lesson 10 OpenAI solution, adapted=evals and observability, checked=${targetTypeScriptFiles.length} TypeScript files`,
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

function hasDisabledOrFocusedTestDeclaration(source: string, path: string): boolean {
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  let found = false;

  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const owner = node.expression.expression;
      const modifier = node.expression.name.text;
      if (
        ts.isIdentifier(owner) &&
        ["describe", "it", "test"].includes(owner.text) &&
        ["todo", "skip", "only"].includes(modifier)
      ) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
}
