import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getLessonCheckCommand,
  getNextOpenRouterLesson,
  getNextStarterCheckCommand,
  OPENROUTER_LESSONS,
} from "../../scripts/dev-manager.js";
import {
  createFixturePackageBoundary,
  inspectLesson12OpenRouterCandidate,
  isWithinResolvedRoot,
  requireSecurityEvalSummary,
} from "../../scripts/verify-lesson12-openrouter-completion.js";
import { inspectLesson12OpenRouterContinuity } from "../../scripts/verify-lesson12-openrouter-continuity.js";
import { inspectLesson12OpenRouterScaffolding } from "../../scripts/verify-lesson12-openrouter-scaffolding.js";

const repositoryRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const lesson = "lesson-12-security-openrouter";
const starter = resolve(repositoryRoot, lesson, "starter");
const solution = resolve(repositoryRoot, lesson, "solution");

describe("Lesson 12 OpenRouter infrastructure gates", () => {
  it("requires all 12 security cases and rejects a stale 11-case report", () => {
    const report = (baselineCases: number, securityCases: number, securityTotal = 12) =>
      [
        `Baseline: ${baselineCases}/12 passed, 0 errored.`,
        `Security: ${securityCases}/${securityTotal} passed, 0 errored.`,
      ].join("\n");

    expect(() => requireSecurityEvalSummary(report(12, 12))).not.toThrow();
    expect(() => requireSecurityEvalSummary(report(12, 11))).toThrow(
      "Offline security eval must pass the inherited 12-case baseline and all 12 security cases.",
    );
    expect(() => requireSecurityEvalSummary(report(12, 11, 11))).toThrow(
      "Offline security eval must pass the inherited 12-case baseline and all 12 security cases.",
    );
    expect(() => requireSecurityEvalSummary(report(11, 12))).toThrow(
      "Offline security eval must pass the inherited 12-case baseline and all 12 security cases.",
    );
  });

  it("wires the global course audit to the strict Lesson 12 and 13 contracts", () => {
    const output = execFileSync(
      process.execPath,
      ["scripts/run-tsx-entrypoint.mjs", "scripts/audit-course-contract.ts"],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024,
      },
    );

    expect(output).toContain(
      "PASS Lesson 12 OpenRouter scaffolding: 157 byte-identical Lesson 11 foundation files",
    );
    expect(output).toContain(
      "PASS Lesson 12 OpenRouter continuity: 157 byte-identical Lesson 11 foundation files",
    );
    expect(output).toContain(
      "PASS lesson-13-databases-openrouter scaffolding: strict contract validated",
    );
    expect(output).toContain(
      "PASS lesson-13-databases-openrouter continuity: strict contract validated",
    );
    expect(output).toContain(
      "PASS lesson-13-databases-openrouter completion: strict contract validated",
    );
  });

  it("accepts only the strict starter with the exact 157-file Lesson 11 foundation", async () => {
    const result = await inspectLesson12OpenRouterScaffolding(starter);
    expect(result.join("\n")).toContain("157 byte-identical Lesson 11 foundation files");
    expect(result.join("\n")).toContain("zero Lesson 12 implementation files");
  });

  it("requires the inherited JSON file helper", async () => {
    const fixture = await copyFixture(starter);
    try {
      await rm(resolve(fixture, "src/memory/json-file.ts"));
      expect((await inspectLesson12OpenRouterScaffolding(fixture)).join("\n")).toContain(
        "missing byte-identical Lesson 11 foundation file: src/memory/json-file.ts",
      );
    } finally {
      await rm(dirname(fixture), { recursive: true, force: true });
    }
  });

  it("rejects unaccounted delta, secret paths and incomplete starter markers", async () => {
    const fixture = await copyFixture(starter);
    try {
      await writeFile(resolve(fixture, "src/security.ts"), "export {}\n");
      await writeFile(resolve(fixture, ".env.example"), "placeholder\n");
      await writeFile(resolve(fixture, "src/incomplete.ts"), "// TODO security\n");
      const result = (await inspectLesson12OpenRouterScaffolding(fixture)).join("\n");
      expect(result).toContain("unaccounted Lesson 12 starter file");
      expect(result).toContain("credential configuration is not accepted: .env.example");
      expect(result).toContain("src/incomplete.ts contains an incomplete-work marker");
    } finally {
      await rm(dirname(fixture), { recursive: true, force: true });
    }
  });

  it("requires README and byte-exact inherited files in the starter", async () => {
    const fixture = await copyFixture(starter);
    try {
      await unlink(resolve(fixture, "README.md"));
      await writeFile(resolve(fixture, "src/model-contract.ts"), "// modified foundation\n");
      const result = (await inspectLesson12OpenRouterScaffolding(fixture)).join("\n");
      expect(result).toContain("starter root README.md is required");
      expect(result).toContain("src/model-contract.ts differs from Lesson 11 solution");
    } finally {
      await rm(dirname(fixture), { recursive: true, force: true });
    }
  });

  it("accepts both the zero-delta starter and exact completed 13-file solution", async () => {
    expect((await inspectLesson12OpenRouterContinuity(starter)).join("\n")).toContain(
      "zero-delta starter accepted",
    );
    expect((await inspectLesson12OpenRouterContinuity(solution)).join("\n")).toContain(
      "complete 13-file Lesson 12 delta accepted",
    );
  });

  it("rejects an incomplete Lesson 12 delta", async () => {
    const fixture = await copyFixture(solution);
    try {
      await unlink(resolve(fixture, "src/security.ts"));
      const result = (await inspectLesson12OpenRouterContinuity(fixture)).join("\n");
      expect(result).toContain("delta must be empty (starter) or complete (13 files)");
      expect(result).toContain("missing required Lesson 12 file: src/security.ts");
    } finally {
      await rm(dirname(fixture), { recursive: true, force: true });
    }
  });

  it("rejects modified inherited source and unaccounted files in continuity", async () => {
    const fixture = await copyFixture(solution);
    try {
      await writeFile(resolve(fixture, "src/model-contract.ts"), "// modified inherited source\n");
      await writeFile(resolve(fixture, "extra.ts"), "export {}\n");
      const result = (await inspectLesson12OpenRouterContinuity(fixture)).join("\n");
      expect(result).toContain("source-bound Lesson 11 foundation drift: src/model-contract.ts");
      expect(result).toContain("unaccounted Lesson 12 candidate file: extra.ts");
    } finally {
      await rm(dirname(fixture), { recursive: true, force: true });
    }
  });

  it("accepts the complete candidate inventory before running its isolated execution suite", async () => {
    expect(await inspectLesson12OpenRouterCandidate(solution)).toEqual([]);
  });

  it("rejects a candidate real path outside the repository without touching that path", () => {
    expect(isWithinResolvedRoot(repositoryRoot, resolve(repositoryRoot, "..", "external"))).toBe(
      false,
    );
  });

  it("rejects env files, extra files and skipped tests in completion candidates", async () => {
    const fixture = await copyFixture(solution);
    try {
      await mkdir(resolve(fixture, "config"), { recursive: true });
      await writeFile(resolve(fixture, "config/.env.local"), "placeholder\n");
      await writeFile(resolve(fixture, "extra.json"), "{}\n");
      await writeFile(
        resolve(fixture, "tests/security.test.ts"),
        'it.skip("disabled", () => {});\n',
      );
      const result = (await inspectLesson12OpenRouterCandidate(fixture)).join("\n");
      expect(result).toContain("credential configuration is not accepted: config/.env.local");
      expect(result).toContain("unaccounted Lesson 12 candidate file: extra.json");
      expect(result).toContain("tests/security.test.ts:1 contains disabled or focused test");
    } finally {
      await rm(dirname(fixture), { recursive: true, force: true });
    }
  });

  it("creates a nearest package boundary inside the disposable completion repository", async () => {
    await mkdir(resolve(repositoryRoot, ".tmp", "l12-refactor-20261011"), { recursive: true });
    const parent = await mkdtemp(resolve(repositoryRoot, ".tmp", "l12-package-boundary-"));
    const fixtureRepository = resolve(parent, "repo");
    try {
      await createFixturePackageBoundary(fixtureRepository);
      expect(
        JSON.parse(await readFile(resolve(fixtureRepository, "package.json"), "utf8")),
      ).toEqual({ private: true, type: "module" });
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("routes Lesson 11 to 12 and validates starter, actual dev and solution at their own boundaries", async () => {
    expect(OPENROUTER_LESSONS).toContain(lesson);
    expect(getNextOpenRouterLesson("lesson-11-evals-observability-openrouter")).toEqual({
      nextLessonNum: 12,
      nextLessonDir: lesson,
    });
    expect(getNextStarterCheckCommand(lesson)).toBe("yarn check:lesson12:openrouter:starter");
    expect(getLessonCheckCommand(lesson, "development")).toBe("yarn check:dev:lesson12:openrouter");
    expect(getLessonCheckCommand(lesson, "solution")).toBe("yarn check:dev:lesson12:openrouter");
    const manager = await readFile(resolve(repositoryRoot, "scripts/dev-manager.ts"), "utf8");
    const nextBody = manager.slice(manager.indexOf("export async function runNext"));
    expect(nextBody).toContain("yarn verify:lesson11:openrouter:completion dev");
    expect(nextBody).toContain("yarn verify:lesson12:openrouter:scaffolding dev");
    expect(nextBody).toContain('path !== "README.md"');
    expect(manager).toContain(
      'state.lessonDir === "lesson-12-security-openrouter"\n        ? "yarn check:lesson12:openrouter:solution"',
    );
  });

  it("keeps package gates on the Windows helper and offline checks by default", async () => {
    const { scripts } = JSON.parse(
      await readFile(resolve(repositoryRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(scripts["verify:mvp:no-fallback:through12"]).toContain("--through 12");
    expect(scripts["dev:lesson12:openrouter"]).toContain("starter/src/demo.ts");
    expect(scripts["eval:lesson12:openrouter"]).toContain(
      "starter/evals/run-observability.ts --offline",
    );
    expect(scripts["eval:lesson12:openrouter:solution:offline"]).toContain("--offline");
    expect(scripts["eval:lesson12:openrouter:solution:live"]).toContain("run-security-live.ts");
    expect(scripts["dev:init"]).toContain("scripts/dev-manager.ts init");
    expect(scripts["check:lesson12:openrouter:solution"]).not.toContain(
      "test:lesson12:openrouter:solution",
    );
    expect(scripts["check:lesson12:openrouter:solution"]).not.toContain(
      "eval:lesson12:openrouter:solution:offline",
    );
    for (const name of [
      "verify:lesson12:openrouter",
      "verify:lesson12:openrouter:scaffolding",
      "verify:lesson12:openrouter:continuity",
      "verify:lesson12:openrouter:completion",
      "verify:lesson12:openrouter:catalog",
      "eval:lesson12:openrouter",
      "eval:lesson12:openrouter:solution:offline",
      "eval:lesson12:openrouter:solution:live",
      "demo:lesson12:openrouter:solution",
      "verify:my:lesson12:openrouter",
    ])
      expect(scripts[name], name).toContain("scripts/run-tsx-entrypoint.mjs");
    expect(scripts["check:dev:lesson12:openrouter"]).toContain(
      "verify:lesson12:openrouter:completion dev",
    );
  });
});

async function copyFixture(source: string): Promise<string> {
  const parentRoot = resolve(repositoryRoot, ".tmp", "l12-refactor-20261011", "infra-fixtures");
  await mkdir(parentRoot, { recursive: true });
  const parent = await mkdtemp(resolve(parentRoot, "candidate-"));
  const target = resolve(parent, "candidate");
  await cp(source, target, { recursive: true, filter: (path) => !path.endsWith("node_modules") });
  return target;
}
