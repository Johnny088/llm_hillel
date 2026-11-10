import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFile,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  stat,
} from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";

const sourceExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
interface IncompletePattern {
  label: string;
  pattern: RegExp;
}

const incompletePatterns = [
  { label: "todo test", pattern: /\b(?:describe|it|test)\.(?:todo|todoIf)\s*\(/u },
  {
    label: "skipped or conditional test",
    pattern: /\b(?:describe|it|test)\.(?:skip|only|skipIf|runIf)\s*\(/u,
  },
  { label: "NOT_IMPLEMENTED marker", pattern: /\bNOT_IMPLEMENTED\b/u },
  { label: "STARTER_TODO marker", pattern: /\bSTARTER_TODO\b/u },
] satisfies IncompletePattern[];
const lesson03IncompletePatterns: readonly IncompletePattern[] = [
  ...incompletePatterns,
  { label: "TODO marker", pattern: /\bTODO\b/u },
];
const lesson06IncompletePatterns: readonly IncompletePattern[] = [
  ...lesson03IncompletePatterns,
  {
    label: "HTTP 501 placeholder",
    pattern:
      /(?:\.status\s*\(\s*501\b|\bsendStatus\s*\(\s*501\b|\bstatus(?:Code)?\s*:\s*501\b|\bHTTP_(?:STATUS_)?NOT_IMPLEMENTED\b)/u,
  },
];
const activeTestPattern = /\b(?:it|test)\s*\(/gu;
const lesson05ActiveTestPattern = /\b(?:it|test)(?:\.(?:each|for|runIf|skipIf))?\s*\(/gu;
const lesson05AcceptanceTestPaths = [
  "tests/agent-route.test.ts",
  "tests/app.test.ts",
  "tests/config-and-metrics.test.ts",
  "tests/conversation-manager.test.ts",
  "tests/evals.test.ts",
  "tests/filesystem-client.test.ts",
  "tests/filesystem-tools.test.ts",
  "tests/json-stores.test.ts",
  "tests/mcp-web-search-agent.test.ts",
  "tests/openrouter-document-ai.test.ts",
  "tests/runtime.test.ts",
  "tests/server-lifecycle.test.ts",
  "tests/tool-calling.test.ts",
  "tests/tool-evals.test.ts",
  "tests/user-facts.test.ts",
] as const;

interface IncompleteLocation {
  file: string;
  line: number;
  label: string;
}

interface ContractFailure {
  path: string;
  message: string;
}

async function collectSourceFiles(target: string): Promise<string[]> {
  const targetPath = resolve(target);
  const targetStat = await stat(targetPath);

  if (targetStat.isFile()) {
    return sourceExtensions.has(extname(targetPath)) ? [targetPath] : [];
  }

  if (!targetStat.isDirectory()) {
    return [];
  }

  const entries = await readdir(targetPath, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map((entry) => collectSourceFiles(resolve(targetPath, entry.name))),
  );

  return nestedFiles.flat();
}

async function collectLesson05SourceFiles(target: string): Promise<string[]> {
  const targetPath = resolve(target);
  const entry = await lstat(targetPath);
  if (entry.isSymbolicLink()) return [];
  if (entry.isFile()) return sourceExtensions.has(extname(targetPath)) ? [targetPath] : [];
  if (!entry.isDirectory()) return [];

  const entries = await readdir(targetPath, { withFileTypes: true });
  const files: string[] = [];
  for (const child of entries) {
    if (child.isSymbolicLink()) continue;
    const childPath = resolve(targetPath, child.name);
    if (child.isDirectory()) {
      files.push(...(await collectLesson05SourceFiles(childPath)));
    } else if (child.isFile() && sourceExtensions.has(extname(childPath))) {
      files.push(childPath);
    }
  }
  return files.sort();
}

async function collectAvailableLesson06SourceFiles(targets: readonly string[]): Promise<string[]> {
  const files: string[] = [];
  for (const target of targets) {
    try {
      files.push(...(await collectLesson05SourceFiles(target)));
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        continue;
      }
      throw error;
    }
  }
  return files.sort();
}

async function copyCandidateTree(source: string, destination: string): Promise<void> {
  const entry = await lstat(source);
  if (!entry.isDirectory()) {
    throw new Error(`Lesson 04 student path must be a directory: ${source}`);
  }
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });
  const allowedExtensions = new Set([...sourceExtensions, ".json", ".md", ".txt"]);

  for (const child of entries) {
    if (child.isSymbolicLink() || child.name.startsWith(".")) continue;
    const childSource = resolve(source, child.name);
    const childDestination = resolve(destination, child.name);
    if (child.isDirectory()) {
      await copyCandidateTree(childSource, childDestination);
    } else if (child.isFile() && allowedExtensions.has(extname(child.name))) {
      await copyFile(childSource, childDestination);
    }
  }
}

async function findIncompleteLocations(
  targets: string[],
  patterns: readonly IncompletePattern[] = incompletePatterns,
): Promise<IncompleteLocation[]> {
  const files = (await Promise.all(targets.map(collectSourceFiles))).flat().sort();
  const locations: IncompleteLocation[] = [];

  for (const file of files) {
    const lines = (await readFile(file, "utf8")).split(/\r?\n/u);

    for (const [index, line] of lines.entries()) {
      for (const marker of patterns) {
        if (marker.pattern.test(line)) {
          locations.push({ file, line: index + 1, label: marker.label });
        }
      }
    }
  }

  return locations;
}

function findStarterRoot(target: string): string | undefined {
  let current = resolve(target);

  while (true) {
    if (basename(current) === "starter") {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

async function verifyRagCompletionContract(targets: string[]): Promise<ContractFailure[]> {
  const starterRoots = [...new Set(targets.map(findStarterRoot).filter(Boolean))] as string[];
  const failures: ContractFailure[] = [];

  for (const starterRoot of starterRoots) {
    const lessonName = basename(dirname(starterRoot));

    if (lessonName !== "lesson-06-rag" && lessonName !== "lesson-06-rag-openrouter") {
      continue;
    }

    const ragServicePath = resolve(starterRoot, "src/services/rag-assistant.ts");
    const evalRunnerPath = resolve(starterRoot, "evals/run.ts");
    const testFiles = await collectSourceFiles(resolve(starterRoot, "tests"));
    let activeTests = 0;

    for (const testFile of testFiles) {
      const source = await readFile(testFile, "utf8");
      activeTests += source.match(activeTestPattern)?.length ?? 0;
    }

    if (activeTests < 8) {
      failures.push({
        path: resolve(starterRoot, "tests"),
        message: `expected at least 8 active tests after replacing 5 todo cases; found ${activeTests}`,
      });
    }

    try {
      const ragServiceStat = await stat(ragServicePath);
      if (!ragServiceStat.isFile()) {
        throw new Error("not a file");
      }
    } catch {
      failures.push({
        path: ragServicePath,
        message: "missing completed Retriever/RagAssistant service",
      });
    }

    const evalRunner = await readFile(evalRunnerPath, "utf8");
    for (const [marker, description] of [
      ["RagAssistant", "instantiate RagAssistant"],
      ["runRefusalEvals", "expose the refusal eval runner"],
      ["Result:", "print the final Result: passed/total summary"],
    ] as const) {
      if (!evalRunner.includes(marker)) {
        failures.push({ path: evalRunnerPath, message: `must ${description}` });
      }
    }
  }

  return failures;
}

const targets = process.argv.slice(2);

const lesson03Mode = targets[0] === "--lesson03-openrouter";
const lesson04Mode = targets[0] === "--lesson04-openrouter";
const lesson05Mode = targets[0] === "--lesson05-openrouter";
const lesson06Mode = targets[0] === "--lesson06-openrouter";
const lesson07Mode = targets[0] === "--lesson07-openrouter";
const lesson08Mode = targets[0] === "--lesson08-openrouter";
const lesson09Mode = targets[0] === "--lesson09-openrouter";
const lesson10Mode = targets[0] === "--lesson10-openrouter";
const lesson11Mode = targets[0] === "--lesson11-openrouter";
const lesson12Mode = targets[0] === "--lesson12-openrouter";
const lesson13Mode = targets[0] === "--lesson13-openrouter";

async function verifyLesson03OpenRouterCompletion(studentRootInput: string): Promise<void> {
  const repositoryRoot = process.cwd();
  const studentRoot = resolve(repositoryRoot, studentRootInput);
  const relativeStudentRoot = relative(repositoryRoot, studentRoot);

  if (
    relativeStudentRoot === "" ||
    relativeStudentRoot.startsWith(`..${sep}`) ||
    relativeStudentRoot === ".." ||
    isAbsolute(relativeStudentRoot)
  ) {
    throw new Error("Lesson 03 completion target must be inside this repository.");
  }

  const sourceRoot = resolve(studentRoot, "src");
  const evalRoot = resolve(studentRoot, "evals");
  const testRoot = resolve(studentRoot, "tests");
  const requiredFiles = [
    "src/schemas/agent-request.ts",
    "src/tools/currency.ts",
    "src/lib/tool-errors.ts",
    "src/lib/retry.ts",
    "src/services/tool-calling-agent.ts",
    "src/app.ts",
    "src/server.ts",
    "evals/tool-calling.eval.ts",
    "evals/tool-calling-scorer.ts",
    "evals/run-tool-calling.ts",
    "evals/recorded-tool-results.ts",
    "tests/tool-calling.test.ts",
    "tests/agent-route.test.ts",
    "tests/tool-evals.test.ts",
  ];
  const failures: string[] = [];

  for (const requiredFile of requiredFiles) {
    try {
      const target = resolve(studentRoot, requiredFile);
      const targetStat = await stat(target);
      if (!targetStat.isFile()) throw new Error("not a file");
    } catch {
      failures.push(`missing required Lesson 03 implementation file: ${requiredFile}`);
    }
  }

  if (failures.length > 0) {
    console.error(`Lesson 03 OpenRouter completion gate failed for ${relativeStudentRoot}:`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  const incomplete = await findIncompleteLocations(
    [sourceRoot, evalRoot, testRoot],
    lesson03IncompletePatterns,
  );
  const studentTestPaths = [
    resolve(testRoot, "tool-calling.test.ts"),
    resolve(testRoot, "agent-route.test.ts"),
    resolve(testRoot, "tool-evals.test.ts"),
  ];
  const emptyStudentTests: string[] = [];

  for (const studentTestPath of studentTestPaths) {
    const source = await readFile(studentTestPath, "utf8");
    const activeTests = (source.match(activeTestPattern) ?? []).length;
    if (activeTests === 0) emptyStudentTests.push(relative(repositoryRoot, studentTestPath));
  }

  const implementationFiles = (await collectSourceFiles(sourceRoot))
    .concat(await collectSourceFiles(evalRoot))
    .concat(await collectSourceFiles(testRoot));
  const solutionImports: string[] = [];

  for (const file of implementationFiles) {
    const source = await readFile(file, "utf8");
    if (/from\s+["'][^"']*\/solution\/|import\s*\(["'][^"']*\/solution\//u.test(source)) {
      solutionImports.push(relative(repositoryRoot, file));
    }
  }

  if (incomplete.length > 0 || solutionImports.length > 0 || emptyStudentTests.length > 0) {
    console.error(
      `Lesson 03 OpenRouter completion gate failed: ${incomplete.length} incomplete marker(s), ` +
        `${solutionImports.length} import(s) from a ready solution, ` +
        `${emptyStudentTests.length} empty student test file(s).`,
    );
    for (const location of incomplete) {
      console.error(
        `- ${relative(repositoryRoot, location.file)}:${location.line} (${location.label})`,
      );
    }
    for (const file of solutionImports) console.error(`- forbidden solution import: ${file}`);
    for (const file of emptyStudentTests) console.error(`- no active student tests: ${file}`);
    process.exitCode = 1;
    return;
  }

  const tempRoot = resolve(repositoryRoot, ".tmp", "lesson03-openrouter-completion");
  await mkdir(tempRoot, { recursive: true });
  const fixtureRoot = await mkdtemp(resolve(tempRoot, "completion-"));
  const fixtureRelative = relative(tempRoot, fixtureRoot);

  if (
    fixtureRelative === "" ||
    fixtureRelative === ".." ||
    fixtureRelative.startsWith(`..${sep}`) ||
    isAbsolute(fixtureRelative)
  ) {
    throw new Error("Lesson 03 completion fixture escaped its guarded temporary directory.");
  }

  try {
    await cp(sourceRoot, resolve(fixtureRoot, "src"), { recursive: true });
    await cp(evalRoot, resolve(fixtureRoot, "evals"), { recursive: true });
    await cp(testRoot, resolve(fixtureRoot, "tests"), { recursive: true });
    const acceptanceTests = resolve(fixtureRoot, "acceptance-tests");
    await mkdir(acceptanceTests, { recursive: true });

    for (const testName of ["tool-calling.test.ts", "agent-route.test.ts", "tool-evals.test.ts"]) {
      const sourceTest = resolve(
        repositoryRoot,
        "lesson-03-function-calling-openrouter",
        "solution",
        "tests",
        testName,
      );
      await copyFile(sourceTest, resolve(acceptanceTests, testName));
    }

    const vitestCli = resolve(repositoryRoot, "node_modules", "vitest", "vitest.mjs");
    execFileSync(
      process.execPath,
      [
        vitestCli,
        "run",
        "--root",
        fixtureRoot,
        "--config",
        resolve(repositoryRoot, "vitest.config.ts"),
        "tests",
        "acceptance-tests",
      ],
      {
        cwd: repositoryRoot,
        stdio: "inherit",
      },
    );

    const tsxHelper = resolve(repositoryRoot, "scripts", "run-tsx-entrypoint.mjs");
    const fixtureEvalRunner = relative(
      repositoryRoot,
      resolve(fixtureRoot, "evals", "run-tool-calling.ts"),
    );
    execFileSync(process.execPath, [tsxHelper, fixtureEvalRunner], {
      cwd: repositoryRoot,
      stdio: "inherit",
    });
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }

  console.log(
    `PASS Lesson 03 OpenRouter completion: tested ${implementationFiles.length} student source/eval files from ${relativeStudentRoot}; solution tests ran against the fixture copy.`,
  );
}

if (lesson03Mode) {
  if (targets.length !== 2) {
    throw new Error(
      "Usage: assert-starter-complete.ts --lesson03-openrouter <student-lesson-root>",
    );
  }

  await verifyLesson03OpenRouterCompletion(targets[1]!);
  process.exit(process.exitCode ?? 0);
}

async function verifyLesson04OpenRouterCompletion(studentRootInput: string): Promise<void> {
  const repositoryRoot = process.cwd();
  const studentRoot = resolve(repositoryRoot, studentRootInput);
  const relativeStudentRoot = relative(repositoryRoot, studentRoot);

  if (
    relativeStudentRoot === "" ||
    relativeStudentRoot.startsWith(`..${sep}`) ||
    relativeStudentRoot === ".." ||
    isAbsolute(relativeStudentRoot)
  ) {
    throw new Error("Lesson 04 completion target must be inside this repository.");
  }

  const realRepositoryRoot = await realpath(repositoryRoot);
  const realStudentRoot = await realpath(studentRoot);
  const realRelativeStudentRoot = relative(realRepositoryRoot, realStudentRoot);
  if (
    realRelativeStudentRoot === "" ||
    realRelativeStudentRoot.startsWith(`..${sep}`) ||
    realRelativeStudentRoot === ".." ||
    isAbsolute(realRelativeStudentRoot)
  ) {
    throw new Error("Lesson 04 completion target resolves outside this repository.");
  }

  const sourceRoot = resolve(studentRoot, "src");
  const evalRoot = resolve(studentRoot, "evals");
  const testRoot = resolve(studentRoot, "tests");
  const smokeScript = resolve(studentRoot, "scripts", "smoke-filesystem-mcp.ts");
  const requiredFiles = [
    "src/app.ts",
    "src/server.ts",
    "src/runtime.ts",
    "src/services/mcp-web-search-agent.ts",
    "src/mcp/filesystem-tools.ts",
    "src/mcp/filesystem-client.ts",
    "scripts/smoke-filesystem-mcp.ts",
    "evals/run.ts",
    "evals/run-tool-calling.ts",
    "evals/mcp-tools.eval.ts",
    "evals/scorer.ts",
    "evals/recorded-results.ts",
    "tests/app.test.ts",
    "tests/mcp-web-search-agent.test.ts",
    "tests/filesystem-tools.test.ts",
    "tests/evals.test.ts",
  ];
  const failures: string[] = [];

  for (const requiredFile of requiredFiles) {
    try {
      const target = resolve(studentRoot, requiredFile);
      const targetStat = await stat(target);
      if (!targetStat.isFile()) throw new Error("not a file");
    } catch {
      failures.push(`missing required Lesson 04 implementation file: ${requiredFile}`);
    }
  }

  if (failures.length > 0) {
    console.error(`Lesson 04 OpenRouter completion gate failed for ${relativeStudentRoot}:`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  const incomplete = await findIncompleteLocations(
    [sourceRoot, evalRoot, testRoot, smokeScript],
    lesson03IncompletePatterns,
  );
  const studentTestFiles = (await collectSourceFiles(testRoot)).filter((file) =>
    /\.test\.tsx?$/u.test(file),
  );
  let activeTests = 0;
  const emptyStudentTests: string[] = [];

  for (const testFile of studentTestFiles) {
    const source = await readFile(testFile, "utf8");
    const fileActiveTests = (source.match(activeTestPattern) ?? []).length;
    activeTests += fileActiveTests;
    if (fileActiveTests === 0) emptyStudentTests.push(relative(repositoryRoot, testFile));
  }

  const implementationFiles = (await collectSourceFiles(sourceRoot))
    .concat(await collectSourceFiles(evalRoot))
    .concat(await collectSourceFiles(testRoot), [smokeScript]);
  const solutionImports: string[] = [];

  for (const file of implementationFiles) {
    const source = await readFile(file, "utf8");
    if (/from\s+["'][^"']*\/solution\/|import\s*\(["'][^"']*\/solution\//u.test(source)) {
      solutionImports.push(relative(repositoryRoot, file));
    }
  }

  if (
    incomplete.length > 0 ||
    solutionImports.length > 0 ||
    emptyStudentTests.length > 0 ||
    activeTests === 0
  ) {
    console.error(
      `Lesson 04 OpenRouter completion gate failed: ${incomplete.length} incomplete marker(s), ` +
        `${solutionImports.length} import(s) from a ready solution, ` +
        `${emptyStudentTests.length} empty student test file(s), ${activeTests} direct student test declaration(s).`,
    );
    for (const location of incomplete) {
      console.error(
        `- ${relative(repositoryRoot, location.file)}:${location.line} (${location.label})`,
      );
    }
    for (const file of solutionImports) console.error(`- forbidden solution import: ${file}`);
    for (const file of emptyStudentTests) console.error(`- no active student tests: ${file}`);
    process.exitCode = 1;
    return;
  }

  const tempRoot = resolve(repositoryRoot, ".tmp", "lesson04-openrouter-completion");
  await mkdir(tempRoot, { recursive: true });
  const fixtureRoot = await mkdtemp(resolve(tempRoot, "completion-"));
  const fixtureRelative = relative(tempRoot, fixtureRoot);

  if (
    fixtureRelative === "" ||
    fixtureRelative === ".." ||
    fixtureRelative.startsWith(`..${sep}`) ||
    isAbsolute(fixtureRelative)
  ) {
    throw new Error("Lesson 04 completion fixture escaped its guarded temporary directory.");
  }

  try {
    await copyCandidateTree(sourceRoot, resolve(fixtureRoot, "src"));
    await copyCandidateTree(evalRoot, resolve(fixtureRoot, "evals"));
    await copyCandidateTree(testRoot, resolve(fixtureRoot, "tests"));
    const fixtureSmoke = resolve(fixtureRoot, "scripts", "smoke-filesystem-mcp.ts");
    await mkdir(dirname(fixtureSmoke), { recursive: true });
    await copyFile(smokeScript, fixtureSmoke);
    const fixtureTests = resolve(fixtureRoot, "tests");

    const solutionTestRoot = resolve(
      repositoryRoot,
      "lesson-04-mcp-built-in-tools-openrouter",
      "solution",
      "tests",
    );
    const solutionTestFiles = (await collectSourceFiles(solutionTestRoot)).filter((file) =>
      /\.test\.tsx?$/u.test(file),
    );
    if (solutionTestFiles.length === 0) {
      throw new Error("Lesson 04 solution acceptance test suite is empty.");
    }
    const incompleteAcceptanceTests = await findIncompleteLocations(
      solutionTestFiles,
      lesson03IncompletePatterns,
    );
    const emptyAcceptanceTests: string[] = [];
    for (const solutionTest of solutionTestFiles) {
      const source = await readFile(solutionTest, "utf8");
      if ((source.match(activeTestPattern) ?? []).length === 0) {
        emptyAcceptanceTests.push(relative(repositoryRoot, solutionTest));
      }
    }
    if (incompleteAcceptanceTests.length > 0 || emptyAcceptanceTests.length > 0) {
      throw new Error(
        `Lesson 04 solution acceptance tests are incomplete: ${incompleteAcceptanceTests.length} marker(s), ` +
          `${emptyAcceptanceTests.length} empty test file(s).`,
      );
    }
    for (const solutionTest of solutionTestFiles) {
      await copyFile(
        solutionTest,
        resolve(fixtureTests, `lesson04-acceptance-${basename(solutionTest)}`),
      );
    }

    const vitestCli = resolve(repositoryRoot, "node_modules", "vitest", "vitest.mjs");
    execFileSync(process.execPath, [vitestCli, "run", "--dir", fixtureTests], {
      cwd: repositoryRoot,
      stdio: "inherit",
    });

    const tsxHelper = resolve(repositoryRoot, "scripts", "run-tsx-entrypoint.mjs");
    const fixtureEvalRunner = relative(repositoryRoot, resolve(fixtureRoot, "evals", "run.ts"));
    execFileSync(process.execPath, [tsxHelper, fixtureEvalRunner, "--mode=all"], {
      cwd: repositoryRoot,
      stdio: "inherit",
    });
    const inheritedToolEvalRunner = relative(
      repositoryRoot,
      resolve(fixtureRoot, "evals", "run-tool-calling.ts"),
    );
    execFileSync(process.execPath, [tsxHelper, inheritedToolEvalRunner], {
      cwd: repositoryRoot,
      stdio: "inherit",
    });
    const fixtureSmokePath = relative(repositoryRoot, fixtureSmoke);
    execFileSync(process.execPath, [tsxHelper, fixtureSmokePath], {
      cwd: repositoryRoot,
      stdio: "inherit",
    });
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }

  console.log(
    `PASS Lesson 04 OpenRouter completion: student implementation, acceptance tests, recorded evals, ` +
      `and local MCP smoke passed against the copied source/evals from ${relativeStudentRoot}.`,
  );
}

if (lesson04Mode) {
  if (targets.length !== 2) {
    throw new Error(
      "Usage: assert-starter-complete.ts --lesson04-openrouter <student-lesson-root>",
    );
  }

  await verifyLesson04OpenRouterCompletion(targets[1]!);
  process.exit(process.exitCode ?? 0);
}

async function verifyLesson05OpenRouterCompletion(candidateRootInput: string): Promise<void> {
  const repositoryRoot = process.cwd();
  const candidateRoot = resolve(repositoryRoot, candidateRootInput);
  const relativeCandidateRoot = relative(repositoryRoot, candidateRoot);

  if (
    relativeCandidateRoot === "" ||
    relativeCandidateRoot.startsWith(`..${sep}`) ||
    relativeCandidateRoot === ".." ||
    isAbsolute(relativeCandidateRoot)
  ) {
    throw new Error("Lesson 05 completion target must be inside this repository.");
  }

  const realRepositoryRoot = await realpath(repositoryRoot);
  const realCandidateRoot = await realpath(candidateRoot);
  const realRelativeCandidateRoot = relative(realRepositoryRoot, realCandidateRoot);
  if (
    realRelativeCandidateRoot === "" ||
    realRelativeCandidateRoot.startsWith(`..${sep}`) ||
    realRelativeCandidateRoot === ".." ||
    isAbsolute(realRelativeCandidateRoot)
  ) {
    throw new Error("Lesson 05 completion target resolves outside this repository.");
  }

  const sourceRoot = resolve(candidateRoot, "src");
  const evalRoot = resolve(candidateRoot, "evals");
  const testRoot = resolve(candidateRoot, "tests");
  const requiredFiles = [
    "src/app.ts",
    "src/server.ts",
    "src/runtime.ts",
    "src/memory/conversation-history.ts",
    "src/memory/user-facts.ts",
    "src/schemas/conversation-request.ts",
    "src/services/conversation-manager.ts",
    "evals/memory.eval.ts",
    "evals/run.ts",
    ...lesson05AcceptanceTestPaths,
  ];
  const failures: string[] = [];

  for (const requiredFile of requiredFiles) {
    try {
      const target = resolve(candidateRoot, requiredFile);
      const targetStat = await stat(target);
      if (!targetStat.isFile()) throw new Error("not a file");
    } catch {
      failures.push(`missing required Lesson 05 memory implementation file: ${requiredFile}`);
    }
  }

  if (failures.length > 0) {
    console.error(`Lesson 05 OpenRouter completion gate failed for ${relativeCandidateRoot}:`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  const candidateTests = (await collectLesson05SourceFiles(testRoot)).filter((file) =>
    /\.test\.tsx?$/u.test(file),
  );
  let activeCandidateTests = 0;
  const emptyCandidateTests: string[] = [];
  for (const testFile of candidateTests) {
    const source = await readFile(testFile, "utf8");
    const activeCount = (source.match(lesson05ActiveTestPattern) ?? []).length;
    activeCandidateTests += activeCount;
    if (activeCount === 0) emptyCandidateTests.push(relative(repositoryRoot, testFile));
  }

  const candidateFiles = (await collectLesson05SourceFiles(sourceRoot)).concat(
    await collectLesson05SourceFiles(evalRoot),
    await collectLesson05SourceFiles(testRoot),
  );
  const incomplete = await findIncompleteLocations(candidateFiles, lesson03IncompletePatterns);
  const forbiddenCanonicalImports: string[] = [];
  for (const file of candidateFiles) {
    const source = await readFile(file, "utf8");
    if (
      /(?:\bfrom\s*|\bimport(?:\s*\(\s*)?|\brequire\s*\(\s*)["'][^"']*lesson-\d{2}[^"']*\/(?:starter|solution)\//iu.test(
        source,
      )
    ) {
      forbiddenCanonicalImports.push(relative(repositoryRoot, file));
    }
  }

  const solutionTestRoot = resolve(
    repositoryRoot,
    "lesson-05-memory-openrouter",
    "solution",
    "tests",
  );
  const solutionTestFiles = (await collectLesson05SourceFiles(solutionTestRoot)).filter((file) =>
    /\.test\.tsx?$/u.test(file),
  );
  for (const requiredTest of lesson05AcceptanceTestPaths) {
    try {
      const requiredTestPath = resolve(solutionTestRoot, requiredTest.slice("tests/".length));
      const requiredTestStat = await stat(requiredTestPath);
      if (!requiredTestStat.isFile()) throw new Error("not a file");
    } catch {
      failures.push(`missing required Lesson 05 acceptance test: ${requiredTest}`);
    }
  }
  let activeAcceptanceTests = 0;
  const emptyAcceptanceTests: string[] = [];
  for (const testFile of solutionTestFiles) {
    const source = await readFile(testFile, "utf8");
    const activeCount = (source.match(lesson05ActiveTestPattern) ?? []).length;
    activeAcceptanceTests += activeCount;
    if (activeCount === 0) emptyAcceptanceTests.push(relative(repositoryRoot, testFile));
  }
  const incompleteAcceptanceTests = await findIncompleteLocations(
    solutionTestFiles,
    lesson03IncompletePatterns,
  );

  if (
    incomplete.length > 0 ||
    forbiddenCanonicalImports.length > 0 ||
    emptyCandidateTests.length > 0 ||
    activeCandidateTests === 0 ||
    solutionTestFiles.length === 0 ||
    incompleteAcceptanceTests.length > 0 ||
    emptyAcceptanceTests.length > 0 ||
    activeAcceptanceTests === 0
  ) {
    console.error(
      `Lesson 05 OpenRouter completion gate failed: ${incomplete.length} incomplete marker(s), ` +
        `${forbiddenCanonicalImports.length} canonical cross-lesson starter/solution import(s), ` +
        `${emptyCandidateTests.length} empty student test file(s), ${activeCandidateTests} direct student test declaration(s), ` +
        `${solutionTestFiles.length} solution acceptance test file(s), ${activeAcceptanceTests} active acceptance declaration(s).`,
    );
    for (const location of incomplete) {
      console.error(
        `- ${relative(repositoryRoot, location.file)}:${location.line} (${location.label})`,
      );
    }
    for (const file of forbiddenCanonicalImports)
      console.error(`- forbidden canonical cross-lesson starter/solution import: ${file}`);
    for (const file of emptyCandidateTests) console.error(`- no active student tests: ${file}`);
    for (const location of incompleteAcceptanceTests) {
      console.error(
        `- incomplete solution acceptance test ${relative(repositoryRoot, location.file)}:${location.line} (${location.label})`,
      );
    }
    for (const file of emptyAcceptanceTests)
      console.error(`- no active solution acceptance tests: ${file}`);
    process.exitCode = 1;
    return;
  }

  const tempRoot = resolve(repositoryRoot, ".tmp", "lesson05-openrouter-completion");
  await mkdir(tempRoot, { recursive: true });
  const fixtureRoot = await mkdtemp(resolve(tempRoot, "candidate-"));
  const fixtureRelative = relative(tempRoot, fixtureRoot);

  if (
    fixtureRelative === "" ||
    fixtureRelative === ".." ||
    fixtureRelative.startsWith(`..${sep}`) ||
    isAbsolute(fixtureRelative)
  ) {
    throw new Error("Lesson 05 completion fixture escaped its guarded temporary directory.");
  }

  const candidateFixture = resolve(fixtureRoot, "candidate");
  const acceptanceFixture = resolve(fixtureRoot, "acceptance");
  try {
    await copyCandidateTree(sourceRoot, resolve(candidateFixture, "src"));
    await copyCandidateTree(evalRoot, resolve(candidateFixture, "evals"));
    await copyCandidateTree(testRoot, resolve(candidateFixture, "tests"));
    const candidateSandbox = resolve(candidateRoot, "sandbox");
    try {
      if ((await stat(candidateSandbox)).isDirectory()) {
        await copyCandidateTree(candidateSandbox, resolve(candidateFixture, "sandbox"));
      }
    } catch {
      // Some completed implementations do not need a local sandbox fixture.
    }

    // The canonical Lesson 05 tests are copied beside candidate source. Their
    // relative ../src imports therefore exercise this candidate, never solution.
    await copyCandidateTree(sourceRoot, resolve(acceptanceFixture, "src"));
    await copyCandidateTree(evalRoot, resolve(acceptanceFixture, "evals"));
    await copyCandidateTree(solutionTestRoot, resolve(acceptanceFixture, "tests"));
    try {
      if ((await stat(candidateSandbox)).isDirectory()) {
        await copyCandidateTree(candidateSandbox, resolve(acceptanceFixture, "sandbox"));
      }
    } catch {
      // The acceptance tests may not require a local sandbox fixture.
    }

    const vitestCli = resolve(repositoryRoot, "node_modules", "vitest", "vitest.mjs");
    for (const fixtureTests of [
      resolve(candidateFixture, "tests"),
      resolve(acceptanceFixture, "tests"),
    ]) {
      execFileSync(process.execPath, [vitestCli, "run", "--dir", fixtureTests], {
        cwd: repositoryRoot,
        stdio: "inherit",
      });
    }

    const tsxHelper = resolve(repositoryRoot, "scripts", "run-tsx-entrypoint.mjs");
    execFileSync(process.execPath, [tsxHelper, resolve(candidateFixture, "evals", "run.ts")], {
      cwd: repositoryRoot,
      stdio: "inherit",
    });
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }

  console.log(
    `PASS Lesson 05 OpenRouter completion: candidate and acceptance suites passed against ${relativeCandidateRoot} ` +
      `(${activeCandidateTests} candidate and ${activeAcceptanceTests} acceptance test declarations); ` +
      `candidate recorded memory eval passed.`,
  );
}

function runLesson06GateCommand(
  args: string[],
  label: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env,
    maxBuffer: 16 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (output.length > 0) process.stdout.write(output);
  if (result.error) throw new Error(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${String(result.status)}.`);
  }
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
      `${label} must report at least ${minPasses} passed tests and zero todo/skipped; summary: ${summary}.`,
    );
  }
  return passed;
}

async function verifyLesson06OpenRouterCompletion(candidateRootInput: string): Promise<void> {
  const repositoryRoot = process.cwd();
  const candidateRoot = resolve(repositoryRoot, candidateRootInput);
  const relativeCandidateRoot = relative(repositoryRoot, candidateRoot);

  if (
    relativeCandidateRoot === "" ||
    relativeCandidateRoot.startsWith(`..${sep}`) ||
    relativeCandidateRoot === ".." ||
    isAbsolute(relativeCandidateRoot)
  ) {
    throw new Error("Lesson 06 completion target must be inside this repository.");
  }

  const realRepositoryRoot = await realpath(repositoryRoot);
  const realCandidateRoot = await realpath(candidateRoot);
  const realRelativeCandidateRoot = relative(realRepositoryRoot, realCandidateRoot);
  if (
    realRelativeCandidateRoot === "" ||
    realRelativeCandidateRoot.startsWith(`..${sep}`) ||
    realRelativeCandidateRoot === ".." ||
    isAbsolute(realRelativeCandidateRoot)
  ) {
    throw new Error("Lesson 06 completion target resolves outside this repository.");
  }

  const testRoot = resolve(candidateRoot, "tests");
  const candidateFiles = await collectAvailableLesson06SourceFiles([
    resolve(candidateRoot, "src"),
    resolve(candidateRoot, "data"),
    resolve(candidateRoot, "evals"),
    testRoot,
  ]);

  const requiredFiles = [
    "src/app.ts",
    "src/server.ts",
    "src/runtime.ts",
    "src/services/conversation-manager.ts",
    "src/services/rag-assistant.ts",
    "src/schemas/rag-request.ts",
    "data/prepared-index.ts",
    "evals/refusal.eval.ts",
    "evals/run.ts",
    "tests/rag-assistant.test.ts",
    "tests/evals.test.ts",
    ...lesson05AcceptanceTestPaths,
  ];
  const failures: string[] = [];
  for (const requiredFile of requiredFiles) {
    try {
      const target = resolve(candidateRoot, requiredFile);
      const targetStat = await lstat(target);
      if (!targetStat.isFile() || targetStat.isSymbolicLink()) throw new Error("not a file");
    } catch {
      failures.push(
        `missing required local Lesson 06 implementation or inherited file: ${requiredFile}`,
      );
    }
  }

  const candidateTests = candidateFiles.filter(
    (file) => file.startsWith(`${testRoot}${sep}`) && /\.test\.tsx?$/u.test(file),
  );
  const emptyCandidateTests: string[] = [];
  let activeCandidateTests = 0;
  for (const testFile of candidateTests) {
    const source = await readFile(testFile, "utf8");
    const activeCount = (source.match(lesson05ActiveTestPattern) ?? []).length;
    activeCandidateTests += activeCount;
    if (activeCount === 0) emptyCandidateTests.push(relative(repositoryRoot, testFile));
  }

  const solutionTestRoot = resolve(repositoryRoot, "lesson-06-rag-openrouter", "solution", "tests");
  const solutionTestFiles = (await collectLesson05SourceFiles(solutionTestRoot)).filter((file) =>
    /\.test\.tsx?$/u.test(file),
  );
  for (const requiredTest of [
    ...lesson05AcceptanceTestPaths,
    "tests/retriever.test.ts",
    "tests/rag-assistant.test.ts",
    "tests/rag-server.test.ts",
  ]) {
    try {
      const requiredPath = resolve(solutionTestRoot, requiredTest.slice("tests/".length));
      const requiredStat = await lstat(requiredPath);
      if (!requiredStat.isFile() || requiredStat.isSymbolicLink()) throw new Error("not a file");
    } catch {
      failures.push(`missing required Lesson 06 canonical acceptance test: ${requiredTest}`);
    }
  }
  const incompleteAcceptance = await findIncompleteLocations(
    solutionTestFiles,
    lesson06IncompletePatterns,
  );
  let activeAcceptanceTests = 0;
  const emptyAcceptanceTests: string[] = [];
  for (const testFile of solutionTestFiles) {
    const activeCount =
      (await readFile(testFile, "utf8")).match(lesson05ActiveTestPattern)?.length ?? 0;
    activeAcceptanceTests += activeCount;
    if (activeCount === 0) emptyAcceptanceTests.push(relative(repositoryRoot, testFile));
  }

  const incomplete = await findIncompleteLocations(candidateFiles, lesson06IncompletePatterns);
  const forbiddenCanonicalImports: string[] = [];
  for (const file of candidateFiles) {
    const source = await readFile(file, "utf8");
    if (
      /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["'][^"']*lesson-\d{2}[^"']*\/(?:starter|solution)\//iu.test(
        source,
      )
    ) {
      forbiddenCanonicalImports.push(relative(repositoryRoot, file));
    }
  }

  if (
    failures.length > 0 ||
    incomplete.length > 0 ||
    incompleteAcceptance.length > 0 ||
    forbiddenCanonicalImports.length > 0 ||
    emptyCandidateTests.length > 0 ||
    candidateTests.length === 0 ||
    activeCandidateTests === 0 ||
    solutionTestFiles.length === 0 ||
    emptyAcceptanceTests.length > 0 ||
    activeAcceptanceTests === 0
  ) {
    console.error(
      `Lesson 06 OpenRouter completion gate failed for ${relativeCandidateRoot}: ` +
        `${failures.length} missing file(s), ${incomplete.length} incomplete marker(s), ` +
        `${incompleteAcceptance.length} incomplete canonical marker(s), ` +
        `${forbiddenCanonicalImports.length} canonical imports, ${candidateTests.length} test file(s), ` +
        `${activeCandidateTests} candidate source test declarations, ` +
        `${activeAcceptanceTests} canonical source test declarations.`,
    );
    for (const failure of failures) console.error(`- ${failure}`);
    for (const location of incomplete) {
      console.error(
        `- ${relative(repositoryRoot, location.file)}:${location.line} (${location.label})`,
      );
    }
    for (const location of incompleteAcceptance) {
      console.error(
        `- incomplete canonical acceptance test ${relative(repositoryRoot, location.file)}:${location.line} (${location.label})`,
      );
    }
    for (const file of emptyAcceptanceTests) {
      console.error(`- no canonical acceptance test declarations: ${file}`);
    }
    for (const file of forbiddenCanonicalImports) {
      console.error(`- candidate code imports a canonical lesson starter/solution: ${file}`);
    }
    for (const file of emptyCandidateTests) {
      console.error(`- no candidate test declarations: ${file}`);
    }
    process.exitCode = 1;
    return;
  }

  const vitestCli = resolve(repositoryRoot, "node_modules", "vitest", "vitest.mjs");
  const studentTestOutput = runLesson06GateCommand(
    [vitestCli, "run", "--dir", testRoot],
    "Lesson 06 candidate tests",
  );
  const activePassed = getCleanVitestPassCount(studentTestOutput, "Lesson 06 candidate tests", 1);

  const tempRoot = resolve(repositoryRoot, ".tmp", "lesson06-openrouter-completion");
  await mkdir(tempRoot, { recursive: true });
  const fixtureRoot = await mkdtemp(resolve(tempRoot, "candidate-"));
  const fixtureRelative = relative(tempRoot, fixtureRoot);
  if (
    fixtureRelative === "" ||
    fixtureRelative === ".." ||
    fixtureRelative.startsWith(`..${sep}`) ||
    isAbsolute(fixtureRelative)
  ) {
    throw new Error(
      "Lesson 06 candidate acceptance fixture escaped its guarded temporary directory.",
    );
  }

  let acceptancePassed = 0;
  try {
    const acceptanceRoot = resolve(fixtureRoot, "acceptance");
    await copyCandidateTree(resolve(candidateRoot, "src"), resolve(acceptanceRoot, "src"));
    await copyCandidateTree(resolve(candidateRoot, "data"), resolve(acceptanceRoot, "data"));
    await copyCandidateTree(resolve(candidateRoot, "evals"), resolve(acceptanceRoot, "evals"));
    await copyCandidateTree(solutionTestRoot, resolve(acceptanceRoot, "tests"));

    const acceptanceOutput = runLesson06GateCommand(
      [vitestCli, "run", "--dir", resolve(acceptanceRoot, "tests")],
      "Lesson 06 canonical candidate acceptance tests",
    );
    acceptancePassed = getCleanVitestPassCount(
      acceptanceOutput,
      "Lesson 06 canonical candidate acceptance tests",
      activeAcceptanceTests,
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }

  const refusalEvalOutput = runLesson06GateCommand(
    [
      resolve(repositoryRoot, "scripts", "run-tsx-entrypoint.mjs"),
      resolve(candidateRoot, "evals", "run.ts"),
      "--mode=rag",
    ],
    "Lesson 06 candidate RAG refusal eval",
  );
  if (!/Result:\s*5\/5\b/u.test(refusalEvalOutput)) {
    throw new Error(
      "Lesson 06 candidate refusal eval must execute all five cases and report Result: 5/5.",
    );
  }

  console.log(
    `PASS Lesson 06 OpenRouter completion: ${activePassed} candidate tests, ` +
      `${acceptancePassed} source-rebound canonical acceptance tests, and five refusal cases passed against ` +
      `${relativeCandidateRoot}.`,
  );
}

if (lesson05Mode) {
  if (targets.length !== 2) {
    throw new Error(
      "Usage: assert-starter-complete.ts --lesson05-openrouter <candidate-lesson-root>",
    );
  }

  await verifyLesson05OpenRouterCompletion(targets[1]!);
  process.exit(process.exitCode ?? 0);
}

if (lesson06Mode) {
  if (targets.length !== 2) {
    throw new Error(
      "Usage: assert-starter-complete.ts --lesson06-openrouter <candidate-lesson-root>",
    );
  }

  await verifyLesson06OpenRouterCompletion(targets[1]!);
  process.exit(process.exitCode ?? 0);
}

if (
  lesson07Mode ||
  lesson08Mode ||
  lesson09Mode ||
  lesson10Mode ||
  lesson11Mode ||
  lesson12Mode ||
  lesson13Mode
) {
  const lessonNumber = lesson13Mode
    ? "13"
    : lesson11Mode
      ? "11"
      : lesson12Mode
        ? "12"
        : lesson10Mode
          ? "10"
          : lesson09Mode
            ? "09"
            : lesson08Mode
              ? "08"
              : "07";
  if (targets.length !== 2) {
    throw new Error(
      `Usage: assert-starter-complete.ts --lesson${lessonNumber}-openrouter <candidate-lesson-root>`,
    );
  }

  const helper = resolve(process.cwd(), "scripts", "run-tsx-entrypoint.mjs");
  const verifier = resolve(
    process.cwd(),
    "scripts",
    `verify-lesson${lessonNumber}-openrouter-completion.ts`,
  );
  const result = spawnSync(process.execPath, [helper, verifier, targets[1]!], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (output.length > 0) process.stdout.write(output);
  if (result.error)
    throw new Error(
      `Lesson ${lessonNumber} completion gate could not start: ${result.error.message}`,
    );
  process.exit(result.status ?? 1);
}

if (targets.length === 0) {
  throw new Error("Expected at least one starter source, test or eval path.");
}

const locations = await findIncompleteLocations(targets);
const contractFailures = await verifyRagCompletionContract(targets);

if (locations.length === 0 && contractFailures.length === 0) {
  console.log(
    "Starter completion gate: no todo, skip or incomplete implementation markers remain; provider-specific contracts passed.",
  );
} else {
  console.error(
    `Starter completion gate failed: ${locations.length} incomplete marker(s), ` +
      `${contractFailures.length} contract failure(s).`,
  );
  for (const location of locations) {
    console.error(
      `- ${relative(process.cwd(), location.file)}:${location.line} (${location.label})`,
    );
  }
  for (const failure of contractFailures) {
    console.error(`- ${relative(process.cwd(), failure.path)} (${failure.message})`);
  }
  process.exitCode = 1;
}
