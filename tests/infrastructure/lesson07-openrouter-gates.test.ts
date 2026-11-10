import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const tempBase = resolve(repositoryRoot, ".tmp", "lesson07-openrouter-gates");
const lesson07Solution = resolve(repositoryRoot, "lesson-07-agent-loop-openrouter", "solution");
const temporaryRoots: string[] = [];

async function createFixture(label: string): Promise<string> {
  await mkdir(tempBase, { recursive: true });
  const root = await mkdtemp(resolve(tempBase, `${label}-`));
  const relativeRoot = relative(await realpath(tempBase), await realpath(root));
  if (
    relativeRoot === "" ||
    relativeRoot === ".." ||
    relativeRoot.startsWith(`..${sep}`) ||
    isAbsolute(relativeRoot)
  ) {
    throw new Error("Lesson 07 fixture escaped its guarded scratch directory.");
  }
  temporaryRoots.push(root);
  return root;
}

function runHelper(entrypoint: string, args: string[]) {
  return spawnSync(
    process.execPath,
    [resolve(repositoryRoot, "scripts", "run-tsx-entrypoint.mjs"), entrypoint, ...args],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 24 * 1024 * 1024,
      timeout: 180_000,
    },
  );
}

function runCandidateCompletion(candidateRoot: string) {
  return runHelper("scripts/assert-starter-complete.ts", [
    "--lesson07-openrouter",
    relative(repositoryRoot, candidateRoot),
  ]);
}

async function copyLearningTree(source: string, destination: string): Promise<void> {
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyLearningTree(sourcePath, destinationPath);
    } else if (
      entry.isFile() &&
      [".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx", ".json", ".md", ".txt"].includes(
        extname(entry.name),
      ) &&
      !/(?:^|[\\/])data[\\/](?:user-memory|conversation-history)\.json$/iu.test(sourcePath)
    ) {
      await cp(sourcePath, destinationPath);
    }
  }
}

async function seedCandidate(sourceRoot: string, destinationRoot: string): Promise<void> {
  await mkdir(destinationRoot, { recursive: true });
  for (const directory of ["src", "data", "evals", "tests", "sandbox", "scripts"]) {
    await copyLearningTree(join(sourceRoot, directory), join(destinationRoot, directory)).catch(
      (error: unknown) => {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return;
        }
        throw error;
      },
    );
  }
  for (const filename of ["README.md", "final-project-ideas.md"]) {
    try {
      await cp(join(sourceRoot, filename), join(destinationRoot, filename));
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
}

async function seedPhysicalFixture(fixtureRoot: string): Promise<{
  starterRoot: string;
  sourceRoot: string;
  inheritedCount: number;
}> {
  const prefix = "lesson-06-rag-openrouter/solution/";
  const trackedFiles = execFileSync(
    "git",
    ["ls-files", "--", "lesson-06-rag-openrouter/solution"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  )
    .split(/\r?\n/u)
    .filter((path) => path.startsWith(prefix));
  expect(trackedFiles.length).toBeGreaterThan(0);
  expect(trackedFiles).toContain(`${prefix}README.md`);

  const sourceRoot = join(fixtureRoot, "parent", "solution");
  const starterRoot = join(fixtureRoot, "lesson-07", "starter");
  for (const trackedFile of trackedFiles) {
    const relativePath = trackedFile.slice(prefix.length);
    const source = join(repositoryRoot, trackedFile);
    const parent = join(sourceRoot, relativePath);
    const starter = join(starterRoot, relativePath);
    await mkdir(dirname(parent), { recursive: true });
    await mkdir(dirname(starter), { recursive: true });
    await cp(source, parent);
    await cp(source, starter);
  }
  await writeFile(join(starterRoot, "README.md"), "Lesson 07 fixture instructions.\n", "utf8");
  return { starterRoot, sourceRoot, inheritedCount: trackedFiles.length };
}

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) {
    const realBase = await realpath(tempBase);
    const realRoot = await realpath(root);
    const relativeRoot = relative(realBase, realRoot);
    if (
      relativeRoot === "" ||
      relativeRoot === ".." ||
      relativeRoot.startsWith(`..${sep}`) ||
      isAbsolute(relativeRoot)
    ) {
      throw new Error("Refusing to remove a fixture outside its guarded scratch directory.");
    }
    await rm(realRoot, { recursive: true, force: true });
  }
});

describe("Lesson 07 OpenRouter physical inheritance verifier", () => {
  it("accepts the README exception and rejects byte drift or an added starter file", async () => {
    const fixtureRoot = await createFixture("physical");
    const { starterRoot, sourceRoot, inheritedCount } = await seedPhysicalFixture(fixtureRoot);
    const args = [relative(repositoryRoot, starterRoot), relative(repositoryRoot, sourceRoot)];

    const clean = runHelper("scripts/verify-openrouter-starter-contracts.ts", [
      "--lesson07-openrouter",
      ...args,
    ]);
    expect(clean.status, clean.stderr).toBe(0);
    expect(clean.stdout).toContain(
      `${inheritedCount - 1} byte-identical Git-tracked Lesson 06 files`,
    );
    expect(clean.stdout).toContain("one root README.md exception");

    const inheritedPath = join(starterRoot, "src", "app.ts");
    await writeFile(inheritedPath, `${await readFile(inheritedPath, "utf8")}\n// drift\n`, "utf8");
    const drift = runHelper("scripts/verify-openrouter-starter-contracts.ts", [
      "--lesson07-openrouter",
      ...args,
    ]);
    expect(drift.status).toBe(1);
    expect(drift.stdout + drift.stderr).toContain("differs byte-for-byte from Lesson 06 solution");

    await cp(join(sourceRoot, "src", "app.ts"), inheritedPath);
    await writeFile(join(starterRoot, "src", "run-agent-loop.ts"), "export {};\n", "utf8");
    const extra = runHelper("scripts/verify-openrouter-starter-contracts.ts", [
      "--lesson07-openrouter",
      ...args,
    ]);
    expect(extra.status).toBe(1);
    expect(extra.stdout + extra.stderr).toContain(
      "unaccounted Lesson 07 starter file src/run-agent-loop.ts",
    );
  });
});

describe("Lesson 07 OpenRouter completion gate", () => {
  it("rejects alternate-model routing added to an otherwise complete candidate", async () => {
    const fixtureRoot = await createFixture("alternate-model");
    const candidateRoot = join(fixtureRoot, "candidate");
    await seedCandidate(lesson07Solution, candidateRoot);
    const adapterPath = join(candidateRoot, "src", "services", "agent-loop.ts");
    const source = await readFile(adapterPath, "utf8");
    expect(source).toContain("model: this.options.modelName,");
    await writeFile(
      adapterPath,
      source.replace(
        "model: this.options.modelName,",
        'model: this.options.modelName, models: ["course/alternate"],',
      ),
      "utf8",
    );
    const result = runCandidateCompletion(candidateRoot);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("single-model contract violation");
  });

  it("accepts a complete candidate after running candidate and source-rebound canonical suites", async () => {
    const fixtureRoot = await createFixture("complete");
    const candidateRoot = join(fixtureRoot, "candidate");
    await seedCandidate(lesson07Solution, candidateRoot);

    const result = runCandidateCompletion(candidateRoot);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("candidate tests");
    expect(result.stdout).toContain("source-rebound canonical tests");
    expect(result.stdout).toContain("7/7 local agent-loop cases");
  });
});
