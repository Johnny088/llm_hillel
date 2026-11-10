import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getSourceFoundation,
  inspectLesson14OpenRouterCandidate,
  lesson14FoundationSize,
  lesson14SolutionDelta,
} from "../../scripts/lesson14-openrouter-contract.js";
import {
  getLessonCheckCommand,
  getNextOpenRouterLesson,
  getNextStarterCheckCommand,
  OPENROUTER_LESSONS,
} from "../../scripts/dev-manager.js";

const repositoryRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const lesson = "lesson-14-react-sse-openrouter";

describe("Lesson 14 OpenRouter infrastructure routing", () => {
  it("extends the flat OpenRouter chain from Lesson 13 to Lesson 14", () => {
    expect(OPENROUTER_LESSONS[13]).toBe(lesson);
    expect(getNextOpenRouterLesson("lesson-13-databases-openrouter")).toEqual({
      nextLessonNum: 14,
      nextLessonDir: lesson,
    });
    expect(getNextStarterCheckCommand(lesson)).toBe("yarn check:dev:lesson14:openrouter:starter");
  });

  it("matches the tracked predecessor and exact Lesson 14 delta in a fresh checkout", async () => {
    const foundation = await getSourceFoundation();
    expect(foundation).toHaveLength(lesson14FoundationSize);
    expect(foundation).toContain("src/memory/json-file.ts");
    expect(foundation).not.toContain("README.md");
    expect(foundation).toContain("integration-tests/catalog-approval-restart-worker.ts");
    expect(new Set(lesson14SolutionDelta).size).toBe(lesson14SolutionDelta.length);
    expect(await inspectLesson14OpenRouterCandidate(`${lesson}/starter`, "starter")).toEqual([]);
    expect(await inspectLesson14OpenRouterCandidate(`${lesson}/solution`, "solution")).toEqual([]);
  });

  it("routes every Lesson 14 actual-dev stage through its scoped completion gate", () => {
    for (const stage of ["starter", "development", "solution"] as const) {
      expect(getLessonCheckCommand(lesson, stage)).toBe("yarn check:dev:lesson14:openrouter");
    }
  });

  it("validates completed Lesson 13 before a README-only migration, then gates the starter", async () => {
    const manager = await readFile(resolve(repositoryRoot, "scripts/dev-manager.ts"), "utf8");
    const nextBody = manager.slice(manager.indexOf("export async function runNext"));
    const completionIndex = nextBody.indexOf("yarn verify:lesson13:openrouter:completion dev");
    const compareIndex = nextBody.indexOf("compareDirectories(devRoot, nextStarterRoot)");
    const applyIndex = nextBody.indexOf("applySafeSync(nextStarterRoot, diff)");
    const stateIndex = nextBody.indexOf("await writeCourseState(state)");
    const starterGateIndex = nextBody.indexOf("getNextStarterCheckCommand(nextInfo.nextLessonDir)");

    expect(completionIndex).toBeGreaterThanOrEqual(0);
    expect(compareIndex).toBeGreaterThan(completionIndex);
    expect(applyIndex).toBeGreaterThan(compareIndex);
    expect(stateIndex).toBeGreaterThan(applyIndex);
    expect(starterGateIndex).toBeGreaterThan(stateIndex);
    expect(nextBody).not.toContain("verify:lesson14:openrouter:scaffolding dev");
    expect(nextBody).toContain("Lesson 13 → 14 transition may update only README.md");
  });

  it("prechecks the canonical Lesson 14 solution before syncing it to actual dev", async () => {
    const manager = await readFile(resolve(repositoryRoot, "scripts/dev-manager.ts"), "utf8");
    const solutionBody = manager.slice(manager.indexOf("export async function runSolution"));
    expect(solutionBody).toContain('state.lessonDir === "lesson-14-react-sse-openrouter"');
    expect(solutionBody).toContain('"yarn check:lesson14:openrouter:solution"');
    expect(solutionBody.indexOf("execSync(checkCmd")).toBeLessThan(
      solutionBody.indexOf("applySafeSync(solutionRoot, diff)"),
    );
  });

  it("rejects real candidate foundation drift, missing topic files, and unaccounted additions", async () => {
    const fixture = await mkdtemp(resolve(repositoryRoot, ".tmp", "lesson14-contract-"));
    const foundationRoot = resolve(repositoryRoot, "lesson-13-databases-openrouter/solution");
    try {
      for (const path of await getSourceFoundation()) {
        const destination = resolve(fixture, path);
        await mkdir(dirname(destination), { recursive: true });
        await copyFile(resolve(foundationRoot, path), destination);
      }
      await writeFile(resolve(fixture, "README.md"), "candidate README\n", "utf8");
      for (const path of lesson14SolutionDelta) {
        const destination = resolve(fixture, path);
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, "candidate delta\n", "utf8");
      }

      expect(await inspectLesson14OpenRouterCandidate(fixture, "solution")).toEqual([]);
      await writeFile(resolve(fixture, "src/app.ts"), "mutated source\n", "utf8");
      await rm(resolve(fixture, "src/lesson14/sse.ts"));
      await writeFile(resolve(fixture, "unaccounted.ts"), "extra\n", "utf8");
      const failures = await inspectLesson14OpenRouterCandidate(fixture, "solution");
      expect(
        failures.some((failure) =>
          failure.includes("source-bound Lesson 13 foundation drift: src/app.ts"),
        ),
      ).toBe(true);
      expect(
        failures.some((failure) =>
          failure.includes("missing required Lesson 14 solution file: src/lesson14/sse.ts"),
        ),
      ).toBe(true);
      expect(
        failures.some((failure) =>
          failure.includes("unaccounted Lesson 14 solution file: unaccounted.ts"),
        ),
      ).toBe(true);
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  });

  it("uses the process-local tsx helper for direct Lesson 14 OpenRouter entrypoints", async () => {
    const { scripts } = JSON.parse(
      await readFile(resolve(repositoryRoot, "package.json"), "utf8"),
    ) as {
      scripts: Record<string, string>;
    };
    expect(scripts["verify:mvp:no-fallback:through14"]).toContain("--through 14");
    expect(scripts["dev:lesson14:openrouter"]).toContain("dev/src/lesson14/server.ts");
    expect(scripts["dev:lesson14:openrouter"]).toContain("dev/client/vite.config.ts");
    expect(scripts["dev:lesson14:openrouter"]).not.toContain("starter/src/demo.ts");
    for (const name of [
      "dev:lesson14:openrouter",
      "verify:lesson14:openrouter",
      "verify:lesson14:openrouter:continuity",
      "eval:lesson14:openrouter",
      "eval:lesson14:openrouter:solution",
    ]) {
      expect(scripts[name], name).toContain("scripts/run-tsx-entrypoint.mjs");
    }
    expect(scripts["audit:lesson14:openrouter"]).toContain("scripts/run-tsx-entrypoint.mjs");
  });
});
