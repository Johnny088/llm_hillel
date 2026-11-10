import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { findModelFallbackViolations } from "./verify-no-model-fallback.js";
import { requireSecurityEvalSummary } from "./verify-lesson12-openrouter-completion.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const lesson = "lesson-13-databases-openrouter";
const previousLesson = "lesson-12-security-openrouter";
const generatedDirectories = new Set(["node_modules", "dist", "coverage"]);
const copyExtensions = new Set([
  ".cjs",
  ".js",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
  ".json",
  ".md",
  ".txt",
  ".sql",
  ".yml",
  ".yaml",
]);
const lessonDelta = new Set([
  "docker-compose.yml",
  "db/migrations/001_catalog.sql",
  "db/migrations/002_agent_runtime.sql",
  "db/seed.sql",
  "src/catalog-agent.ts",
  "src/catalog-contracts.ts",
  "src/catalog-database-env.ts",
  "src/catalog-database.ts",
  "src/catalog-demo.ts",
  "src/catalog-embeddings.ts",
  "src/catalog-repository.ts",
  "src/catalog-seed-embeddings.ts",
  "src/catalog-tools.ts",
  "src/agent-runtime.ts",
  "src/approval-store.ts",
  "src/thread-lock.ts",
  "src/testing/catalog-database-fixture.ts",
  "src/testing/deterministic-embeddings.ts",
  "scripts/migrate-catalog.ts",
  "scripts/setup-agent-checkpoints.ts",
  "scripts/seed-catalog.ts",
  "evals/catalog-dataset.ts",
  "evals/catalog-run.ts",
  "integration-tests/postgres-catalog.test.ts",
  "integration-tests/agent-checkpoints.test.ts",
  "integration-tests/catalog-approval-restart-worker.ts",
  "tests/catalog-agent.test.ts",
  "tests/catalog-contracts.test.ts",
  "tests/catalog-database-env.test.ts",
  "tests/catalog-embeddings.test.ts",
  "tests/catalog-repository.test.ts",
  "tests/catalog-tools.test.ts",
  "tests/thread-lock.test.ts",
  "src/runtime.ts",
  "src/server.ts",
  "src/demo-security.ts",
  "scripts/run-content-review-live-demo.ts",
]);
// These existing entrypoints acquire durable storage only in Lesson 13.
// The canonical starter still keeps every Lesson 12 foundation byte intact.
const persistenceExtensions = new Set([
  "src/runtime.ts",
  "src/server.ts",
  "src/demo-security.ts",
  "scripts/run-content-review-live-demo.ts",
]);
const reboundTests = [
  "tests/catalog-agent.test.ts",
  "tests/catalog-contracts.test.ts",
  "tests/catalog-database-env.test.ts",
  "tests/catalog-embeddings.test.ts",
  "tests/catalog-repository.test.ts",
  "tests/catalog-tools.test.ts",
] as const;
const incompletePatterns = [
  { label: "todo test", pattern: /\b(?:describe|it|test)\.(?:todo|todoIf)\s*\(/u },
  {
    label: "disabled or focused test",
    pattern: /\b(?:describe|it|test)\.(?:skip|only|skipIf|runIf)\s*\(/u,
  },
  { label: "TODO marker", pattern: /\bTODO\b/u },
  { label: "NOT_IMPLEMENTED marker", pattern: /\bNOT_IMPLEMENTED\b/u },
  { label: "STARTER_TODO marker", pattern: /\bSTARTER_TODO\b/u },
  {
    label: "HTTP 501 placeholder",
    pattern: /(?:\.status\s*\(\s*501\b|\bsendStatus\s*\(\s*501\b|\bstatus(?:Code)?\s*:\s*501\b)/u,
  },
];
const activeTestPattern = /\b(?:it|test)(?:\.(?:each|for|runIf|skipIf))?\s*\(/gu;
const candidateFileExtensions = new Set([...copyExtensions]);

interface CandidateFile {
  absolutePath: string;
  relativePath: string;
  symlink: boolean;
}

export async function inspectLesson13OpenRouterScaffolding(
  candidateInput = `${lesson}/starter`,
): Promise<string[]> {
  return inspectCandidate(resolve(repositoryRoot, candidateInput), false);
}

export async function inspectLesson13OpenRouterContinuity(
  candidateInput = `${lesson}/solution`,
): Promise<string[]> {
  return inspectCandidate(resolve(repositoryRoot, candidateInput), true);
}

export async function inspectLesson13OpenRouterCandidate(
  candidateInput: string,
): Promise<string[]> {
  return inspectCandidate(resolve(repositoryRoot, candidateInput), true);
}

async function inspectCandidate(root: string, requireDelta: boolean): Promise<string[]> {
  if (!isWithin(repositoryRoot, root))
    return ["Lesson 13 candidate must stay inside this repository."];
  const metadata = await lstat(root).catch((error: unknown) =>
    isMissing(error) ? undefined : Promise.reject(error),
  );
  if (metadata === undefined) return ["Lesson 13 candidate does not exist."];
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    return ["Lesson 13 candidate must be a real directory."];
  const [repositoryRealPath, candidateRealPath] = await Promise.all([
    realpath(repositoryRoot),
    realpath(root).catch((error: unknown) =>
      isMissing(error) ? undefined : Promise.reject(error),
    ),
  ]);
  if (candidateRealPath === undefined) return ["Lesson 13 candidate does not exist."];
  if (!isWithin(repositoryRealPath, candidateRealPath))
    return ["Lesson 13 candidate resolves outside this repository."];

  const files = await listFiles(root, root);
  const byPath = new Map(files.map((entry) => [entry.relativePath, entry]));
  const failures: string[] = [];
  const foundation = trackedFoundationFiles();
  if (foundation.length !== 170)
    failures.push(
      `Git-tracked Lesson 12 foundation must contain 170 files, found ${foundation.length}.`,
    );
  if (!byPath.has("README.md")) failures.push("Lesson 13 candidate root README.md is required.");

  for (const entry of files) {
    if (entry.symlink) failures.push(`candidate paths must not be symlinks: ${entry.relativePath}`);
    if (entry.relativePath.split("/").some((part) => /^\.env(?:\.|$)/iu.test(part)))
      failures.push(`credential configuration is not accepted: ${entry.relativePath}`);
  }

  for (const path of foundation) {
    const entry = byPath.get(path);
    if (entry === undefined) {
      failures.push(`missing inherited Lesson 12 foundation file: ${path}`);
      continue;
    }
    if (entry.symlink) continue;
    const [source, candidate] = await Promise.all([
      readFile(resolve(repositoryRoot, `${previousLesson}/solution`, path)),
      readFile(entry.absolutePath),
    ]);
    if (!source.equals(candidate) && !(requireDelta && persistenceExtensions.has(path)))
      failures.push(`source-bound Lesson 12 foundation drift: ${path}`);
  }

  if (requireDelta) {
    for (const path of lessonDelta)
      if (!byPath.has(path)) failures.push(`missing required Lesson 13 implementation: ${path}`);
  }
  const expectedFiles = new Set([
    "README.md",
    ".course-state.json",
    ...foundation,
    ...(requireDelta ? lessonDelta : []),
  ]);
  for (const entry of files)
    if (!expectedFiles.has(entry.relativePath))
      failures.push(`unaccounted Lesson 13 candidate file: ${entry.relativePath}`);

  for (const entry of files.filter(
    (item) =>
      candidateFileExtensions.has(extname(item.relativePath)) &&
      !/(?:^|\/)(?:tests|integration-tests)\//u.test(item.relativePath),
  )) {
    if (entry.symlink) continue;
    const source = await readFile(entry.absolutePath, "utf8");
    for (const [lineIndex, line] of source.split(/\r?\n/u).entries()) {
      for (const marker of incompletePatterns) {
        if (marker.pattern.test(line))
          failures.push(`${entry.relativePath}:${lineIndex + 1} contains ${marker.label}.`);
        marker.pattern.lastIndex = 0;
      }
    }
  }

  for (const entry of files.filter((item) =>
    /(?:^|\/)(?:tests|integration-tests)\//u.test(item.relativePath),
  )) {
    if (entry.symlink) continue;
    const source = await readFile(entry.absolutePath, "utf8");
    for (const marker of incompletePatterns.slice(0, 2))
      if (marker.pattern.test(source))
        failures.push(`${entry.relativePath} contains ${marker.label}.`);
  }

  for (const violation of findModelFallbackViolations(root))
    failures.push(
      `${violation.file}:${violation.line} violates the one-model contract (${violation.rule}).`,
    );
  return failures;
}

export async function verifyLesson13OpenRouterCompletion(
  candidateInput = `${lesson}/solution`,
): Promise<void> {
  const candidateRoot = resolve(repositoryRoot, candidateInput);
  const relativeCandidate = portable(relative(repositoryRoot, candidateRoot));
  const failures = await inspectLesson13OpenRouterCandidate(candidateInput);
  if (failures.length > 0) {
    console.error(
      `Lesson 13 OpenRouter completion failed for ${relativeCandidate}: ${failures.length} issue(s).`,
    );
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  const safeEnvironment = createLesson13TestEnvironment(process.env);
  const vitestCli = resolve(repositoryRoot, "node_modules", "vitest", "vitest.mjs");
  const tempRoot = resolve(repositoryRoot, ".tmp", "l13-refactor-20261012", "infra-completion");
  await mkdir(tempRoot, { recursive: true });
  const fixtureRoot = await mkdtemp(resolve(tempRoot, "candidate-"));
  assertContained(await realpath(tempRoot), await realpath(fixtureRoot));
  try {
    const fixtureRepository = resolve(fixtureRoot, "repo");
    const fixtureCandidate = resolve(fixtureRepository, "dev", lesson);
    await createFixturePackageBoundary(fixtureRepository);
    await copySafeTree(candidateRoot, fixtureCandidate);
    const candidateTests = await runVitest(
      fixtureCandidate,
      vitestCli,
      safeEnvironment,
      "Lesson 13 candidate tests",
      ["--dir", "tests"],
    );
    if (candidateTests < 394)
      throw new Error(
        `Inherited Lesson 12 plus Lesson 13 catalog suite must pass at least 394 tests; found ${candidateTests}.`,
      );

    const reboundRoot = resolve(fixtureRepository, "dev", "lesson13-source-rebound");
    await copySafeTree(fixtureCandidate, reboundRoot);
    for (const path of reboundTests) {
      const destination = resolve(reboundRoot, path);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(resolve(repositoryRoot, lesson, "solution", path), destination);
    }
    const reboundTestCount = await countActiveTests(
      reboundTests.map((path) => ({
        absolutePath: resolve(repositoryRoot, lesson, "solution", path),
        relativePath: path,
        symlink: false,
      })),
    );
    if (reboundTestCount === 0)
      throw new Error("Source-rebound Lesson 13 tests contain no active cases.");
    const reboundPassed = await runVitest(
      reboundRoot,
      vitestCli,
      safeEnvironment,
      "Lesson 13 source-rebound catalog tests",
      reboundTests,
    );
    if (reboundPassed < 27 || reboundPassed < reboundTestCount)
      throw new Error(
        `Source-rebound tests must pass all 27 catalog assertions; found ${reboundPassed}/${reboundTestCount} declared cases.`,
      );

    const inheritedCases = runInheritedEvals(fixtureCandidate, safeEnvironment);
    if (inheritedCases !== 29)
      throw new Error(`Inherited Lesson 11 evals must pass 29 cases; found ${inheritedCases}.`);
    const observability = runCandidateTsx(
      fixtureCandidate,
      "evals/run-observability.ts",
      safeEnvironment,
      ["--offline"],
    );
    requireOfflineProfiles(observability);
    const security = runCandidateTsx(fixtureCandidate, "evals/run-security.ts", safeEnvironment);
    requireSecurityEvalSummary(security);

    const catalog = runCandidateTsx(fixtureCandidate, "evals/catalog-run.ts", safeEnvironment);
    const catalogSummary = catalog.match(/Eval успішно завершено:\s*(\d+)\s*\/\s*(\d+)/u);
    if (
      catalogSummary === null ||
      catalogSummary[1] !== catalogSummary[2] ||
      catalogSummary[1] !== "7"
    )
      throw new Error("Offline Lesson 13 catalog eval must report all seven passing cases.");

    const smoke = runCandidateTsx(
      fixtureCandidate,
      "scripts/smoke-content-review-graph.ts",
      safeEnvironment,
    );
    for (const marker of [
      "PASS health=200",
      "PASS invalid-input=400",
      "PASS start (202 approval_required) -> decision resume (200 completed/approved)",
    ])
      if (!smoke.includes(marker))
        throw new Error(`Inherited local HTTP smoke did not report ${marker}.`);

    console.log(
      `PASS Lesson 13 OpenRouter completion: ${candidateTests} candidate tests, ${reboundPassed} source-rebound cases, 29 inherited eval cases, two offline profiles, 12/12 baseline + 12/12 security, 7/7 catalog eval, and local HTTP smoke against ${relativeCandidate}.`,
    );
  } finally {
    assertContained(await realpath(tempRoot), await realpath(fixtureRoot));
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

async function runVitest(
  candidateRoot: string,
  vitestCli: string,
  environment: NodeJS.ProcessEnv,
  label: string,
  testPaths: readonly string[],
): Promise<number> {
  const output = runCommand(
    [process.execPath, vitestCli, "run", "--root", candidateRoot, ...testPaths],
    candidateRoot,
    environment,
    label,
  );
  const summary = output.match(/\bTests\s+([^\r\n]*\(\d+\))/u)?.[1];
  if (!summary) throw new Error(`${label} did not report a Vitest test summary.`);
  const count = (expression: RegExp): number =>
    [...summary.matchAll(expression)].reduce((total, match) => total + Number(match[1]), 0);
  const passed = count(/(\d+)\s+passed\b/gu);
  const todo = count(/(\d+)\s+todo\b/giu);
  const skipped = count(/(\d+)\s+skipped\b/giu);
  if (passed === 0 || todo > 0 || skipped > 0)
    throw new Error(`${label} requires passing tests and zero todo/skipped; ${summary}.`);
  return passed;
}

function runInheritedEvals(candidateRoot: string, environment: NodeJS.ProcessEnv): number {
  const entries = [
    "evals/run.ts",
    "evals/run-agent-loop.ts",
    "evals/run-report-workflow.ts",
    "evals/run-agents-sdk.ts",
    "evals/run-content-review.ts",
  ];
  let total = 0;
  for (const [index, entrypoint] of entries.entries()) {
    const output = runCandidateTsx(candidateRoot, entrypoint, environment);
    const summaries = [...output.matchAll(/\bResult:\s*(\d+)\s*\/\s*(\d+)\b/gu)];
    if (summaries.length === 0)
      throw new Error(`Inherited Lesson 11 eval ${index + 1} did not report a Result summary.`);
    for (const summary of summaries) {
      const passed = Number(summary[1]);
      const expected = Number(summary[2]);
      if (passed !== expected)
        throw new Error(
          `Inherited Lesson 11 eval ${index + 1} failed ${passed}/${expected} cases.`,
        );
      total += expected;
    }
  }
  return total;
}

export function requireOfflineProfiles(output: string): void {
  const rows = output
    .split(/\r?\n/u)
    .filter((line) => line.trimStart().startsWith("│"))
    .map((line) =>
      line
        .split("│")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
  const requiredHeaders = ["configuration", "mode", "total", "passed", "failed", "errored"];
  const headerIndex = rows.findIndex((cells) =>
    requiredHeaders.every((header) => cells.filter((cell) => cell === header).length === 1),
  );
  if (headerIndex < 0)
    throw new Error("Offline observability eval must include its complete table header.");
  const header = rows[headerIndex]!;
  const indexOf = (name: string) => header.indexOf(name);
  const profiles = new Map<string, string[]>();
  for (const cells of rows.slice(headerIndex + 1)) {
    const profile = cells[indexOf("configuration")];
    if (profile !== "'fast'" && profile !== "'main'") continue;
    if (profiles.has(profile))
      throw new Error("Offline observability eval must report each profile once.");
    profiles.set(profile, cells);
  }
  const complete = (profile: string) => {
    const cells = profiles.get(profile);
    return (
      cells?.[indexOf("mode")] === "'offline-fixture'" &&
      cells[indexOf("total")] === "12" &&
      cells[indexOf("passed")] === "12" &&
      cells[indexOf("failed")] === "0" &&
      cells[indexOf("errored")] === "0"
    );
  };
  if (profiles.size !== 2 || !complete("'fast'") || !complete("'main'"))
    throw new Error("Offline observability eval must pass 12/12 in both fast and main profiles.");
}

function runCandidateTsx(
  candidateRoot: string,
  entrypoint: string,
  environment: NodeJS.ProcessEnv,
  args: string[] = [],
): string {
  return runCommand(
    [
      process.execPath,
      resolve(repositoryRoot, "scripts", "run-tsx-entrypoint.mjs"),
      resolve(candidateRoot, entrypoint),
      ...args,
    ],
    candidateRoot,
    environment,
    entrypoint,
  );
}

function runCommand(
  args: string[],
  cwd: string,
  environment: NodeJS.ProcessEnv,
  label: string,
): string {
  const result = spawnSync(args[0]!, args.slice(1), {
    cwd,
    encoding: "utf8",
    env: environment,
    maxBuffer: 24 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.error) throw new Error(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(`${label} failed with exit code ${String(result.status)}.`);
  return output;
}

async function createFixturePackageBoundary(fixtureRepository: string): Promise<void> {
  await mkdir(fixtureRepository, { recursive: true });
  await writeFile(
    resolve(fixtureRepository, "package.json"),
    `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`,
    "utf8",
  );
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
      isRuntimeData(source) ||
      !copyExtensions.has(extname(source))
    )
      return;
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

async function listFiles(root: string, base = root): Promise<CandidateFile[]> {
  const metadata = await lstat(root).catch((error: unknown) =>
    isMissing(error) ? undefined : Promise.reject(error),
  );
  if (metadata === undefined) return [];
  if (metadata.isSymbolicLink())
    return [{ absolutePath: root, relativePath: portable(relative(base, root)), symlink: true }];
  if (metadata.isFile())
    return isRuntimeData(root)
      ? []
      : [{ absolutePath: root, relativePath: portable(relative(base, root)), symlink: false }];
  if (!metadata.isDirectory()) return [];
  const files: CandidateFile[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (generatedDirectories.has(entry.name)) continue;
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path, base)));
    else if (entry.isFile() || entry.isSymbolicLink())
      if (!isRuntimeData(path))
        files.push({
          absolutePath: path,
          relativePath: portable(relative(base, path)),
          symlink: entry.isSymbolicLink(),
        });
  }
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function trackedFoundationFiles(): string[] {
  const prefix = `${previousLesson}/solution/`;
  return execFileSync("git", ["ls-files", "--", prefix.slice(0, -1)], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split(/\r?\n/u)
    .filter((path) => path.startsWith(prefix) && path !== `${prefix}README.md`)
    .map((path) => path.slice(prefix.length))
    .sort();
}

async function countActiveTests(entries: CandidateFile[]): Promise<number> {
  let count = 0;
  for (const entry of entries) {
    if (entry.symlink) throw new Error(`Acceptance test is a symlink: ${entry.relativePath}`);
    const source = await readFile(entry.absolutePath, "utf8");
    count += [...source.matchAll(activeTestPattern)].length;
    if (incompletePatterns.slice(0, 2).some(({ pattern }) => pattern.test(source)))
      throw new Error(`Acceptance test is incomplete: ${entry.relativePath}`);
  }
  return count;
}

export function createLesson13TestEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const portText = environment.COURSE_TEST_DATABASE_PORT ?? "5434";
  if (!/^\d+$/u.test(portText) || Number(portText) < 1 || Number(portText) > 65535)
    throw new Error("COURSE_TEST_DATABASE_PORT must be an integer between 1 and 65535.");
  const port = Number(portText);
  const safe = { ...environment };
  for (const key of Object.keys(safe))
    if (
      /(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH|OPENROUTER|OPENAI|DATABASE_URL|DB_URL|^PG(?:HOST|PORT|USER|PASSWORD|DATABASE)$)/iu.test(
        key,
      )
    )
      delete safe[key];
  const databaseUrl = (role: string): string =>
    `postgresql://${role}:${role}_password@127.0.0.1:${port}/ai_agents_openrouter`;
  safe.COURSE_TEST_DATABASE_PORT = String(port);
  safe.LESSON13_OPENROUTER_ADMIN_DATABASE_URL = databaseUrl("course_admin");
  safe.LESSON13_OPENROUTER_READ_DATABASE_URL = databaseUrl("catalog_reader");
  safe.LESSON13_OPENROUTER_WRITE_DATABASE_URL = databaseUrl("catalog_writer");
  safe.LESSON13_OPENROUTER_AGENT_DATABASE_URL = databaseUrl("catalog_agent_runtime");
  safe.NODE_ENV = "test";
  return safe;
}

function assertContained(parent: string, child: string): void {
  if (!isWithin(parent, child))
    throw new Error("Completion fixture escaped its guarded scratch root.");
}
function isWithin(parent: string, child: string): boolean {
  const path = relative(resolve(parent), resolve(child));
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}
function portable(path: string): string {
  return path.replaceAll("\\", "/");
}
function isRuntimeData(path: string): boolean {
  return /(?:^|[\\/])data[\\/](?:user-memory|conversation-history)\.json$/iu.test(path);
}
function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
