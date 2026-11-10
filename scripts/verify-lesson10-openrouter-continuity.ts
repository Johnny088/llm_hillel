import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findModelFallbackViolations } from "./verify-no-model-fallback.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const previousLesson = "lesson-09-openai-agents-sdk-openrouter";
const targetRoot = "lesson-10-langgraph-openrouter";
const sourcePrefix = `${previousLesson}/solution/`;
const generatedDirectories = new Set(["node_modules", "dist", "coverage"]);
const integrationFiles = new Set(["src/app.ts", "src/runtime.ts", "src/server.ts"]);
const lesson10Files = [
  "src/services/content-review-graph.ts",
  "src/services/openrouter-draft-generator.ts",
  "src/services/high-level-agent-example.ts",
  "src/testing/scripted-draft-generator.ts",
  "src/demo-content-review.ts",
  "tests/content-review-graph.test.ts",
  "tests/openrouter-draft-generator.test.ts",
  "tests/content-review-app.test.ts",
  "tests/content-review-evals.test.ts",
  "tests/content-review-live-eval.test.ts",
  "tests/openrouter-content-review-model.test.ts",
  "evals/content-review-dataset.ts",
  "evals/evaluate-content-review.ts",
  "evals/run-content-review.ts",
  "evals/live-content-review.ts",
  "evals/live-content-review-application.ts",
  "scripts/smoke-content-review-graph.ts",
  "scripts/run-content-review-live-demo.ts",
  "scripts/verify-content-review-catalog.ts",
] as const;
const allowedCanonicalImports = new Map<string, ReadonlySet<string>>([
  ["src/app.ts", new Set([previousLesson])],
  ["src/runtime.ts", new Set([previousLesson])],
  ["src/server.ts", new Set([previousLesson, "lesson-03-function-calling-openrouter"])],
  ["scripts/smoke-content-review-graph.ts", new Set(["lesson-03-function-calling-openrouter"])],
]);

export async function inspectLesson10OpenRouterContinuity(
  candidateStarterRoot = `${targetRoot}/starter`,
): Promise<string[]> {
  const failures: string[] = [];
  const resolvedStarter = resolve(repositoryRoot, candidateStarterRoot);
  if (!isWithin(repositoryRoot, resolvedStarter)) {
    return ["Lesson 10 continuity candidate must stay inside this repository."];
  }
  const repositoryRealPath = await realpath(repositoryRoot);
  const starterRealPath = await realpath(resolvedStarter).catch((error: unknown) => {
    if (isMissing(error)) return undefined;
    throw error;
  });
  if (starterRealPath === undefined) return ["Lesson 10 continuity candidate does not exist."];
  if (!isWithin(repositoryRealPath, starterRealPath)) {
    return ["Lesson 10 continuity candidate resolves outside this repository."];
  }
  const starterRoot = relative(repositoryRoot, resolvedStarter).replaceAll("\\", "/");
  const sourceFiles = trackedFoundationFiles();
  if (sourceFiles.length !== 112)
    return [
      `Git-tracked Lesson 09 foundation must contain 112 files; found ${sourceFiles.length}.`,
    ];

  const solutionRoot = `${targetRoot}/solution`;
  const solutionFiles = await listFiles(solutionRoot);
  const expectedSolutionFiles = new Set(["README.md", ...sourceFiles, ...lesson10Files]);
  for (const path of sourceFiles) {
    if (integrationFiles.has(path)) continue;
    if (!solutionFiles.includes(path)) {
      failures.push(`solution is missing inherited Lesson 09 foundation file: ${path}`);
      continue;
    }
    const [source, target] = await Promise.all([
      readFile(`${sourcePrefix}${path}`),
      readFile(`${solutionRoot}/${path}`),
    ]);
    if (!source.equals(target)) failures.push(`${path} differs from Lesson 09 foundation.`);
  }
  for (const path of lesson10Files) {
    if (!solutionFiles.includes(path))
      failures.push(`solution is missing Lesson 10 graph file: ${path}`);
  }
  for (const path of solutionFiles) {
    if (!expectedSolutionFiles.has(path))
      failures.push(`unaccounted Lesson 10 solution file: ${path}`);
  }

  const starterFiles = await listFiles(starterRoot);
  const starterHasGraphDelta = lesson10Files.some((path) => starterFiles.includes(path));
  const expectedStarterFiles = new Set([
    "README.md",
    ...sourceFiles,
    ...(starterHasGraphDelta ? lesson10Files : []),
  ]);
  for (const path of sourceFiles) {
    if (!starterFiles.includes(path))
      failures.push(`starter is missing inherited Lesson 09 file: ${path}`);
    if (starterHasGraphDelta && integrationFiles.has(path)) continue;
    const [source, target] = await Promise.all([
      readFile(`${sourcePrefix}${path}`),
      readFile(resolve(resolvedStarter, path)).catch(() => undefined),
    ]);
    if (target !== undefined && !source.equals(target))
      failures.push(`starter ${path} differs from Lesson 09 foundation.`);
  }
  if (starterHasGraphDelta) {
    for (const path of lesson10Files) {
      if (!starterFiles.includes(path))
        failures.push(`completed starter is missing Lesson 10 graph file: ${path}`);
    }
  }
  for (const path of starterFiles) {
    if (!expectedStarterFiles.has(path))
      failures.push(`unaccounted Lesson 10 starter file: ${path}`);
  }

  for (const { files, root } of [
    { files: starterFiles, root: resolvedStarter },
    { files: solutionFiles, root: resolve(repositoryRoot, targetRoot, "solution") },
  ]) {
    for (const path of files.filter((item) => /\.(?:[cm]?[jt]sx?)$/iu.test(item))) {
      const source = await readFile(resolve(root, path), "utf8");
      const canonicalImports = [
        ...source.matchAll(
          /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["'][^"']*?(lesson-\d{2}-[a-z0-9-]+)\/\s*(?:starter|solution)\//giu,
        ),
      ].map((match) => match[1]!);
      for (const importedLesson of canonicalImports) {
        if (!allowedCanonicalImports.get(path)?.has(importedLesson)) {
          failures.push(`${path}: unapproved canonical lesson import ${importedLesson}.`);
        }
      }
      if (/(?:^|["'`/])(?:my-dev|dev)\/lesson-/iu.test(source)) {
        failures.push(`${path}: imports a real development workspace path.`);
      }
      if (root === resolvedStarter && /lesson-10-langgraph-openrouter\/solution/u.test(source)) {
        failures.push(`${path}: candidate starter imports current Lesson 10 solution.`);
      }
    }
  }

  for (const violation of [
    ...findModelFallbackViolations(`${targetRoot}/solution`),
    ...findModelFallbackViolations(resolvedStarter),
  ]) {
    failures.push(
      `${targetRoot}/${violation.file}:${violation.line} violates the one-model contract (${violation.rule}).`,
    );
  }

  if (failures.length === 0) {
    return [
      `PASS Lesson 10 OpenRouter continuity: ${sourceFiles.length} Lesson 09 foundation files preserved, ` +
        `${integrationFiles.size} solution integration files extended, ${lesson10Files.length} graph files present, ` +
        `${starterHasGraphDelta ? "candidate completion accepted" : "candidate is the unchanged starter foundation"}, ` +
        "one-model configuration retained.",
    ];
  }
  return failures;
}

function trackedFoundationFiles(): string[] {
  return execFileSync("git", ["ls-files", "--", sourcePrefix.slice(0, -1)], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split(/\r?\n/u)
    .filter((path) => path.startsWith(sourcePrefix))
    .map((path) => path.slice(sourcePrefix.length))
    .filter((path) => path !== "README.md")
    .sort();
}

async function listFiles(root: string, base = root): Promise<string[]> {
  const metadata = await lstat(root).catch((error: unknown) => {
    if (isMissing(error)) return undefined;
    throw error;
  });
  if (metadata === undefined) return [];
  if (metadata.isSymbolicLink())
    throw new Error(`Lesson path must not be a symlink: ${relative(base, root)}.`);
  if (metadata.isFile()) return [relative(base, root).replaceAll("\\", "/")];
  if (!metadata.isDirectory()) return [];

  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() && generatedDirectories.has(entry.name)) continue;
    const path = `${root}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await listFiles(path, base)));
    else if (entry.isFile()) files.push(relative(base, path).replaceAll("\\", "/"));
    else if (entry.isSymbolicLink())
      throw new Error(`Lesson path must not be a symlink: ${relative(base, path)}.`);
  }
  return files.sort();
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isWithin(parent: string, child: string): boolean {
  const path = relative(resolve(parent), resolve(child));
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

async function main(): Promise<void> {
  const results = await inspectLesson10OpenRouterContinuity();
  if (results[0]?.startsWith("PASS ")) console.log(results[0]);
  else {
    console.error("FAIL Lesson 10 OpenRouter continuity:");
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
    console.error(error instanceof Error ? error.message : "Lesson 10 continuity failed.");
    process.exitCode = 1;
  });
}
