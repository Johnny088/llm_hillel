import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findModelFallbackViolations } from "./verify-no-model-fallback.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePrefix = "lesson-08-multi-agent-workflow-openrouter/solution/";
const targetRoot = "lesson-09-openai-agents-sdk-openrouter";
const generatedDirectories = new Set(["node_modules", "dist", "coverage"]);
const integrationFiles = new Set(["src/app.ts", "src/runtime.ts", "src/server.ts"]);
const lesson09Files = [
  "evals/evaluate-agents-sdk.ts",
  "evals/live-agents-sdk-catalog.ts",
  "evals/run-agents-sdk-live.ts",
  "evals/run-agents-sdk.ts",
  "scripts/smoke-agents-sdk.ts",
  "src/demo-agents-sdk.ts",
  "src/services/agents-sdk-report.ts",
  "src/testing/scripted-report-model.ts",
  "tests/agents-sdk-app.test.ts",
  "tests/agents-sdk-evals.test.ts",
  "tests/agents-sdk-report.test.ts",
  "tests/openrouter-model-settings.test.ts",
] as const;

export async function inspectLesson09OpenRouterContinuity(): Promise<string[]> {
  const failures: string[] = [];
  const sourceFiles = execFileSync("git", ["ls-files", "--", sourcePrefix.slice(0, -1)], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split(/\r?\n/u)
    .filter((path) => path.startsWith(sourcePrefix))
    .map((path) => path.slice(sourcePrefix.length))
    .filter((path) => path !== "README.md")
    .sort();
  if (sourceFiles.length === 0) return ["Git-tracked Lesson 08 solution manifest is empty."];

  const solutionRoot = resolve(repositoryRoot, targetRoot, "solution");
  const solutionFiles = await listFiles(solutionRoot);
  const solutionSet = new Set(solutionFiles);
  const expectedSolutionFiles = new Set([...sourceFiles, "README.md", ...lesson09Files]);

  for (const path of sourceFiles) {
    if (integrationFiles.has(path)) continue;
    if (!solutionSet.has(path)) {
      failures.push(`missing inherited Lesson 08 solution file: ${path}`);
      continue;
    }
    if (path === "README.md") continue;
    const source = await readFile(resolve(repositoryRoot, `${sourcePrefix}${path}`));
    const target = await readFile(resolve(solutionRoot, path));
    if (!source.equals(target)) failures.push(`${path} differs from Lesson 08 foundation.`);
  }

  for (const path of lesson09Files) {
    if (!solutionSet.has(path)) failures.push(`missing Lesson 09 SDK file: ${path}`);
  }
  for (const path of solutionFiles) {
    if (path === "README.md") continue;
    if (!expectedSolutionFiles.has(path))
      failures.push(`unaccounted Lesson 09 solution file: ${path}`);
  }

  const starterRoot = resolve(repositoryRoot, targetRoot, "starter");
  const starterFiles = await listFiles(starterRoot);
  for (const path of sourceFiles) {
    if (!starterFiles.includes(path))
      failures.push(`starter is missing inherited Lesson 08 file: ${path}`);
  }
  for (const path of starterFiles) {
    if (path !== "README.md" && !sourceFiles.includes(path)) {
      failures.push(`starter contains a file outside the Lesson 08 foundation: ${path}`);
    }
  }

  const allTypeScriptFiles = [
    ...solutionFiles.map((path) => `${targetRoot}/solution/${path}`),
    ...starterFiles.map((path) => `${targetRoot}/starter/${path}`),
  ].filter((path) => /\.(?:[cm]?[jt]sx?)$/iu.test(path));
  for (const path of allTypeScriptFiles) {
    const source = await readFile(resolve(repositoryRoot, path), "utf8");
    if (/lesson-\d{2}[^"']*\/(?:starter|solution)\//iu.test(source)) {
      failures.push(`${path}: imports another canonical lesson starter or solution.`);
    }
    if (/(?:^|["'`/])(?:my-dev|dev)\/lesson-/iu.test(source)) {
      failures.push(`${path}: imports a real dev workspace path.`);
    }
  }

  for (const violation of [
    ...findModelFallbackViolations(solutionRoot),
    ...findModelFallbackViolations(starterRoot),
  ]) {
    failures.push(
      `${targetRoot}/${violation.file}:${violation.line} violates the single-model contract (${violation.rule}).`,
    );
  }

  if (failures.length === 0) {
    return [
      `PASS Lesson 09 OpenRouter continuity: ${sourceFiles.length} Lesson 08 foundation files ` +
        `preserved, ${integrationFiles.size} integration files extended, ${lesson09Files.length} SDK files present, ` +
        "one inherited model and no model fallback configuration.",
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
  if (metadata.isSymbolicLink())
    throw new Error(`Solution path must not be a symlink: ${relative(base, root)}.`);
  if (metadata.isFile()) return [relative(base, root).replaceAll("\\", "/")];
  if (!metadata.isDirectory()) return [];

  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() && generatedDirectories.has(entry.name)) continue;
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path, base)));
    else if (entry.isFile()) files.push(relative(base, path).replaceAll("\\", "/"));
    else if (entry.isSymbolicLink()) {
      throw new Error(`Solution path must not be a symlink: ${relative(base, path)}.`);
    }
  }
  return files.sort();
}

async function main(): Promise<void> {
  const results = await inspectLesson09OpenRouterContinuity();
  if (results[0]?.startsWith("PASS ")) console.log(results[0]);
  else {
    console.error("FAIL Lesson 09 OpenRouter continuity:");
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
    console.error(error instanceof Error ? error.message : "Lesson 09 continuity failed.");
    process.exitCode = 1;
  });
}
