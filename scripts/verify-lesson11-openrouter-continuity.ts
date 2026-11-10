import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findModelFallbackViolations } from "./verify-no-model-fallback.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const lesson = "lesson-11-evals-observability-openrouter";
const sourcePrefix = "lesson-10-langgraph-openrouter/solution/";
const lessonDelta = new Set([
  "evals/observability-cases.ts",
  "evals/run-observability.ts",
  "scripts/run-live-demo.ts",
  "scripts/verify-openrouter-catalog.ts",
  "src/agent-adapter.ts",
  "src/eval-settings.ts",
  "src/evaluator.ts",
  "src/graders.ts",
  "src/judge.ts",
  "src/model-contract.ts",
  "src/model-observation.ts",
  "src/observed-openrouter-client.ts",
  "src/offline-fixtures.ts",
  "src/pricing.ts",
  "src/report.ts",
  "tests/agent-adapter.test.ts",
  "tests/catalog.test.ts",
  "tests/dataset.test.ts",
  "tests/demo.test.ts",
  "tests/eval-settings.test.ts",
  "tests/evaluator.test.ts",
  "tests/graders.test.ts",
  "tests/judge.test.ts",
  "tests/observed-client.test.ts",
  "tests/observed-draft-generator.test.ts",
  "tests/pricing.test.ts",
]);
const generatedDirectories = new Set(["node_modules", "dist", "coverage"]);

export async function inspectLesson11OpenRouterContinuity(
  candidateRoot = `${lesson}/solution`,
): Promise<string[]> {
  const failures: string[] = [];
  const resolvedCandidate = resolve(repositoryRoot, candidateRoot);
  if (!isWithin(repositoryRoot, resolvedCandidate)) {
    return ["Lesson 11 continuity candidate must stay inside this repository."];
  }
  const repositoryRealPath = await realpath(repositoryRoot);
  const candidateRealPath = await realpath(resolvedCandidate).catch((error: unknown) => {
    if (isMissing(error)) return undefined;
    throw error;
  });
  if (candidateRealPath === undefined) return ["Lesson 11 continuity candidate does not exist."];
  if (!isWithin(repositoryRealPath, candidateRealPath)) {
    return ["Lesson 11 continuity candidate resolves outside this repository."];
  }

  const sourceFiles = trackedFoundationFiles();
  if (sourceFiles.length !== 131) {
    return [
      `Git-tracked Lesson 10 foundation must contain 131 files; found ${sourceFiles.length}.`,
    ];
  }
  const candidateFiles = await listFiles(resolvedCandidate);
  const actualFiles = new Set(candidateFiles);
  if (!actualFiles.has("README.md"))
    failures.push("Lesson 11 candidate root README.md is required.");
  for (const path of candidateFiles) {
    if (
      /^\.env(?:\.|$)/iu.test(path) ||
      path.split("/").some((part) => /^\.env(?:\.|$)/iu.test(part))
    ) {
      failures.push(`credential configuration is not accepted: ${path}`);
    }
  }
  for (const path of sourceFiles) {
    if (!actualFiles.has(path)) {
      failures.push(`missing inherited Lesson 10 foundation file: ${path}`);
      continue;
    }
    const [source, target] = await Promise.all([
      readFile(resolve(repositoryRoot, `${sourcePrefix}${path}`)),
      readFile(resolve(resolvedCandidate, path)),
    ]);
    if (!source.equals(target)) failures.push(`source-bound Lesson 10 foundation drift: ${path}`);
  }

  const additions = candidateFiles.filter(
    (path) => !sourceFiles.includes(path) && path !== "README.md" && path !== ".course-state.json",
  );
  const isPreTransition = additions.length === 0;
  const isCompleted =
    additions.length === lessonDelta.size && additions.every((path) => lessonDelta.has(path));
  if (!isPreTransition && !isCompleted) {
    failures.push(
      `Lesson 11 candidate delta must be empty (starter) or complete (${lessonDelta.size}); found ${additions.length} file(s).`,
    );
    for (const path of lessonDelta) {
      if (!actualFiles.has(path)) failures.push(`missing required Lesson 11 file: ${path}`);
    }
    for (const path of additions) {
      if (!lessonDelta.has(path)) {
        failures.push(`unaccounted Lesson 11 candidate file: ${path}`);
      }
    }
  }

  for (const violation of findModelFallbackViolations(resolvedCandidate)) {
    failures.push(
      `${violation.file}:${violation.line} violates the one-model contract (${violation.rule}).`,
    );
  }

  if (failures.length === 0) {
    return [
      `PASS Lesson 11 OpenRouter continuity: 131 byte-identical Lesson 10 foundation files, ` +
        `${isCompleted ? "completed candidate accepted" : "zero-delta starter accepted"}, ` +
        "one-model policy retained.",
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
    throw new Error(`Lesson path must not be a symlink: ${portable(relative(base, root))}.`);
  if (metadata.isFile()) return [portable(relative(base, root))];
  if (!metadata.isDirectory()) return [];
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() && generatedDirectories.has(entry.name)) continue;
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path, base)));
    else if (entry.isFile() && !isRuntimeData(path)) files.push(portable(relative(base, path)));
    else if (entry.isSymbolicLink())
      throw new Error(`Lesson path must not be a symlink: ${portable(relative(base, path))}.`);
  }
  return files.sort();
}

function portable(path: string): string {
  return path.replaceAll("\\", "/");
}

function isWithin(parent: string, child: string): boolean {
  const path = relative(resolve(parent), resolve(child));
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isRuntimeData(path: string): boolean {
  return /(?:^|[\\/])data[\\/](?:user-memory|conversation-history)\.json$/iu.test(path);
}

async function main(): Promise<void> {
  if (process.argv.length > 3)
    throw new Error("Usage: verify-lesson11-openrouter-continuity.ts [candidate-root]");
  const failures = await inspectLesson11OpenRouterContinuity(
    process.argv[2] ?? `${lesson}/solution`,
  );
  if (failures[0]?.startsWith("PASS ")) console.log(failures[0]);
  else {
    console.error("FAIL Lesson 11 OpenRouter continuity:");
    for (const failure of failures) console.error(`- ${failure}`);
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
    console.error(error instanceof Error ? error.message : "Lesson 11 continuity failed.");
    process.exitCode = 1;
  });
}
