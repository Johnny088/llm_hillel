import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { findModelFallbackViolations } from "./verify-no-model-fallback.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const inheritedPrefix = "lesson-06-rag-openrouter/solution/";
const sourceExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const allowedCopyExtensions = new Set([...sourceExtensions, ".json", ".md", ".txt"]);
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
    pattern:
      /(?:\.status\s*\(\s*501\b|\bsendStatus\s*\(\s*501\b|\bstatus(?:Code)?\s*:\s*501\b|\bHTTP_(?:STATUS_)?NOT_IMPLEMENTED\b)/u,
  },
];
const requiredCandidateFiles = [
  "src/app.ts",
  "src/server.ts",
  "src/runtime.ts",
  "src/services/agent-loop.ts",
  "src/services/conversation-manager.ts",
  "src/services/rag-assistant.ts",
  "src/config/agent-model.ts",
  "src/config/openrouter.ts",
  "src/tools/course-knowledge.ts",
  "src/memory/conversation-history.ts",
  "src/memory/user-facts.ts",
  "data/prepared-index.ts",
  "evals/run.ts",
  "evals/cases.ts",
  "evals/evaluate-agent-loop.ts",
  "evals/run-agent-loop.ts",
  "tests/app.test.ts",
  "tests/agent-loop.test.ts",
  "tests/agent-loop-app.test.ts",
  "tests/agent-loop-server.test.ts",
] as const;

interface FileEntry {
  path: string;
  relativePath: string;
  isSymbolicLink: boolean;
}

interface IncompleteLocation {
  path: string;
  line: number;
  label: string;
}

const candidateRootInput = process.argv[2] ?? "lesson-07-agent-loop-openrouter/starter";
if (process.argv.length > 3) {
  throw new Error("Usage: verify-lesson07-openrouter-completion.ts [candidate-lesson-root]");
}

await verifyLesson07OpenRouterCompletion(candidateRootInput);

async function verifyLesson07OpenRouterCompletion(candidateRootInput: string): Promise<void> {
  const candidateRoot = resolve(repositoryRoot, candidateRootInput);
  const relativeCandidateRoot = relative(repositoryRoot, candidateRoot);
  assertContained(
    repositoryRoot,
    candidateRoot,
    "Lesson 07 completion target must be inside this repository.",
  );

  const realRepositoryRoot = await realpath(repositoryRoot);
  const realCandidateRoot = await realpath(candidateRoot);
  assertContained(
    realRepositoryRoot,
    realCandidateRoot,
    "Lesson 07 completion target resolves outside this repository.",
  );

  const rootMetadata = await lstat(candidateRoot);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new Error("Lesson 07 completion target must be a real directory.");
  }

  const inheritedFiles = trackedLesson06SolutionFiles();
  const candidateEntries = await listCandidateFiles(candidateRoot, candidateRoot);
  const candidateByRelativePath = new Map(
    candidateEntries.map((entry) => [entry.relativePath, entry]),
  );
  const failures: string[] = [];

  for (const entry of candidateEntries) {
    if (entry.isSymbolicLink)
      failures.push(`candidate paths must not be symlinks: ${entry.relativePath}`);
    if (entry.relativePath.split("/").some((part) => /^\.env(?:\.|$)/iu.test(part))) {
      failures.push(`credential configuration files are not accepted: ${entry.relativePath}`);
    }
  }

  if (inheritedFiles.length === 0 || !inheritedFiles.includes("README.md")) {
    failures.push(
      `expected the current Git-tracked Lesson 06 inherited manifest including README.md, found ${inheritedFiles.length} files.`,
    );
  }
  for (const inheritedFile of inheritedFiles) {
    const entry = candidateByRelativePath.get(inheritedFile);
    if (!entry) failures.push(`missing inherited Lesson 06 file: ${inheritedFile}`);
    else if (entry.isSymbolicLink)
      failures.push(`inherited file must not be a symlink: ${inheritedFile}`);
  }

  for (const requiredFile of requiredCandidateFiles) {
    const entry = candidateByRelativePath.get(requiredFile);
    if (!entry) failures.push(`missing required local Lesson 07 implementation: ${requiredFile}`);
    else if (entry.isSymbolicLink)
      failures.push(`required implementation must not be a symlink: ${requiredFile}`);
  }

  const sourceFiles = candidateEntries.filter((entry) => sourceExtensions.has(extname(entry.path)));
  const candidateTests = sourceFiles.filter(
    (entry) => entry.relativePath.startsWith("tests/") && /\.test\.tsx?$/u.test(entry.path),
  );
  const emptyCandidateTests: string[] = [];
  let activeCandidateTests = 0;
  const incompleteCandidate: IncompleteLocation[] = [];
  const forbiddenCanonicalImports: string[] = [];
  for (const violation of findModelFallbackViolations(candidateRoot)) {
    failures.push(
      `single-model contract violation: ${violation.file}:${violation.line} (${violation.rule})`,
    );
  }

  for (const entry of sourceFiles) {
    if (entry.isSymbolicLink) continue;
    const source = await readFile(entry.path, "utf8");
    const lines = source.split(/\r?\n/u);
    for (const [index, line] of lines.entries()) {
      for (const marker of incompletePatterns) {
        if (marker.pattern.test(line)) {
          incompleteCandidate.push({
            path: entry.relativePath,
            line: index + 1,
            label: marker.label,
          });
        }
      }
    }
    if (
      /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["'][^"']*lesson-\d{2}[^"']*\/(?:starter|solution)\//iu.test(
        source,
      )
    ) {
      forbiddenCanonicalImports.push(entry.relativePath);
    }

    if (entry.relativePath.startsWith("tests/") && /\.test\.tsx?$/u.test(entry.path)) {
      const activeCount = (source.match(activeTestPattern) ?? []).length;
      activeCandidateTests += activeCount;
      if (activeCount === 0) emptyCandidateTests.push(entry.relativePath);
    }
  }

  if (
    failures.length > 0 ||
    incompleteCandidate.length > 0 ||
    forbiddenCanonicalImports.length > 0 ||
    emptyCandidateTests.length > 0 ||
    candidateTests.length === 0 ||
    activeCandidateTests === 0
  ) {
    console.error(
      `Lesson 07 OpenRouter completion gate failed for ${relativeCandidateRoot}: ` +
        `${failures.length} missing structure item(s), ${incompleteCandidate.length} incomplete marker(s), ` +
        `${forbiddenCanonicalImports.length} canonical imports, ${candidateTests.length} candidate test file(s), ` +
        `${activeCandidateTests} active candidate test declarations.`,
    );
    for (const failure of failures) console.error(`- ${failure}`);
    for (const location of incompleteCandidate) {
      console.error(`- ${location.path}:${location.line} (${location.label})`);
    }
    for (const path of forbiddenCanonicalImports) {
      console.error(`- candidate imports a canonical lesson starter/solution: ${path}`);
    }
    for (const path of emptyCandidateTests) console.error(`- no active test declarations: ${path}`);
    process.exitCode = 1;
    return;
  }

  const safeEnv = withoutProviderCredentials(process.env);
  const vitestCli = resolve(repositoryRoot, "node_modules", "vitest", "vitest.mjs");
  const candidateOutput = runCommand(
    [process.execPath, vitestCli, "run", "--root", candidateRoot, "--dir", "tests"],
    candidateRoot,
    safeEnv,
    "Lesson 07 candidate tests",
  );
  const candidatePassed = getCleanVitestPassCount(candidateOutput, "Lesson 07 candidate tests", 1);

  const solutionTestRoot = resolve(
    repositoryRoot,
    "lesson-07-agent-loop-openrouter",
    "solution",
    "tests",
  );
  const solutionTestFiles = (await listCandidateFiles(solutionTestRoot, solutionTestRoot)).filter(
    (entry) => /\.test\.tsx?$/u.test(entry.path),
  );
  const canonicalFailures: IncompleteLocation[] = [];
  let activeCanonicalTests = 0;
  for (const entry of solutionTestFiles) {
    if (entry.isSymbolicLink) {
      canonicalFailures.push({ path: entry.relativePath, line: 0, label: "symbolic link" });
      continue;
    }
    const source = await readFile(entry.path, "utf8");
    for (const [index, line] of source.split(/\r?\n/u).entries()) {
      for (const marker of incompletePatterns) {
        if (marker.pattern.test(line)) {
          canonicalFailures.push({
            path: entry.relativePath,
            line: index + 1,
            label: marker.label,
          });
        }
      }
    }
    activeCanonicalTests += (source.match(activeTestPattern) ?? []).length;
  }
  if (
    solutionTestFiles.length === 0 ||
    activeCanonicalTests === 0 ||
    canonicalFailures.length > 0
  ) {
    throw new Error(
      `Lesson 07 canonical solution tests are incomplete: ${solutionTestFiles.length} file(s), ` +
        `${activeCanonicalTests} active declarations, ${canonicalFailures.length} issue(s).`,
    );
  }

  const tempRoot = resolve(repositoryRoot, ".tmp", "lesson07-openrouter-completion");
  await mkdir(tempRoot, { recursive: true });
  const fixtureRoot = await mkdtemp(resolve(tempRoot, "candidate-"));
  assertContained(
    await realpath(tempRoot),
    await realpath(fixtureRoot),
    "Completion fixture escaped its guarded scratch root.",
  );

  let canonicalPassed = 0;
  try {
    const acceptanceRoot = resolve(fixtureRoot, "acceptance");
    for (const directory of ["src", "data", "evals", "sandbox"] as const) {
      await copySafeCandidateTree(
        resolve(candidateRoot, directory),
        resolve(acceptanceRoot, directory),
      );
    }
    const acceptanceTestsRoot = resolve(acceptanceRoot, "tests");
    for (const entry of solutionTestFiles) {
      const target = resolve(acceptanceTestsRoot, entry.relativePath);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(entry.path, target);
    }

    const acceptanceOutput = runCommand(
      [process.execPath, vitestCli, "run", "--root", acceptanceRoot, "--dir", "tests"],
      acceptanceRoot,
      safeEnv,
      "Lesson 07 source-rebound canonical acceptance tests",
    );
    canonicalPassed = getCleanVitestPassCount(
      acceptanceOutput,
      "Lesson 07 source-rebound canonical acceptance tests",
      activeCanonicalTests,
    );
  } finally {
    const safeTempRoot = await realpath(tempRoot);
    const safeFixtureRoot = await realpath(fixtureRoot);
    assertContained(
      safeTempRoot,
      safeFixtureRoot,
      "Refusing to remove a fixture outside its scratch root.",
    );
    await rm(safeFixtureRoot, { recursive: true, force: true });
  }

  const tsxHelper = resolve(repositoryRoot, "scripts", "run-tsx-entrypoint.mjs");
  const inheritedEval = runCommand(
    [process.execPath, tsxHelper, resolve(candidateRoot, "evals", "run.ts")],
    repositoryRoot,
    safeEnv,
    "Lesson 07 inherited candidate eval",
  );
  if (!/\bResult:\s*\d+\/\d+\b/u.test(inheritedEval)) {
    throw new Error("Lesson 07 inherited candidate eval must run and report its Result summary.");
  }

  const loopEval = runCommand(
    [process.execPath, tsxHelper, resolve(candidateRoot, "evals", "run-agent-loop.ts")],
    repositoryRoot,
    safeEnv,
    "Lesson 07 candidate agent-loop eval",
  );
  if (!/\bResult:\s*7\/7\b/u.test(loopEval)) {
    throw new Error(
      "Lesson 07 candidate agent-loop eval must execute all seven cases and report Result: 7/7.",
    );
  }

  console.log(
    `PASS Lesson 07 OpenRouter completion: ${candidatePassed} candidate tests, ` +
      `${canonicalPassed} source-rebound canonical tests, inherited eval, and 7/7 local agent-loop cases ` +
      `passed against ${relativeCandidateRoot}.`,
  );
}

function trackedLesson06SolutionFiles(): string[] {
  return execFileSync("git", ["ls-files", "--", "lesson-06-rag-openrouter/solution"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split(/\r?\n/u)
    .filter((path) => path.startsWith(inheritedPrefix))
    .map((path) => path.slice(inheritedPrefix.length))
    .sort((left, right) => left.localeCompare(right));
}

async function listCandidateFiles(root: string, baseRoot: string): Promise<FileEntry[]> {
  const metadata = await lstat(root).catch((error: unknown) => {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  });
  if (!metadata) return [];
  if (metadata.isSymbolicLink()) {
    return [
      { path: root, relativePath: toPortablePath(relative(baseRoot, root)), isSymbolicLink: true },
    ];
  }
  if (metadata.isFile()) {
    if (isRuntimeData(root)) return [];
    return [
      { path: root, relativePath: toPortablePath(relative(baseRoot, root)), isSymbolicLink: false },
    ];
  }
  if (!metadata.isDirectory()) return [];

  const entries = await readdir(root, { withFileTypes: true });
  const files: FileEntry[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (/^\.env(?:\.|$)/iu.test(entry.name)) {
      files.push({
        path,
        relativePath: toPortablePath(relative(baseRoot, path)),
        isSymbolicLink: false,
      });
      continue;
    }
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) files.push(...(await listCandidateFiles(path, baseRoot)));
    else if (entry.isFile() || entry.isSymbolicLink()) {
      if (isRuntimeData(path)) continue;
      files.push({
        path,
        relativePath: toPortablePath(relative(baseRoot, path)),
        isSymbolicLink: entry.isSymbolicLink(),
      });
    }
  }
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function toPortablePath(path: string): string {
  return path.replaceAll("\\", "/");
}

async function copySafeCandidateTree(source: string, destination: string): Promise<void> {
  const metadata = await lstat(source).catch((error: unknown) => {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  });
  if (!metadata) return;
  if (metadata.isSymbolicLink()) throw new Error(`Refusing to copy symlink ${source}.`);
  if (metadata.isFile()) {
    if (
      isRuntimeData(source) ||
      /^\.env(?:\.|$)/iu.test(basename(source)) ||
      !allowedCopyExtensions.has(extname(source))
    ) {
      return;
    }
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
    return;
  }
  if (!metadata.isDirectory() || basename(source).startsWith(".")) return;
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    await copySafeCandidateTree(join(source, entry.name), join(destination, entry.name));
  }
}

function runCommand(args: string[], cwd: string, env: NodeJS.ProcessEnv, label: string): string {
  const result = spawnSync(args[0]!, args.slice(1), {
    cwd,
    encoding: "utf8",
    env,
    maxBuffer: 16 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (output.length > 0) process.stdout.write(output);
  if (result.error) throw new Error(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(`${label} failed with exit code ${String(result.status)}.`);
  return output;
}

function getCleanVitestPassCount(output: string, label: string, minPasses: number): number {
  const summary = output.match(/\bTests\s+([^\r\n]*\(\d+\))/u)?.[1];
  if (!summary) throw new Error(`${label} did not report a Vitest test summary.`);
  const passed = [...summary.matchAll(/(\d+)\s+passed\b/gu)].reduce(
    (total, match) => total + Number(match[1]),
    0,
  );
  const todo = [...summary.matchAll(/(\d+)\s+todo\b/giu)].reduce(
    (total, match) => total + Number(match[1]),
    0,
  );
  const skipped = [...summary.matchAll(/(\d+)\s+skipped\b/giu)].reduce(
    (total, match) => total + Number(match[1]),
    0,
  );
  if (passed < minPasses || todo > 0 || skipped > 0) {
    throw new Error(
      `${label} must pass at least ${minPasses} tests with zero todo/skipped; ${summary}.`,
    );
  }
  return passed;
}

function withoutProviderCredentials(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const safeEnvironment = { ...environment };
  for (const key of Object.keys(safeEnvironment)) {
    if (/(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH|OPENROUTER|OPENAI)/iu.test(key)) {
      delete safeEnvironment[key];
    }
  }
  return safeEnvironment;
}

function isRuntimeData(path: string): boolean {
  return /(?:^|[\\/])data[\\/](?:user-memory|conversation-history)\.json$/iu.test(path);
}

function assertContained(parent: string, child: string, message: string): void {
  const childRelative = relative(parent, child);
  if (
    childRelative === "" ||
    childRelative === ".." ||
    childRelative.startsWith(`..${sep}`) ||
    isAbsolute(childRelative)
  ) {
    throw new Error(message);
  }
}
