import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryBase = resolve(repositoryRoot, ".tmp", "lesson03-openrouter-gates");
const completionScratch = resolve(repositoryRoot, ".tmp", "lesson03-openrouter-completion");
const temporaryRoots: string[] = [];
const canonicalRoot = resolve(repositoryRoot, "lesson-03-function-calling-openrouter", "solution");
const requiredTestNames = ["tool-calling.test.ts", "agent-route.test.ts", "tool-evals.test.ts"];

async function createCandidate(prefix: string): Promise<string> {
  await mkdir(temporaryBase, { recursive: true });
  const root = await mkdtemp(join(temporaryBase, `${prefix}-with spaces-`));
  const rootRelative = relative(temporaryBase, root);
  if (
    rootRelative === "" ||
    rootRelative === ".." ||
    rootRelative.startsWith(`..${sep}`) ||
    isAbsolute(rootRelative)
  ) {
    throw new Error("Lesson 03 test fixture escaped its temporary directory.");
  }
  temporaryRoots.push(root);
  await Promise.all(
    ["src", "evals", "tests"].map((directory) =>
      cp(join(canonicalRoot, directory), join(root, directory), { recursive: true }),
    ),
  );
  return root;
}

function runCompletion(candidateRoot: string) {
  const helper = join(repositoryRoot, "scripts", "run-tsx-entrypoint.mjs");
  return spawnSync(
    process.execPath,
    [helper, "scripts/assert-starter-complete.ts", "--lesson03-openrouter", candidateRoot],
    { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
}

async function createScratchRoot(prefix: string): Promise<string> {
  await mkdir(temporaryBase, { recursive: true });
  const root = await mkdtemp(join(temporaryBase, `${prefix}-with spaces-`));
  const rootRelative = relative(temporaryBase, root);
  if (
    rootRelative === "" ||
    rootRelative === ".." ||
    rootRelative.startsWith(`..${sep}`) ||
    isAbsolute(rootRelative)
  ) {
    throw new Error("Lesson 03 test fixture escaped its temporary directory.");
  }
  temporaryRoots.push(root);
  return root;
}

function runFixtureTests(fixtureRoot: string) {
  const vitestCli = join(repositoryRoot, "node_modules", "vitest", "vitest.mjs");
  return spawnSync(
    process.execPath,
    [
      vitestCli,
      "run",
      "--root",
      fixtureRoot,
      "--config",
      join(repositoryRoot, "vitest.config.ts"),
      "tests",
      "acceptance-tests",
    ],
    { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
}
async function completionFixtures(): Promise<string[]> {
  try {
    return (await readdir(completionScratch)).filter((entry) => entry.startsWith("completion-"));
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
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
        throw new Error("Refusing to remove a fixture outside the Lesson 03 test scratch root.");
      }
      await rm(root, { recursive: true, force: true });
    }),
  );
});

describe("Lesson 03 OpenRouter completion gate fixture", () => {
  it("runs candidate and canonical tests from a .tmp path with spaces, then cleans the fixture", async () => {
    const candidateRoot = await createCandidate("passing candidate");
    const before = await completionFixtures();

    const result = runCompletion(candidateRoot);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("PASS Lesson 03 OpenRouter completion");
    const fileCounts = result.stdout.match(/Test Files\s+(\d+) passed \((\d+)\)/u);
    const testCounts = result.stdout.match(/Tests\s+(\d+) passed \((\d+)\)/u);
    expect(fileCounts).not.toBeNull();
    expect(testCounts).not.toBeNull();
    expect(Number(fileCounts?.[1])).toBeGreaterThan(0);
    expect(Number(testCounts?.[1])).toBeGreaterThan(0);
    expect(fileCounts?.[1]).toBe(fileCounts?.[2]);
    expect(testCounts?.[1]).toBe(testCounts?.[2]);
    expect(await completionFixtures()).toEqual(before);
  });

  it("rejects behavior broken behind passing candidate smoke tests and cleans the fixture", async () => {
    const candidateRoot = await createCandidate("broken candidate");
    const currencyPath = join(candidateRoot, "src", "tools", "currency.ts");
    const currencySource = await readFile(currencyPath, "utf8");
    expect(currencySource).toContain("USD_UAH: 41.5");
    await writeFile(currencyPath, currencySource.replace("USD_UAH: 41.5", "USD_UAH: 0"), "utf8");
    for (const testName of requiredTestNames) {
      await writeFile(
        join(candidateRoot, "tests", testName),
        'import { describe, expect, it } from "vitest";\ndescribe("candidate smoke", () => { it("passes", () => expect(true).toBe(true)); });\n',
        "utf8",
      );
    }
    const before = await completionFixtures();

    const result = runCompletion(relative(repositoryRoot, candidateRoot));
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).not.toContain("incomplete marker(s)");
    expect(output).toMatch(/AssertionError|expected .* to (?:be|equal)/iu);
    expect(await completionFixtures()).toEqual(before);
  });

  it("rejects candidates without active tests before creating an acceptance fixture", async () => {
    const candidateRoot = await createCandidate("empty tests");
    for (const testName of requiredTestNames) {
      await writeFile(join(candidateRoot, "tests", testName), "export {};\n", "utf8");
    }
    const before = await completionFixtures();

    const result = runCompletion(candidateRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("empty student test file(s)");
    expect(await completionFixtures()).toEqual(before);
  });

  it("uses default file discovery while excluding a unique fixture under .tmp", async () => {
    const candidateRoot = await createCandidate("discovery sentinel");
    const uniqueFixture = "lesson03-unique-discovery-sentinel.test.ts";
    await writeFile(
      join(candidateRoot, uniqueFixture),
      'import { it, expect } from "vitest"; it("must stay undiscovered", () => expect(true).toBe(true));\n',
      "utf8",
    );
    const vitestCli = join(repositoryRoot, "node_modules", "vitest", "vitest.mjs");

    const result = spawnSync(process.execPath, [vitestCli, "list", "--filesOnly"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    const discoveredFiles = result.stdout.replaceAll("\\", "/");
    const fixtureRelative = relative(repositoryRoot, candidateRoot).replaceAll("\\", "/");

    expect(result.status, result.stderr).toBe(0);
    expect(discoveredFiles).toContain(
      "lesson-03-function-calling-openrouter/solution/tests/tool-calling.test.ts",
    );
    expect(discoveredFiles).not.toContain(fixtureRelative);
    expect(discoveredFiles).not.toContain(uniqueFixture);
  });

  it("reports no test files for an empty explicit-root fixture", async () => {
    const fixtureRoot = await createScratchRoot("empty Vitest runner");
    await mkdir(join(fixtureRoot, "tests"), { recursive: true });
    await mkdir(join(fixtureRoot, "acceptance-tests"), { recursive: true });

    const result = runFixtureTests(fixtureRoot);

    expect(result.status).toBe(1);
    expect(`${result.stdout}\\n${result.stderr}`).toMatch(/No test files found/iu);
  });
});
