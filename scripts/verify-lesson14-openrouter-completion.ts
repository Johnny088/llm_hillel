import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { inspectLesson14OpenRouterCandidate } from "./lesson14-openrouter-contract.js";
import { verifyLesson14OpenRouterInheritedEvals } from "./verify-lesson14-openrouter-inherited-evals.js";
import { createLesson14TestEnvironment } from "./verify-lesson14-openrouter-test-environment.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const lesson = "lesson-14-react-sse-openrouter";
const inheritedUnitMinimum = 394;
const lesson14UnitMinimum = 61;
const nativeIntegrationMinimum = 14;
const canonicalSolution = resolve(repositoryRoot, lesson, "solution");
const copyExtensions = new Set([
  ".md",
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".jsx",
  ".mjs",
  ".sql",
  ".ts",
  ".tsx",
  ".json",
  ".txt",
  ".yml",
  ".yaml",
]);
const generatedDirectories = new Set(["node_modules", "dist", "coverage"]);
const activeTestPattern = /\b(?:it|test)(?:\.(?:each|for|runIf|skipIf))?\s*\(/gu;
const disabledTestPattern = /\b(?:describe|it|test)\.(?:skip|only|skipIf|runIf|todo|todoIf)\s*\(/gu;

export interface Lesson14CompletionSummary {
  candidatePassed: number;
  sourceReboundPassed: number;
  nativeIntegrationPassed: number;
  passed: boolean;
}

export async function verifyLesson14OpenRouterCompletion(
  candidateInput = `${lesson}/solution`,
): Promise<Lesson14CompletionSummary> {
  const candidateRoot = resolve(repositoryRoot, candidateInput);
  const failures = await inspectLesson14OpenRouterCandidate(candidateInput, "solution");
  if (failures.length > 0) throw new Error(formatFailures(candidateInput, failures));

  const canonicalTests = await listTestFiles(resolve(canonicalSolution, "tests/lesson14"));
  const canonicalIntegration = resolve(
    canonicalSolution,
    "integration-tests/react-sse-postgres.test.ts",
  );
  const counts = await inspectTestFiles(canonicalTests);
  if (canonicalTests.length !== 9 || counts.active === 0 || counts.disabled > 0)
    throw new Error(
      `Canonical Lesson 14 source-rebound suite must contain 9 enabled files, active declarations, and no disabled tests; found ${canonicalTests.length} files, ${counts.active} declarations, and ${counts.disabled} disabled declarations.`,
    );

  const safeEnvironment = createLesson14TestEnvironment(process.env);
  const vitestCli = resolve(repositoryRoot, "node_modules/vitest/vitest.mjs");
  const tempRoot = resolve(repositoryRoot, ".tmp/l14-refactor-20261012/completion");
  await mkdir(tempRoot, { recursive: true });
  const fixtureRoot = await mkdtemp(resolve(tempRoot, "candidate-"));
  assertContained(await realpath(tempRoot), await realpath(fixtureRoot));
  try {
    const fixtureRepository = resolve(fixtureRoot, "repo");
    const fixtureCandidate = resolve(fixtureRepository, "dev", lesson);
    await mkdir(fixtureRepository, { recursive: true });
    await writeFile(
      resolve(fixtureRepository, "package.json"),
      '{"private":true,"type":"module"}\n',
      "utf8",
    );
    await copySafeTree(candidateRoot, fixtureCandidate);

    const reboundRoot = resolve(fixtureRepository, "dev/lesson14-source-rebound");
    await copySafeTree(fixtureCandidate, reboundRoot);
    for (const path of canonicalTests) {
      const destination = resolve(reboundRoot, "tests/lesson14", basename(path));
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(path, destination);
    }
    const reboundSummary = await runVitest(
      reboundRoot,
      vitestCli,
      safeEnvironment,
      canonicalTests.map((path) => `tests/lesson14/${basename(path)}`),
      "Lesson 14 source-rebound unit suite",
    );
    if (reboundSummary.passed < lesson14UnitMinimum)
      throw new Error(
        `Source-rebound Lesson 14 suite must pass at least ${lesson14UnitMinimum} tests; found ${reboundSummary.passed}.`,
      );

    const candidateSummary = await runVitest(
      fixtureCandidate,
      vitestCli,
      safeEnvironment,
      ["--dir", "tests"],
      "Lesson 14 candidate unit suite",
    );
    const candidateMinimum = inheritedUnitMinimum + reboundSummary.passed;
    if (candidateSummary.passed < candidateMinimum)
      throw new Error(
        `Candidate suite must pass at least ${candidateMinimum} tests (394 inherited + ${reboundSummary.passed} rebound Lesson 14); found ${candidateSummary.passed}.`,
      );

    const evalFailures = await verifyLesson14OpenRouterInheritedEvals(
      relative(repositoryRoot, fixtureCandidate),
    );
    if (evalFailures.length > 0) throw new Error(formatFailures(candidateInput, evalFailures));

    runCandidateTsx(fixtureCandidate, "scripts/lesson14/migrate-chat.ts", safeEnvironment);
    const nativeIntegrationPath = "integration-tests/react-sse-postgres.test.ts";
    const nativeDestination = resolve(fixtureCandidate, nativeIntegrationPath);
    await mkdir(dirname(nativeDestination), { recursive: true });
    await copyFile(canonicalIntegration, nativeDestination);
    const nativeSummary = await runVitest(
      fixtureCandidate,
      vitestCli,
      safeEnvironment,
      ["--maxWorkers=1", "--fileParallelism=false", "--dir", "integration-tests"],
      "Lesson 14 serialized PostgreSQL integration suite",
    );
    if (nativeSummary.passed < nativeIntegrationMinimum)
      throw new Error(
        `Inherited Lesson 13 + Lesson 14 serialized integration must pass at least ${nativeIntegrationMinimum} tests; found ${nativeSummary.passed}.`,
      );

    const summary: Lesson14CompletionSummary = {
      candidatePassed: candidateSummary.passed,
      sourceReboundPassed: reboundSummary.passed,
      nativeIntegrationPassed: nativeSummary.passed,
      passed: true,
    };
    console.log(
      `PASS Lesson 14 completion: candidate=${summary.candidatePassed} tests, ` +
        `source-rebound=${summary.sourceReboundPassed} tests (zero todo/skipped), ` +
        `serialized PostgreSQL integration=${summary.nativeIntegrationPassed}; inherited evals passed.`,
    );
    return summary;
  } finally {
    assertContained(await realpath(tempRoot), await realpath(fixtureRoot));
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

async function listTestFiles(root: string): Promise<string[]> {
  const metadata = await lstat(root).catch(() => undefined);
  if (metadata === undefined || !metadata.isDirectory() || metadata.isSymbolicLink()) return [];
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isFile() && /\.test\.(?:ts|tsx)$/u.test(entry.name)) files.push(path);
  }
  return files.sort();
}

async function inspectTestFiles(
  paths: readonly string[],
): Promise<{ active: number; disabled: number }> {
  let active = 0;
  let disabled = 0;
  for (const path of paths) {
    const source = await readFile(path, "utf8");
    active += [...source.matchAll(activeTestPattern)].length;
    disabled += [...source.matchAll(disabledTestPattern)].length;
  }
  return { active, disabled };
}

async function runVitest(
  candidateRoot: string,
  vitestCli: string,
  environment: NodeJS.ProcessEnv,
  args: readonly string[],
  label: string,
): Promise<{ passed: number; todo: number; skipped: number }> {
  const result = spawnSync(process.execPath, [vitestCli, "run", "--root", candidateRoot, ...args], {
    cwd: candidateRoot,
    encoding: "utf8",
    env: environment,
    maxBuffer: 24 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.error) throw new Error(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(`${label} failed with exit code ${String(result.status)}.`);
  const summary = output.match(/\bTests\s+([^\r\n]*\(\d+\))/u)?.[1];
  if (!summary) throw new Error(`${label} did not report a Vitest test summary.`);
  const count = (expression: RegExp): number =>
    [...summary.matchAll(expression)].reduce((total, match) => total + Number(match[1]), 0);
  const parsed = {
    passed: count(/(\d+)\s+passed\b/gu),
    todo: count(/(\d+)\s+todo\b/giu),
    skipped: count(/(\d+)\s+skipped\b/giu),
  };
  if (parsed.passed === 0 || parsed.todo !== 0 || parsed.skipped !== 0)
    throw new Error(`${label} requires passing tests and zero todo/skipped; ${summary}.`);
  return parsed;
}

function runCandidateTsx(
  candidateRoot: string,
  entrypoint: string,
  environment: NodeJS.ProcessEnv,
): string {
  const result = spawnSync(
    process.execPath,
    [resolve(repositoryRoot, "scripts/run-tsx-entrypoint.mjs"), resolve(candidateRoot, entrypoint)],
    { cwd: candidateRoot, encoding: "utf8", env: environment, maxBuffer: 24 * 1024 * 1024 },
  );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.error) throw new Error(`${entrypoint} could not start: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(`${entrypoint} failed with exit code ${String(result.status)}.`);
  return output;
}

async function copySafeTree(source: string, destination: string): Promise<void> {
  const metadata = await lstat(source).catch((error: unknown) =>
    isMissing(error) ? undefined : Promise.reject(error),
  );
  if (metadata === undefined) return;
  if (metadata.isSymbolicLink()) throw new Error(`Refusing to copy symlink ${source}.`);
  if (metadata.isFile()) {
    if (
      /^\.env(?:\.|$)/iu.test(basename(source)) ||
      basename(source) === ".course-state.json" ||
      extname(source) === ".map" ||
      isRuntimeData(source)
    )
      return;
    if (!copyExtensions.has(extname(source))) return;
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
    return;
  }
  if (!metadata.isDirectory() || basename(source).startsWith(".")) return;
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true }))
    if (!entry.name.startsWith(".") && !generatedDirectories.has(entry.name))
      await copySafeTree(resolve(source, entry.name), resolve(destination, entry.name));
}

function formatFailures(candidate: string, failures: readonly string[]): string {
  return `Lesson 14 completion failed for ${candidate}:\n${failures.map((failure) => `- ${failure}`).join("\n")}`;
}
function assertContained(parent: string, child: string): void {
  if (!isWithin(parent, child))
    throw new Error("Completion fixture escaped its guarded scratch root.");
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

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  const candidate = process.argv[2];
  try {
    await verifyLesson14OpenRouterCompletion(candidate);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Lesson 14 completion failed.");
    process.exitCode = 1;
  }
}
