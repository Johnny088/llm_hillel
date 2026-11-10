import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findModelFallbackViolations } from "./verify-no-model-fallback.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const lesson = "lesson-08-multi-agent-workflow-openrouter";
const sourcePrefix = "lesson-07-agent-loop-openrouter/solution/";
const integrationFiles = new Set(["src/app.ts", "src/runtime.ts", "src/server.ts"]);
const requiredFiles = [
  "src/services/report-workflow.ts",
  "src/services/openrouter-report-workers.ts",
  "src/demo-report-workflow.ts",
  "evals/report-workflow-cases.ts",
  "evals/evaluate-report-workflow.ts",
  "evals/run-report-workflow.ts",
  "scripts/smoke-report-workflow-api.ts",
  "tests/report-workflow.test.ts",
  "tests/openrouter-report-workers.test.ts",
  "tests/report-workflow-app.test.ts",
  "tests/report-workflow-evals.test.ts",
] as const;

export async function inspectLesson08OpenRouterContinuity(): Promise<string[]> {
  const failures: string[] = [];
  const root = resolve(repositoryRoot, lesson, "solution");
  const inheritedFiles = execFileSync("git", ["ls-files", "--", sourcePrefix.slice(0, -1)], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split(/\r?\n/u)
    .filter((path) => path.startsWith(sourcePrefix))
    .map((path) => path.slice(sourcePrefix.length))
    .filter((path) => path !== "README.md");
  if (inheritedFiles.length === 0) return ["Git-tracked Lesson 07 solution manifest is empty."];

  const solutionFiles = await listFiles(root);
  const solutionSet = new Set(solutionFiles);
  for (const path of inheritedFiles) {
    if (integrationFiles.has(path)) continue;
    if (!solutionSet.has(path)) {
      failures.push(`missing inherited Lesson 07 solution file: ${path}`);
      continue;
    }
    const source = await readFile(resolve(repositoryRoot, `${sourcePrefix}${path}`));
    const target = await readFile(resolve(root, path));
    if (!source.equals(target))
      failures.push(`${path} differs from Lesson 07 solution foundation.`);
  }
  for (const path of requiredFiles) {
    if (!solutionSet.has(path)) failures.push(`missing Lesson 08 workflow implementation: ${path}`);
  }

  const runtime = await readFile(resolve(root, "src/runtime.ts"), "utf8");
  const app = await readFile(resolve(root, "src/app.ts"), "utf8");
  const server = await readFile(resolve(root, "src/server.ts"), "utf8");
  if (!runtime.includes("createLesson08OpenRouterRuntime")) {
    failures.push("solution runtime does not export createLesson08OpenRouterRuntime.");
  }
  if (!runtime.includes("lesson07Runtime.agentModelConfiguration.model")) {
    failures.push("all new workers must use the inherited OPENROUTER_MODEL configuration.");
  }
  for (const role of [
    "OpenRouterResearchWorker",
    "OpenRouterWriterWorker",
    "OpenRouterReviewerWorker",
  ]) {
    if (!runtime.includes(`new ${role}(lesson07Runtime.openai, workerOptions)`)) {
      failures.push(`runtime does not configure ${role} from the single inherited model.`);
    }
  }
  if (!app.includes('"/api/workflow/report"'))
    failures.push("solution app is missing the report route.");
  if (!server.includes("createLesson08OpenRouterRuntime")) {
    failures.push("solution server does not start the Lesson 08 runtime.");
  }

  for (const violation of findModelFallbackViolations(root)) {
    failures.push(
      `${violation.file}:${violation.line} violates the single-model contract (${violation.rule}).`,
    );
  }

  const sourceFiles = solutionFiles.filter((path) => /\.(?:[cm]?[jt]sx?)$/iu.test(path));
  for (const path of sourceFiles) {
    const source = await readFile(resolve(root, path), "utf8");
    if (
      /\b(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)["'][^"']*lesson-\d{2}[^"']*\/(?:starter|solution)\//iu.test(
        source,
      )
    ) {
      failures.push(`${path} imports a canonical lesson starter or solution.`);
    }
  }

  if (failures.length === 0) {
    return [
      `PASS Lesson 08 OpenRouter continuity: ${inheritedFiles.length} tracked foundation files ` +
        `preserved, ${integrationFiles.size} integration files extended, ${requiredFiles.length} workflow files present.`,
    ];
  }
  return failures;
}

async function listFiles(root: string, base = root): Promise<string[]> {
  const metadata = await lstat(root).catch((error: unknown) => {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  });
  if (metadata === undefined) return [];
  if (metadata.isSymbolicLink()) {
    throw new Error(`Solution path must not be a symlink: ${relative(base, root)}.`);
  }
  if (metadata.isFile()) return [relative(base, root).replaceAll("\\", "/")];
  if (!metadata.isDirectory()) return [];
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path, base)));
    else if (entry.isFile()) files.push(relative(base, path).replaceAll("\\", "/"));
    else if (entry.isSymbolicLink()) {
      throw new Error(`Solution path must not be a symlink: ${relative(base, path)}.`);
    }
  }
  return files;
}

async function main(): Promise<void> {
  if (process.argv.length > 2) throw new Error("Usage: verify-lesson08-openrouter-continuity.ts");
  const results = await inspectLesson08OpenRouterContinuity();
  if (results[0]?.startsWith("PASS ")) console.log(results[0]);
  else {
    console.error("FAIL Lesson 08 OpenRouter continuity:");
    for (const failure of results) console.error(`- ${failure}`);
    process.exitCode = 1;
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

if (isDirectExecution()) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Lesson 08 continuity failed.");
    process.exitCode = 1;
  });
}
