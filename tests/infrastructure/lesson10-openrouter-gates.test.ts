import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  getLessonCheckCommand,
  getNextOpenRouterLesson,
  getNextStarterCheckCommand,
} from "../../scripts/dev-manager.js";
import { inspectLesson10OpenRouterCandidate } from "../../scripts/verify-lesson10-openrouter-completion.js";
import { inspectLesson10OpenRouterContinuity } from "../../scripts/verify-lesson10-openrouter-continuity.js";
import { inspectLesson10OpenRouterScaffolding } from "../../scripts/verify-lesson10-openrouter-scaffolding.js";

const repositoryRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const tempBase = resolve(repositoryRoot, ".tmp", "lesson10-openrouter-gates");
const solutionRoot = resolve(repositoryRoot, "lesson-10-langgraph-openrouter", "solution");
const starterRoot = resolve(repositoryRoot, "lesson-10-langgraph-openrouter", "starter");
const temporaryRoots: string[] = [];

async function copyTree(label: string, sourceRoot = solutionRoot): Promise<string> {
  await mkdir(tempBase, { recursive: true });
  const fixture = await mkdtemp(resolve(tempBase, `${label}-`));
  assertContained(await realpath(tempBase), await realpath(fixture));
  temporaryRoots.push(fixture);
  const candidate = resolve(fixture, "candidate");
  await cp(sourceRoot, candidate, { recursive: true });
  return candidate;
}

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) {
    assertContained(await realpath(tempBase), await realpath(root));
    await rm(root, { recursive: true, force: true });
  }
});

describe("Lesson 10 OpenRouter source-bound gates", () => {
  it("separates final completion, canonical next-starter, and actual dev candidate checks", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(repositoryRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const { scripts } = packageJson;
    const finalCheck = scripts["check:lesson10:openrouter"]!;
    const starterCheck = scripts["check:lesson10:openrouter:starter"]!;
    const devCheck = scripts["check:dev:lesson10:openrouter"]!;

    expect(scripts["verify:mvp:no-fallback"]).toContain("--through 10");
    expect(finalCheck).toMatch(/^yarn verify:mvp:no-fallback/u);
    expect(finalCheck).toMatch(/&& yarn verify:lesson10:openrouter$/u);
    expect(finalCheck).toContain("verify:lesson10:openrouter:continuity");
    expect(finalCheck).not.toContain("verify:lesson10:openrouter:scaffolding");
    expect(finalCheck).toContain("test:lesson10:openrouter");
    expect(finalCheck).toContain("build:lesson10:openrouter:starter");
    expect(starterCheck).toContain("verify:lesson10:openrouter:scaffolding");
    expect(starterCheck).toContain("build:lesson10:openrouter:starter");
    expect(starterCheck).toMatch(/^yarn verify:mvp:no-fallback/u);
    expect(starterCheck).not.toContain("verify:lesson10:openrouter:completion");
    expect(scripts["verify:lesson10:openrouter"]).toContain(
      "scripts/assert-starter-complete.ts --lesson10-openrouter",
    );
    const completionDispatcher = await readFile(
      resolve(repositoryRoot, "scripts", "assert-starter-complete.ts"),
      "utf8",
    );
    expect(completionDispatcher).toContain("verify-lesson${lessonNumber}-openrouter-completion.ts");

    expect(getNextStarterCheckCommand("lesson-10-langgraph-openrouter")).toBe(
      "yarn check:lesson10:openrouter:starter",
    );
    const devManagerSource = await readFile(
      resolve(repositoryRoot, "scripts", "dev-manager.ts"),
      "utf8",
    );
    expect(devManagerSource).toContain("getNextStarterCheckCommand(nextInfo.nextLessonDir)");
    expect(getNextStarterCheckCommand("lesson-09-openai-agents-sdk-openrouter")).toBe(
      "yarn typecheck:dev && yarn lint:dev && yarn format:check:dev && yarn vitest run --dir dev/tests",
    );
    expect(getLessonCheckCommand("lesson-10-langgraph-openrouter", "starter")).toBe(
      "yarn check:dev:lesson10:openrouter",
    );
    expect(getLessonCheckCommand("lesson-10-langgraph-openrouter", "development")).toBe(
      "yarn check:dev:lesson10:openrouter",
    );
    expect(getLessonCheckCommand("lesson-10-langgraph-openrouter", "solution")).toBe(
      "yarn check:lesson10:openrouter:solution",
    );
    expect(devCheck).toContain("verify:lesson10:openrouter:completion dev");
    expect(devCheck).not.toContain("lesson-10-langgraph-openrouter/starter");
    expect(devCheck).not.toContain("lesson-10-langgraph-openrouter/solution");

    const solutionCheck = scripts["check:lesson10:openrouter:solution"]!;
    expect(solutionCheck).toMatch(/^yarn verify:mvp:no-fallback/u);
    expect(solutionCheck).not.toContain("verify:lesson10:openrouter:scaffolding");
    expect(solutionCheck).toContain("verify:lesson10:openrouter:completion");

    const canonicalStarterFailures = await inspectLesson10OpenRouterCandidate(starterRoot);
    expect(canonicalStarterFailures).toHaveLength(19);
    expect(
      canonicalStarterFailures.every((failure) =>
        failure.startsWith("missing required Lesson 10 implementation:"),
      ),
    ).toBe(true);
  });

  it("accepts the completed graph candidate and routes chain 09 to 10", async () => {
    const candidate = await copyTree("complete");
    expect(await inspectLesson10OpenRouterCandidate(candidate)).toEqual([]);
    expect(getNextOpenRouterLesson("lesson-09-openai-agents-sdk-openrouter")).toEqual({
      nextLessonNum: 10,
      nextLessonDir: "lesson-10-langgraph-openrouter",
    });
    expect(getLessonCheckCommand("lesson-10-langgraph-openrouter", "solution")).toBe(
      "yarn check:lesson10:openrouter:solution",
    );
  });

  it("rejects missing inherited SDK and unique Content Review graph files", async () => {
    const missingJsonHelper = await copyTree("missing-json-helper");
    await rm(join(missingJsonHelper, "src", "memory", "json-file.ts"));
    expect((await inspectLesson10OpenRouterCandidate(missingJsonHelper)).join("\n")).toContain(
      "missing inherited Lesson 09 foundation file: src/memory/json-file.ts",
    );

    const missingSdk = await copyTree("missing-sdk");
    await rm(join(missingSdk, "evals", "run-agents-sdk.ts"));
    expect((await inspectLesson10OpenRouterCandidate(missingSdk)).join("\n")).toContain(
      "missing inherited Lesson 09 foundation file: evals/run-agents-sdk.ts",
    );

    const missingGraph = await copyTree("missing-graph");
    await rm(join(missingGraph, "src", "services", "content-review-graph.ts"));
    expect((await inspectLesson10OpenRouterCandidate(missingGraph)).join("\n")).toContain(
      "missing required Lesson 10 implementation: src/services/content-review-graph.ts",
    );
  });

  it("rejects changed inherited work, credential paths, and unaccounted files", async () => {
    const changed = await copyTree("changed-foundation");
    const foundation = join(changed, "src", "services", "agents-sdk-report.ts");
    await writeFile(
      foundation,
      `${await readFile(foundation, "utf8")}\n// changed foundation\n`,
      "utf8",
    );
    await writeFile(join(changed, ".env.local"), "ignored-by-tests\n", "utf8");
    await writeFile(join(changed, "unexpected.ts"), "export {};\n", "utf8");
    const failures = (await inspectLesson10OpenRouterCandidate(changed)).join("\n");
    expect(failures).toContain(
      "source-bound Lesson 09 foundation drift: src/services/agents-sdk-report.ts",
    );
    expect(failures).toContain("credential configuration is not accepted: .env.local");
    expect(failures).toContain("unaccounted Lesson 10 candidate file: unexpected.ts");
  });

  it("accepts a completed starter in continuity while scaffolding stays starter-exact", async () => {
    const preTransition = await copyTree("pre-transition", starterRoot);
    expect(await inspectLesson10OpenRouterScaffolding(preTransition)).toEqual([
      expect.stringContaining("112 byte-identical Lesson 09 foundation files"),
    ]);

    const changedIntegration = await copyTree("changed-inherited-integration", starterRoot);
    const appPath = join(changedIntegration, "src", "app.ts");
    await writeFile(appPath, `${await readFile(appPath, "utf8")}\n// unapproved delta\n`, "utf8");
    expect((await inspectLesson10OpenRouterScaffolding(changedIntegration)).join("\n")).toContain(
      "src/app.ts differs from Lesson 09 solution.",
    );

    const completed = await copyTree("completed-starter", starterRoot);
    for (const path of [
      "src/app.ts",
      "src/runtime.ts",
      "src/server.ts",
      "src/services/content-review-graph.ts",
      "src/services/openrouter-draft-generator.ts",
      "src/services/high-level-agent-example.ts",
      "src/testing/scripted-draft-generator.ts",
      "src/demo-content-review.ts",
      "tests/content-review-graph.test.ts",
      "tests/openrouter-draft-generator.test.ts",
      "tests/content-review-app.test.ts",
      "tests/content-review-evals.test.ts",
      "tests/content-review-live-eval.test.ts",
      "tests/openrouter-content-review-model.test.ts",
      "evals/content-review-dataset.ts",
      "evals/evaluate-content-review.ts",
      "evals/run-content-review.ts",
      "evals/live-content-review.ts",
      "evals/live-content-review-application.ts",
      "scripts/smoke-content-review-graph.ts",
      "scripts/run-content-review-live-demo.ts",
      "scripts/verify-content-review-catalog.ts",
    ]) {
      const destination = join(completed, path);
      await mkdir(dirname(destination), { recursive: true });
      await cp(join(solutionRoot, path), destination, { recursive: true });
    }

    expect(await inspectLesson10OpenRouterContinuity(completed)).toEqual([
      expect.stringContaining("candidate completion accepted"),
    ]);
    expect((await inspectLesson10OpenRouterScaffolding(completed)).join("\n")).toContain(
      "unaccounted Lesson 10 starter file: src/services/content-review-graph.ts",
    );

    const outside = await inspectLesson10OpenRouterScaffolding(
      resolve(repositoryRoot, "..", "outside-candidate"),
    );
    expect(outside).toContain("Lesson 10 starter candidate must stay inside this repository.");
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
    throw new Error("Lesson 10 fixture escaped its guarded scratch directory.");
  }
}
