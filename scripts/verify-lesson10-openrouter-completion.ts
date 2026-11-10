import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findModelFallbackViolations } from "./verify-no-model-fallback.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const lesson = "lesson-10-langgraph-openrouter";
const previousLesson = "lesson-09-openai-agents-sdk-openrouter";
const sourcePrefix = `${previousLesson}/solution/`;
const sourceExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const copyExtensions = new Set([...sourceExtensions, ".json", ".md", ".txt"]);
const integrationFiles = new Set(["src/app.ts", "src/runtime.ts", "src/server.ts"]);
const expectedIntegrationImports = new Map<string, ReadonlySet<string>>([
  ["src/app.ts", new Set([previousLesson])],
  ["src/runtime.ts", new Set([previousLesson])],
  ["src/server.ts", new Set([previousLesson, "lesson-03-function-calling-openrouter"])],
]);
const lesson10Files = [
  "src/services/content-review-graph.ts",
  "src/services/openrouter-draft-generator.ts",
  "src/services/high-level-agent-example.ts",
  "src/testing/scripted-draft-generator.ts",
  "src/demo-content-review.ts",
  "tests/content-review-graph.test.ts",
  "tests/openrouter-draft-generator.test.ts",
  "tests/content-review-app.test.ts",
  "tests/content-review-evals.test.ts",
  "tests/content-review-live-eval.test.ts",
  "tests/openrouter-content-review-model.test.ts",
  "evals/content-review-dataset.ts",
  "evals/evaluate-content-review.ts",
  "evals/run-content-review.ts",
  "evals/live-content-review.ts",
  "evals/live-content-review-application.ts",
  "scripts/smoke-content-review-graph.ts",
  "scripts/run-content-review-live-demo.ts",
  "scripts/verify-content-review-catalog.ts",
] as const;
const activeTestPattern = /\b(?:it|test)(?:\.(?:each|for|runIf|skipIf))?\s*\(/gu;
const incompletePatterns = [
  { label: "todo test", pattern: /\b(?:describe|it|test)\.(?:todo|todoIf)\s*\(/u },
  {
    label: "skipped or conditional test",
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

export async function inspectLesson10OpenRouterCandidate(candidateRoot: string): Promise<string[]> {
  const root = resolve(repositoryRoot, candidateRoot);
  if (!isWithin(repositoryRoot, root)) {
    return ["Lesson 10 completion candidate must stay inside this repository."];
  }

  const entries = await listCandidateFiles(root, root);
  const byPath = new Map(entries.map((entry) => [entry.relativePath, entry]));
  const failures: string[] = [];
  const inheritedFiles = trackedSolutionFiles();
  const inheritedFoundation = inheritedFiles.filter((path) => path !== "README.md");

  if (inheritedFoundation.length !== 112) {
    failures.push(
      `Git-tracked Lesson 09 foundation manifest must contain 112 files, found ${inheritedFoundation.length}.`,
    );
  }
  for (const entry of entries) {
    if (entry.symlink) failures.push(`candidate paths must not be symlinks: ${entry.relativePath}`);
    if (entry.relativePath.split("/").some((part) => /^\.env(?:\.|$)/iu.test(part))) {
      failures.push(`credential configuration is not accepted: ${entry.relativePath}`);
    }
  }

  for (const path of inheritedFoundation) {
    if (integrationFiles.has(path)) continue;
    const entry = byPath.get(path);
    if (entry === undefined) {
      failures.push(`missing inherited Lesson 09 foundation file: ${path}`);
      continue;
    }
    if (entry.symlink) continue;
    const source = await readFile(resolve(repositoryRoot, `${sourcePrefix}${path}`));
    const candidate = await readFile(entry.absolutePath);
    if (!source.equals(candidate))
      failures.push(`source-bound Lesson 09 foundation drift: ${path}`);
  }

  for (const path of integrationFiles) {
    if (!byPath.has(path)) failures.push(`missing Lesson 10 integration file: ${path}`);
  }
  for (const path of lesson10Files) {
    if (!byPath.has(path)) failures.push(`missing required Lesson 10 implementation: ${path}`);
  }

  const expectedFiles = new Set([
    "README.md",
    ...inheritedFoundation,
    ...integrationFiles,
    ...lesson10Files,
  ]);
  for (const entry of entries) {
    if (!expectedFiles.has(entry.relativePath)) {
      failures.push(`unaccounted Lesson 10 candidate file: ${entry.relativePath}`);
    }
  }

  let activeTests = 0;
  for (const entry of entries.filter((item) => sourceExtensions.has(extname(item.relativePath)))) {
    if (entry.symlink) continue;
    const source = await readFile(entry.absolutePath, "utf8");
    for (const [lineIndex, line] of source.split(/\r?\n/u).entries()) {
      for (const marker of incompletePatterns) {
        if (marker.pattern.test(line)) {
          failures.push(`${entry.relativePath}:${lineIndex + 1} contains ${marker.label}.`);
        }
        marker.pattern.lastIndex = 0;
      }
    }
    if (entry.relativePath.startsWith("tests/") && /\.test\.tsx?$/u.test(entry.relativePath)) {
      activeTests += [...source.matchAll(activeTestPattern)].length;
    }
    const importedLessons = [
      ...source.matchAll(
        /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["'][^"']*?(lesson-\d{2}-[a-z0-9-]+)\/\s*(?:starter|solution)\//giu,
      ),
    ].map((match) => match[1]!);
    for (const importedLesson of importedLessons) {
      if (!expectedIntegrationImports.get(entry.relativePath)?.has(importedLesson)) {
        failures.push(
          `${entry.relativePath} imports an unapproved canonical lesson path: ${importedLesson}.`,
        );
      }
    }
    if (/(?:^|["'`/])(?:my-dev|dev)\/lesson-/iu.test(source)) {
      failures.push(`${entry.relativePath} imports a development workspace path.`);
    }
  }
  for (const violation of findModelFallbackViolations(root)) {
    failures.push(
      `${violation.file}:${violation.line} violates the one-model contract (${violation.rule}).`,
    );
  }
  if (activeTests === 0) failures.push("candidate must contain active tests.");
  return failures;
}

async function verifyCompletion(candidateInput: string): Promise<void> {
  const candidateRoot = resolve(repositoryRoot, candidateInput);
  const relativeCandidateRoot = relative(repositoryRoot, candidateRoot).replaceAll("\\", "/");
  if (!isWithin(repositoryRoot, candidateRoot))
    throw new Error("Candidate must stay in the repository.");
  const rootMetadata = await lstat(candidateRoot);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new Error("Lesson 10 completion target must be a real directory.");
  }
  const failures = await inspectLesson10OpenRouterCandidate(candidateRoot);
  if (failures.length > 0) {
    console.error(
      `Lesson 10 OpenRouter completion failed for ${relativeCandidateRoot}: ${failures.length} issue(s).`,
    );
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  const safeEnv = withoutProviderCredentials(process.env);
  const vitestCli = resolve(repositoryRoot, "node_modules", "vitest", "vitest.mjs");
  const tempRoot = resolve(repositoryRoot, ".tmp", "lesson10-openrouter-completion");
  await mkdir(tempRoot, { recursive: true });
  const fixtureRoot = await mkdtemp(resolve(tempRoot, "candidate-"));
  assertContained(await realpath(tempRoot), await realpath(fixtureRoot));
  let candidatePassed = 0;
  let canonicalPassed = 0;
  try {
    const fixtureRepository = resolve(fixtureRoot, "repo");
    const fixtureCandidate = resolve(fixtureRepository, "my-dev", lesson);
    for (const directory of ["src", "data", "evals", "sandbox", "tests", "scripts", "README.md"]) {
      await copySafeTree(resolve(candidateRoot, directory), resolve(fixtureCandidate, directory));
    }
    await copyPreviousDependencies(fixtureRepository);
    candidatePassed = getCleanVitestPassCount(
      runCommand(
        [process.execPath, vitestCli, "run", "--root", fixtureCandidate, "--dir", "tests"],
        fixtureCandidate,
        safeEnv,
        "Lesson 10 candidate tests",
      ),
      "Lesson 10 candidate tests",
      1,
    );

    const solutionTestRoot = resolve(repositoryRoot, lesson, "solution", "tests");
    const solutionTests = (await listCandidateFiles(solutionTestRoot, solutionTestRoot)).filter(
      (entry) => /\.test\.tsx?$/u.test(entry.relativePath),
    );
    const activeCanonicalTests = await countActiveTests(solutionTests);
    if (solutionTests.length === 0 || activeCanonicalTests === 0) {
      throw new Error("Lesson 10 canonical solution test oracle is empty.");
    }
    const acceptanceRoot = resolve(fixtureRepository, "my-dev", "lesson10-acceptance");
    for (const directory of ["src", "data", "evals", "sandbox"]) {
      await copySafeTree(resolve(candidateRoot, directory), resolve(acceptanceRoot, directory));
    }
    for (const entry of solutionTests) {
      const target = resolve(acceptanceRoot, "tests", entry.relativePath);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(entry.absolutePath, target);
    }
    canonicalPassed = getCleanVitestPassCount(
      runCommand(
        [process.execPath, vitestCli, "run", "--root", acceptanceRoot, "--dir", "tests"],
        acceptanceRoot,
        safeEnv,
        "Lesson 10 source-rebound canonical acceptance tests",
      ),
      "Lesson 10 source-rebound canonical acceptance tests",
      activeCanonicalTests,
    );

    runInheritedEvals(fixtureCandidate, safeEnv);
    const graphEval = runCandidateTsx(fixtureCandidate, "evals/run-content-review.ts", safeEnv);
    requireEvalSummary(graphEval, "Lesson 10 Content Review graph eval");
    const smoke = runCandidateTsx(
      fixtureCandidate,
      "scripts/smoke-content-review-graph.ts",
      safeEnv,
    );
    if (
      !smoke.includes(
        "PASS start (202 approval_required) -> decision resume (200 completed/approved)",
      )
    ) {
      throw new Error("Lesson 10 candidate local graph HTTP smoke did not report PASS.");
    }
  } finally {
    assertContained(await realpath(tempRoot), await realpath(fixtureRoot));
    await rm(fixtureRoot, { recursive: true, force: true });
  }

  console.log(
    `PASS Lesson 10 OpenRouter completion: ${candidatePassed} candidate tests, ` +
      `${canonicalPassed} source-rebound canonical tests, inherited SDK evals, Content Review graph eval, ` +
      `and local HTTP smoke against ${relativeCandidateRoot}.`,
  );
}

function runInheritedEvals(candidateRoot: string, env: NodeJS.ProcessEnv): void {
  requireEvalSummary(
    runCandidateTsx(candidateRoot, "evals/run.ts", env),
    "Inherited Lesson 08 eval",
  );
  requireExactEvalSummary(
    runCandidateTsx(candidateRoot, "evals/run-agent-loop.ts", env),
    7,
    "Lesson 07 Agent Loop eval",
  );
  requireExactEvalSummary(
    runCandidateTsx(candidateRoot, "evals/run-report-workflow.ts", env),
    6,
    "Lesson 08 Report Workflow eval",
  );
  requireEvalSummary(
    runCandidateTsx(candidateRoot, "evals/run-agents-sdk.ts", env),
    "Lesson 09 Agents SDK eval",
  );
}

async function copyPreviousDependencies(fixtureRepository: string): Promise<void> {
  for (let number = 3; number <= 9; number += 1) {
    const prefix = `lesson-${String(number).padStart(2, "0")}-`;
    const directory = number === 9 ? previousLesson : trackedLessonDirectory(number, prefix);
    if (!directory) continue;
    await copySafeTree(
      resolve(repositoryRoot, directory, "solution", "src"),
      resolve(fixtureRepository, directory, "solution", "src"),
    );
    await copySafeTree(
      resolve(repositoryRoot, directory, "solution", "data"),
      resolve(fixtureRepository, directory, "solution", "data"),
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

function trackedSolutionFiles(): string[] {
  return execFileSync("git", ["ls-files", "--", sourcePrefix.slice(0, -1)], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split(/\r?\n/u)
    .filter((path) => path.startsWith(sourcePrefix))
    .map((path) => path.slice(sourcePrefix.length));
}

async function countActiveTests(entries: CandidateFile[]): Promise<number> {
  let count = 0;
  for (const entry of entries) {
    if (entry.symlink) throw new Error(`Canonical test is a symlink: ${entry.relativePath}`);
    const source = await readFile(entry.absolutePath, "utf8");
    count += [...source.matchAll(activeTestPattern)].length;
    if (incompletePatterns.slice(0, 2).some((marker) => marker.pattern.test(source))) {
      throw new Error(`Canonical acceptance test is incomplete: ${entry.relativePath}`);
    }
  }
  return count;
}

interface CandidateFile {
  absolutePath: string;
  relativePath: string;
  symlink: boolean;
}

async function listCandidateFiles(root: string, baseRoot: string): Promise<CandidateFile[]> {
  const metadata = await lstat(root).catch((error: unknown) => {
    if (isMissing(error)) return undefined;
    throw error;
  });
  if (metadata === undefined) return [];
  if (metadata.isSymbolicLink()) {
    return [
      { absolutePath: root, relativePath: toPortablePath(relative(baseRoot, root)), symlink: true },
    ];
  }
  if (metadata.isFile()) {
    if (isRuntimeData(root)) return [];
    return [
      {
        absolutePath: root,
        relativePath: toPortablePath(relative(baseRoot, root)),
        symlink: false,
      },
    ];
  }
  if (!metadata.isDirectory()) return [];
  const files: CandidateFile[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (generatedDirectories.has(entry.name)) continue;
    if (/^\.env(?:\.|$)/iu.test(entry.name)) {
      files.push({
        absolutePath: path,
        relativePath: toPortablePath(relative(baseRoot, path)),
        symlink: false,
      });
      continue;
    }
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) files.push(...(await listCandidateFiles(path, baseRoot)));
    else if (entry.isFile() || entry.isSymbolicLink()) {
      if (isRuntimeData(path)) continue;
      files.push({
        absolutePath: path,
        relativePath: toPortablePath(relative(baseRoot, path)),
        symlink: entry.isSymbolicLink(),
      });
    }
  }
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

const generatedDirectories = new Set(["node_modules", "dist", "coverage"]);

async function copySafeTree(source: string, destination: string): Promise<void> {
  const metadata = await lstat(source).catch((error: unknown) => {
    if (isMissing(error)) return undefined;
    throw error;
  });
  if (metadata === undefined) return;
  if (metadata.isSymbolicLink()) throw new Error(`Refusing to copy symlink ${source}.`);
  if (metadata.isFile()) {
    if (
      isRuntimeData(source) ||
      /^\.env(?:\.|$)/iu.test(basename(source)) ||
      !copyExtensions.has(extname(source))
    )
      return;
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
    return;
  }
  if (!metadata.isDirectory() || basename(source).startsWith(".")) return;
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || generatedDirectories.has(entry.name)) continue;
    await copySafeTree(resolve(source, entry.name), resolve(destination, entry.name));
  }
}

function runCandidateTsx(
  candidateRoot: string,
  entrypoint: string,
  env: NodeJS.ProcessEnv,
): string {
  return runCommand(
    [
      process.execPath,
      resolve(repositoryRoot, "scripts", "run-tsx-entrypoint.mjs"),
      resolve(candidateRoot, entrypoint),
    ],
    candidateRoot,
    env,
    entrypoint,
  );
}

function runCommand(args: string[], cwd: string, env: NodeJS.ProcessEnv, label: string): string {
  const result = spawnSync(args[0]!, args.slice(1), {
    cwd,
    encoding: "utf8",
    env,
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
  if (passed < minimum || todo > 0 || skipped > 0) {
    throw new Error(`${label} requires >=${minimum} passed with zero todo/skipped; ${summary}.`);
  }
  return passed;
}

function requireEvalSummary(output: string, label: string): void {
  if (!/\bResult:\s*\d+\/\d+\b/u.test(output)) throw new Error(`${label} did not report a result.`);
}

function requireExactEvalSummary(output: string, expected: number, label: string): void {
  if (!new RegExp(`\\bResult:\\s*${expected}/${expected}\\b`, "u").test(output)) {
    throw new Error(`${label} must pass ${expected}/${expected} cases.`);
  }
}

function withoutProviderCredentials(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const result = { ...environment };
  for (const key of Object.keys(result)) {
    if (/(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH|OPENROUTER|OPENAI)/iu.test(key))
      delete result[key];
  }
  return result;
}

function isRuntimeData(path: string): boolean {
  return /(?:^|[\\/])data[\\/](?:user-memory|conversation-history)\.json$/iu.test(path);
}

function isWithin(parent: string, child: string): boolean {
  const path = relative(resolve(parent), resolve(child));
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

function assertContained(parent: string, child: string): void {
  if (!isWithin(parent, child))
    throw new Error("Completion fixture escaped its guarded scratch root.");
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function toPortablePath(path: string): string {
  return path.replaceAll("\\", "/");
}

async function main(): Promise<void> {
  const candidate = process.argv[2] ?? `${lesson}/starter`;
  if (process.argv.length > 3)
    throw new Error("Usage: verify-lesson10-openrouter-completion.ts [candidate-lesson-root]");
  await verifyCompletion(candidate);
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
    console.error(error instanceof Error ? error.message : "Lesson 10 completion failed.");
    process.exitCode = 1;
  });
}
