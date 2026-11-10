import { execFileSync } from "node:child_process";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const lesson15OpenRouter = "lesson-15-final-project-workshop-openrouter";
export const lesson15FoundationSize = 237;
export const rcArtifacts = [
  "ARCHITECTURE.md",
  "PRODUCTION_READINESS.md",
  "SECURITY.md",
  "EVAL_REPORT.md",
  "KNOWN_LIMITATIONS.md",
  "DEMO_PLAN.md",
] as const;

export type Lesson15CandidateKind = "starter" | "solution" | "structural";
export const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePrefix = "lesson-14-react-sse-openrouter/solution/";
const sourceRoot = resolve(repositoryRoot, sourcePrefix);
const generatedDirectories = new Set(["node_modules", "dist", "coverage"]);

interface CandidateEntry {
  absolutePath: string;
  relativePath: string;
  kind: "file" | "directory" | "symlink" | "other";
}

export async function getLesson15SourceFoundation(): Promise<string[]> {
  return execFileSync("git", ["ls-files", "--", sourcePrefix.slice(0, -1)], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split(/\r?\n/u)
    .filter((path) => path.startsWith(sourcePrefix) && path !== `${sourcePrefix}README.md`)
    .map((path) => path.slice(sourcePrefix.length))
    .sort();
}

export async function inspectLesson15OpenRouterCandidate(
  candidateInput: string,
  kind: Lesson15CandidateKind = "structural",
): Promise<string[]> {
  const candidateRoot = resolve(repositoryRoot, candidateInput);
  if (!isWithin(repositoryRoot, candidateRoot) || candidateRoot === repositoryRoot)
    return ["candidate path escapes the allowed repository subtree"];
  const pathFailure = await inspectRealDirectory(candidateRoot);
  if (pathFailure !== undefined) return [pathFailure];
  const [entries, foundation] = await Promise.all([
    listEntries(candidateRoot, candidateRoot),
    getLesson15SourceFoundation(),
  ]);
  const failures: string[] = [];
  if (foundation.length !== lesson15FoundationSize)
    failures.push(
      `Lesson 14 solution foundation must contain ${lesson15FoundationSize} tracked files, found ${foundation.length}`,
    );
  const byPath = new Map(entries.map((entry) => [entry.relativePath, entry]));
  const expected = new Set([
    ...foundation,
    "README.md",
    ...(kind === "starter" ? [] : rcArtifacts),
  ]);
  // Managed flat-dev metadata is outside the learning-file inventory.
  if (candidateRoot === resolve(repositoryRoot, "dev")) expected.add(".course-state.json");
  const expectedDirectories = new Set<string>();
  for (const path of expected) {
    let parent = dirname(path).split(sep).join("/");
    while (parent !== ".") {
      expectedDirectories.add(parent);
      parent = dirname(parent).split(sep).join("/");
    }
  }
  for (const entry of entries) {
    if (entry.kind === "symlink")
      failures.push(`candidate contains symlink: ${entry.relativePath}`);
    if (entry.relativePath.split("/").some((part) => /^\.env(?:\.|$)/iu.test(part)))
      failures.push(`candidate contains environment file: ${entry.relativePath}`);
    const accounted =
      entry.kind === "directory"
        ? expectedDirectories.has(entry.relativePath)
        : expected.has(entry.relativePath);
    if (!accounted) failures.push(`unaccounted Lesson 15 ${kind} entry: ${entry.relativePath}`);
  }
  for (const path of foundation) {
    const entry = byPath.get(path);
    if (entry?.kind !== "file") {
      failures.push(`missing inherited Lesson 14 foundation file: ${path}`);
      continue;
    }
    const sourcePath = resolve(sourceRoot, path);
    if (!isWithin(sourceRoot, sourcePath))
      throw new Error("Tracked foundation path escapes source.");
    const metadata = await lstat(sourcePath);
    if (!metadata.isFile() || metadata.isSymbolicLink())
      throw new Error(`Source foundation must be a regular file: ${path}`);
    const [source, candidate] = await Promise.all([
      readFile(sourcePath),
      readFile(entry.absolutePath),
    ]);
    if (!source.equals(candidate))
      failures.push(`source-bound Lesson 14 foundation drift: ${path}`);
  }
  for (const path of ["README.md", ...(kind === "solution" ? rcArtifacts : [])])
    if (byPath.get(path)?.kind !== "file")
      failures.push(`missing required Lesson 15 ${kind} file: ${path}`);
  return failures;
}

/** Copies the inspected candidate itself into a document-free Lesson 14 fixture. */
export async function withLesson15FoundationFixture<T>(
  candidateInput: string,
  run: (relativeCandidate: string) => Promise<T>,
): Promise<T> {
  const failures = await inspectLesson15OpenRouterCandidate(candidateInput, "structural");
  if (failures.length > 0) throw new Error(formatLesson15Failures(candidateInput, failures));
  const temporaryRoot = resolve(repositoryRoot, ".tmp");
  if ((await lstat(temporaryRoot).catch(missingAsUndefined)) !== undefined) {
    const temporaryFailure = await inspectRealDirectory(temporaryRoot);
    if (temporaryFailure !== undefined) throw new Error(temporaryFailure);
  } else await mkdir(temporaryRoot);
  const scratchRoot = resolve(repositoryRoot, ".tmp/lesson15-openrouter-foundation");
  if ((await lstat(scratchRoot).catch(missingAsUndefined)) !== undefined) {
    const existingFailure = await inspectRealDirectory(scratchRoot);
    if (existingFailure !== undefined) throw new Error(existingFailure);
  }
  await mkdir(scratchRoot, { recursive: true });
  const scratchFailure = await inspectRealDirectory(scratchRoot);
  if (scratchFailure !== undefined) throw new Error(scratchFailure);
  const fixtureRoot = await mkdtemp(resolve(scratchRoot, "candidate-"));
  const scratchReal = await realpath(scratchRoot);
  assertContained(scratchReal, await realpath(fixtureRoot));
  try {
    const candidateRoot = resolve(repositoryRoot, candidateInput);
    for (const path of [...(await getLesson15SourceFoundation()), "README.md"]) {
      const source = resolve(candidateRoot, path);
      const destination = resolve(fixtureRoot, path);
      assertContained(fixtureRoot, destination);
      const metadata = await lstat(source);
      if (!metadata.isFile() || metadata.isSymbolicLink())
        throw new Error(`Refusing to copy non-regular candidate file: ${path}`);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(source, destination);
    }
    return await run(relative(repositoryRoot, fixtureRoot).split(sep).join("/"));
  } finally {
    assertContained(scratchReal, await realpath(fixtureRoot));
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

export function formatLesson15Failures(candidate: string, failures: readonly string[]): string {
  return `Lesson 15 OpenRouter contract failed for ${candidate}:\n${failures.map((failure) => `- ${failure}`).join("\n")}`;
}

async function inspectRealDirectory(path: string): Promise<string | undefined> {
  const metadata = await lstat(path).catch(missingAsUndefined);
  if (metadata === undefined) return "candidate directory does not exist";
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    return "candidate must be a real directory, not a symlink";
  let current = path;
  while (current !== repositoryRoot) {
    if ((await lstat(current)).isSymbolicLink()) return "candidate path contains a symlink";
    const parent = dirname(current);
    if (parent === current) return "candidate path escapes repository root";
    current = parent;
  }
  if (!isWithin(await realpath(repositoryRoot), await realpath(path)))
    return "candidate resolves outside repository root";
  return undefined;
}

async function listEntries(path: string, base: string): Promise<CandidateEntry[]> {
  const entries: CandidateEntry[] = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (!entry.isSymbolicLink() && entry.isDirectory() && generatedDirectories.has(entry.name))
      continue;
    const absolutePath = resolve(path, entry.name);
    const kind = entry.isSymbolicLink()
      ? "symlink"
      : entry.isDirectory()
        ? "directory"
        : entry.isFile()
          ? "file"
          : "other";
    entries.push({
      absolutePath,
      relativePath: relative(base, absolutePath).split(sep).join("/"),
      kind,
    });
    if (kind === "directory") entries.push(...(await listEntries(absolutePath, base)));
  }
  return entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}
function assertContained(parent: string, child: string): void {
  if (parent === child || !isWithin(parent, child))
    throw new Error("Lesson 15 fixture escaped its guarded scratch root.");
}
function isWithin(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`));
}
function missingAsUndefined(error: unknown): undefined {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")
    return undefined;
  throw error;
}
