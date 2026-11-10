import { cp, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getLessonCheckCommand,
  getNextOpenRouterLesson,
  getNextStarterCheckCommand,
  OPENROUTER_LESSONS,
} from "../../scripts/dev-manager.js";
import { resolveRepositoryEnvFile } from "../../lesson-10-langgraph-openrouter/solution/src/config/env.js";
import { requireOfflineProfiles as requireLesson11OfflineProfiles } from "../../scripts/verify-lesson11-openrouter-completion.js";
import { requireOfflineProfiles as requireLesson12OfflineProfiles } from "../../scripts/verify-lesson12-openrouter-completion.js";
import { requireOfflineProfiles as requireLesson13OfflineProfiles } from "../../scripts/lesson13-openrouter-contract.js";
import { requireOfflineProfiles as requireLesson14OfflineProfiles } from "../../scripts/verify-lesson14-openrouter-inherited-evals.js";
import {
  createFixturePackageBoundary,
  inspectLesson11OpenRouterCandidate,
} from "../../scripts/verify-lesson11-openrouter-completion.js";
import { inspectLesson11OpenRouterContinuity } from "../../scripts/verify-lesson11-openrouter-continuity.js";
import { inspectLesson11OpenRouterScaffolding } from "../../scripts/verify-lesson11-openrouter-scaffolding.js";

const repositoryRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const lesson = "lesson-11-evals-observability-openrouter";
const starter = resolve(repositoryRoot, lesson, "starter");
const solution = resolve(repositoryRoot, lesson, "solution");
const offlineProfileParsers = [
  requireLesson11OfflineProfiles,
  requireLesson12OfflineProfiles,
  requireLesson13OfflineProfiles,
  requireLesson14OfflineProfiles,
];

function offlineProfileReport(
  fastOverrides: Partial<Record<"mode" | "total" | "passed" | "failed" | "errored", string>> = {},
): string {
  const headers = [
    "(index)",
    "configuration",
    "model",
    "providerSort",
    "hasPromptCacheKey",
    "promptCacheKeyFingerprint",
    "mode",
    "total",
    "passed",
    "failed",
    "errored",
  ];
  const row = (index: number, configuration: string, overrides: typeof fastOverrides = {}) => {
    const values = [
      String(index),
      `'${configuration}'`,
      "'model'",
      "'default'",
      "true",
      "'abc123'",
      "'offline-fixture'",
      "12",
      "12",
      "0",
      "0",
    ];
    for (const [key, value] of Object.entries(overrides)) values[headers.indexOf(key)] = value;
    return `│ ${values.join(" │ ")} │`;
  };
  return [`│ ${headers.join(" │ ")} │`, row(0, "fast", fastOverrides), row(1, "main")].join("\n");
}

describe("Lesson 11 OpenRouter infrastructure gates", () => {
  it.each(offlineProfileParsers)(
    "parses observability profiles by header, including fingerprint columns",
    (parseProfiles) => {
      expect(() => parseProfiles(offlineProfileReport())).not.toThrow();
      expect(() => parseProfiles(offlineProfileReport({ failed: "1", passed: "11" }))).toThrow();
      expect(() => parseProfiles(offlineProfileReport({ errored: "1", passed: "11" }))).toThrow();
      expect(() => parseProfiles(offlineProfileReport().split("\n").slice(1).join("\n"))).toThrow();
    },
  );

  it("keeps the exact Lesson 10 foundation and accepts the strict zero-delta starter", async () => {
    const result = await inspectLesson11OpenRouterScaffolding(starter);
    expect(result.join("\n")).toContain("131 byte-identical Lesson 10 foundation files");
    expect(result.join("\n")).toContain("zero Lesson 11 implementation files");
  });

  it("requires each candidate root README alongside the 131-file inherited foundation", async () => {
    const fixture = await copyFixture(starter);
    try {
      await unlink(resolve(fixture, "README.md"));
      const scaffold = await inspectLesson11OpenRouterScaffolding(fixture);
      const continuity = await inspectLesson11OpenRouterContinuity(fixture);
      expect(scaffold.join("\n")).toContain("starter root README.md is required");
      expect(continuity.join("\n")).toContain("candidate root README.md is required");
    } finally {
      await rm(dirname(fixture), { recursive: true, force: true });
    }
  });

  it("accepts a pre-transition 131-file baseline and rejects inherited integration drift", async () => {
    const fixture = await copyFixture(starter);
    try {
      const baseline = await inspectLesson11OpenRouterScaffolding(fixture);
      expect(baseline.join("\n")).toContain("zero Lesson 11 implementation files");

      await writeFile(resolve(fixture, "unexpected.ts"), "export {};\n");
      await writeFile(resolve(fixture, ".env"), "OPENROUTER_API_KEY=must-not-be-read\n");
      const unsafe = await inspectLesson11OpenRouterScaffolding(fixture);
      expect(unsafe.join("\n")).toContain("unaccounted Lesson 11 starter file");
      expect(unsafe.join("\n")).toContain("credential configuration is not accepted: .env");
      await unlink(resolve(fixture, "unexpected.ts"));
      await unlink(resolve(fixture, ".env"));

      await writeFile(resolve(fixture, "evals/run.ts"), "// altered inherited integration file\n");
      const drift = await inspectLesson11OpenRouterScaffolding(fixture);
      expect(drift.join("\n")).toContain("evals/run.ts differs from Lesson 10 solution");
    } finally {
      await rm(dirname(fixture), { recursive: true, force: true });
    }
  });

  it("requires the inherited JSON file helper", async () => {
    const fixture = await copyFixture(starter);
    try {
      await unlink(resolve(fixture, "src/memory/json-file.ts"));
      expect((await inspectLesson11OpenRouterScaffolding(fixture)).join("\n")).toContain(
        "missing byte-identical Lesson 10 foundation file: src/memory/json-file.ts",
      );
    } finally {
      await rm(dirname(fixture), { recursive: true, force: true });
    }
  });

  it("rejects symbolic links inside a candidate tree", async (context) => {
    const fixture = await copyFixture(starter);
    const linkedFixture = resolve(dirname(fixture), "candidate-link");
    try {
      try {
        await symlink(fixture, linkedFixture, "junction");
      } catch (error) {
        const code =
          typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
        if (code === "EPERM" || code === "EACCES" || code === "ENOSYS") {
          context.skip("Host does not permit creating a test symlink.");
          return;
        }
        throw error;
      }
      await expect(inspectLesson11OpenRouterScaffolding(linkedFixture)).rejects.toThrow(
        "must not be a symlink",
      );
    } finally {
      await rm(dirname(fixture), { recursive: true, force: true });
    }
  });

  it("accepts complete student work through general continuity and requires every unique file", async () => {
    const continuity = await inspectLesson11OpenRouterContinuity(solution);
    expect(continuity.join("\n")).toContain("completed candidate accepted");

    const incomplete = await copyFixture(solution);
    try {
      await unlink(resolve(incomplete, "evals/run-observability.ts"));
      const result = await inspectLesson11OpenRouterContinuity(incomplete);
      expect(result.join("\n")).toMatch(/delta must be empty \(starter\) or complete \(26\)/u);
      expect(result.join("\n")).toContain(
        "missing required Lesson 11 file: evals/run-observability.ts",
      );
    } finally {
      await rm(dirname(incomplete), { recursive: true, force: true });
    }
  });

  it("binds completion to the 26-file candidate and source-rebound canonical oracle", async () => {
    const canonicalStarter = await inspectLesson11OpenRouterCandidate(starter);
    expect(canonicalStarter.join("\n")).toContain("missing required Lesson 11 implementation");
    expect(canonicalStarter.join("\n")).toContain("evals/observability-cases.ts");

    const completed = await inspectLesson11OpenRouterCandidate(solution);
    expect(completed).toEqual([]);

    const altered = await copyFixture(solution);
    try {
      await writeFile(resolve(altered, "src/app.ts"), "// modified inherited source\n");
      const drift = await inspectLesson11OpenRouterCandidate(altered);
      expect(drift.join("\n")).toContain("source-bound Lesson 10 foundation drift: src/app.ts");
    } finally {
      await rm(dirname(altered), { recursive: true, force: true });
    }
  });

  it("gives the disposable completion fixture its own nearest package boundary", async () => {
    await mkdir(resolve(repositoryRoot, ".tmp"), { recursive: true });
    const fixtureParent = await mkdtemp(resolve(repositoryRoot, ".tmp", "lesson11-env-boundary-"));
    const fixtureRepository = resolve(fixtureParent, "repo");
    try {
      await createFixturePackageBoundary(fixtureRepository);
      const packageJson = JSON.parse(
        await readFile(resolve(fixtureRepository, "package.json"), "utf8"),
      ) as {
        private: boolean;
        type: string;
      };
      expect(packageJson).toEqual({ private: true, type: "module" });

      const nestedSource = resolve(
        fixtureRepository,
        "lesson-10-langgraph-openrouter",
        "solution",
        "src",
      );
      const discoveredEnv = resolveRepositoryEnvFile(nestedSource);
      expect(discoveredEnv).toBe(resolve(fixtureRepository, ".env"));
      expect(discoveredEnv).not.toBe(resolve(repositoryRoot, ".env"));
    } finally {
      await rm(fixtureParent, { recursive: true, force: true });
    }
  });

  it("routes Lesson 11 starter, actual dev, solution and one-time dev-next through scoped gates", async () => {
    expect(OPENROUTER_LESSONS).toContain(lesson);
    expect(getNextOpenRouterLesson("lesson-10-langgraph-openrouter")).toEqual({
      nextLessonNum: 11,
      nextLessonDir: lesson,
    });
    expect(getNextStarterCheckCommand(lesson)).toBe("yarn check:lesson11:openrouter:starter");
    expect(getLessonCheckCommand(lesson, "development")).toBe("yarn check:dev:lesson11:openrouter");
    expect(getLessonCheckCommand(lesson, "solution")).toBe("yarn check:dev:lesson11:openrouter");

    const manager = await readFile(resolve(repositoryRoot, "scripts/dev-manager.ts"), "utf8");
    const solutionBody = manager.slice(manager.indexOf("export async function runSolution"));
    expect(solutionBody).toContain('"yarn check:lesson11:openrouter:solution"');
    const nextBody = manager.slice(manager.indexOf("export async function runNext"));
    expect(nextBody).toContain('"yarn verify:lesson11:openrouter:scaffolding dev"');
    expect(nextBody.indexOf("const preflight")).toBeLessThan(
      nextBody.indexOf("const diff = await compareDirectories"),
    );
    expect(nextBody).toContain("await applySafeSync(nextStarterRoot, diff)");
  });

  it("keeps aliases offline by default and scopes no-fallback checks through Lesson 11", async () => {
    const { scripts } = JSON.parse(
      await readFile(resolve(repositoryRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(scripts["verify:mvp:no-fallback:through11"]).toContain("--through 11");
    expect(scripts["eval:lesson11:openrouter:solution"]).toContain("--offline");
    expect(scripts["eval:lesson11:openrouter:solution:live"]).toContain("--live");
    for (const name of [
      "verify:lesson11:openrouter",
      "verify:lesson11:openrouter:scaffolding",
      "verify:lesson11:openrouter:continuity",
      "verify:lesson11:openrouter:completion",
      "eval:lesson11:openrouter:solution",
      "eval:lesson11:openrouter:solution:live",
      "demo:lesson11:openrouter:solution",
      "verify:my:lesson11:openrouter",
    ]) {
      expect(scripts[name], name).toContain("scripts/run-tsx-entrypoint.mjs");
    }
    expect(scripts["check:dev:lesson11:openrouter"]).toContain(
      "verify:lesson11:openrouter:completion dev",
    );
    expect(scripts["verify:my:lesson11:openrouter"]).toContain(
      "my-dev/lesson-11-evals-observability-openrouter",
    );
  });
});

async function copyFixture(source: string): Promise<string> {
  await mkdir(resolve(repositoryRoot, ".tmp"), { recursive: true });
  const parent = await mkdtemp(resolve(repositoryRoot, ".tmp", "lesson11-gates-"));
  const target = resolve(parent, "candidate");
  await cp(source, target, { recursive: true, filter: (path) => !path.endsWith("node_modules") });
  return target;
}
