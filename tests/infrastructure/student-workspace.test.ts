import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  initializeStudentWorkspace,
  inspectCompletion,
  inspectSourceDelta,
  normalizeVitestReport,
  parseStudentArguments,
  requireCompletion,
  requireDisposableDatabaseIfNeeded,
  resolveEvalCommands,
  resolveStudentLesson,
  runCandidateTests,
  type StudentLessonContext,
} from "../../scripts/student-workspace.js";
import { inspectLesson15OpenRouterCompletion } from "../../scripts/verify-lesson15-openrouter-completion.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("student workspace CLI contract", () => {
  it("requires a lesson and explicit provider for every common action", () => {
    expect(parseStudentArguments(["check", "4", "openrouter"])).toEqual({
      action: "check",
      lesson: "04",
      provider: "openrouter",
    });
    expect(() => parseStudentArguments(["check", "04"])).toThrow(/Usage:/u);
    expect(() => parseStudentArguments(["check", "16", "openai"])).toThrow(/01 through 15/u);
  });

  it("initializes once, omits credentials, and preserves later student edits", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "student-init-contract-"));
    try {
      const repository = resolve(temporary, "course");
      const lessonRoot = resolve(repository, "lesson-01-example");
      const starterRoot = resolve(lessonRoot, "starter");
      const candidateRoot = resolve(repository, "my-dev", "lesson-01-example");
      await mkdir(resolve(starterRoot, "src"), { recursive: true });
      await writeFile(resolve(starterRoot, "src", "app.ts"), "export const answer = 42;\n", "utf8");
      await writeFile(resolve(starterRoot, ".env"), "API_KEY=fixture-secret\n", "utf8");
      await writeFile(resolve(starterRoot, ".env.example"), "API_KEY=replace-me\n", "utf8");
      const context: StudentLessonContext = {
        lesson: "01",
        provider: "openai",
        lessonDirectory: "lesson-01-example",
        lessonRoot,
        starterRoot,
        solutionRoot: resolve(lessonRoot, "solution"),
        candidateRoot,
      };

      await initializeStudentWorkspace(context);
      await expect(readFile(resolve(candidateRoot, ".env"), "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(readFile(resolve(candidateRoot, ".env.example"), "utf8")).resolves.toBe(
        "API_KEY=replace-me\n",
      );
      await writeFile(resolve(candidateRoot, "student-notes.txt"), "keep this work\n", "utf8");
      await expect(initializeStudentWorkspace(context)).rejects.toThrow(/not empty/u);
      await expect(readFile(resolve(candidateRoot, "student-notes.txt"), "utf8")).resolves.toBe(
        "keep this work\n",
      );
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it("distinguishes candidate source changes from an unchanged starter", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "student-delta-contract-"));
    try {
      const starter = resolve(temporary, "starter");
      const candidate = resolve(temporary, "candidate");
      await mkdir(resolve(starter, "src"), { recursive: true });
      await mkdir(resolve(candidate, "src"), { recursive: true });
      await writeFile(resolve(starter, "src", "app.ts"), "export const answer = 42;\n", "utf8");
      await writeFile(resolve(candidate, "src", "app.ts"), "export const answer = 42;\n", "utf8");
      expect((await inspectSourceDelta(starter, candidate)).implementationChanges).toEqual([]);
      await writeFile(resolve(candidate, "src", "app.ts"), "export const answer = 43;\n", "utf8");
      expect((await inspectSourceDelta(starter, candidate)).implementationChanges).toEqual([
        "src/app.ts",
      ]);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it("accepts Lesson 15 OpenRouter's unchanged foundation only with its RC artifacts", async () => {
    const context = await resolveStudentLesson(repositoryRoot, "15", "openrouter");
    const finalCandidate = { ...context, candidateRoot: context.solutionRoot };

    expect(
      (await inspectSourceDelta(context.starterRoot, finalCandidate.candidateRoot))
        .implementationChanges,
    ).toEqual([]);
    await expect(requireCompletion(finalCandidate)).resolves.toBeUndefined();
    await expect(
      inspectLesson15OpenRouterCompletion(relative(repositoryRoot, finalCandidate.candidateRoot)),
    ).resolves.toMatchObject({ passed: true, failures: [] });

    const unchangedStarter = await inspectLesson15OpenRouterCompletion(
      relative(repositoryRoot, context.starterRoot),
    );
    expect(unchangedStarter.passed).toBe(false);
    expect(unchangedStarter.failures.join("\n")).toMatch(
      /missing required Lesson 15 solution file/u,
    );
  });

  it("routes late OpenRouter evals through the fixed offline security and catalog plan", async () => {
    const lesson12 = await resolveStudentLesson(repositoryRoot, "12", "openrouter");
    const expectedInherited = [
      "evals/run.ts",
      "evals/run-agent-loop.ts",
      "evals/run-report-workflow.ts",
      "evals/run-agents-sdk.ts",
      "evals/run-content-review.ts",
      "evals/run-observability.ts",
      "evals/run-security.ts",
    ];
    const lesson12Commands = await resolveEvalCommands({
      ...lesson12,
      candidateRoot: lesson12.solutionRoot,
    });
    expect(lesson12Commands.map((command) => command.relativeEntrypoint)).toEqual(
      expectedInherited,
    );
    expect(
      lesson12Commands.find((command) =>
        command.relativeEntrypoint.endsWith("run-observability.ts"),
      )?.args,
    ).toEqual(["--offline"]);
    expect(
      lesson12Commands.find((command) => command.relativeEntrypoint.endsWith("run-security.ts"))
        ?.args,
    ).toEqual(["--offline"]);

    for (const lesson of ["13", "14", "15"]) {
      const context = await resolveStudentLesson(repositoryRoot, lesson, "openrouter");
      const commands = await resolveEvalCommands({
        ...context,
        candidateRoot: context.solutionRoot,
      });
      expect(commands.map((command) => command.relativeEntrypoint)).toEqual([
        ...expectedInherited,
        "evals/catalog-run.ts",
      ]);
      expect(commands.flatMap((command) => command.args)).not.toContain("--live");
    }

    await expect(
      resolveEvalCommands({ ...lesson12, candidateRoot: lesson12.starterRoot }, true),
    ).rejects.toThrow(/evals\/run-security\.ts/u);
  });

  it("reports JSON test counts without adding suite and assertion totals", () => {
    expect(
      normalizeVitestReport({
        numPassedTests: 4,
        numTodoTests: 1,
        testResults: [
          { assertionResults: [{ status: "passed" }, { status: "skipped" }, { status: "todo" }] },
          { assertionResults: [{ status: "passed" }] },
        ],
      }),
    ).toEqual({ passed: 4, todo: 1, skipped: 1 });
  });

  it("allows exploratory student:test to report TODO and skip but blocks them in completion mode", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "student-tests-contract-"));
    try {
      const lessonDirectory = "lesson-01-fixture";
      const candidateRoot = resolve(temporary, lessonDirectory, "solution");
      await mkdir(resolve(candidateRoot, "tests"), { recursive: true });
      await writeFile(
        resolve(candidateRoot, "tests", "fixture.test.ts"),
        'import { describe, expect, it } from "vitest";\ndescribe("fixture", () => { it("passes", () => expect(1).toBe(1)); it.skip("skips", () => {}); it.todo("todo"); });\n',
        "utf8",
      );
      const context: StudentLessonContext = {
        lesson: "01",
        provider: "openai",
        lessonDirectory,
        lessonRoot: resolve(temporary, lessonDirectory),
        starterRoot: resolve(temporary, lessonDirectory, "starter"),
        solutionRoot: resolve(temporary, "canonical", "solution"),
        candidateRoot,
      };

      await expect(runCandidateTests(context, false)).resolves.toBeUndefined();
      await expect(runCandidateTests(context, true)).rejects.toThrow(/zero todo and skipped/u);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it("requires explicit disposable database authorization before Lesson 13+ checks", async () => {
    const lesson13: StudentLessonContext = {
      lesson: "13",
      provider: "openrouter",
      lessonDirectory: "lesson-13-databases-openrouter",
      lessonRoot: resolve(repositoryRoot, "lesson-13-databases-openrouter"),
      starterRoot: resolve(repositoryRoot, "lesson-13-databases-openrouter", "starter"),
      solutionRoot: resolve(repositoryRoot, "lesson-13-databases-openrouter", "solution"),
      candidateRoot: resolve(repositoryRoot, "my-dev", "lesson-13-databases-openrouter"),
    };
    await expect(requireDisposableDatabaseIfNeeded(lesson13, {})).rejects.toThrow(
      /STUDENT_TEST_DATABASE_DISPOSABLE=1/u,
    );
    await expect(
      requireDisposableDatabaseIfNeeded({ ...lesson13, lesson: "12" }, {}),
    ).resolves.toBeUndefined();
    await expect(
      requireDisposableDatabaseIfNeeded(lesson13, {
        STUDENT_TEST_DATABASE_DISPOSABLE: "1",
        COURSE_TEST_DATABASE_PORT: "15432",
        LESSON13_ADMIN_DATABASE_URL:
          "postgres://fixture:fixture@localhost:15432/ai_agents_openrouter",
      }),
    ).resolves.toBeUndefined();
    await expect(
      requireDisposableDatabaseIfNeeded(lesson13, {
        STUDENT_TEST_DATABASE_DISPOSABLE: "1",
        COURSE_TEST_DATABASE_PORT: "15432",
        LESSON13_ADMIN_DATABASE_URL:
          "https://fixture:fixture@example.test:15432/ai_agents_openrouter",
      }),
    ).rejects.toThrow(/PostgreSQL URL/u);
  });

  it("flags TODO markers before completion can be accepted", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "student-completion-contract-"));
    try {
      await mkdir(resolve(temporary, "tests"), { recursive: true });
      await writeFile(
        resolve(temporary, "tests", "todo.test.ts"),
        'import { it } from "vitest"; it.todo("finish me");\n',
        "utf8",
      );
      expect(await inspectCompletion(temporary)).toContain("tests/todo.test.ts contains todo test");
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
});
