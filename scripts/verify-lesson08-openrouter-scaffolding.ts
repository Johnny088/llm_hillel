import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const lesson = "lesson-08-multi-agent-workflow-openrouter";
const sourcePrefix = "lesson-07-agent-loop-openrouter/solution/";

export async function inspectLesson08OpenRouterScaffolding(
  candidateRoot = resolve(repositoryRoot, lesson, "starter"),
): Promise<string[]> {
  const failures: string[] = [];
  if (!isWithin(repositoryRoot, candidateRoot)) {
    return ["Lesson 08 starter must stay inside this repository."];
  }

  const sourceFiles = execFileSync("git", ["ls-files", "--", sourcePrefix.slice(0, -1)], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split(/\r?\n/u)
    .filter((path) => path.startsWith(sourcePrefix));
  if (sourceFiles.length === 0 || !sourceFiles.includes(`${sourcePrefix}README.md`)) {
    return ["Git-tracked Lesson 07 solution manifest is empty or missing README.md."];
  }

  const entries = await listFiles(candidateRoot, candidateRoot);
  const byRelativePath = new Map(entries.map((entry) => [entry.path, entry]));
  const expected = new Set(sourceFiles.map((path) => path.slice(sourcePrefix.length)));
  expected.delete("README.md");

  for (const entry of entries) {
    if (entry.symlink) failures.push(`starter path must not be a symlink: ${entry.path}`);
    if (entry.path.split("/").some((part) => /^\.env(?:\.|$)/iu.test(part))) {
      failures.push(`credential configuration is not accepted: ${entry.path}`);
    }
    if (entry.path !== "README.md" && !expected.has(entry.path)) {
      failures.push(`unaccounted Lesson 08 starter file: ${entry.path}`);
    }
  }

  for (const path of [...expected].sort()) {
    const entry = byRelativePath.get(path);
    if (entry === undefined) {
      failures.push(`missing Git-tracked Lesson 07 solution file: ${path}`);
      continue;
    }
    if (entry.symlink) continue;
    const sourcePath = resolve(repositoryRoot, `${sourcePrefix}${path}`);
    const source = await readFile(sourcePath);
    const target = await readFile(entry.absolutePath);
    if (!source.equals(target))
      failures.push(`${path} differs byte-for-byte from Lesson 07 solution.`);
  }

  if (failures.length === 0) {
    return [
      `PASS Lesson 08 OpenRouter physical starter: ${expected.size} byte-identical Git-tracked ` +
        "Lesson 07 files, one root README.md exception.",
    ];
  }
  return failures;
}

async function listFiles(
  root: string,
  baseRoot: string,
): Promise<Array<{ path: string; absolutePath: string; symlink: boolean }>> {
  const metadata = await lstat(root).catch((error: unknown) => {
    if (isMissing(error)) return undefined;
    throw error;
  });
  if (metadata === undefined) return [];
  if (metadata.isSymbolicLink()) {
    return [
      {
        path: relative(baseRoot, root).replaceAll("\\", "/"),
        absolutePath: root,
        symlink: true,
      },
    ];
  }
  if (metadata.isFile()) {
    return [
      {
        path: relative(baseRoot, root).replaceAll("\\", "/"),
        absolutePath: root,
        symlink: false,
      },
    ];
  }
  if (!metadata.isDirectory()) return [];

  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) {
      if (/^\.env(?:\.|$)/iu.test(entry.name)) {
        files.push({
          path: relative(baseRoot, resolve(root, entry.name)).replaceAll("\\", "/"),
          absolutePath: resolve(root, entry.name),
          symlink: entry.isSymbolicLink(),
        });
      }
      continue;
    }
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path, baseRoot)));
    else if (entry.isFile() || entry.isSymbolicLink()) {
      files.push({
        path: relative(baseRoot, path).replaceAll("\\", "/"),
        absolutePath: path,
        symlink: entry.isSymbolicLink(),
      });
    }
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function isWithin(parent: string, child: string): boolean {
  const path = relative(resolve(parent), resolve(child));
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`));
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

async function main(): Promise<void> {
  const candidate = process.argv[2] ?? resolve(repositoryRoot, lesson, "starter");
  if (process.argv.length > 3) {
    throw new Error("Usage: verify-lesson08-openrouter-scaffolding.ts [candidate-starter-root]");
  }
  const results = await inspectLesson08OpenRouterScaffolding(resolve(repositoryRoot, candidate));
  if (results[0]?.startsWith("PASS ")) console.log(results[0]);
  else {
    console.error("FAIL Lesson 08 OpenRouter physical starter:");
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
    console.error(error instanceof Error ? error.message : "Lesson 08 scaffolding failed.");
    process.exitCode = 1;
  });
}
