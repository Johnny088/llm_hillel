import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryBase = resolve(repositoryRoot, ".tmp", "lesson04-gates");
const temporaryRoots: string[] = [];

async function createFixture(): Promise<string> {
  await mkdir(temporaryBase, { recursive: true });
  const root = await mkdtemp(join(temporaryBase, "course-"));
  const relativeRoot = relative(temporaryBase, root);
  if (
    relativeRoot === "" ||
    relativeRoot === ".." ||
    relativeRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
    isAbsolute(relativeRoot)
  ) {
    throw new Error("Lesson 04 gate fixture escaped its bounded temporary directory.");
  }
  temporaryRoots.push(root);
  return root;
}

function runScopedVerifier(fixtureRoot: string): SpawnSyncReturns<string> {
  const script = join(fixtureRoot, "scripts", "verify-openrouter-starter-contracts.ts");
  const helper = join(repositoryRoot, "scripts", "run-tsx-entrypoint.mjs");
  return spawnSync(process.execPath, [helper, script, "--lesson04-openrouter"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

function runStudentCompletionGate(studentRoot: string): SpawnSyncReturns<string> {
  const helper = join(repositoryRoot, "scripts", "run-tsx-entrypoint.mjs");
  const entrypoint = join(repositoryRoot, "scripts", "assert-starter-complete.ts");
  return spawnSync(
    process.execPath,
    [helper, entrypoint, "--lesson04-openrouter", relative(repositoryRoot, studentRoot)],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map(async (root) => {
      const relativeRoot = relative(temporaryBase, root);
      if (
        relativeRoot === "" ||
        relativeRoot === ".." ||
        relativeRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
        isAbsolute(relativeRoot)
      ) {
        throw new Error("Refusing to remove an out-of-scope Lesson 04 gate fixture.");
      }
      await rm(root, { recursive: true, force: true });
    }),
  );
});

describe("Lesson 04 OpenRouter physical inheritance gate", () => {
  it("runs in an OpenRouter release through Lesson 04 and reports inherited-file drift", async () => {
    const root = await createFixture();
    const verifierDirectory = join(root, "scripts");
    const previousRoot = join(root, "lesson-03-function-calling-openrouter", "solution");
    const starterRoot = join(root, "lesson-04-mcp-built-in-tools-openrouter", "starter");
    await mkdir(verifierDirectory, { recursive: true });
    await cp(
      join(repositoryRoot, "scripts", "verify-openrouter-starter-contracts.ts"),
      join(verifierDirectory, "verify-openrouter-starter-contracts.ts"),
    );
    await cp(
      join(repositoryRoot, "scripts", "course-inheritance.ts"),
      join(verifierDirectory, "course-inheritance.ts"),
    );
    await writeFile(join(root, "package.json"), '{"type":"module"}\n', "utf8");
    await mkdir(join(previousRoot, "src"), { recursive: true });
    await writeFile(join(previousRoot, "src", "inherited.ts"), "export const baseline = 3;\n");
    await writeFile(join(previousRoot, "README.md"), "Lesson 03 source README\n");
    await writeFile(join(previousRoot, "final-project-ideas.md"), "Lesson 03 ideas\n");
    await cp(previousRoot, starterRoot, { recursive: true });
    await writeFile(join(starterRoot, "README.md"), "Lesson 04 instructions\n");
    await writeFile(join(starterRoot, "final-project-ideas.md"), "Lesson 04 project ideas\n");

    const cleanResult = runScopedVerifier(root);
    expect(cleanResult.status, cleanResult.stderr).toBe(0);
    expect(cleanResult.stdout).toContain("PASS Lesson 04 OpenRouter canonical inheritance");

    await writeFile(join(starterRoot, "src", "inherited.ts"), "export const baseline = 4;\n");
    const driftResult = runScopedVerifier(root);
    expect(driftResult.status).toBe(1);
    expect(driftResult.stderr).toContain("differs byte-for-byte from Lesson 03 solution");
  });

  it("rejects complete-looking student files that import the ready solution", async () => {
    const root = await createFixture();
    const studentRoot = join(root, "student");
    const sourceFiles = [
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

    for (const sourceFile of sourceFiles) {
      const target = join(studentRoot, sourceFile);
      await mkdir(dirname(target), { recursive: true });
      const content = sourceFile.startsWith("tests/")
        ? 'import { it } from "vitest";\nit("has active coverage", () => {});\n'
        : "export const placeholder = true;\n";
      await writeFile(target, content, "utf8");
    }
    await writeFile(
      join(studentRoot, "src/app.ts"),
      'import { createApp } from "../../../lesson-04-mcp-built-in-tools-openrouter/solution/src/app.js";\n' +
        "export { createApp };\n",
      "utf8",
    );

    const result = runStudentCompletionGate(studentRoot);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("import(s) from a ready solution");
    expect(result.stderr).toContain("forbidden solution import");
  });
});
