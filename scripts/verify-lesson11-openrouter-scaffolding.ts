import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const targetRoot = "lesson-11-evals-observability-openrouter";
const sourcePrefix = "lesson-10-langgraph-openrouter/solution/";
const starterRoot = resolve(repositoryRoot, targetRoot, "starter");
const generatedDirectories = new Set(["node_modules", "dist", "coverage"]);

export async function inspectLesson11OpenRouterScaffolding(
  candidateRoot = starterRoot,
): Promise<string[]> {
  const failures: string[] = [];
  const resolvedCandidate = resolve(repositoryRoot, candidateRoot);
  if (!isWithin(repositoryRoot, resolvedCandidate)) {
    return ["Lesson 11 starter candidate must stay inside this repository."];
  }

  const repositoryRealPath = await realpath(repositoryRoot);
  const candidateRealPath = await realpath(resolvedCandidate).catch((error: unknown) => {
    if (isMissing(error)) return undefined;
    throw error;
  });
  if (candidateRealPath === undefined) return ["Lesson 11 starter candidate does not exist."];
  if (!isWithin(repositoryRealPath, candidateRealPath)) {
    return ["Lesson 11 starter candidate resolves outside this repository."];
  }

  const sourceFiles = trackedFoundationFiles();
  if (sourceFiles.length !== 131) {
    return [
      `Git-tracked Lesson 10 foundation must contain 131 files; found ${sourceFiles.length}.`,
    ];
  }

  const candidateFiles = await listFiles(resolvedCandidate);
  const actualFiles = new Set(candidateFiles);
  if (!actualFiles.has("README.md")) failures.push("Lesson 11 starter root README.md is required.");
  for (const path of candidateFiles) {
    if (path.split("/").some((part) => /^\.env(?:\.|$)/iu.test(part))) {
      failures.push(`credential configuration is not accepted: ${path}`);
    }
  }
  for (const path of sourceFiles) {
    if (!actualFiles.has(path)) {
      failures.push(`missing byte-identical Lesson 10 foundation file: ${path}`);
      continue;
    }
    const [source, target] = await Promise.all([
      readFile(resolve(repositoryRoot, `${sourcePrefix}${path}`)),
      readFile(resolve(resolvedCandidate, path)),
    ]);
    if (!source.equals(target)) failures.push(`${path} differs from Lesson 10 solution.`);
  }

  const extras = candidateFiles.filter(
    (path) => !sourceFiles.includes(path) && path !== "README.md" && path !== ".course-state.json",
  );
  for (const path of extras) {
    failures.push(
      `unaccounted Lesson 11 starter file; starter must retain only the 131-file foundation: ${path}`,
    );
  }

  if (failures.length === 0) {
    return [
      `PASS Lesson 11 OpenRouter scaffolding: 131 byte-identical Lesson 10 foundation files, ` +
        `candidate=${relative(repositoryRoot, resolvedCandidate).replaceAll("\\", "/")}, ` +
        "zero Lesson 11 implementation files in the starter.",
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
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`));
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isRuntimeData(path: string): boolean {
  return /(?:^|[\\/])data[\\/](?:user-memory|conversation-history)\.json$/iu.test(path);
}

async function main(): Promise<void> {
  if (process.argv.length > 3)
    throw new Error("Usage: verify-lesson11-openrouter-scaffolding.ts [candidate-root]");
  const candidate =
    process.argv[2] === undefined ? starterRoot : resolve(repositoryRoot, process.argv[2]);
  const failures = await inspectLesson11OpenRouterScaffolding(candidate);
  if (failures[0]?.startsWith("PASS ")) console.log(failures[0]);
  else {
    console.error("FAIL Lesson 11 OpenRouter canonical scaffolding:");
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
    console.error(error instanceof Error ? error.message : "Lesson 11 scaffolding failed.");
    process.exitCode = 1;
  });
}
