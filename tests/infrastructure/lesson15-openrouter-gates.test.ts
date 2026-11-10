import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  getLesson15SourceFoundation,
  inspectLesson15OpenRouterCandidate,
  lesson15FoundationSize,
  lesson15OpenRouter,
  rcArtifacts,
  repositoryRoot,
  withLesson15FoundationFixture,
} from "../../scripts/lesson15-openrouter-contract.js";
import {
  getLessonCheckCommand,
  getNextOpenRouterLesson,
  getNextStarterCheckCommand,
  OPENROUTER_LESSONS,
} from "../../scripts/dev-manager.js";
import {
  inspectLesson15OpenRouterCompletion,
  verifyLesson15OpenRouterCompletion,
} from "../../scripts/verify-lesson15-openrouter-completion.js";
import { verifyLesson15OpenRouterInheritedEvals } from "../../scripts/verify-lesson15-openrouter-inherited-evals.js";

const delegates = vi.hoisted(() => ({ completion: vi.fn(), evals: vi.fn() }));
vi.mock("../../scripts/verify-lesson14-openrouter-completion.js", () => ({
  verifyLesson14OpenRouterCompletion: delegates.completion,
}));
vi.mock("../../scripts/verify-lesson14-openrouter-inherited-evals.js", () => ({
  verifyLesson14OpenRouterInheritedEvals: delegates.evals,
}));

const scratchRoot = resolve(repositoryRoot, ".tmp/lesson15-infrastructure-tests");
const roleReadme = "# Candidate role\nThis README belongs to the actual student candidate.\n";
const completeDocument =
  "# Release candidate evidence\n\n## Scope\n" +
  "The release candidate retains the completed React SSE application, authenticated chat history, PostgreSQL persistence, input validation and provider configuration from the preceding lesson.\n\n" +
  "## Evidence and limits\nThe local checks exercise candidate code. Live provider verification is NOT RUN, and known limitations remain explicit.\n";

async function withCandidate<T>(run: (candidate: string) => Promise<T>): Promise<T> {
  await mkdir(scratchRoot, { recursive: true });
  const candidate = await mkdtemp(resolve(scratchRoot, "candidate-"));
  try {
    for (const path of await getLesson15SourceFoundation()) {
      const destination = resolve(candidate, path);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(
        resolve(repositoryRoot, "lesson-14-react-sse-openrouter/solution", path),
        destination,
      );
    }
    await writeFile(resolve(candidate, "README.md"), roleReadme, "utf8");
    return await run(candidate);
  } finally {
    await removeFixture(candidate);
  }
}

async function removeFixture(path: string): Promise<void> {
  const metadata = await lstat(path).catch(() => undefined);
  if (metadata === undefined) return;
  const within = relative(await realpath(scratchRoot), await realpath(path));
  if (within === "" || within === ".." || within.startsWith(`..${sep}`))
    throw new Error("Test fixture escaped its guarded scratch root.");
  await rm(path, { recursive: true, force: true });
}

async function addDocuments(candidate: string): Promise<void> {
  for (const artifact of rcArtifacts)
    await writeFile(resolve(candidate, artifact), completeDocument, "utf8");
}

describe("Lesson 15 OpenRouter physical continuation", () => {
  it("keeps the fixed Lesson 14 slot and appends the Lesson 15 transition", () => {
    expect(OPENROUTER_LESSONS[13]).toBe("lesson-14-react-sse-openrouter");
    expect(OPENROUTER_LESSONS[14]).toBe(lesson15OpenRouter);
    expect(getNextOpenRouterLesson("lesson-14-react-sse-openrouter")).toEqual({
      nextLessonNum: 15,
      nextLessonDir: lesson15OpenRouter,
    });
    expect(getNextStarterCheckCommand(lesson15OpenRouter)).toBe(
      "yarn check:dev:lesson15:openrouter:starter",
    );
    for (const stage of ["starter", "development", "solution"] as const)
      expect(getLessonCheckCommand(lesson15OpenRouter, stage)).toBe(
        "yarn check:dev:lesson15:openrouter",
      );
  });

  it("freezes all 237 tracked predecessor files with zero code delta", async () => {
    const foundation = await getLesson15SourceFoundation();
    expect(foundation).toHaveLength(lesson15FoundationSize);
    expect(foundation).toContain("src/memory/json-file.ts");
    expect(foundation).not.toContain("README.md");
    expect(foundation).toContain("src/lesson14/server.ts");
    expect(foundation).toContain("tests/lesson14/client.test.tsx");
    expect(foundation).toContain("integration-tests/react-sse-postgres.test.ts");
    expect(foundation).toContain("integration-tests/catalog-approval-restart-worker.ts");
    expect(rcArtifacts).toHaveLength(6);
    await withCandidate(async (candidate) => {
      expect(await inspectLesson15OpenRouterCandidate(candidate, "starter")).toEqual([]);
      expect(await inspectLesson15OpenRouterCandidate(candidate, "structural")).toEqual([]);
      expect((await inspectLesson15OpenRouterCompletion(candidate)).passed).toBe(false);
    });
  });

  it("accepts completed documents structurally without demanding their removal", async () => {
    await withCandidate(async (candidate) => {
      await addDocuments(candidate);
      expect(await inspectLesson15OpenRouterCandidate(candidate, "structural")).toEqual([]);
      expect((await inspectLesson15OpenRouterCompletion(candidate)).passed).toBe(true);
      expect(await inspectLesson15OpenRouterCandidate(candidate, "starter")).toHaveLength(6);
    });
  });

  it("rejects candidate source drift, removed tests and extra runtime files", async () => {
    await withCandidate(async (candidate) => {
      await writeFile(resolve(candidate, "src/lesson14/server.ts"), "changed runtime\n");
      await rm(resolve(candidate, "tests/lesson14/app.test.ts"));
      await writeFile(resolve(candidate, "src/lesson15.ts"), "extra runtime\n");
      const failures = await inspectLesson15OpenRouterCandidate(candidate, "structural");
      expect(failures).toContain("source-bound Lesson 14 foundation drift: src/lesson14/server.ts");
      expect(failures).toContain(
        "missing inherited Lesson 14 foundation file: tests/lesson14/app.test.ts",
      );
      expect(failures).toContain("unaccounted Lesson 15 structural entry: src/lesson15.ts");
    });
  });

  it.each([
    "it.todo('disabled');",
    "it.skip('disabled', () => {});",
    "test.only('disabled', () => {});",
  ])("rejects test weakening in the inherited foundation (%s)", async (declaration) => {
    await withCandidate(async (candidate) => {
      await writeFile(resolve(candidate, "tests/lesson14/app.test.ts"), declaration);
      expect(await inspectLesson15OpenRouterCandidate(candidate, "structural")).toContain(
        "source-bound Lesson 14 foundation drift: tests/lesson14/app.test.ts",
      );
    });
  });

  it("rejects environment files and unexpected empty directories", async () => {
    await withCandidate(async (candidate) => {
      await writeFile(resolve(candidate, ".env"), "SYNTHETIC=fixture\n");
      await mkdir(resolve(candidate, ".private"));
      const failures = await inspectLesson15OpenRouterCandidate(candidate, "structural");
      expect(failures).toContain("candidate contains environment file: .env");
      expect(failures).toContain("unaccounted Lesson 15 structural entry: .private");
    });
  });

  it("rejects repository escapes and symlink candidates without traversing them", async () => {
    expect(await inspectLesson15OpenRouterCandidate("../outside", "structural")).toEqual([
      "candidate path escapes the allowed repository subtree",
    ]);
    await withCandidate(async (candidate) => {
      const link = resolve(candidate, "linked-runtime");
      await symlink(resolve(candidate, "src"), link, "junction");
      expect(await inspectLesson15OpenRouterCandidate(candidate, "structural")).toContain(
        "candidate contains symlink: linked-runtime",
      );
      expect(await inspectLesson15OpenRouterCandidate(link, "structural")).toEqual([
        "candidate must be a real directory, not a symlink",
      ]);
    });
  });

  it.each(["TODO", "TBD", "FILLME"])("rejects document placeholder %s", async (placeholder) => {
    await withCandidate(async (candidate) => {
      await addDocuments(candidate);
      await writeFile(resolve(candidate, rcArtifacts[0]), `${completeDocument}\n${placeholder}\n`);
      expect((await inspectLesson15OpenRouterCompletion(candidate)).failures).toContain(
        `${rcArtifacts[0]} contains an unfinished placeholder`,
      );
    });
  });

  it("requires meaningful document structure and content beyond fenced examples", async () => {
    await withCandidate(async (candidate) => {
      await addDocuments(candidate);
      await writeFile(
        resolve(candidate, rcArtifacts[0]),
        "```markdown\n# Heading\n## One\n## Two\n```\n",
      );
      expect((await inspectLesson15OpenRouterCompletion(candidate)).failures).toEqual([
        `${rcArtifacts[0]} must contain an H1 heading`,
        `${rcArtifacts[0]} must contain at least two H2 headings`,
        `${rcArtifacts[0]} must contain at least 200 non-whitespace characters`,
      ]);
    });
  });

  it("delegates completion to the candidate foundation and cleans its isolated fixture", async () => {
    await withCandidate(async (candidate) => {
      await addDocuments(candidate);
      let delegatedPath = "";
      delegates.completion.mockImplementationOnce(async (fixture: string) => {
        delegatedPath = resolve(repositoryRoot, fixture);
        expect(delegatedPath).not.toBe(candidate);
        expect(await readFile(resolve(delegatedPath, "README.md"), "utf8")).toBe(roleReadme);
        expect(
          (await readdir(delegatedPath)).some((name) =>
            rcArtifacts.some((artifact) => name === artifact),
          ),
        ).toBe(false);
        expect(await inspectLesson15OpenRouterCandidate(delegatedPath, "starter")).toEqual([]);
        return {
          candidatePassed: 455,
          sourceReboundPassed: 61,
          nativeIntegrationPassed: 13,
          passed: true,
        };
      });
      expect((await verifyLesson15OpenRouterCompletion(candidate)).candidatePassed).toBe(455);
      expect(delegates.completion).toHaveBeenCalledTimes(1);
      expect(await lstat(delegatedPath).catch(() => undefined)).toBeUndefined();
    });
  });

  it("propagates inherited gate failures and removes the fixture", async () => {
    await withCandidate(async (candidate) => {
      let delegatedPath = "";
      await expect(
        withLesson15FoundationFixture(candidate, async (fixture) => {
          delegatedPath = resolve(repositoryRoot, fixture);
          throw new Error("inherited gate failed");
        }),
      ).rejects.toThrow("inherited gate failed");
      expect(await lstat(delegatedPath).catch(() => undefined)).toBeUndefined();
    });
  });

  it("reuses the unchanged inherited eval gate for the document-free candidate", async () => {
    await withCandidate(async (candidate) => {
      await addDocuments(candidate);
      let delegatedPath = "";
      delegates.evals.mockImplementationOnce(async (fixture: string) => {
        delegatedPath = resolve(repositoryRoot, fixture);
        expect(await inspectLesson15OpenRouterCandidate(delegatedPath, "starter")).toEqual([]);
        return [];
      });
      expect(await verifyLesson15OpenRouterInheritedEvals(candidate)).toEqual([]);
      expect(delegates.evals).toHaveBeenCalledTimes(1);
      expect(await lstat(delegatedPath).catch(() => undefined)).toBeUndefined();
    });
  });

  it("validates Lesson 14 before a README-only migration and checks Lesson 15 afterward", async () => {
    const manager = await readFile(resolve(repositoryRoot, "scripts/dev-manager.ts"), "utf8");
    const next = manager.slice(manager.indexOf("export async function runNext"));
    const completion = next.indexOf("yarn verify:lesson14:openrouter:dev");
    const compare = next.indexOf("compareDirectories(devRoot, nextStarterRoot)");
    const apply = next.indexOf("applySafeSync(nextStarterRoot, diff)");
    const state = next.indexOf("await writeCourseState(state)");
    const postcheck = next.indexOf("getNextStarterCheckCommand(nextInfo.nextLessonDir)");
    expect(completion).toBeGreaterThanOrEqual(0);
    expect(compare).toBeGreaterThan(completion);
    expect(apply).toBeGreaterThan(compare);
    expect(state).toBeGreaterThan(apply);
    expect(postcheck).toBeGreaterThan(state);
    expect(next).toContain("Lesson 14 → 15 transition may update only README.md");
    const solution = manager.slice(manager.indexOf("export async function runSolution"));
    expect(solution).toContain('"yarn check:lesson15:openrouter:solution"');
    expect(solution.indexOf("execSync(checkCmd")).toBeLessThan(
      solution.indexOf("applySafeSync(solutionRoot, diff)"),
    );
  });

  it("wires scoped gates and inherited runtime aliases without stale Lesson 15 paths", async () => {
    const { scripts } = JSON.parse(
      await readFile(resolve(repositoryRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(scripts["verify:mvp:no-fallback:through15"]).toContain("--through 15");
    expect(scripts["dev:lesson15:openrouter:dev"]).toContain("dev/src/lesson14/server.ts");
    expect(scripts["dev:lesson15:openrouter:dev"]).toContain("dev/client/vite.config.ts");
    expect(scripts["dev:lesson15:openrouter:api"]).toContain(
      `${lesson15OpenRouter}/starter/src/lesson14/server.ts`,
    );
    expect(scripts["db:lesson15:openrouter:migrate"]).toContain("scripts/lesson14/migrate-chat.ts");
    expect(scripts["verify:lesson15:openrouter:completion"]).toBe(
      "node scripts/run-tsx-entrypoint.mjs scripts/verify-lesson15-openrouter-completion.ts lesson-15-final-project-workshop-openrouter/starter",
    );
    expect(scripts["verify:lesson15:openrouter"]).toBe(
      "node scripts/run-tsx-entrypoint.mjs scripts/verify-lesson15-openrouter-completion.ts lesson-15-final-project-workshop-openrouter/starter",
    );
    expect(scripts["verify:lesson15:openrouter:solution:completion"]).toContain(
      "lesson-15-final-project-workshop-openrouter/solution",
    );
    expect(scripts["check:lesson15:openrouter:solution"]).toContain(
      "verify:lesson15:openrouter:solution:completion",
    );
    expect(scripts["check:lesson15:openrouter:solution"]).not.toContain(
      "&& yarn verify:lesson15:openrouter &&",
    );
    expect(scripts["check:lesson15:openrouter:solution"]).not.toContain("audit:structure");
    expect(scripts["check:dev:lesson15:openrouter"]).toContain("verify:lesson15:openrouter:dev");
    expect(scripts["check:dev:lesson15:openrouter:starter"]).toBe(
      "yarn verify:lesson15:openrouter:dev:starter",
    );
    for (const key of [
      "demo:lesson15:openrouter:solution",
      "eval:lesson15:openrouter:solution:live",
      "verify:lesson15:openrouter:catalog",
    ])
      expect(scripts[key]).toBeUndefined();
    for (const key of [
      "verify:lesson15:openrouter",
      "verify:lesson15:openrouter:continuity",
      "verify:lesson15:openrouter:model",
      "eval:lesson15:openrouter:solution",
      "audit:lesson15:openrouter",
    ])
      expect(scripts[key], key).toContain("scripts/run-tsx-entrypoint.mjs");
  });
});
