import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findModelFallbackViolations } from "./verify-no-model-fallback.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const lesson = "lesson-08-multi-agent-workflow-openrouter";
const sourcePrefix = "lesson-07-agent-loop-openrouter/solution/";
const sourceExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const copyExtensions = new Set([...sourceExtensions, ".json", ".md", ".txt"]);
const integrationFiles = new Set(["README.md", "src/app.ts", "src/runtime.ts", "src/server.ts"]);
const requiredFiles = [
  "src/services/report-workflow.ts",
  "src/services/openrouter-report-workers.ts",
  "src/demo-report-workflow.ts",
  "evals/report-workflow-cases.ts",
  "evals/evaluate-report-workflow.ts",
  "evals/run-report-workflow.ts",
  "scripts/smoke-report-workflow-api.ts",
  "tests/report-workflow.test.ts",
  "tests/openrouter-report-workers.test.ts",
  "tests/report-workflow-app.test.ts",
  "tests/report-workflow-evals.test.ts",
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

export async function inspectLesson08OpenRouterCandidate(candidateRoot: string): Promise<string[]> {
  const root = resolve(repositoryRoot, candidateRoot);
  if (!isWithin(repositoryRoot, root))
    return ["Lesson 08 completion candidate must stay inside this repository."];
  const entries = await listCandidateFiles(root, root);
  const byPath = new Map(entries.map((entry) => [entry.relativePath, entry]));
  const failures: string[] = [];
  const inheritedFiles = trackedSolutionFiles();

  if (!inheritedFiles.includes("README.md") || inheritedFiles.length === 0) {
    failures.push("Git-tracked Lesson 07 solution manifest is empty or missing README.md.");
  }
  for (const entry of entries) {
    if (entry.symlink) failures.push(`candidate paths must not be symlinks: ${entry.relativePath}`);
    if (entry.relativePath.split("/").some((part) => /^\.env(?:\.|$)/iu.test(part))) {
      failures.push(`credential configuration is not accepted: ${entry.relativePath}`);
    }
  }
  for (const path of inheritedFiles) {
    if (integrationFiles.has(path)) continue;
    const entry = byPath.get(path);
    if (entry === undefined) {
      failures.push(`missing inherited Lesson 07 foundation file: ${path}`);
      continue;
    }
    if (entry.symlink) continue;
    const source = await readFile(resolve(repositoryRoot, `${sourcePrefix}${path}`));
    const candidate = await readFile(entry.absolutePath);
    if (!source.equals(candidate))
      failures.push(`source-bound Lesson 07 foundation drift: ${path}`);
  }
  for (const path of requiredFiles) {
    if (!byPath.has(path)) failures.push(`missing required Lesson 08 implementation: ${path}`);
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
    if (
      /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["'][^"']*lesson-\d{2}[^"']*\/(?:starter|solution)\//iu.test(
        source,
      )
    ) {
      failures.push(`${entry.relativePath} imports a canonical lesson starter or solution.`);
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
    throw new Error("Lesson 08 completion target must be a real directory.");
  }
  const failures = await inspectLesson08OpenRouterCandidate(candidateRoot);
  if (failures.length > 0) {
    console.error(
      `Lesson 08 OpenRouter completion failed for ${relativeCandidateRoot}: ${failures.length} issue(s).`,
    );
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  const safeEnv = withoutProviderCredentials(process.env);
  const vitestCli = resolve(repositoryRoot, "node_modules", "vitest", "vitest.mjs");
  const candidateOutput = runCommand(
    [process.execPath, vitestCli, "run", "--root", candidateRoot, "--dir", "tests"],
    candidateRoot,
    safeEnv,
    "Lesson 08 candidate tests",
  );
  const candidatePassed = getCleanVitestPassCount(candidateOutput, "Lesson 08 candidate tests", 1);

  const solutionTestRoot = resolve(repositoryRoot, lesson, "solution", "tests");
  const solutionTests = (await listCandidateFiles(solutionTestRoot, solutionTestRoot)).filter(
    (entry) => /\.test\.tsx?$/u.test(entry.relativePath),
  );
  const activeCanonicalTests = await countActiveTests(solutionTests);
  if (solutionTests.length === 0 || activeCanonicalTests === 0) {
    throw new Error("Lesson 08 canonical solution test oracle is empty.");
  }

  const tempRoot = resolve(repositoryRoot, ".tmp", "lesson08-openrouter-completion");
  await mkdir(tempRoot, { recursive: true });
  const fixtureRoot = await mkdtemp(resolve(tempRoot, "candidate-"));
  assertContained(await realpath(tempRoot), await realpath(fixtureRoot));
  let canonicalPassed = 0;
  try {
    const acceptanceRoot = resolve(fixtureRoot, "acceptance");
    for (const directory of ["src", "data", "evals", "sandbox"]) {
      await copySafeTree(resolve(candidateRoot, directory), resolve(acceptanceRoot, directory));
    }
    for (const entry of solutionTests) {
      const target = resolve(acceptanceRoot, "tests", entry.relativePath);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(entry.absolutePath, target);
    }
    const output = runCommand(
      [process.execPath, vitestCli, "run", "--root", acceptanceRoot, "--dir", "tests"],
      acceptanceRoot,
      safeEnv,
      "Lesson 08 source-rebound canonical acceptance tests",
    );
    canonicalPassed = getCleanVitestPassCount(
      output,
      "Lesson 08 source-rebound canonical acceptance tests",
      activeCanonicalTests,
    );
  } finally {
    assertContained(await realpath(tempRoot), await realpath(fixtureRoot));
    await rm(fixtureRoot, { recursive: true, force: true });
  }

  const inheritedEval = runCandidateTsx(candidateRoot, "evals/run.ts", safeEnv);
  requireEvalSummary(inheritedEval, "Lesson 08 inherited eval");
  const agentLoopEval = runCandidateTsx(candidateRoot, "evals/run-agent-loop.ts", safeEnv);
  requireExactEvalSummary(agentLoopEval, 7, "Lesson 07 Agent Loop eval");
  const workflowEval = runCandidateTsx(candidateRoot, "evals/run-report-workflow.ts", safeEnv);
  requireExactEvalSummary(workflowEval, 6, "Lesson 08 Report Workflow eval");
  const smoke = runCandidateTsx(candidateRoot, "scripts/smoke-report-workflow-api.ts", safeEnv);
  if (!smoke.includes("PASS Lesson 08 local smoke")) {
    throw new Error("Lesson 08 candidate local HTTP smoke did not report PASS.");
  }

  console.log(
    `PASS Lesson 08 OpenRouter completion: ${candidatePassed} candidate tests, ` +
      `${canonicalPassed} source-rebound canonical tests, inherited eval, 7/7 Agent Loop, ` +
      `6/6 Report Workflow eval, and local HTTP smoke against ${relativeCandidateRoot}.`,
  );
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
    if (entry.name.startsWith(".")) continue;
    await copySafeTree(resolve(source, entry.name), resolve(destination, entry.name));
  }
}

function runCandidateTsx(
  candidateRoot: string,
  relativeEntrypoint: string,
  env: NodeJS.ProcessEnv,
): string {
  return runCommand(
    [
      process.execPath,
      resolve(repositoryRoot, "scripts", "run-tsx-entrypoint.mjs"),
      resolve(candidateRoot, relativeEntrypoint),
    ],
    repositoryRoot,
    env,
    relativeEntrypoint,
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
    if (/(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH|OPENROUTER|OPENAI)/iu.test(key)) {
      delete result[key];
    }
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
  if (process.argv.length > 3) {
    throw new Error("Usage: verify-lesson08-openrouter-completion.ts [candidate-lesson-root]");
  }
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
    console.error(error instanceof Error ? error.message : "Lesson 08 completion failed.");
    process.exitCode = 1;
  });
}
