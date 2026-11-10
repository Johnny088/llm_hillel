import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { getLessonCheckCommand, getNextOpenRouterLesson } from "../../scripts/dev-manager.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryBase = resolve(repositoryRoot, ".tmp", "lesson05-gates");
const temporaryRoots: string[] = [];
const lesson05Root = "lesson-05-memory-openrouter";
const source04Prefix = "lesson-04-mcp-built-in-tools-openrouter/solution/";

async function createFixture(prefix: string): Promise<string> {
  await mkdir(temporaryBase, { recursive: true });
  const root = await mkdtemp(join(temporaryBase, `${prefix}-`));
  const rootRelative = relative(temporaryBase, root);
  if (
    rootRelative === "" ||
    rootRelative === ".." ||
    rootRelative.startsWith(`..${sep}`) ||
    isAbsolute(rootRelative)
  ) {
    throw new Error("Lesson 05 gate fixture escaped its task-scoped temporary directory.");
  }
  temporaryRoots.push(root);
  return root;
}

async function seedCandidateCode(sourceRoot: string, destinationRoot: string): Promise<void> {
  await mkdir(destinationRoot, { recursive: true });
  for (const directory of ["src", "evals", "tests", "sandbox"]) {
    await cp(join(sourceRoot, directory), join(destinationRoot, directory), { recursive: true });
  }
}

function runHelper(entrypoint: string, args: string[], cwd: string = repositoryRoot) {
  const helper = join(repositoryRoot, "scripts", "run-tsx-entrypoint.mjs");
  return spawnSync(process.execPath, [helper, entrypoint, ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}

function runPhysicalVerifier(fixtureRoot: string) {
  return runHelper(join(fixtureRoot, "scripts", "verify-openrouter-starter-contracts.ts"), [
    "--lesson05-openrouter",
  ]);
}

function runCompletion(candidateRoot: string) {
  return runHelper(join(repositoryRoot, "scripts", "assert-starter-complete.ts"), [
    "--lesson05-openrouter",
    relative(repositoryRoot, candidateRoot),
  ]);
}

async function seedPhysicalInheritanceFixture(fixtureRoot: string): Promise<string> {
  const gitFiles = execFileSync(
    "git",
    ["ls-files", "--", "lesson-04-mcp-built-in-tools-openrouter/solution"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  )
    .split(/\r?\n/u)
    .filter((file) => file.startsWith(source04Prefix));
  const sourceRoot = join(fixtureRoot, "lesson-04-mcp-built-in-tools-openrouter", "solution");
  const starterRoot = join(fixtureRoot, lesson05Root, "starter");

  for (const gitFile of gitFiles) {
    const relativePath = gitFile.slice(source04Prefix.length);
    const sourceFile = join(sourceRoot, relativePath);
    await mkdir(dirname(sourceFile), { recursive: true });
    await cp(join(repositoryRoot, gitFile), sourceFile);
  }

  await cp(sourceRoot, starterRoot, { recursive: true });
  await writeFile(join(starterRoot, "README.md"), "Lesson 05 instructions differ.\n", "utf8");
  await mkdir(join(fixtureRoot, "scripts"), { recursive: true });
  await cp(
    join(repositoryRoot, "scripts", "verify-openrouter-starter-contracts.ts"),
    join(fixtureRoot, "scripts", "verify-openrouter-starter-contracts.ts"),
  );
  await cp(
    join(repositoryRoot, "scripts", "course-inheritance.ts"),
    join(fixtureRoot, "scripts", "course-inheritance.ts"),
  );
  await writeFile(join(fixtureRoot, "package.json"), '{"type":"module"}\n', "utf8");
  await writeFile(
    join(fixtureRoot, ".gitignore"),
    ".env\n**/data/*.json\nnode_modules/\ndist/\ncache/\n",
    "utf8",
  );

  const init = spawnSync("git", ["init", "--quiet"], { cwd: fixtureRoot, encoding: "utf8" });
  if (init.status !== 0)
    throw new Error(init.stderr || "Could not initialize isolated gate fixture.");
  const add = spawnSync("git", ["add", "--all"], { cwd: fixtureRoot, encoding: "utf8" });
  if (add.status !== 0) throw new Error(add.stderr || "Could not index isolated gate fixture.");

  await writeFile(join(starterRoot, ".env"), "synthetic-secret=keep-me\n", "utf8");
  await mkdir(join(starterRoot, "data"), { recursive: true });
  await writeFile(join(starterRoot, "data", "user-memory.json"), '{"synthetic":true}\n', "utf8");
  await writeFile(
    join(starterRoot, "data", "conversation-history.json"),
    '{"messages":[]}\n',
    "utf8",
  );
  for (const directory of ["node_modules/pkg", "dist/generated", "cache/compiler"]) {
    await mkdir(join(starterRoot, directory), { recursive: true });
    await writeFile(join(starterRoot, directory, "artifact.ts"), "NOT_IMPLEMENTED\n", "utf8");
  }
  return starterRoot;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map(async (root) => {
      const rootRelative = relative(temporaryBase, root);
      if (
        rootRelative === "" ||
        rootRelative === ".." ||
        rootRelative.startsWith(`..${sep}`) ||
        isAbsolute(rootRelative)
      ) {
        throw new Error("Refusing to remove a fixture outside the Lesson 05 task scratch root.");
      }
      await rm(root, { recursive: true, force: true });
    }),
  );
});

describe("Lesson 05 OpenRouter physical inheritance gate", () => {
  it("ignores local state and generated artifacts while enforcing the 52-file manifest", async () => {
    const root = await createFixture("inheritance");
    const starterRoot = await seedPhysicalInheritanceFixture(root);

    const clean = runPhysicalVerifier(root);
    expect(clean.status, clean.stderr).toBe(0);
    expect(clean.stdout).toContain("51 byte-identical git-tracked Lesson 04 files");
    expect(await readFile(join(starterRoot, ".env"), "utf8")).toContain("synthetic-secret=keep-me");
    expect(await readFile(join(starterRoot, "data", "user-memory.json"), "utf8")).toContain(
      '"synthetic":true',
    );
    expect(
      await readFile(join(starterRoot, "data", "conversation-history.json"), "utf8"),
    ).toContain('"messages":[]');
    for (const directory of ["node_modules/pkg", "dist/generated", "cache/compiler"]) {
      expect(await readFile(join(starterRoot, directory, "artifact.ts"), "utf8")).toContain(
        "NOT_IMPLEMENTED",
      );
    }

    await writeFile(
      join(starterRoot, "evals", "README.md"),
      "altered eval documentation\n",
      "utf8",
    );
    const docsDrift = runPhysicalVerifier(root);
    expect(docsDrift.status).toBe(1);
    expect(docsDrift.stderr).toContain("evals/README.md differs byte-for-byte");

    await cp(
      join(root, "lesson-04-mcp-built-in-tools-openrouter", "solution", "evals", "README.md"),
      join(starterRoot, "evals", "README.md"),
    );
    await writeFile(join(starterRoot, "extra.ts"), "export {};\n", "utf8");
    const extraFile = runPhysicalVerifier(root);
    expect(extraFile.status).toBe(1);
    expect(extraFile.stderr).toContain("unaccounted Lesson 05 starter file extra.ts");
  });
});

describe("Lesson 05 OpenRouter behavioral completion gate", () => {
  it("rejects the inherited untouched starter for missing memory functionality", () => {
    const result = runCompletion(join(repositoryRoot, lesson05Root, "starter"));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("missing required Lesson 05 memory implementation file");
  });

  it("passes canonical solution only after candidate and acceptance suites exercise it", async () => {
    const solutionRoot = join(repositoryRoot, lesson05Root, "solution");
    const result = runCompletion(solutionRoot);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.replaceAll("\\", "/")).toContain(
      "PASS Lesson 05 OpenRouter completion: candidate and acceptance suites passed against lesson-05-memory-openrouter/solution",
    );
  });

  it("passes a completed candidate root using its own source tree", async () => {
    const root = await createFixture("complete-candidate");
    const candidateRoot = join(root, "student", lesson05Root);
    await seedCandidateCode(join(repositoryRoot, lesson05Root, "solution"), candidateRoot);

    const result = runCompletion(candidateRoot);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.replaceAll("\\", "/")).toContain(
      "PASS Lesson 05 OpenRouter completion: candidate and acceptance suites passed against .tmp/lesson05-gates/",
    );
  });

  it("runs the independent acceptance tests against substituted candidate source", async () => {
    const root = await createFixture("candidate");
    const candidateRoot = join(root, "candidate");
    await seedCandidateCode(join(repositoryRoot, lesson05Root, "solution"), candidateRoot);

    const factsPath = join(candidateRoot, "src", "memory", "user-facts.ts");
    const facts = await readFile(factsPath, "utf8");
    const weakenedFacts = facts.replace(
      'z.enum(["displayName", "preferredStack", "learningGoal"])',
      'z.enum(["displayName", "learningGoal"])',
    );
    expect(weakenedFacts).not.toBe(facts);
    await writeFile(factsPath, weakenedFacts, "utf8");

    const candidateTestRoot = join(candidateRoot, "tests");
    const entries = await readdir(candidateTestRoot);
    for (const filename of entries.filter((entry) => /\.test\.tsx?$/u.test(entry))) {
      await writeFile(
        join(candidateTestRoot, filename),
        'import { expect, it } from "vitest";\nit("candidate fixture test", () => expect(true).toBe(true));\n',
        "utf8",
      );
    }

    const result = runCompletion(candidateRoot);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("user-facts.test.ts");
    expect(result.stdout).toMatch(/Test Files\s+\d+ failed/u);
  });
});

describe("Lesson 05 OpenRouter public audit and routes", () => {
  it("routes every declared course-contract audit through the Windows TS helper", async () => {
    const packageJson = JSON.parse(
      await readFile(join(repositoryRoot, "package.json"), "utf8"),
    ) as {
      scripts: Record<string, string>;
    };
    const auditCommands = Object.entries(packageJson.scripts).filter(
      ([, command]) =>
        command.includes("node ") && command.includes("scripts/audit-course-contract.ts"),
    );
    const directAuditCommands = Object.entries(packageJson.scripts).filter(([, command]) =>
      command.includes("node scripts/audit-course-contract.ts"),
    );

    expect(auditCommands.length).toBeGreaterThan(0);
    expect(directAuditCommands).toEqual([]);
    for (const [name, command] of auditCommands) {
      expect(command, name).toContain(
        "node scripts/run-tsx-entrypoint.mjs scripts/audit-course-contract.ts",
      );
      expect(command, name).not.toContain("node scripts/audit-course-contract.ts");
    }
  });

  it("runs the scoped audit when future lesson and private directories are absent", async () => {
    const root = await createFixture("public-clone");
    const auditPath = join(root, "scripts", "audit-course-contract.ts");
    await mkdir(dirname(auditPath), { recursive: true });
    await cp(join(repositoryRoot, "scripts", "audit-course-contract.ts"), auditPath);
    await cp(join(repositoryRoot, "package.json"), join(root, "package.json"));
    await cp(join(repositoryRoot, lesson05Root), join(root, lesson05Root), { recursive: true });
    for (const config of [
      "tsconfig.lesson-05-openrouter.starter.build.json",
      "tsconfig.lesson-05-openrouter.build.json",
      "tsconfig.lesson-05.my-openrouter.json",
    ]) {
      await cp(join(repositoryRoot, config), join(root, config));
    }

    const result = runHelper(auditPath, ["--lesson05-openrouter"], root);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("PASS scoped Lesson 05 OpenRouter contract");
    const publicRootEntries = await readdir(root);
    expect(publicRootEntries).not.toContain("lesson-06-rag-openrouter");
    expect(publicRootEntries).not.toContain(".private");
  });

  it("routes teacher dev state to the L05 solution gate and protects local memory JSON", () => {
    expect(getNextOpenRouterLesson("lesson-04-mcp-built-in-tools-openrouter")).toEqual({
      nextLessonNum: 5,
      nextLessonDir: lesson05Root,
    });
    expect(getLessonCheckCommand(lesson05Root, "starter")).toContain(
      "yarn vitest run --dir dev/tests",
    );
    expect(getLessonCheckCommand(lesson05Root, "solution")).toBe(
      "yarn check:lesson05:openrouter:solution",
    );

    const protectedPaths = [
      "my-dev/lesson-05-memory-openrouter/data/user-memory.json",
      "my-dev/lesson-05-memory-openrouter/data/conversation-history.json",
      "dev/data/user-memory.json",
      "dev/data/conversation-history.json",
    ];
    const result = spawnSync("git", ["check-ignore", "--no-index", "-v", "--stdin"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      input: `${protectedPaths.join("\n")}\n`,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim().split(/\r?\n/u)).toHaveLength(protectedPaths.length);
    for (const protectedPath of protectedPaths) expect(result.stdout).toContain(protectedPath);
  });
});
