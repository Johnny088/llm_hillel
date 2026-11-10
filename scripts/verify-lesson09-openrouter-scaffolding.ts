import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePrefix = "lesson-08-multi-agent-workflow-openrouter/solution/";
const starterRoot = resolve(repositoryRoot, "lesson-09-openai-agents-sdk-openrouter", "starter");
const generatedDirectories = new Set(["node_modules", "dist", "coverage"]);

export async function inspectLesson09OpenRouterScaffolding(
  candidateRoot = starterRoot,
): Promise<string[]> {
  const failures: string[] = [];
  const resolvedCandidate = resolve(repositoryRoot, candidateRoot);
  if (!isWithin(repositoryRoot, resolvedCandidate)) {
    return ["Lesson 09 starter candidate must stay inside this repository."];
  }

  const repositoryRealPath = await realpath(repositoryRoot);
  const candidateRealPath = await realpath(resolvedCandidate).catch((error: unknown) => {
    if (isMissing(error)) return undefined;
    throw error;
  });
  if (candidateRealPath === undefined) return ["Lesson 09 starter candidate does not exist."];
  if (!isWithin(repositoryRealPath, candidateRealPath)) {
    return ["Lesson 09 starter candidate resolves outside this repository."];
  }

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

  const starterFiles = await listFiles(resolvedCandidate);
  for (const path of starterFiles) {
    if (path.split("/").some((part) => /^\.env(?:\.|$)/iu.test(part))) {
      failures.push(`credential configuration is not accepted: ${path}`);
    }
  }
  const actualFiles = new Set(starterFiles);
  for (const path of sourceFiles) {
    if (!actualFiles.has(path)) {
      failures.push(`missing byte-identical Lesson 08 foundation file: ${path}`);
      continue;
    }
    const source = await readFile(resolve(repositoryRoot, `${sourcePrefix}${path}`));
    const target = await readFile(resolve(resolvedCandidate, path));
    if (!source.equals(target)) failures.push(`${path} differs from Lesson 08 solution.`);
  }

  for (const path of starterFiles) {
    if (path !== "README.md" && !sourceFiles.includes(path)) {
      failures.push(`unaccounted Lesson 09 starter file: ${path}`);
    }
  }

  if (failures.length === 0) {
    return [
      `PASS Lesson 09 OpenRouter starter: ${sourceFiles.length} byte-identical Lesson 08 solution files, ` +
        `candidate=${relative(repositoryRoot, resolvedCandidate).replaceAll("\\", "/")}, ` +
        "one root README.md exception, no Lesson 09 implementation delta.",
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
    throw new Error(`Starter path must not be a symlink: ${relative(base, root)}.`);
  if (metadata.isFile()) return [relative(base, root).replaceAll("\\", "/")];
  if (!metadata.isDirectory()) return [];

  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() && generatedDirectories.has(entry.name)) continue;
    if (entry.name.startsWith(".")) {
      if (/^\.env(?:\.|$)/iu.test(entry.name)) {
        files.push(relative(base, resolve(root, entry.name)).replaceAll("\\", "/"));
      }
      continue;
    }
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path, base)));
    else if (entry.isFile()) files.push(relative(base, path).replaceAll("\\", "/"));
    else if (entry.isSymbolicLink()) {
      throw new Error(`Starter path must not be a symlink: ${relative(base, path)}.`);
    }
  }
  return files.sort();
}

function isWithin(parent: string, child: string): boolean {
  const path = relative(resolve(parent), resolve(child));
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`));
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

async function main(): Promise<void> {
  if (process.argv.length > 3) {
    throw new Error("Usage: verify-lesson09-openrouter-scaffolding.ts [candidate-starter-root]");
  }
  const candidate = process.argv[2];
  const results = await inspectLesson09OpenRouterScaffolding(
    candidate === undefined ? starterRoot : resolve(repositoryRoot, candidate),
  );
  if (results[0]?.startsWith("PASS ")) console.log(results[0]);
  else {
    console.error("FAIL Lesson 09 OpenRouter canonical starter:");
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
    console.error(error instanceof Error ? error.message : "Lesson 09 scaffolding failed.");
    process.exitCode = 1;
  });
}
