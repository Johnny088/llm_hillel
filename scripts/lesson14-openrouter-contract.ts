import { execFileSync } from "node:child_process";
import { lstat, readFile, realpath, readdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const lesson14OpenRouter = "lesson-14-react-sse-openrouter";
export const lesson14FoundationSize = 203;

export const lesson14SolutionDelta = [
  "src/lesson14/agent-persistence.ts",
  "src/lesson14/agent-stream.ts",
  "src/lesson14/app.ts",
  "src/lesson14/auth.ts",
  "src/lesson14/chat-repository.ts",
  "src/lesson14/chat-service.ts",
  "src/lesson14/contracts.ts",
  "src/lesson14/env.ts",
  "src/lesson14/provider-stream-normalization.ts",
  "src/lesson14/server.ts",
  "src/lesson14/sse.ts",
  "src/lesson14/stream-redactor.ts",
  "tests/lesson14/agent-stream.test.ts",
  "tests/lesson14/agent-stream-runtime.test.ts",
  "tests/lesson14/app.test.ts",
  "tests/lesson14/chat-service.test.ts",
  "tests/lesson14/client.test.tsx",
  "tests/lesson14/contracts.test.ts",
  "tests/lesson14/provider-stream-normalization.test.ts",
  "tests/lesson14/sse.test.ts",
  "tests/lesson14/stream-redactor.test.ts",
  "client/src/App.tsx",
  "client/src/chat-api.ts",
  "client/index.html",
  "client/vite.config.ts",
  "client/src/main.tsx",
  "client/src/styles.css",
  "db/migrations/002_chat.sql",
  "integration-tests/react-sse-postgres.test.ts",
  "scripts/lesson14/migrate-chat.ts",
  "scripts/lesson14/setup-agent-checkpoints.ts",
  "db/migrations/003_stream_runtime.sql",
  "integration-tests/checkpoint-restart.test.ts",
  "integration-tests/checkpoint-restart-worker.ts",
] as const;

const starterDelta: readonly string[] = [];
const generatedDirectories = new Set(["node_modules", "dist", "coverage"]);
const forbiddenDirectories = new Set([
  ".private",
  ".public",
  ".agents",
  ".codex",
  "userdev",
  "user-dev",
  "mydev",
  "my-dev",
  "mywork",
  "my-work",
]);
const lessonRootReadmes = new Set(["README.md"]);
const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoot = resolve(repositoryRoot, "lesson-13-databases-openrouter/solution");

export type Lesson14CandidateKind = "starter" | "solution";

interface CandidateEntry {
  absolutePath: string;
  relativePath: string;
  symlink: boolean;
}

export async function inspectLesson14OpenRouterCandidate(
  candidateInput: string,
  kind: Lesson14CandidateKind,
): Promise<string[]> {
  const candidateRoot = resolve(repositoryRoot, candidateInput);
  const failures: string[] = [];
  if (!isWithin(repositoryRoot, candidateRoot)) return ["candidate path escapes repository root"];

  const candidateMetadata = await lstat(candidateRoot).catch(missingAsUndefined);
  if (candidateMetadata === undefined) return ["candidate directory does not exist"];
  if (!candidateMetadata.isDirectory() || candidateMetadata.isSymbolicLink())
    return ["candidate must be a real directory, not a symlink"];
  const [repositoryReal, candidateReal] = await Promise.all([
    realpath(repositoryRoot),
    realpath(candidateRoot),
  ]);
  if (!isWithin(repositoryReal, candidateReal))
    return ["candidate resolves outside repository root"];

  const [entries, foundation] = await Promise.all([
    listFiles(candidateRoot, candidateRoot),
    getSourceFoundation(),
  ]);
  if (foundation.length !== lesson14FoundationSize)
    failures.push(
      `Lesson 13 solution foundation must contain ${lesson14FoundationSize} tracked files, found ${foundation.length}`,
    );

  const byPath = new Map(entries.map((entry) => [entry.relativePath, entry]));
  for (const entry of entries) {
    if (entry.symlink) failures.push(`candidate contains symlink: ${entry.relativePath}`);
    if (entry.relativePath.split("/").some((part) => /^\.env(?:\.|$)/iu.test(part)))
      failures.push(`candidate contains environment file: ${entry.relativePath}`);
  }

  for (const path of foundation) {
    const entry = byPath.get(path);
    if (entry === undefined) {
      failures.push(`missing inherited Lesson 13 foundation file: ${path}`);
      continue;
    }
    if (entry.symlink) continue;
    const [source, candidate] = await Promise.all([
      readFile(resolve(sourceRoot, path)),
      readFile(entry.absolutePath),
    ]);
    if (!source.equals(candidate))
      failures.push(`source-bound Lesson 13 foundation drift: ${path}`);
  }

  const delta = kind === "starter" ? starterDelta : lesson14SolutionDelta;
  for (const path of delta)
    if (!byPath.has(path)) failures.push(`missing required Lesson 14 ${kind} file: ${path}`);

  const expected = new Set([...foundation, ...lessonRootReadmes, ".course-state.json", ...delta]);
  for (const entry of entries)
    if (!expected.has(entry.relativePath))
      failures.push(`unaccounted Lesson 14 ${kind} file: ${entry.relativePath}`);

  return failures;
}

export async function getSourceFoundation(): Promise<string[]> {
  const prefix = "lesson-13-databases-openrouter/solution/";
  return execFileSync("git", ["ls-files", "--", prefix.slice(0, -1)], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split(/\r?\n/u)
    .filter((path) => path.startsWith(prefix) && path !== `${prefix}README.md`)
    .map((path) => path.slice(prefix.length))
    .sort();
}

async function listFiles(path: string, base: string): Promise<CandidateEntry[]> {
  const files: CandidateEntry[] = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.isDirectory() && generatedDirectories.has(entry.name)) continue;
    const absolutePath = resolve(path, entry.name);
    if (entry.isDirectory() && forbiddenDirectories.has(entry.name.toLocaleLowerCase())) {
      files.push({
        absolutePath,
        relativePath: relative(base, absolutePath).split(sep).join("/"),
        symlink: false,
      });
      continue;
    }
    if (entry.isDirectory()) files.push(...(await listFiles(absolutePath, base)));
    else if (entry.isFile() || entry.isSymbolicLink())
      files.push({
        absolutePath,
        relativePath: relative(base, absolutePath).split(sep).join("/"),
        symlink: entry.isSymbolicLink(),
      });
  }
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
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
