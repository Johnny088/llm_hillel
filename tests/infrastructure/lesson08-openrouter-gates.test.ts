import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { inspectLesson08OpenRouterCandidate } from "../../scripts/verify-lesson08-openrouter-completion.js";
import { inspectLesson08OpenRouterScaffolding } from "../../scripts/verify-lesson08-openrouter-scaffolding.js";

const repositoryRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const tempBase = resolve(
  repositoryRoot,
  ".tmp",
  "lesson08-continuity-20261006",
  "source08",
  "gates",
);
const starterRoot = resolve(repositoryRoot, "lesson-08-multi-agent-workflow-openrouter", "starter");
const temporaryRoots: string[] = [];

async function createFixture(label: string): Promise<string> {
  await mkdir(tempBase, { recursive: true });
  const root = await mkdtemp(resolve(tempBase, `${label}-`));
  assertContained(await realpath(tempBase), await realpath(root));
  temporaryRoots.push(root);
  return root;
}

async function copyStarter(label: string): Promise<string> {
  const fixture = await createFixture(label);
  const candidate = resolve(fixture, "starter");
  await cp(starterRoot, candidate, { recursive: true });
  return candidate;
}

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) {
    assertContained(await realpath(tempBase), await realpath(root));
    await rm(root, { recursive: true, force: true });
  }
});

describe("Lesson 08 OpenRouter physical inheritance gate", () => {
  it("accepts the Git-tracked predecessor manifest with its root README exception", async () => {
    const clean = await inspectLesson08OpenRouterScaffolding(starterRoot);
    expect(clean[0]).toContain("PASS Lesson 08 OpenRouter physical starter: 89 byte-identical");

    const candidate = await copyStarter("readme-exception");
    await writeFile(join(candidate, "README.md"), "Docs-owned root README exception.\n", "utf8");
    const withReadmeEdit = await inspectLesson08OpenRouterScaffolding(candidate);
    expect(withReadmeEdit[0]).toContain("PASS Lesson 08 OpenRouter physical starter");
  });

  it("rejects byte drift, missing tracked files, and unaccounted files", async () => {
    const drift = await copyStarter("byte-drift");
    const appPath = join(drift, "src", "app.ts");
    await writeFile(appPath, `${await readFile(appPath, "utf8")}\n// drift\n`, "utf8");
    expect((await inspectLesson08OpenRouterScaffolding(drift)).join("\n")).toContain(
      "src/app.ts differs byte-for-byte",
    );

    const missing = await copyStarter("missing-file");
    await rm(join(missing, "tests", "agent-loop.test.ts"));
    expect((await inspectLesson08OpenRouterScaffolding(missing)).join("\n")).toContain(
      "missing Git-tracked Lesson 07 solution file: tests/agent-loop.test.ts",
    );

    const extra = await copyStarter("extra-file");
    await writeFile(join(extra, "src", "new.ts"), "export {};\n", "utf8");
    expect((await inspectLesson08OpenRouterScaffolding(extra)).join("\n")).toContain(
      "unaccounted Lesson 08 starter file: src/new.ts",
    );
  });
});

describe("Lesson 08 OpenRouter source-bound completion gate", () => {
  it("rejects the untouched starter for the missing workflow delta", async () => {
    const failures = await inspectLesson08OpenRouterCandidate(starterRoot);
    expect(
      failures.some((failure) => failure.includes("missing required Lesson 08 implementation")),
    ).toBe(true);
    expect(failures.join("\n")).not.toMatch(/credential|environment|module resolution/iu);
  });

  it("rejects source drift, fallback routing, and canonical imports in candidate fixtures", async () => {
    const drift = await copyStarter("source-binding");
    const inherited = join(drift, "src", "services", "agent-loop.ts");
    await writeFile(
      inherited,
      `${await readFile(inherited, "utf8")}\n// changed foundation\n`,
      "utf8",
    );
    expect((await inspectLesson08OpenRouterCandidate(drift)).join("\n")).toContain(
      "source-bound Lesson 07 foundation drift: src/services/agent-loop.ts",
    );

    const fallback = await copyStarter("fallback-route");
    const delta = join(fallback, "src", "services", "report-workflow.ts");
    await mkdir(dirname(delta), { recursive: true });
    await writeFile(delta, "const fallbackModels = ['alternate/model'];\n", "utf8");
    expect((await inspectLesson08OpenRouterCandidate(fallback)).join("\n")).toContain(
      "violates the one-model contract",
    );

    const canonicalImport = await copyStarter("canonical-import");
    const importPath = join(canonicalImport, "src", "services", "report-workflow.ts");
    await mkdir(dirname(importPath), { recursive: true });
    await writeFile(
      importPath,
      'import type { TokenUsage } from "../../../lesson-07-agent-loop-openrouter/solution/src/services/agent-loop.js";\n',
      "utf8",
    );
    expect((await inspectLesson08OpenRouterCandidate(canonicalImport)).join("\n")).toContain(
      "imports a canonical lesson starter or solution",
    );
  });
});

function assertContained(parent: string, child: string): void {
  const relativeRoot = relative(parent, child);
  if (
    relativeRoot === "" ||
    relativeRoot === ".." ||
    relativeRoot.startsWith(`..${sep}`) ||
    isAbsolute(relativeRoot)
  ) {
    throw new Error("Lesson 08 fixture escaped its guarded scratch directory.");
  }
}
