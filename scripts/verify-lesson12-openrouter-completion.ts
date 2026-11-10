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
import { fileURLToPath, pathToFileURL } from "node:url";
import { findModelFallbackViolations } from "./verify-no-model-fallback.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const lesson = "lesson-12-security-openrouter";
const previousLesson = "lesson-11-evals-observability-openrouter";
const sourcePrefix = `${previousLesson}/solution/`;
const foundationExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const copyExtensions = new Set([...foundationExtensions, ".json", ".md", ".txt"]);
const generatedDirectories = new Set(["node_modules", "dist", "coverage"]);
const canonicalTests = [
  "tests/security.test.ts",
  "tests/security-evals.test.ts",
  "tests/security-live-contract.test.ts",
  "tests/security-catalog.test.ts",
] as const;
const lessonDelta = new Set([
  "src/security.ts",
  "src/secure-content-review-agent.ts",
  "src/demo-security.ts",
  "scripts/run-security-live-demo.ts",
  "scripts/verify-security-catalog.ts",
  "evals/security-cases.ts",
  "evals/security-runner.ts",
  "evals/run-security.ts",
  "evals/run-security-live.ts",
  ...canonicalTests,
]);
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

interface CandidateFile {
  absolutePath: string;
  relativePath: string;
  symlink: boolean;
}

export async function inspectLesson12OpenRouterCandidate(candidateRoot: string): Promise<string[]> {
  const root = resolve(repositoryRoot, candidateRoot);
  if (!isWithin(repositoryRoot, root))
    return ["Lesson 12 completion candidate must stay inside this repository."];
  const metadata = await lstat(root).catch((error: unknown) =>
    isMissing(error) ? undefined : Promise.reject(error),
  );
  if (metadata === undefined) return ["Lesson 12 completion candidate does not exist."];
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    return ["Lesson 12 completion target must be a real directory."];
  const [repositoryRealPath, candidateRealPath] = await Promise.all([
    realpath(repositoryRoot),
    realpath(root).catch((error: unknown) =>
      isMissing(error) ? undefined : Promise.reject(error),
    ),
  ]);
  if (candidateRealPath === undefined) return ["Lesson 12 completion candidate does not exist."];
  if (!isWithinResolvedRoot(repositoryRealPath, candidateRealPath))
    return ["Lesson 12 completion candidate real path must stay inside this repository."];

  const files = await listCandidateFiles(root, root);
  const byPath = new Map(files.map((entry) => [entry.relativePath, entry]));
  const failures: string[] = [];
  const foundation = trackedFoundationFiles();
  if (!byPath.has("README.md"))
    failures.push("Lesson 12 completion candidate root README.md is required.");
  if (foundation.length !== 157)
    failures.push(
      `Git-tracked Lesson 11 foundation must contain 157 files, found ${foundation.length}.`,
    );

  for (const entry of files) {
    if (entry.symlink) failures.push(`candidate paths must not be symlinks: ${entry.relativePath}`);
    if (entry.relativePath.split("/").some((part) => /^\.env(?:\.|$)/iu.test(part)))
      failures.push(`credential configuration is not accepted: ${entry.relativePath}`);
  }
  for (const path of foundation) {
    const entry = byPath.get(path);
    if (entry === undefined) {
      failures.push(`missing inherited Lesson 11 foundation file: ${path}`);
      continue;
    }
    if (entry.symlink) continue;
    const [source, candidate] = await Promise.all([
      readFile(resolve(repositoryRoot, `${sourcePrefix}${path}`)),
      readFile(entry.absolutePath),
    ]);
    if (!source.equals(candidate))
      failures.push(`source-bound Lesson 11 foundation drift: ${path}`);
  }
  for (const path of lessonDelta)
    if (!byPath.has(path)) failures.push(`missing required Lesson 12 implementation: ${path}`);
  const expectedFiles = new Set(["README.md", ".course-state.json", ...foundation, ...lessonDelta]);
  for (const entry of files)
    if (!expectedFiles.has(entry.relativePath))
      failures.push(`unaccounted Lesson 12 candidate file: ${entry.relativePath}`);

  for (const entry of files.filter((item) =>
    foundationExtensions.has(extname(item.relativePath)),
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
  for (const violation of findModelFallbackViolations(root))
    failures.push(
      `${violation.file}:${violation.line} violates the one-model contract (${violation.rule}).`,
    );
  return failures;
}

export async function verifyLesson12Completion(candidateInput: string): Promise<void> {
  const candidateRoot = resolve(repositoryRoot, candidateInput);
  const relativeCandidate = portable(relative(repositoryRoot, candidateRoot));
  const failures = await inspectLesson12OpenRouterCandidate(candidateRoot);
  if (failures.length > 0) {
    console.error(
      `Lesson 12 OpenRouter completion failed for ${relativeCandidate}: ${failures.length} issue(s).`,
    );
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  const safeEnvironment = withoutProviderCredentials(process.env);
  const vitestCli = resolve(repositoryRoot, "node_modules", "vitest", "vitest.mjs");
  const tempRoot = resolve(repositoryRoot, ".tmp", "lesson12-openrouter-completion");
  await mkdir(tempRoot, { recursive: true });
  const fixtureRoot = await mkdtemp(resolve(tempRoot, "candidate-"));
  assertContained(await realpath(tempRoot), await realpath(fixtureRoot));
  let candidatePassed = 0;
  let canonicalPassed = 0;
  try {
    const fixtureRepository = resolve(fixtureRoot, "repo");
    const fixtureCandidate = resolve(fixtureRepository, "dev", lesson);
    await createFixturePackageBoundary(fixtureRepository);
    await copySafeTree(candidateRoot, fixtureCandidate);
    await copyPreviousDependencies(fixtureRepository);

    const canonicalOracleRoot = resolve(fixtureRepository, "dev", "lesson12-acceptance");
    for (const directory of ["src", "data", "evals", "sandbox", "scripts", "README.md"]) {
      await copySafeTree(
        resolve(candidateRoot, directory),
        resolve(canonicalOracleRoot, directory),
      );
    }
    for (const path of canonicalTests) {
      const source = resolve(repositoryRoot, lesson, "solution", path);
      const destination = resolve(canonicalOracleRoot, path);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(source, destination);
    }

    const canonicalTestCount = await countActiveTests(
      canonicalTests.map((path) => ({
        absolutePath: resolve(repositoryRoot, lesson, "solution", path),
        relativePath: path,
        symlink: false,
      })),
    );
    if (canonicalTestCount !== 16)
      throw new Error(
        `Four source-rebound Lesson 12 tests must contain 16 active cases; found ${canonicalTestCount}.`,
      );
    candidatePassed = getCleanVitestPassCount(
      runCommand(
        [process.execPath, vitestCli, "run", "--root", fixtureCandidate, "--dir", "tests"],
        fixtureCandidate,
        safeEnvironment,
        "Lesson 12 candidate tests",
      ),
      "Lesson 12 candidate tests",
      367,
    );
    canonicalPassed = getCleanVitestPassCount(
      runCommand(
        [process.execPath, vitestCli, "run", "--root", canonicalOracleRoot, "--dir", "tests"],
        canonicalOracleRoot,
        safeEnvironment,
        "Lesson 12 source-rebound canonical tests",
      ),
      "Lesson 12 source-rebound canonical tests",
      16,
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
    const smoke = runCandidateTsx(
      fixtureCandidate,
      "scripts/smoke-content-review-graph.ts",
      safeEnvironment,
    );
    for (const marker of [
      "PASS health=200",
      "PASS invalid-input=400",
      "PASS start (202 approval_required) -> decision resume (200 completed/approved)",
    ]) {
      if (!smoke.includes(marker))
        throw new Error(`Inherited local HTTP smoke did not report ${marker}.`);
    }
  } finally {
    assertContained(await realpath(tempRoot), await realpath(fixtureRoot));
    await rm(fixtureRoot, { recursive: true, force: true });
  }
  console.log(
    `PASS Lesson 12 OpenRouter completion: ${candidatePassed} candidate tests, ${canonicalPassed} source-rebound canonical tests, 29 inherited eval cases, two 12-case offline profiles, baseline 12/12 plus security 12/12 offline eval, and local HTTP health/input/approval smoke against ${relativeCandidate}.`,
  );
}

export function requireSecurityEvalSummary(output: string): void {
  if (
    !/^Baseline:\s*12\s*\/\s*12\s*passed(?:,|\.)/mu.test(output) ||
    !/^Security:\s*12\s*\/\s*12\s*passed(?:,|\.)/mu.test(output)
  )
    throw new Error(
      "Offline security eval must pass the inherited 12-case baseline and all 12 security cases.",
    );
}

export async function createFixturePackageBoundary(fixtureRepository: string): Promise<void> {
  await mkdir(fixtureRepository, { recursive: true });
  await writeFile(
    resolve(fixtureRepository, "package.json"),
    `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`,
    "utf8",
  );
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
function runInheritedEvals(candidateRoot: string, environment: NodeJS.ProcessEnv): number {
  const entries: Array<[string, string[]]> = [
    ["evals/run.ts", []],
    ["evals/run-agent-loop.ts", []],
    ["evals/run-report-workflow.ts", []],
    ["evals/run-agents-sdk.ts", []],
    ["evals/run-content-review.ts", []],
  ];
  const outputs = entries.map(([entrypoint, args]) =>
    runCandidateTsx(candidateRoot, entrypoint, environment, args),
  );
  let total = 0;
  for (const [index, output] of outputs.entries()) {
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
    throw new Error("Lesson 11 offline observability eval must include its complete table header.");
  const header = rows[headerIndex]!;
  const indexOf = (name: string) => header.indexOf(name);
  const profiles = new Map<string, string[]>();
  for (const cells of rows.slice(headerIndex + 1)) {
    const profile = cells[indexOf("configuration")];
    if (profile !== "'fast'" && profile !== "'main'") continue;
    if (profiles.has(profile))
      throw new Error("Lesson 11 offline observability eval must report each profile once.");
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
    throw new Error(
      "Lesson 11 offline observability eval must pass 12/12 cases in both fast and main profiles.",
    );
}
async function copyPreviousDependencies(fixtureRepository: string): Promise<void> {
  for (let number = 3; number <= 11; number += 1) {
    const prefix = `lesson-${String(number).padStart(2, "0")}-`;
    const lessonDirectory = number === 11 ? previousLesson : trackedLessonDirectory(number, prefix);
    if (lessonDirectory === undefined) continue;
    await copySafeTree(
      resolve(repositoryRoot, lessonDirectory, "solution", "src"),
      resolve(fixtureRepository, lessonDirectory, "solution", "src"),
    );
    await copySafeTree(
      resolve(repositoryRoot, lessonDirectory, "solution", "data"),
      resolve(fixtureRepository, lessonDirectory, "solution", "data"),
    );
  }
}
function trackedLessonDirectory(number: number, prefix: string): string | undefined {
  const output = execFileSync("git", ["ls-files", "--", `${prefix}*openrouter/solution/src`], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return output
    .split(/\r?\n/u)
    .map((path) => path.split("/")[0]!)
    .find((path) => path.startsWith(prefix));
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
async function listCandidateFiles(root: string, baseRoot: string): Promise<CandidateFile[]> {
  const metadata = await lstat(root).catch((error: unknown) =>
    isMissing(error) ? undefined : Promise.reject(error),
  );
  if (metadata === undefined) return [];
  if (metadata.isSymbolicLink())
    return [
      { absolutePath: root, relativePath: portable(relative(baseRoot, root)), symlink: true },
    ];
  if (metadata.isFile())
    return isRuntimeData(root)
      ? []
      : [{ absolutePath: root, relativePath: portable(relative(baseRoot, root)), symlink: false }];
  if (!metadata.isDirectory()) return [];
  const files: CandidateFile[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (generatedDirectories.has(entry.name)) continue;
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...(await listCandidateFiles(path, baseRoot)));
    else if (entry.isFile() || entry.isSymbolicLink())
      if (!isRuntimeData(path))
        files.push({
          absolutePath: path,
          relativePath: portable(relative(baseRoot, path)),
          symlink: entry.isSymbolicLink(),
        });
  }
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
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
  if (output.length > 0) process.stdout.write(output);
  if (result.error) throw new Error(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(`${label} failed with exit code ${String(result.status)}.`);
  return output;
}
function getCleanVitestPassCount(output: string, label: string, minimum: number): number {
  const summary = output.match(/\bTests\s+([^\r\n]*\(\d+\))/u)?.[1];
  if (!summary) throw new Error(`${label} did not report a Vitest test summary.`);
  const count = (expression: RegExp): number =>
    [...summary.matchAll(expression)].reduce((total, match) => total + Number(match[1]), 0);
  const passed = count(/(\d+)\s+passed\b/gu);
  const todo = count(/(\d+)\s+todo\b/giu);
  const skipped = count(/(\d+)\s+skipped\b/giu);
  if (passed < minimum || todo > 0 || skipped > 0)
    throw new Error(`${label} requires >=${minimum} passed and zero todo/skipped; ${summary}.`);
  return passed;
}
function withoutProviderCredentials(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const result = { ...environment };
  for (const key of Object.keys(result))
    if (/(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH|OPENROUTER|OPENAI)/iu.test(key))
      delete result[key];
  return result;
}
function assertContained(parent: string, child: string): void {
  if (!isWithin(parent, child))
    throw new Error("Completion fixture escaped its guarded scratch root.");
}
function isWithin(parent: string, child: string): boolean {
  const path = relative(resolve(parent), resolve(child));
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}
export function isWithinResolvedRoot(repositoryPath: string, candidatePath: string): boolean {
  return isWithin(repositoryPath, candidatePath);
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
async function main(): Promise<void> {
  const candidate = process.argv[2] ?? `${lesson}/solution`;
  if (process.argv.length > 3)
    throw new Error("Usage: verify-lesson12-openrouter-completion.ts [candidate-root]");
  await verifyLesson12Completion(candidate);
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
    console.error(error instanceof Error ? error.message : "Lesson 12 completion failed.");
    process.exitCode = 1;
  });
