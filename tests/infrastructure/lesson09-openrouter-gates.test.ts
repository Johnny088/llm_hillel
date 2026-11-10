import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { getLessonCheckCommand, getNextOpenRouterLesson } from "../../scripts/dev-manager.js";
import { inspectLesson09OpenRouterCandidate } from "../../scripts/verify-lesson09-openrouter-completion.js";

const repositoryRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const tempBase = resolve(repositoryRoot, ".tmp", "lesson09-openrouter-gates");
const solutionRoot = resolve(repositoryRoot, "lesson-09-openai-agents-sdk-openrouter", "solution");
const temporaryRoots: string[] = [];

async function copySolution(label: string): Promise<string> {
  await mkdir(tempBase, { recursive: true });
  const fixture = await mkdtemp(resolve(tempBase, `${label}-`));
  assertContained(await realpath(tempBase), await realpath(fixture));
  temporaryRoots.push(fixture);
  const candidate = resolve(fixture, "candidate");
  await cp(solutionRoot, candidate, { recursive: true });
  return candidate;
}

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) {
    assertContained(await realpath(tempBase), await realpath(root));
    await rm(root, { recursive: true, force: true });
  }
});

describe("Lesson 09 OpenRouter source-bound completion gate", () => {
  it("accepts the completed SDK candidate", async () => {
    const candidate = await copySolution("complete");
    expect(await inspectLesson09OpenRouterCandidate(candidate)).toEqual([]);
  });

  it("rejects a missing SDK delta file and incomplete implementation marker", async () => {
    const missing = await copySolution("missing-delta");
    await rm(join(missing, "evals", "run-agents-sdk.ts"));
    expect((await inspectLesson09OpenRouterCandidate(missing)).join("\n")).toContain(
      "missing required Lesson 09 implementation: evals/run-agents-sdk.ts",
    );

    const incomplete = await copySolution("todo-marker");
    const service = join(incomplete, "src", "services", "agents-sdk-report.ts");
    await writeFile(service, `${await readFile(service, "utf8")}\n// TODO finish this\n`, "utf8");
    expect((await inspectLesson09OpenRouterCandidate(incomplete)).join("\n")).toContain(
      "contains TODO marker",
    );
  });

  it("rejects inherited foundation drift and canonical lesson imports", async () => {
    const drift = await copySolution("foundation-drift");
    const inherited = join(drift, "src", "services", "agent-loop.ts");
    await writeFile(
      inherited,
      `${await readFile(inherited, "utf8")}\n// changed foundation\n`,
      "utf8",
    );
    expect((await inspectLesson09OpenRouterCandidate(drift)).join("\n")).toContain(
      "source-bound Lesson 08 foundation drift: src/services/agent-loop.ts",
    );

    const canonicalImport = await copySolution("canonical-import");
    const service = join(canonicalImport, "src", "services", "agents-sdk-report.ts");
    await writeFile(
      service,
      `${await readFile(service, "utf8")}\nimport "../../../lesson-08-multi-agent-workflow-openrouter/solution/src/app.js";\n`,
      "utf8",
    );
    expect((await inspectLesson09OpenRouterCandidate(canonicalImport)).join("\n")).toContain(
      "imports a canonical lesson starter or solution",
    );
  });
});

describe("Lesson 09 flat-dev routing", () => {
  it("advances from Lesson 08 to the Lesson 09 starter and checks the current solution", () => {
    expect(getNextOpenRouterLesson("lesson-08-multi-agent-workflow-openrouter")).toEqual({
      nextLessonNum: 9,
      nextLessonDir: "lesson-09-openai-agents-sdk-openrouter",
    });
    expect(getLessonCheckCommand("lesson-09-openai-agents-sdk-openrouter", "solution")).toBe(
      "yarn check:lesson09:openrouter:solution",
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
    throw new Error("Lesson 09 fixture escaped its guarded scratch directory.");
  }
}
