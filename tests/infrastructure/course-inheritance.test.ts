import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getCanonicalCourseTransitions,
  inspectCourseInheritance,
  verifyCourseInheritance,
  type CourseProvider,
} from "../../scripts/course-inheritance.js";

const providers: CourseProvider[] = ["openai", "openrouter"];
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("canonical course inheritance transitions", () => {
  it.each(providers)("lists only same-provider transitions for %s", (provider) => {
    const transitions = getCanonicalCourseTransitions(provider);

    expect(transitions).toHaveLength(13);
    expect(transitions[0]).toEqual({
      provider,
      fromLesson: provider === "openrouter" ? "lesson-02-llm-api-openrouter" : "lesson-02-llm-api",
      toLesson:
        provider === "openrouter"
          ? "lesson-03-function-calling-openrouter"
          : "lesson-03-function-calling",
      sourceRoot:
        provider === "openrouter"
          ? "lesson-02-llm-api-openrouter/solution"
          : "lesson-02-llm-api/solution",
      targetRoot:
        provider === "openrouter"
          ? "lesson-03-function-calling-openrouter/starter"
          : "lesson-03-function-calling/starter",
    });
    expect(transitions.some((transition) => transition.fromLesson.includes("lesson-01"))).toBe(
      false,
    );
    expect(transitions.at(-1)?.toLesson).toBe(
      provider === "openrouter"
        ? "lesson-15-final-project-workshop-openrouter"
        : "lesson-15-final-project-workshop",
    );
    expect(transitions.every((transition) => transition.provider === provider)).toBe(true);
  });
});

describe.each(providers)("exact %s inheritance comparison", (provider) => {
  async function createTrees() {
    const root = await mkdtemp(join(tmpdir(), `course-inheritance-${provider}-`));
    temporaryRoots.push(root);
    const sourceRoot = join(root, "solution");
    const targetRoot = join(root, "starter");
    await Promise.all([
      mkdir(join(sourceRoot, "src"), { recursive: true }),
      mkdir(join(targetRoot, "src"), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(sourceRoot, "src", "agent.ts"), "export const ready = true;\n"),
      writeFile(join(targetRoot, "src", "agent.ts"), "export const ready = true;\n"),
      writeFile(join(sourceRoot, "README.md"), "solution documentation\n"),
      writeFile(join(targetRoot, "README.md"), "starter documentation\n"),
    ]);
    return { sourceRoot, targetRoot };
  }

  it("accepts identical non-Markdown source trees while allowing lesson-specific Markdown", async () => {
    const { sourceRoot, targetRoot } = await createTrees();
    const result = await verifyCourseInheritance(sourceRoot, targetRoot);

    expect(result.ok).toBe(true);
    expect(result.matchedFiles).toEqual(["src/agent.ts"]);
    expect(result.sourceFiles).toEqual(["src/agent.ts"]);
    expect(result.targetFiles).toEqual(["src/agent.ts"]);
  });

  it("ignores generated dependency output without hiding extra source files", async () => {
    const { sourceRoot, targetRoot } = await createTrees();
    await Promise.all([
      mkdir(join(sourceRoot, "node_modules", ".vite", "vitest"), { recursive: true }),
      mkdir(join(targetRoot, "node_modules", ".vite", "vitest"), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(
        join(sourceRoot, "node_modules", ".vite", "vitest", "results.json"),
        "source cache",
      ),
      writeFile(
        join(targetRoot, "node_modules", ".vite", "vitest", "results.json"),
        "target cache",
      ),
    ]);

    const result = await verifyCourseInheritance(sourceRoot, targetRoot);
    expect(result.ok).toBe(true);
    expect(result.sourceFiles).toEqual(["src/agent.ts"]);
    expect(result.targetFiles).toEqual(["src/agent.ts"]);
  });

  it("rejects byte changes", async () => {
    const { sourceRoot, targetRoot } = await createTrees();
    await writeFile(join(targetRoot, "src", "agent.ts"), "export const ready = false;\n");

    const result = await inspectCourseInheritance(sourceRoot, targetRoot);
    expect(result.ok).toBe(false);
    expect(result.changedFiles).toEqual(["src/agent.ts"]);
    await expect(verifyCourseInheritance(sourceRoot, targetRoot)).rejects.toThrow(
      "byte mismatch: src/agent.ts",
    );
  });

  it("rejects a missing inherited source file", async () => {
    const { sourceRoot, targetRoot } = await createTrees();
    await rm(join(targetRoot, "src", "agent.ts"));

    const result = await inspectCourseInheritance(sourceRoot, targetRoot);
    expect(result.ok).toBe(false);
    expect(result.missingFiles).toEqual(["src/agent.ts"]);
    await expect(verifyCourseInheritance(sourceRoot, targetRoot)).rejects.toThrow(
      "missing from target: src/agent.ts",
    );
  });

  it("rejects a new source file in the next starter", async () => {
    const { sourceRoot, targetRoot } = await createTrees();
    await writeFile(join(targetRoot, "src", "new-lesson-delta.ts"), "export {};\n");

    const result = await inspectCourseInheritance(sourceRoot, targetRoot);
    expect(result.ok).toBe(false);
    expect(result.extraFiles).toEqual(["src/new-lesson-delta.ts"]);
    await expect(verifyCourseInheritance(sourceRoot, targetRoot)).rejects.toThrow(
      "extra in target: src/new-lesson-delta.ts",
    );
  });

  it("can include Markdown in an explicitly full-tree comparison", async () => {
    const { sourceRoot, targetRoot } = await createTrees();

    const result = await inspectCourseInheritance(sourceRoot, targetRoot, {
      includeMarkdown: true,
    });
    expect(result.ok).toBe(false);
    expect(result.changedFiles).toEqual(["README.md"]);
  });
});
