import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const lesson = "lesson-12-security-openrouter";
const sourcePrefix = "lesson-11-evals-observability-openrouter/solution/";
const starterRoot = resolve(repositoryRoot, lesson, "starter");
const generatedDirectories = new Set(["node_modules", "dist", "coverage"]);
const incomplete =
  /\b(?:TODO|NOT_IMPLEMENTED|STARTER_TODO)\b|(?:\.status\s*\(\s*501\b|\bsendStatus\s*\(\s*501\b|\bstatus(?:Code)?\s*:\s*501\b)/u;

export async function inspectLesson12OpenRouterScaffolding(
  candidateRoot = starterRoot,
): Promise<string[]> {
  const candidate = resolve(repositoryRoot, candidateRoot);
  if (!isWithin(repositoryRoot, candidate))
    return ["Lesson 12 starter candidate must stay inside this repository."];
  const repositoryRealPath = await realpath(repositoryRoot);
  const candidateRealPath = await realpath(candidate).catch((error: unknown) =>
    isMissing(error) ? undefined : Promise.reject(error),
  );
  if (candidateRealPath === undefined) return ["Lesson 12 starter candidate does not exist."];
  if (!isWithin(repositoryRealPath, candidateRealPath))
    return ["Lesson 12 starter candidate resolves outside this repository."];

  const foundation = trackedFoundationFiles();
  if (foundation.length !== 157)
    return [`Git-tracked Lesson 11 foundation must contain 157 files; found ${foundation.length}.`];
  const candidateFiles = await listFiles(candidate);
  const actual = new Set(candidateFiles);
  const failures: string[] = [];
  if (!actual.has("README.md")) failures.push("Lesson 12 starter root README.md is required.");
  for (const path of candidateFiles) {
    if (path.split("/").some((part) => /^\.env(?:\.|$)/iu.test(part)))
      failures.push(`credential configuration is not accepted: ${path}`);
    if (
      /\.(?:[cm]?js|jsx|tsx?)$/iu.test(path) &&
      incomplete.test(await readFile(resolve(candidate, path), "utf8"))
    ) {
      failures.push(`${path} contains an incomplete-work marker.`);
    }
  }
  for (const path of foundation) {
    if (!actual.has(path)) {
      failures.push(`missing byte-identical Lesson 11 foundation file: ${path}`);
      continue;
    }
    const [source, target] = await Promise.all([
      readFile(resolve(repositoryRoot, `${sourcePrefix}${path}`)),
      readFile(resolve(candidate, path)),
    ]);
    if (!source.equals(target)) failures.push(`${path} differs from Lesson 11 solution.`);
  }

  const extras = candidateFiles.filter(
    (path) => !foundation.includes(path) && path !== "README.md" && path !== ".course-state.json",
  );
  for (const path of extras)
    failures.push(
      `unaccounted Lesson 12 starter file; expected only the 157-file foundation and README.md: ${path}`,
    );
  if (failures.length === 0)
    return [
      `PASS Lesson 12 OpenRouter scaffolding: 157 byte-identical Lesson 11 foundation files, candidate=${portable(relative(repositoryRoot, candidate))}, zero Lesson 12 implementation files and incomplete markers in the starter.`,
    ];
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
  const metadata = await lstat(root).catch((error: unknown) =>
    isMissing(error) ? undefined : Promise.reject(error),
  );
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
    throw new Error("Usage: verify-lesson12-openrouter-scaffolding.ts [candidate-root]");
  const failures = await inspectLesson12OpenRouterScaffolding(
    process.argv[2] === undefined ? starterRoot : resolve(repositoryRoot, process.argv[2]),
  );
  if (failures[0]?.startsWith("PASS ")) console.log(failures[0]);
  else {
    console.error("FAIL Lesson 12 OpenRouter canonical scaffolding:");
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
if (isDirectExecution())
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Lesson 12 scaffolding failed.");
    process.exitCode = 1;
  });
