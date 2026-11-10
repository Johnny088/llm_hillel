import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export type StudentProvider = "openai" | "openrouter";
export type StudentAction = "init" | "test" | "check" | "eval" | "build" | "dev";

export interface StudentLessonContext {
  lesson: string;
  provider: StudentProvider;
  lessonDirectory: string;
  lessonRoot: string;
  starterRoot: string;
  solutionRoot: string;
  candidateRoot: string;
}

export interface SourceDelta {
  changed: string[];
  added: string[];
  removed: string[];
  implementationChanges: string[];
}

interface CandidateFixture {
  root: string;
  candidateRoot: string;
}

interface EvalCommand {
  relativeEntrypoint: string;
  args: string[];
}

interface VitestJsonReport {
  numPassedTests?: number;
  numTodoTests?: number;
  testResults?: Array<{
    assertionResults?: Array<{ status?: string }>;
  }>;
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const myDevRoot = resolve(repositoryRoot, "my-dev");
const tempRoot = resolve(repositoryRoot, ".tmp");
const codeExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const ignoredDirectories = new Set([".git", "node_modules", "dist", "coverage", ".tmp"]);
const credentialFile = /^\.env(?:\..+)?$/iu;
const safeExampleFile = ".env.example";
const testFilePattern = /\.test\.(?:ts|tsx|js|jsx|mjs|cjs)$/u;
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
    pattern:
      /(?:\.status\s*\(\s*501\b|\bsendStatus\s*\(\s*501\b|\bstatus(?:Code)?\s*:\s*501\b|\bHTTP_(?:STATUS_)?NOT_IMPLEMENTED\b)/u,
  },
];

export function parseStudentArguments(args: readonly string[]): {
  action: StudentAction;
  lesson: string;
  provider: StudentProvider;
} {
  const [action, lesson, provider, ...extra] = args;
  if (
    !["init", "test", "check", "eval", "build", "dev"].includes(action ?? "") ||
    !/^\d{1,2}$/u.test(lesson ?? "") ||
    !["openai", "openrouter"].includes(provider ?? "") ||
    extra.length > 0
  ) {
    throw new Error(
      "Usage: yarn student:<init|test|check|eval|build|dev> <01..15> <openai|openrouter>",
    );
  }
  const normalizedLesson = (lesson ?? "").padStart(2, "0");
  if (Number(normalizedLesson) < 1 || Number(normalizedLesson) > 15)
    throw new Error("Lesson must be a number from 01 through 15.");
  return {
    action: action as StudentAction,
    lesson: normalizedLesson,
    provider: provider as StudentProvider,
  };
}

export async function resolveStudentLesson(
  root: string,
  lesson: string,
  provider: StudentProvider,
): Promise<StudentLessonContext> {
  const normalizedLesson = lesson.padStart(2, "0");
  const entries = await readdir(root, { withFileTypes: true });
  const matches = entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.isSymbolicLink() &&
        entry.name.startsWith(`lesson-${normalizedLesson}-`) &&
        (provider === "openrouter") === entry.name.endsWith("-openrouter"),
    )
    .map((entry) => entry.name);
  if (matches.length !== 1)
    throw new Error(
      `Expected exactly one canonical ${provider} lesson directory for Lesson ${normalizedLesson}; found ${matches.length}.`,
    );

  const lessonDirectory = matches[0]!;
  const lessonRoot = resolve(root, lessonDirectory);
  const starterRoot = resolve(lessonRoot, "starter");
  const solutionRoot = resolve(lessonRoot, "solution");
  const candidateRoot = resolve(root, "my-dev", lessonDirectory);
  const starterStat = await lstat(starterRoot);
  const solutionStat = await lstat(solutionRoot);
  if (!starterStat.isDirectory() || starterStat.isSymbolicLink())
    throw new Error(`Canonical starter must be a real directory: ${relative(root, starterRoot)}.`);
  if (!solutionStat.isDirectory() || solutionStat.isSymbolicLink())
    throw new Error(
      `Canonical solution must be a real directory: ${relative(root, solutionRoot)}.`,
    );

  return {
    lesson: normalizedLesson,
    provider,
    lessonDirectory,
    lessonRoot,
    starterRoot,
    solutionRoot,
    candidateRoot,
  };
}

export async function inspectSourceDelta(
  starterRoot: string,
  candidateRoot: string,
): Promise<SourceDelta> {
  const starter = await collectCodeFiles(starterRoot);
  const candidate = await collectCodeFiles(candidateRoot);
  const starterPaths = new Set(starter.keys());
  const candidatePaths = new Set(candidate.keys());
  const added = [...candidatePaths].filter((path) => !starterPaths.has(path)).sort();
  const removed = [...starterPaths].filter((path) => !candidatePaths.has(path)).sort();
  const changed = [...starterPaths]
    .filter(
      (path) => candidatePaths.has(path) && !buffersEqual(starter.get(path)!, candidate.get(path)!),
    )
    .sort();
  const implementationChanges = [...added, ...changed].filter((path) => {
    const first = path.split(/[\\/]/u)[0] ?? "";
    return ["src", "evals", "client", "scripts", "integration-tests"].includes(first);
  });
  return { changed, added, removed, implementationChanges };
}

export async function inspectCompletion(candidateRoot: string): Promise<string[]> {
  const failures: string[] = [];
  const sourceFiles = await collectSourceFiles(candidateRoot);
  const testFiles = sourceFiles.filter((file) =>
    testFilePattern.test(relative(candidateRoot, file)),
  );
  if (testFiles.length === 0) failures.push("candidate has no test files");

  for (const file of sourceFiles) {
    const rel = relative(candidateRoot, file).replaceAll("\\", "/");
    if (!/^(?:src|tests|evals|scripts|client|integration-tests)\//u.test(rel)) continue;
    const text = await readFile(file, "utf8");
    for (const marker of incompletePatterns) {
      if (marker.pattern.test(text)) failures.push(`${rel} contains ${marker.label}`);
    }
  }
  return [...new Set(failures)];
}

export async function initializeStudentWorkspace(context: StudentLessonContext): Promise<void> {
  const localMyDevRoot = dirname(context.candidateRoot);
  const localRepositoryRoot = dirname(localMyDevRoot);
  const realRepository = await realpath(localRepositoryRoot);
  let myDevStat = await lstat(localMyDevRoot).catch((error: unknown) =>
    isMissing(error) ? undefined : Promise.reject(error),
  );
  if (myDevStat?.isSymbolicLink()) throw new Error("my-dev must not be a symbolic link.");
  if (myDevStat && !myDevStat.isDirectory()) throw new Error("my-dev must be a real directory.");
  if (!myDevStat) {
    await mkdir(localMyDevRoot);
    myDevStat = await lstat(localMyDevRoot);
  }
  if (!myDevStat.isDirectory() || myDevStat.isSymbolicLink())
    throw new Error("my-dev must be a real directory inside the repository.");
  const realMyDev = await realpath(localMyDevRoot);
  assertContained(realRepository, realMyDev, "my-dev resolves outside the repository.");

  const existing = await lstat(context.candidateRoot).catch((error: unknown) =>
    isMissing(error) ? undefined : Promise.reject(error),
  );
  if (existing) {
    if (existing.isSymbolicLink())
      throw new Error("Student target is a symbolic link; initialization stopped.");
    if (!existing.isDirectory())
      throw new Error("Student target already exists and is not a directory.");
    const entries = await readdir(context.candidateRoot);
    if (entries.length > 0)
      throw new Error("Student target is not empty; initialization never overwrites student work.");
    throw new Error("Student target already exists; initialization never replaces existing paths.");
  }

  const temp = await mkdtemp(join(realMyDev, `.student-init-${context.lesson}-`));
  assertContained(realMyDev, await realpath(temp), "Initialization fixture escaped my-dev.");
  try {
    await copyTree(context.starterRoot, temp, { rejectSymlinks: true, omitCredentials: true });
    await rename(temp, context.candidateRoot);
  } catch (error) {
    await removeOwnedTree(realMyDev, temp);
    throw error;
  }
  console.log(
    `Initialized ${relative(repositoryRoot, context.candidateRoot)} from canonical starter.`,
  );
}

export async function runStudentAction(
  action: StudentAction,
  context: StudentLessonContext,
): Promise<void> {
  if (action === "init") return initializeStudentWorkspace(context);
  await validateCandidate(context);

  if (action === "dev") return runDev(context);
  if (action === "build") return runBuild(context);
  if (action === "eval") {
    return runEval(context, false);
  }
  if (action === "test") {
    await runCandidateTests(context, false);
    return;
  }

  // This gate runs before any test, eval, or provider verifier can open/reset a database.
  await requireDisposableDatabaseIfNeeded(context);
  await requireCompletion(context);
  await runTypecheck(context);
  await runLint(context);
  await runFormat(context);
  await runCandidateTests(context, true);
  await runProviderCompletion(context);
  await runIndependentAcceptance(context);
  await runEval(context, true);
  await runBuild(context);
  console.log(
    `PASS student:check ${context.lesson} ${context.provider}: source completion, typecheck, lint, format, candidate tests, canonical acceptance, offline eval, and build passed.`,
  );
}

async function validateCandidate(context: StudentLessonContext): Promise<void> {
  const candidateStat = await lstat(context.candidateRoot).catch(() => undefined);
  if (!candidateStat || !candidateStat.isDirectory() || candidateStat.isSymbolicLink())
    throw new Error(
      `Student workspace does not exist at ${relative(repositoryRoot, context.candidateRoot)}. Run student:init first.`,
    );
  const safeMyDevRoot = await ensureMyDevRoot(repositoryRoot);
  const realCandidate = await realpath(context.candidateRoot);
  assertContained(safeMyDevRoot, realCandidate, "Student workspace resolves outside my-dev.");
  const unsafe = await findUnsafePaths(context.candidateRoot);
  if (unsafe.length > 0) throw new Error(`Unsafe candidate paths: ${unsafe.join(", ")}.`);
}

export async function requireCompletion(context: StudentLessonContext): Promise<void> {
  const incomplete = await inspectCompletion(context.candidateRoot);
  if (incomplete.length > 0)
    throw new Error(`Student completion gate failed:\n- ${incomplete.join("\n- ")}`);

  if (Number(context.lesson) >= 3) {
    const delta = await inspectSourceDelta(context.starterRoot, context.candidateRoot);
    // Lesson 15 OpenRouter intentionally inherits an unchanged 236-file Lesson 14
    // foundation. Its six release-candidate documents are the new implementation
    // artifact and are checked by verify-lesson15-openrouter-completion.ts below.
    const completionIsArtifactBased = context.lesson === "15" && context.provider === "openrouter";
    if (delta.implementationChanges.length === 0 && !completionIsArtifactBased) {
      throw new Error(
        `Lesson ${context.lesson} still matches its starter implementation. Change current-lesson source under src/, evals/, client/, scripts/ or integration-tests/ before completion; inherited green tests alone do not pass.`,
      );
    }
    if (completionIsArtifactBased) {
      console.log(
        `PASS Lesson 15 OpenRouter uses the required release-candidate artifact completion verifier for its unchanged Lesson 14 foundation.`,
      );
    } else {
      console.log(
        `PASS current-lesson source delta: ${delta.implementationChanges.length} implementation file(s) differ from starter.`,
      );
    }
  }
}

async function runProviderCompletion(context: StudentLessonContext): Promise<void> {
  if (context.provider === "openrouter" && Number(context.lesson) >= 3) {
    const candidateArg = relative(repositoryRoot, context.candidateRoot);
    const lessonNumber = Number(context.lesson);
    if (lessonNumber <= 6) {
      runNodeTsEntrypoint(
        "scripts/assert-starter-complete.ts",
        [`--lesson${context.lesson}-openrouter`, candidateArg],
        repositoryRoot,
      );
    } else {
      runNodeTsEntrypoint(
        `scripts/verify-lesson${context.lesson}-openrouter-completion.ts`,
        [candidateArg],
        repositoryRoot,
        environmentFor(context, "tests"),
      );
    }
  }
}

export async function runCandidateTests(
  context: StudentLessonContext,
  enforceComplete: boolean,
): Promise<void> {
  const candidateTests = (await collectSourceFiles(resolve(context.candidateRoot, "tests"))).filter(
    (file) => testFilePattern.test(file),
  );
  if (candidateTests.length === 0) throw new Error("Student test suite is empty.");
  const focused = await findFocusedTests(candidateTests);
  if (focused.length > 0)
    throw new Error(`Focused .only tests make results incomplete: ${focused.join(", ")}.`);

  const fixture = await prepareCandidateFixture(context, context.candidateRoot);
  try {
    const testPaths = await listRunnableTests(resolve(fixture.candidateRoot, "tests"));
    const summary = runVitest(
      fixture.root,
      testPaths,
      environmentFor(context, "tests"),
      enforceComplete,
    );
    console.log(
      `student:test inventory: passed=${summary.passed}, todo=${summary.todo}, skipped=${summary.skipped}${enforceComplete ? "" : "; this command allows unfinished work"}.`,
    );
  } finally {
    await removeOwnedTree(await realpath(tempRoot), fixture.root);
  }
}

export async function runIndependentAcceptance(context: StudentLessonContext): Promise<void> {
  const canonicalTests = (await collectSourceFiles(resolve(context.solutionRoot, "tests"))).filter(
    (file) => testFilePattern.test(file),
  );
  if (canonicalTests.length === 0)
    throw new Error("Canonical solution has no offline independent test suite for this candidate.");

  const fixture = await prepareCandidateFixture(context, context.candidateRoot, canonicalTests);
  try {
    const testPaths = await listRunnableTests(resolve(fixture.candidateRoot, "tests"));
    const summary = runVitest(fixture.root, testPaths, environmentFor(context, "tests"), true);
    console.log(
      `PASS independent canonical acceptance: ${summary.passed} tests ran against the student source.`,
    );
  } finally {
    await removeOwnedTree(await realpath(tempRoot), fixture.root);
  }
}

async function prepareCandidateFixture(
  context: StudentLessonContext,
  sourceRoot: string,
  canonicalTests?: string[],
): Promise<CandidateFixture> {
  const root = await createFixtureRoot(
    context,
    canonicalTests ? "canonical-acceptance" : "candidate",
  );
  const candidateRoot = resolve(root, context.lessonDirectory, "solution");
  try {
    await copyTree(sourceRoot, candidateRoot, { rejectSymlinks: true, omitCredentials: true });
    if (canonicalTests) {
      await rm(resolve(candidateRoot, "tests"), { recursive: true, force: true });
      for (const testFile of canonicalTests) {
        const destination = resolve(
          candidateRoot,
          "tests",
          relative(resolve(context.solutionRoot, "tests"), testFile),
        );
        await mkdir(dirname(destination), { recursive: true });
        await copyFile(testFile, destination);
      }
    }
    await copyFixtureDependencies(context, root, sourceRoot, canonicalTests ?? []);
    await writeFixtureMetadata(root, candidateRoot);
    return { root, candidateRoot };
  } catch (error) {
    await removeOwnedTree(await realpath(tempRoot), root);
    throw error;
  }
}

async function copyFixtureDependencies(
  context: StudentLessonContext,
  fixtureRoot: string,
  sourceRoot: string,
  canonicalTests: string[],
): Promise<void> {
  const fixtureCandidateRoot = resolve(fixtureRoot, context.lessonDirectory, "solution");
  const candidateFiles = await collectSourceFiles(sourceRoot);
  const queue = new Map<string, string>();
  for (const file of candidateFiles) {
    const relativeFile = relative(sourceRoot, file);
    const canonical = resolve(context.solutionRoot, relativeFile);
    queue.set(resolve(fixtureCandidateRoot, relativeFile), canonical);
  }
  for (const file of canonicalTests) {
    const relativeTest = relative(resolve(context.solutionRoot, "tests"), file);
    const fixtureTest = resolve(fixtureCandidateRoot, "tests", relativeTest);
    queue.set(fixtureTest, file);
  }

  const visited = new Set<string>();
  while (queue.size > 0) {
    const [fixtureSource, canonicalSource] = queue.entries().next().value as [string, string];
    queue.delete(fixtureSource);
    if (visited.has(canonicalSource)) continue;
    visited.add(canonicalSource);

    const text = await readFile(fixtureSource, "utf8").catch(async (error: unknown) => {
      if (!isMissing(error)) throw error;
      // Candidate source may deliberately omit a referenced source file. Keep the
      // fixture incomplete so the test or compiler reports that student defect.
      if (isWithin(context.solutionRoot, canonicalSource))
        throw new Error(
          `Student source is missing imported file ${relative(context.solutionRoot, canonicalSource)}.`,
        );
      throw error;
    });
    const specifierPattern = /\b(?:from|import)\s*(?:\(\s*)?["']([^"']+)["']/gu;
    for (const match of text.matchAll(specifierPattern)) {
      const specifier = match[1];
      if (!specifier?.startsWith(".")) continue;
      const localUnresolved = resolve(dirname(fixtureSource), specifier);
      let target: string | undefined;
      let fixtureTarget: string;
      let targetCanonical: string;
      if (isWithin(fixtureCandidateRoot, localUnresolved)) {
        target = await resolveImportedFile(localUnresolved);
        if (!target) {
          throw new Error(
            `Student source is missing current-lesson import ${relative(fixtureCandidateRoot, localUnresolved)}; the canonical solution is never used as a fallback.`,
          );
        }
        fixtureTarget = target;
        targetCanonical = resolve(context.solutionRoot, relative(fixtureCandidateRoot, target));
      } else {
        const canonicalUnresolved = resolve(dirname(canonicalSource), specifier);
        if (!isWithin(repositoryRoot, canonicalUnresolved))
          throw new Error(
            `Relative fixture import escapes the repository: ${relative(repositoryRoot, canonicalSource)} -> ${specifier}.`,
          );
        target = await resolveImportedFile(canonicalUnresolved);
        if (!target)
          throw new Error(
            `Relative fixture import does not resolve: ${relative(repositoryRoot, canonicalSource)} -> ${specifier}.`,
          );
        targetCanonical = target;
        if (isWithin(context.solutionRoot, target)) {
          fixtureTarget = resolve(fixtureCandidateRoot, relative(context.solutionRoot, target));
          const stat = await lstat(fixtureTarget).catch((error: unknown) =>
            isMissing(error) ? undefined : Promise.reject(error),
          );
          if (!stat) {
            throw new Error(
              `Student source is missing current-lesson import ${relative(context.solutionRoot, target)}; the canonical solution is never used as a fallback.`,
            );
          }
        } else {
          fixtureTarget = resolve(fixtureRoot, relative(repositoryRoot, target));
          await copyFixtureFile(target, fixtureTarget);
        }
      }
      if (codeExtensions.has(extname(target))) queue.set(fixtureTarget, targetCanonical);
    }
  }
}

async function resolveImportedFile(unresolved: string): Promise<string | undefined> {
  const sourceBase = /\.(?:[cm]?js|jsx)$/iu.test(unresolved)
    ? unresolved.replace(/\.(?:[cm]?js|jsx)$/iu, "")
    : undefined;
  const candidates = [
    unresolved,
    ...(sourceBase
      ? [".ts", ".tsx", ".jsx", ".mjs", ".cjs"].map((extension) => `${sourceBase}${extension}`)
      : []),
    ...[...codeExtensions].map((extension) => `${unresolved}${extension}`),
    ...[...codeExtensions].map((extension) => resolve(unresolved, `index${extension}`)),
    `${unresolved}.json`,
  ];
  for (const candidate of candidates) {
    const stat = await lstat(candidate).catch((error: unknown) =>
      isMissing(error) ? undefined : Promise.reject(error),
    );
    if (!stat) continue;
    if (stat.isSymbolicLink())
      throw new Error(
        `Fixture import resolves through a symbolic link: ${relative(repositoryRoot, candidate)}.`,
      );
    if (stat.isFile()) return candidate;
  }
  return undefined;
}

async function copyFixtureFile(source: string, destination: string): Promise<void> {
  const stat = await lstat(source);
  if (stat.isSymbolicLink() || !stat.isFile())
    throw new Error(
      `Fixture dependency must be a regular file: ${relative(repositoryRoot, source)}.`,
    );
  const existing = await lstat(destination).catch((error: unknown) =>
    isMissing(error) ? undefined : Promise.reject(error),
  );
  if (existing) {
    if (existing.isSymbolicLink() || !existing.isFile())
      throw new Error(`Fixture dependency target is unsafe: ${destination}.`);
    return;
  }
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

async function createFixtureRoot(context: StudentLessonContext, label: string): Promise<string> {
  const safeTempRoot = await ensureTempRoot(repositoryRoot);
  const fixture = await mkdtemp(join(safeTempRoot, `student-${context.lesson}-${label}-`));
  assertContained(safeTempRoot, await realpath(fixture), "Student test fixture escaped .tmp.");
  return fixture;
}

async function writeFixtureMetadata(fixtureRoot: string, candidateRoot: string): Promise<void> {
  await mkdir(candidateRoot, { recursive: true });
  const metadata = '{"private":true,"type":"module"}\n';
  await writeFile(resolve(fixtureRoot, "package.json"), metadata, "utf8");
  await writeFile(resolve(candidateRoot, "package.json"), metadata, "utf8");
  await writeFile(
    resolve(fixtureRoot, "vitest.config.ts"),
    `import { defineConfig } from "vitest/config";\nexport default defineConfig({ test: { environment: "node", exclude: ["**/node_modules/**", "**/dist/**", "**/coverage/**"] } });\n`,
    "utf8",
  );
}

async function listRunnableTests(testRoot: string): Promise<string[]> {
  return (await collectSourceFiles(testRoot)).filter((file) => testFilePattern.test(file));
}

function runVitest(
  cwd: string,
  testFiles: string[],
  environment: NodeJS.ProcessEnv,
  enforceComplete: boolean,
): { passed: number; todo: number; skipped: number } {
  if (testFiles.length === 0) throw new Error("No offline test files were selected.");
  const cli = resolve(repositoryRoot, "node_modules", "vitest", "vitest.mjs");
  const reportPath = resolve(cwd, ".student-vitest-report.json");
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "run",
      "--root",
      cwd,
      "--maxWorkers=1",
      "--fileParallelism=false",
      "--reporter=json",
      `--outputFile=${reportPath}`,
      "--config",
      resolve(cwd, "vitest.config.ts"),
      ...testFiles,
    ],
    { cwd, encoding: "utf8", maxBuffer: 24 * 1024 * 1024, env: environment },
  );
  emitChildOutput(result.stdout, result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Vitest failed with exit code ${result.status ?? "unknown"}.`);
  const reportText = readFileSync(reportPath, "utf8");
  const report = JSON.parse(reportText) as VitestJsonReport;
  const summary = normalizeVitestReport(report);
  if (enforceComplete && summary.passed === 0)
    throw new Error("Vitest did not report any passed tests.");
  if (enforceComplete && (summary.todo > 0 || summary.skipped > 0))
    throw new Error(
      `Completion requires zero todo and skipped tests; found todo=${summary.todo}, skipped=${summary.skipped}.`,
    );
  return summary;
}

export function normalizeVitestReport(report: VitestJsonReport): {
  passed: number;
  todo: number;
  skipped: number;
} {
  const assertions = (report.testResults ?? []).flatMap((suite) => suite.assertionResults ?? []);
  const passed = Number(
    report.numPassedTests ?? assertions.filter((item) => item.status === "passed").length,
  );
  const todo = Number(
    report.numTodoTests ?? assertions.filter((item) => item.status === "todo").length,
  );
  const skipped = assertions.filter(
    (item) => item.status === "skipped" || item.status === "pending",
  ).length;
  return { passed, todo, skipped };
}

async function runTypecheck(context: StudentLessonContext): Promise<void> {
  const fixture = await prepareCandidateFixture(context, context.candidateRoot);
  try {
    const files = (await collectSourceFiles(fixture.root)).filter(
      (file) => isWithin(fixture.candidateRoot, file) && codeExtensions.has(extname(file)),
    );
    if (files.length === 0)
      throw new Error("Student workspace has no TypeScript or JavaScript source files.");
    const config = await writeTemporaryTsconfig(fixture.root, files, true);
    try {
      runNode(
        resolve(repositoryRoot, "node_modules", "typescript", "bin", "tsc"),
        ["--project", config],
        repositoryRoot,
      );
    } finally {
      await rm(dirname(config), { recursive: true, force: true });
    }
  } finally {
    await removeOwnedTree(await realpath(tempRoot), fixture.root);
  }
}

async function runBuild(context: StudentLessonContext): Promise<void> {
  const fixture = await prepareCandidateFixture(context, context.candidateRoot);
  try {
    const files = (await collectSourceFiles(fixture.root)).filter(
      (file) => isWithin(fixture.candidateRoot, file) && codeExtensions.has(extname(file)),
    );
    if (files.length === 0) throw new Error("Student workspace has no buildable source files.");
    const output = await mkdtemp(
      join(await realpath(tempRoot), `student-${context.lesson}-build-`),
    );
    const config = await writeTemporaryTsconfig(fixture.root, files, false, output);
    try {
      runNode(
        resolve(repositoryRoot, "node_modules", "typescript", "bin", "tsc"),
        ["--project", config],
        repositoryRoot,
      );
      await copyNonCodeAssets(fixture.root, output);
      const viteConfig = resolve(fixture.candidateRoot, "client", "vite.config.ts");
      if (await isFile(viteConfig)) {
        const webOutput = resolve(output, "web");
        runNode(
          resolve(repositoryRoot, "node_modules", "vite", "bin", "vite.js"),
          ["build", "--config", viteConfig, "--outDir", webOutput, "--emptyOutDir"],
          fixture.candidateRoot,
          safeOfflineEnvironment(process.env),
        );
      }
      console.log(
        `PASS student:build ${context.lesson} ${context.provider}: isolated build completed; output was removed.`,
      );
    } finally {
      await rm(dirname(config), { recursive: true, force: true });
      await removeOwnedTree(await realpath(tempRoot), output);
    }
  } finally {
    await removeOwnedTree(await realpath(tempRoot), fixture.root);
  }
}

async function writeTemporaryTsconfig(
  rootDir: string,
  files: string[],
  noEmit: boolean,
  outDir?: string,
): Promise<string> {
  const work = await mkdtemp(join(await ensureTempRoot(repositoryRoot), "student-tsconfig-"));
  const config = {
    extends: resolve(repositoryRoot, "tsconfig.json"),
    compilerOptions: {
      noEmit,
      rootDir,
      ...(noEmit ? {} : { outDir }),
      incremental: false,
      tsBuildInfoFile: undefined,
    },
    include: files,
    exclude: [],
  };
  const path = resolve(work, "tsconfig.json");
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return path;
}

async function runLint(context: StudentLessonContext): Promise<void> {
  const files = (await collectSourceFiles(context.candidateRoot)).filter((file) =>
    [".ts", ".tsx", ".js", ".jsx"].includes(extname(file)),
  );
  if (files.length === 0) throw new Error("Student workspace has no lintable source files.");
  runNode(
    resolve(repositoryRoot, "node_modules", "eslint", "bin", "eslint.js"),
    files,
    repositoryRoot,
  );
}

async function runFormat(context: StudentLessonContext): Promise<void> {
  runNode(
    resolve(repositoryRoot, "node_modules", "prettier", "bin", "prettier.cjs"),
    ["--check", context.candidateRoot],
    repositoryRoot,
  );
}

async function runEval(context: StudentLessonContext, requireCompletePlan: boolean): Promise<void> {
  const evalRoot = resolve(context.candidateRoot, "evals");
  const files = await collectSourceFiles(evalRoot);
  if (files.length === 0) {
    console.log(
      `SKIP student:eval ${context.lesson} ${context.provider}: this lesson has no eval suite.`,
    );
    return;
  }

  const commands = await resolveEvalCommands(context, requireCompletePlan);
  if (commands.length === 0) {
    console.log(
      `SKIP student:eval ${context.lesson} ${context.provider}: no offline eval entrypoint is defined.`,
    );
    return;
  }

  if (commands.some((command) => command.relativeEntrypoint === "evals/catalog-run.ts"))
    await requireDisposableDatabaseIfNeeded(context);

  const fixture = await prepareCandidateFixture(context, context.candidateRoot);
  const output = await mkdtemp(join(await realpath(tempRoot), `student-${context.lesson}-eval-`));
  try {
    const sourceFiles = (await collectSourceFiles(fixture.root)).filter(
      (file) => isWithin(fixture.candidateRoot, file) && codeExtensions.has(extname(file)),
    );
    if (sourceFiles.length === 0)
      throw new Error("Student eval suite has no TypeScript or JavaScript source files.");
    const config = await writeTemporaryTsconfig(fixture.root, sourceFiles, false, output);
    try {
      runNode(
        resolve(repositoryRoot, "node_modules", "typescript", "bin", "tsc"),
        ["--project", config],
        repositoryRoot,
      );
      await copyNonCodeAssets(fixture.root, output);
      const compiledRoot = resolve(output, context.lessonDirectory, "solution");
      for (const command of commands) {
        const jsEntrypoint = resolve(
          compiledRoot,
          command.relativeEntrypoint.replace(/\.tsx?$/u, ".js"),
        );
        if (!isWithin(compiledRoot, jsEntrypoint))
          throw new Error("Eval entrypoint escaped the compiled candidate tree.");
        runNode(jsEntrypoint, command.args, fixture.root, environmentFor(context, "eval"));
      }
    } finally {
      await rm(dirname(config), { recursive: true, force: true });
    }
  } finally {
    await removeOwnedTree(await realpath(tempRoot), output);
    await removeOwnedTree(await realpath(tempRoot), fixture.root);
  }
}

export async function resolveEvalCommands(
  context: StudentLessonContext,
  requireCompletePlan = false,
): Promise<EvalCommand[]> {
  if (context.provider === "openrouter" && Number(context.lesson) >= 12) {
    const plan: EvalCommand[] = [
      { relativeEntrypoint: "evals/run.ts", args: [] },
      { relativeEntrypoint: "evals/run-agent-loop.ts", args: [] },
      { relativeEntrypoint: "evals/run-report-workflow.ts", args: [] },
      { relativeEntrypoint: "evals/run-agents-sdk.ts", args: [] },
      { relativeEntrypoint: "evals/run-content-review.ts", args: [] },
      { relativeEntrypoint: "evals/run-observability.ts", args: ["--offline"] },
      { relativeEntrypoint: "evals/run-security.ts", args: ["--offline"] },
      ...(Number(context.lesson) >= 13
        ? [{ relativeEntrypoint: "evals/catalog-run.ts", args: [] }]
        : []),
    ];
    const commands: EvalCommand[] = [];
    const missing: string[] = [];
    for (const command of plan) {
      if (await isFile(resolve(context.candidateRoot, command.relativeEntrypoint)))
        commands.push(command);
      else missing.push(command.relativeEntrypoint);
    }
    if (missing.length > 0) {
      const message =
        `OpenRouter Lesson ${context.lesson} offline eval plan is missing candidate entrypoints: ` +
        missing.join(", ");
      if (requireCompletePlan) throw new Error(message);
      console.log(`SKIP incomplete candidate eval plan: ${message}`);
    }
    return commands;
  }

  const packageJson = JSON.parse(
    await readFile(resolve(repositoryRoot, "package.json"), "utf8"),
  ) as {
    scripts?: Record<string, string>;
  };
  const key = `eval:my:lesson${context.lesson}:${context.provider}`;
  const alias = packageJson.scripts?.[key];
  if (alias) {
    const commands: EvalCommand[] = [];
    for (const part of alias.split(/\s+&&\s+/u)) {
      const match = part.match(/^node scripts\/run-tsx-entrypoint\.mjs ([^\s]+)(?: (.*))?$/u);
      if (!match) throw new Error(`Cannot safely interpret existing eval alias ${key}.`);
      const [, entrypoint, argText = ""] = match;
      const expectedPrefix = `my-dev/${context.lessonDirectory}/evals/`;
      if (!entrypoint?.startsWith(expectedPrefix))
        throw new Error(
          `${key} must target ${expectedPrefix}; found ${entrypoint ?? "no entrypoint"}.`,
        );
      const args = argText.trim() === "" ? [] : argText.trim().split(/\s+/u);
      if (args.some((arg) => /^--live(?:=|$)/iu.test(arg)))
        throw new Error(`${key} contains a live-provider eval; student:eval runs offline only.`);
      commands.push({
        relativeEntrypoint: entrypoint.slice(`my-dev/${context.lessonDirectory}/`.length),
        args,
      });
    }
    return commands;
  }

  const defaultEntrypoint = resolve(context.candidateRoot, "evals", "run.ts");
  return (await isFile(defaultEntrypoint))
    ? [{ relativeEntrypoint: "evals/run.ts", args: [] }]
    : [];
}

async function runDev(context: StudentLessonContext): Promise<void> {
  const fixture = await prepareCandidateFixture(context, context.candidateRoot);
  try {
    const api = await findApiEntrypoint(fixture.candidateRoot);
    const viteConfig = resolve(fixture.candidateRoot, "client", "vite.config.ts");
    const launcher = resolve(fixture.root, "student-dev-launcher.mjs");
    const tsxRuntime = resolve(repositoryRoot, "__tsx_runtime__.cjs");
    await writeFile(
      launcher,
      `import { createRequire } from "node:module";\nimport { pathToFileURL } from "node:url";\nif (process.platform === "win32" && typeof process.geteuid !== "function") Object.defineProperty(process, "geteuid", { configurable: true, value: () => 0 });\nconst candidate = ${JSON.stringify(fixture.candidateRoot)};\nconst entry = ${JSON.stringify(api)};\nconst require = createRequire(${JSON.stringify(tsxRuntime)});\nconst { register } = require("tsx/esm/api");\nrequire("dotenv").config({ path: ${JSON.stringify(resolve(repositoryRoot, ".env"))}, quiet: true });\nprocess.chdir(candidate);\nregister();\nprocess.argv = [process.execPath, entry];\nawait import(pathToFileURL(entry).href);\n`,
      "utf8",
    );

    const commands: Array<{ executable: string; args: string[]; cwd: string }> = [
      { executable: process.execPath, args: [launcher], cwd: fixture.candidateRoot },
    ];
    if (await isFile(viteConfig)) {
      commands.push({
        executable: process.execPath,
        args: [
          resolve(repositoryRoot, "node_modules", "vite", "bin", "vite.js"),
          "--config",
          viteConfig,
          "--host",
          "127.0.0.1",
        ],
        cwd: resolve(fixture.candidateRoot, "client"),
      });
    }
    console.log(
      `Starting isolated student app from ${relative(repositoryRoot, context.candidateRoot)}. It reads the repository .env for local development; restart student:dev after source changes.`,
    );
    const environment = safeOfflineEnvironment(process.env);
    await superviseDevProcesses(commands, environment);
  } finally {
    await removeOwnedTree(await realpath(tempRoot), fixture.root);
  }
}

async function findApiEntrypoint(candidateRoot: string): Promise<string> {
  for (const relativePath of [
    "src/lesson14/server.ts",
    "src/server.ts",
    "src/index.ts",
    "src/demo-security.ts",
    "src/demo.ts",
    "src/main.ts",
    "src/server.tsx",
    "src/index.tsx",
  ]) {
    const entry = resolve(candidateRoot, relativePath);
    if (await isFile(entry)) return entry;
  }
  throw new Error(
    `No supported API/application entrypoint exists under ${relative(repositoryRoot, candidateRoot)}/src.`,
  );
}

async function superviseDevProcesses(
  commands: Array<{ executable: string; args: string[]; cwd: string }>,
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  const children = commands.map(({ executable, args, cwd }) =>
    spawn(executable, args, { cwd, env: environment, stdio: "inherit", windowsHide: true }),
  );
  await new Promise<void>((resolvePromise, rejectPromise) => {
    let finished = false;
    const stopAll = (): void => {
      for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
    };
    const finish = (error?: Error): void => {
      if (finished) return;
      finished = true;
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      stopAll();
      if (error) rejectPromise(error);
      else resolvePromise();
    };
    const onSignal = (): void => finish();
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
    for (const child of children) {
      child.once("error", (error) => finish(error));
      child.once("exit", (code, signal) => {
        if (finished) return;
        const detail = signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`;
        finish(code === 0 ? undefined : new Error(`Student dev process stopped with ${detail}.`));
      });
    }
  });
}

export async function requireDisposableDatabaseIfNeeded(
  context: StudentLessonContext,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (Number(context.lesson) < 13) return;
  const confirmation = environment.STUDENT_TEST_DATABASE_DISPOSABLE;
  if (confirmation !== "1") {
    throw new Error(
      `Lesson ${context.lesson} checks can exercise PostgreSQL state. Set STUDENT_TEST_DATABASE_DISPOSABLE=1 only after configuring an isolated disposable test database; automated checks do not load .env files.`,
    );
  }
  const portText = environment.COURSE_TEST_DATABASE_PORT;
  const port = Number(portText);
  if (!portText || !Number.isInteger(port) || port < 1 || port > 65_535)
    throw new Error(
      "Lesson 13+ checks require an explicit COURSE_TEST_DATABASE_PORT for the disposable test database.",
    );
  for (const [key, value] of Object.entries(environment)) {
    if (!/^LESSON13_(?:OPENROUTER_)?(?:ADMIN|READ|WRITE|AGENT)_DATABASE_URL$/u.test(key) || !value)
      continue;
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`The explicit test database setting ${key} is not a valid URL.`);
    }
    const localHost = ["localhost", "127.0.0.1", "::1"].includes(
      parsed.hostname.replace(/^\[|\]$/gu, "").toLowerCase(),
    );
    let databaseName = "";
    try {
      databaseName = decodeURIComponent(parsed.pathname.replace(/^\//u, ""));
    } catch {
      throw new Error(`The explicit test database setting ${key} has an invalid database name.`);
    }
    if (
      !["postgres:", "postgresql:"].includes(parsed.protocol) ||
      !localHost ||
      Number(parsed.port) !== port ||
      databaseName.length === 0
    )
      throw new Error(
        `The explicit test database setting ${key} must use a PostgreSQL URL for a local host, a database name, and COURSE_TEST_DATABASE_PORT.`,
      );
  }
}

function environmentFor(context: StudentLessonContext, mode: "tests" | "eval"): NodeJS.ProcessEnv {
  const environment = safeOfflineEnvironment(process.env);
  if (Number(context.lesson) < 13 || process.env.STUDENT_TEST_DATABASE_DISPOSABLE !== "1")
    return environment;
  // Only explicit Lesson 13 test-database variables are passed through after the disposable-DB gate.
  for (const [key, value] of Object.entries(process.env)) {
    if (
      /^LESSON13_(?:OPENROUTER_)?(?:ADMIN|READ|WRITE|AGENT)_DATABASE_URL$/u.test(key) &&
      value !== undefined
    )
      environment[key] = value;
  }
  const port = process.env.COURSE_TEST_DATABASE_PORT;
  if (port) environment.COURSE_TEST_DATABASE_PORT = port;
  if (mode === "tests") environment.STUDENT_TEST_DATABASE_DISPOSABLE = "1";
  return environment;
}

async function collectCodeFiles(root: string): Promise<Map<string, Buffer>> {
  const result = new Map<string, Buffer>();
  for (const file of await collectFiles(root)) {
    if (!codeExtensions.has(extname(file))) continue;
    const rel = relative(root, file).replaceAll("\\", "/");
    if (!/^(?:src|evals|tests|scripts|client|integration-tests)\//u.test(rel)) continue;
    result.set(rel, await readFile(file));
  }
  return result;
}

async function collectSourceFiles(root: string): Promise<string[]> {
  return (await collectFiles(root)).filter((file) => codeExtensions.has(extname(file)));
}

async function collectFiles(root: string, relativePath = ""): Promise<string[]> {
  const metadata = await lstat(root).catch((error: unknown) =>
    isMissing(error) ? undefined : Promise.reject(error),
  );
  if (!metadata) return [];
  if (metadata.isSymbolicLink()) throw new Error(`Student tree contains a symbolic link: ${root}.`);
  if (metadata.isFile()) return codeExtensions.has(extname(root)) ? [root] : [];
  if (!metadata.isDirectory()) return [];
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name) || isCredentialFile(entry.name)) continue;
    if (entry.name.startsWith(".") && entry.name !== safeExampleFile) continue;
    const child = resolve(root, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`Student tree contains a symbolic link: ${join(relativePath, entry.name)}.`);
    if (entry.isDirectory())
      files.push(...(await collectFiles(child, join(relativePath, entry.name))));
    else if (entry.isFile() && codeExtensions.has(extname(child))) files.push(child);
  }
  return files.sort();
}

async function findUnsafePaths(root: string, relativePath = ""): Promise<string[]> {
  const unsafe: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const rel = join(relativePath, entry.name).replaceAll("\\", "/");
    if (entry.isSymbolicLink()) {
      unsafe.push(`${rel} (symlink)`);
      continue;
    }
    if (credentialFile.test(entry.name) && entry.name !== safeExampleFile) {
      unsafe.push(`${rel} (credential file)`);
      continue;
    }
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name))
      unsafe.push(...(await findUnsafePaths(resolve(root, entry.name), rel)));
  }
  return unsafe;
}

async function copyTree(
  source: string,
  destination: string,
  options: { rejectSymlinks: boolean; omitCredentials: boolean },
  relativePath = "",
): Promise<void> {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name) || entry.name === ".git") continue;
    if (options.omitCredentials && isCredentialFile(entry.name) && entry.name !== safeExampleFile)
      continue;
    if (entry.name.startsWith(".") && entry.name !== safeExampleFile) continue;
    const sourcePath = resolve(source, entry.name);
    const targetPath = resolve(destination, entry.name);
    const rel = join(relativePath, entry.name);
    if (entry.isSymbolicLink()) {
      if (options.rejectSymlinks) throw new Error(`Refusing to copy symlink ${rel}.`);
      continue;
    }
    if (entry.isDirectory()) await copyTree(sourcePath, targetPath, options, rel);
    else if (entry.isFile()) {
      await mkdir(dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
    }
  }
}

async function copyNonCodeAssets(source: string, target: string, relativePath = ""): Promise<void> {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name) || entry.name === ".git" || isCredentialFile(entry.name))
      continue;
    if (entry.name.startsWith(".") && entry.name !== safeExampleFile) continue;
    const sourcePath = resolve(source, entry.name);
    const rel = join(relativePath, entry.name);
    const targetPath = resolve(target, rel);
    if (entry.isSymbolicLink()) throw new Error(`Fixture contains a symbolic link: ${rel}.`);
    if (entry.isDirectory()) {
      await mkdir(targetPath, { recursive: true });
      await copyNonCodeAssets(sourcePath, target, rel);
    } else if (entry.isFile() && !codeExtensions.has(extname(entry.name))) {
      await mkdir(dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
    }
  }
}

async function ensureTempRoot(root: string): Promise<string> {
  const repository = await realpath(root);
  let metadata = await lstat(tempRoot).catch((error: unknown) =>
    isMissing(error) ? undefined : Promise.reject(error),
  );
  if (metadata?.isSymbolicLink()) throw new Error("Repository .tmp must not be a symbolic link.");
  if (metadata && !metadata.isDirectory()) throw new Error("Repository .tmp must be a directory.");
  if (!metadata) {
    await mkdir(tempRoot);
    metadata = await lstat(tempRoot);
  }
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new Error("Repository .tmp must be a real directory.");
  const realTemp = await realpath(tempRoot);
  assertContained(repository, realTemp, "Repository .tmp resolves outside the repository.");
  return realTemp;
}

async function ensureMyDevRoot(root: string): Promise<string> {
  const repository = await realpath(root);
  let metadata = await lstat(myDevRoot).catch((error: unknown) =>
    isMissing(error) ? undefined : Promise.reject(error),
  );
  if (metadata?.isSymbolicLink()) throw new Error("my-dev must not be a symbolic link.");
  if (metadata && !metadata.isDirectory()) throw new Error("my-dev must be a directory.");
  if (!metadata) {
    await mkdir(myDevRoot);
    metadata = await lstat(myDevRoot);
  }
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new Error("my-dev must be a real directory.");
  const realMyDev = await realpath(myDevRoot);
  assertContained(repository, realMyDev, "my-dev resolves outside the repository.");
  return realMyDev;
}

async function removeOwnedTree(parentReal: string, target: string): Promise<void> {
  const resolvedTarget = resolve(target);
  assertContained(
    parentReal,
    resolvedTarget,
    "Refusing to remove a path outside the owned temporary directory.",
  );
  const metadata = await lstat(resolvedTarget).catch((error: unknown) =>
    isMissing(error) ? undefined : Promise.reject(error),
  );
  if (!metadata) return;
  if (metadata.isSymbolicLink())
    throw new Error("Refusing to remove a symbolic link from an owned temporary path.");
  await rm(resolvedTarget, { recursive: true, force: true });
}

async function findFocusedTests(files: string[]): Promise<string[]> {
  const result: string[] = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (/\b(?:describe|it|test)\.only\s*\(/u.test(source))
      result.push(relative(repositoryRoot, file));
  }
  return result;
}

async function isFile(path: string): Promise<boolean> {
  const metadata = await lstat(path).catch((error: unknown) =>
    isMissing(error) ? undefined : Promise.reject(error),
  );
  return Boolean(metadata?.isFile() && !metadata.isSymbolicLink());
}

function runNode(
  executable: string,
  args: string[],
  cwd: string,
  environment: NodeJS.ProcessEnv = safeOfflineEnvironment(process.env),
): void {
  const result = spawnSync(process.execPath, [executable, ...args], {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
    maxBuffer: 32 * 1024 * 1024,
    env: environment,
  });
  emitChildOutput(result.stdout, result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `Command failed with exit code ${result.status ?? "unknown"}: ${basename(executable)}.`,
    );
}

function runNodeTsEntrypoint(
  entrypoint: string,
  args: string[],
  cwd: string,
  environment: NodeJS.ProcessEnv = safeOfflineEnvironment(process.env),
): void {
  runNode(
    resolve(repositoryRoot, "scripts", "run-tsx-entrypoint.mjs"),
    [resolve(repositoryRoot, entrypoint), ...args],
    cwd,
    environment,
  );
}

function safeOfflineEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const safe: NodeJS.ProcessEnv = { ...environment };
  for (const key of Object.keys(safe)) {
    if (
      /(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH|OPENROUTER|OPENAI|DATABASE_URL|DB_URL|^PG(?:HOST|PORT|USER|PASSWORD|DATABASE)$)/iu.test(
        key,
      )
    )
      delete safe[key];
  }
  delete safe.DOTENV_CONFIG_PATH;
  return safe;
}

function emitChildOutput(stdout: string | null, stderr: string | null): void {
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

function buffersEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && left.equals(right);
}

function isCredentialFile(name: string): boolean {
  return credentialFile.test(name) && name !== safeExampleFile;
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isWithin(parent: string, child: string): boolean {
  const path = relative(resolve(parent), resolve(child));
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

function assertContained(parent: string, child: string, message: string): void {
  if (!isWithin(parent, child)) throw new Error(message);
}

async function main(): Promise<void> {
  const { action, lesson, provider } = parseStudentArguments(process.argv.slice(2));
  const context = await resolveStudentLesson(repositoryRoot, lesson, provider);
  await runStudentAction(action, context);
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Student workspace command failed.");
    process.exitCode = 1;
  });
}
