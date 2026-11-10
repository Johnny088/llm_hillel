import { cp, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
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
  createLesson13TestEnvironment,
  inspectLesson13OpenRouterCandidate,
  inspectLesson13OpenRouterContinuity,
  inspectLesson13OpenRouterScaffolding,
} from "../../scripts/lesson13-openrouter-contract.js";

const repositoryRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const lesson = "lesson-13-databases-openrouter";
const starter = resolve(repositoryRoot, lesson, "starter");
const solution = resolve(repositoryRoot, lesson, "solution");

describe("Lesson 13 isolated test environment", () => {
  it("builds all four local database URLs from the configured port", () => {
    const safe = createLesson13TestEnvironment({ COURSE_TEST_DATABASE_PORT: "62889" });
    for (const [key, role] of [
      ["LESSON13_OPENROUTER_ADMIN_DATABASE_URL", "course_admin"],
      ["LESSON13_OPENROUTER_READ_DATABASE_URL", "catalog_reader"],
      ["LESSON13_OPENROUTER_WRITE_DATABASE_URL", "catalog_writer"],
      ["LESSON13_OPENROUTER_AGENT_DATABASE_URL", "catalog_agent_runtime"],
    ] as const)
      expect(safe[key]).toBe(
        `postgresql://${role}:${role}_password@127.0.0.1:62889/ai_agents_openrouter`,
      );
    expect(safe.NODE_ENV).toBe("test");
  });

  it("replaces hostile URLs, rejects invalid ports and removes provider credentials", () => {
    const original = {
      COURSE_TEST_DATABASE_PORT: "5434",
      LESSON13_OPENROUTER_ADMIN_DATABASE_URL: "postgresql://hostile/production",
      LESSON13_OPENROUTER_READ_DATABASE_URL: "postgresql://hostile/production",
      LESSON13_OPENROUTER_WRITE_DATABASE_URL: "postgresql://hostile/production",
      LESSON13_OPENROUTER_AGENT_DATABASE_URL: "postgresql://hostile/production",
      OPENROUTER_API_KEY: "fixture-provider-key",
      OPENAI_API_KEY: "fixture-openai-key",
    };
    const safe = createLesson13TestEnvironment(original);
    expect(safe.LESSON13_OPENROUTER_ADMIN_DATABASE_URL).toBe(
      "postgresql://course_admin:course_admin_password@127.0.0.1:5434/ai_agents_openrouter",
    );
    expect(safe.LESSON13_OPENROUTER_AGENT_DATABASE_URL).toBe(
      "postgresql://catalog_agent_runtime:catalog_agent_runtime_password@127.0.0.1:5434/ai_agents_openrouter",
    );
    expect(safe.OPENROUTER_API_KEY).toBeUndefined();
    expect(safe.OPENAI_API_KEY).toBeUndefined();
    expect(original.OPENROUTER_API_KEY).toBe("fixture-provider-key");
    for (const port of ["0", "65536", "1.5", "invalid"])
      expect(() => createLesson13TestEnvironment({ COURSE_TEST_DATABASE_PORT: port })).toThrow(
        "COURSE_TEST_DATABASE_PORT must be an integer between 1 and 65535.",
      );
  });
});

describe("Lesson 13 OpenRouter infrastructure gates", () => {
  it("accepts only the zero-delta starter with the exact 170-file Lesson 12 foundation", async () => {
    const result = await inspectLesson13OpenRouterScaffolding(starter);
    expect(result).toEqual([]);
  });

  it("rejects unaccounted starter files, incomplete markers and secret paths", async () => {
    const fixture = await copyFixture(starter);
    try {
      await writeFile(resolve(fixture, "src/catalog-agent.ts"), "export {}\n");
      await writeFile(resolve(fixture, "src/incomplete.ts"), "// TODO database\n");
      await writeFile(resolve(fixture, ".env.example"), "placeholder\n");
      const result = (await inspectLesson13OpenRouterScaffolding(fixture)).join("\n");
      expect(result).toContain("unaccounted Lesson 13 candidate file: src/catalog-agent.ts");
      expect(result).toContain("src/incomplete.ts:1 contains TODO marker");
      expect(result).toContain("credential configuration is not accepted: .env.example");
    } finally {
      await rm(dirname(fixture), { recursive: true, force: true });
    }
  });

  it("requires the exact solution delta and byte-identical inherited foundation", async () => {
    expect(await inspectLesson13OpenRouterContinuity(solution)).toEqual([]);

    const fixture = await copyFixture(solution);
    try {
      await unlink(resolve(fixture, "src/catalog-agent.ts"));
      await unlink(resolve(fixture, "integration-tests/catalog-approval-restart-worker.ts"));
      await writeFile(resolve(fixture, "src/model-contract.ts"), "// drift\n");
      await writeFile(resolve(fixture, "extra.ts"), "export {};\n");
      const result = (await inspectLesson13OpenRouterContinuity(fixture)).join("\n");
      expect(result).toContain("missing required Lesson 13 implementation: src/catalog-agent.ts");
      expect(result).toContain(
        "missing required Lesson 13 implementation: integration-tests/catalog-approval-restart-worker.ts",
      );
      expect(result).toContain("source-bound Lesson 12 foundation drift: src/model-contract.ts");
      expect(result).toContain("unaccounted Lesson 13 candidate file: extra.ts");
    } finally {
      await rm(dirname(fixture), { recursive: true, force: true });
    }
  });

  it("requires the inherited JSON file helper and rejects unrelated extras", async () => {
    const fixture = await copyFixture(starter);
    try {
      await unlink(resolve(fixture, "src/memory/json-file.ts"));
      await writeFile(resolve(fixture, "unexpected.ts"), "export {};\n", "utf8");
      const result = (await inspectLesson13OpenRouterScaffolding(fixture)).join("\n");
      expect(result).toContain(
        "missing inherited Lesson 12 foundation file: src/memory/json-file.ts",
      );
      expect(result).toContain("unaccounted Lesson 13 candidate file: unexpected.ts");
    } finally {
      await rm(dirname(fixture), { recursive: true, force: true });
    }
  });

  it("rejects disabled and todo tests in the candidate", async () => {
    const fixture = await copyFixture(solution);
    try {
      await writeFile(
        resolve(fixture, "tests/catalog-agent.test.ts"),
        'it.skip("disabled", () => {});\n',
      );
      const result = (await inspectLesson13OpenRouterCandidate(fixture)).join("\n");
      expect(result).toContain("tests/catalog-agent.test.ts contains disabled or focused test");
    } finally {
      await rm(dirname(fixture), { recursive: true, force: true });
    }
  });

  it("rejects a starter as a completion candidate", async () => {
    const result = (await inspectLesson13OpenRouterCandidate(starter)).join("\n");
    expect(result).toContain(
      "missing required Lesson 13 implementation: db/migrations/001_catalog.sql",
    );
  });

  it("dispatches Lesson 13 completion mode and reports the missing catalog delta without running DB checks", () => {
    const helper = resolve(repositoryRoot, "scripts", "run-tsx-entrypoint.mjs");
    const verifier = resolve(repositoryRoot, "scripts", "assert-starter-complete.ts");
    const result = spawnSync(
      process.execPath,
      [helper, verifier, "--lesson13-openrouter", `${lesson}/starter`],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(output).toContain(
      "missing required Lesson 13 implementation: db/migrations/001_catalog.sql",
    );
    expect(output).toContain("missing required Lesson 13 implementation: src/catalog-agent.ts");
    expect(output.match(/missing required Lesson 13 implementation:/gu)).toHaveLength(33);
  });

  it("routes every Lesson 13 origin stage through actual dev and preserves the 12-to-13 transition", async () => {
    expect(OPENROUTER_LESSONS).toContain(lesson);
    expect(getNextOpenRouterLesson("lesson-12-security-openrouter")).toEqual({
      nextLessonNum: 13,
      nextLessonDir: lesson,
    });
    expect(getNextStarterCheckCommand(lesson)).toBe("yarn check:lesson13:openrouter:starter");
    for (const stage of ["starter", "development", "solution"] as const)
      expect(getLessonCheckCommand(lesson, stage)).toBe("yarn check:dev:lesson13:openrouter");

    const manager = await readFileText("scripts/dev-manager.ts");
    const nextBody = manager.slice(manager.indexOf("export async function runNext"));
    expect(nextBody).toContain("yarn verify:lesson12:openrouter:completion dev");
    expect(nextBody).toContain("yarn verify:lesson13:openrouter:scaffolding dev");
    expect(nextBody).toContain('path !== "README.md"');
    expect(manager).toContain(
      'state.lessonDir === "lesson-13-databases-openrouter"\n          ? "yarn check:lesson13:openrouter:solution"',
    );
  });

  it("keeps Lesson 13 gates scoped and uses the Windows tsx helper without a live catalog call", async () => {
    const { scripts } = JSON.parse(await readFileText("package.json")) as {
      scripts: Record<string, string>;
    };
    expect(scripts["verify:mvp:no-fallback:through13"]).toContain("--through 13");
    expect(scripts["verify:lesson13:openrouter"]).toContain("--lesson13-openrouter");
    expect(scripts["verify:lesson13:openrouter"]).toContain(
      "lesson-13-databases-openrouter/solution",
    );
    expect(scripts["check:lesson13:openrouter:starter"]).toContain("test:lesson13:openrouter");
    expect(scripts["eval:lesson13:openrouter:catalog"]).toContain("evals/catalog-run.ts");
    expect(scripts["check:dev:lesson13:openrouter"]).toContain(
      "verify:lesson13:openrouter:completion dev",
    );
    expect(scripts["check:dev:lesson13:openrouter"]).toContain("typecheck:dev");
    expect(scripts["check:lesson13:openrouter:solution"]).not.toContain(
      "verify:lesson13:openrouter:catalog",
    );
    for (const name of [
      "dev:lesson13:openrouter",
      "dev:lesson13:openrouter:solution",
      "verify:lesson13:openrouter:completion",
      "eval:lesson13:openrouter",
      "eval:lesson13:openrouter:catalog",
    ])
      expect(scripts[name], name).toContain("scripts/run-tsx-entrypoint.mjs");
    expect(scripts["dev:init"]).toContain("scripts/dev-manager.ts init");
  });
});

async function copyFixture(source: string): Promise<string> {
  const parentRoot = resolve(repositoryRoot, ".tmp", "l13-refactor-20261012", "infra-fixtures");
  await mkdir(parentRoot, { recursive: true });
  const parent = await mkdtemp(resolve(parentRoot, "candidate-"));
  const target = resolve(parent, "candidate");
  await cp(source, target, {
    recursive: true,
    filter: (path) => !path.endsWith("node_modules") && !path.endsWith("dist"),
  });
  return target;
}

async function readFileText(path: string): Promise<string> {
  return readFile(resolve(repositoryRoot, path), "utf8");
}
