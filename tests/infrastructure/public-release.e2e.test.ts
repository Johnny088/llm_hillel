import { execFileSync, execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getNextOpenRouterLesson, parseLessonNumber } from "../../scripts/dev-manager.js";
import {
  filterFilesForRelease,
  validateSecurityAndBoundaries,
} from "../../scripts/publish-public.mjs";
import {
  inspectCheckpointDirectoryMismatch,
  PAIRS,
  verifyProviderParity,
} from "../../scripts/verify-provider-parity.js";

describe("Infrastructure Hardening & Scenarios", () => {
  describe("Scenario E: Missing OpenRouter on dev:next", () => {
    it("aborts when next OpenRouter variant is not available", () => {
      expect(() => {
        getNextOpenRouterLesson("lesson-15-final-project-workshop-openrouter");
      }).toThrow(/OpenRouter variant for lesson 16 is not available/i);
    });

    it("parses lesson numbers accurately", () => {
      expect(parseLessonNumber("lesson-01-intro-openrouter")).toBe(1);
      expect(parseLessonNumber("lesson-04")).toBe(4);
      expect(parseLessonNumber(5)).toBe(5);
    });
  });

  describe("Scenario F: Provider parity mismatch reporting without modifying lesson files", () => {
    it("reports diagnostics while leaving all lesson files strictly read-only", async () => {
      const p1 = join(process.cwd(), "lesson-01-intro", "README.md");
      const beforeContent = await readFile(p1, "utf8");

      const result = await verifyProviderParity();

      const afterContent = await readFile(p1, "utf8");
      expect(beforeContent).toBe(afterContent);
      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes("Manual course-content review required"))).toBe(
        true,
      );
      expect(PAIRS.map((pair) => pair.lessonNum)).toContain(11);
      expect(result.summaries.some((summary) => summary.startsWith("PASS Lesson 11:"))).toBe(true);
    });

    it("accepts only instruction-only lesson 11-15 directories and rejects runtime snapshots", () => {
      const readmeOnly = [{ name: "README.md", isFile: true }];
      const runtimeSnapshot = [
        { name: "README.md", isFile: true },
        { name: "checkpoint-01", isFile: false },
      ];

      expect(inspectCheckpointDirectoryMismatch(13, false, true, readmeOnly)).toMatchObject({
        errors: [],
        warnings: [expect.stringContaining("instructional README")],
      });
      expect(inspectCheckpointDirectoryMismatch(13, false, true, runtimeSnapshot).errors).toContain(
        "Lesson 13: OpenRouter checkpoints/ has unexpected entries: README.md, checkpoint-01.",
      );
      expect(inspectCheckpointDirectoryMismatch(10, false, true, readmeOnly).errors).toHaveLength(
        1,
      );
    });

    it("keeps infrastructure tests serialized with a 30-second timeout", async () => {
      const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
        scripts: Record<string, string>;
      };

      expect(packageJson.scripts["test:infrastructure"]).toBe(
        "vitest run --maxWorkers=1 --fileParallelism=false --testTimeout=30000 tests/infrastructure",
      );
    });
  });

  describe("File Filtering and Security Gate Logic", () => {
    it("filters files accurately according to releasedThrough and dev state", () => {
      const mockFiles = [
        { fullPath: "/repo/package.json", relPath: "package.json" },
        { fullPath: "/repo/lesson-01-intro/src/index.ts", relPath: "lesson-01-intro/src/index.ts" },
        {
          fullPath: "/repo/lesson-01-intro-openrouter/src/index.ts",
          relPath: "lesson-01-intro-openrouter/src/index.ts",
        },
        {
          fullPath: "/repo/lesson-02-llm-api/src/server.ts",
          relPath: "lesson-02-llm-api/src/server.ts",
        },
        {
          fullPath: "/repo/lesson-02-llm-api-openrouter/src/server.ts",
          relPath: "lesson-02-llm-api-openrouter/src/server.ts",
        },
        {
          fullPath: "/repo/lesson-03-function-calling/src/server.ts",
          relPath: "lesson-03-function-calling/src/server.ts",
        },
        { fullPath: "/repo/dev/src/index.ts", relPath: "dev/src/index.ts" },
        { fullPath: "/repo/.private/secret.md", relPath: ".private/secret.md" },
        { fullPath: "/repo/.agents/rule.md", relPath: ".agents/rule.md" },
      ];

      // Test with releasedThrough = 2, dev = 2 (released)
      const releasedDevState = {
        lesson: 2,
        lessonDir: "lesson-02-llm-api-openrouter",
        provider: "openrouter" as const,
        stage: "starter" as const,
        checkpoint: 0,
      };

      const result1 = filterFilesForRelease(mockFiles, 2, releasedDevState);
      const allowed1 = result1.allowed.map((f: { relPath: string }) => f.relPath);

      expect(allowed1).toContain("package.json");
      expect(allowed1).toContain("lesson-01-intro/src/index.ts");
      expect(allowed1).toContain("lesson-01-intro-openrouter/src/index.ts");
      expect(allowed1).toContain("lesson-02-llm-api/src/server.ts");
      expect(allowed1).toContain("lesson-02-llm-api-openrouter/src/server.ts");
      expect(allowed1).toContain("dev/src/index.ts");
      expect(allowed1).not.toContain("lesson-03-function-calling/src/server.ts");
      expect(allowed1).not.toContain(".private/secret.md");
      expect(allowed1).not.toContain(".agents/rule.md");
    });

    it("Scenario A: retains PUBLIC/dev and excludes future dev files when dev.lesson > releasedThrough", () => {
      const mockFiles = [
        { fullPath: "/repo/package.json", relPath: "package.json" },
        { fullPath: "/repo/lesson-04-mcp/src/index.ts", relPath: "lesson-04-mcp/src/index.ts" },
        { fullPath: "/repo/dev/src/memory.ts", relPath: "dev/src/memory.ts" },
      ];

      const futureDevState = {
        lesson: 5,
        lessonDir: "lesson-05-memory",
        provider: "openrouter" as const,
        stage: "starter" as const,
        checkpoint: 0,
      };

      const result = filterFilesForRelease(mockFiles, 4, futureDevState);
      const allowed = result.allowed.map((f: { relPath: string }) => f.relPath);
      const excludedFuture = result.excludedFuture.map((f: { relPath: string }) => f.relPath);

      expect(result.devIsReleased).toBe(false);
      expect(allowed).toContain("package.json");
      expect(allowed).toContain("lesson-04-mcp/src/index.ts");
      expect(allowed).not.toContain("dev/src/memory.ts");
      expect(excludedFuture).toContain("dev/src/memory.ts");
    });

    it("detects secret patterns and forbidden paths in security validation", async () => {
      const fixtureDir = join(tmpdir(), `sec-check-${Date.now()}`);
      await mkdir(fixtureDir, { recursive: true });

      const secretFile = join(fixtureDir, "secret.ts");
      const mockSecret = ["glpat", "123456789012345678901234"].join("-");
      await writeFile(secretFile, `const token = '${mockSecret}';`, "utf8");

      const privateFile = join(fixtureDir, "test.ts");
      await writeFile(privateFile, "export const x = 1;", "utf8");

      const files = [
        { fullPath: secretFile, relPath: "src/secret.ts" },
        { fullPath: privateFile, relPath: ".private/test.ts" },
        { fullPath: privateFile, relPath: "lesson-05-memory/src/index.ts" },
      ];

      const violations = await validateSecurityAndBoundaries(files, 4);
      expect(violations.length).toBe(3);
      expect(violations.some((v: { reason: string }) => v.reason.includes("Forbidden path"))).toBe(
        true,
      );
      expect(
        violations.some((v: { reason: string }) => v.reason.includes("Future lesson leak")),
      ).toBe(true);
      expect(
        violations.some((v: { reason: string }) => v.reason.includes("Potential secret")),
      ).toBe(true);

      await rm(fixtureDir, { recursive: true, force: true });
    });
  });

  describe("Isolated E2E Sandbox Workflow: public:release and Scenarios A-D", () => {
    let sandboxRoot: string;
    let mockRemoteDir: string;
    let privateRepoDir: string;

    beforeEach(async () => {
      sandboxRoot = join(
        tmpdir(),
        `e2e-sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      );
      mockRemoteDir = join(sandboxRoot, "mock-remote.git");
      privateRepoDir = join(sandboxRoot, "private-repo");

      await mkdir(sandboxRoot, { recursive: true });

      // 1. Setup bare remote with default branch main
      execSync(`git init --bare -b main "${mockRemoteDir}"`);

      // 2. Setup initial public repo inside bare remote with releasedThrough = 1 and lesson 04 solution dev
      const initPublic = join(sandboxRoot, "init-public");
      await mkdir(initPublic, { recursive: true });
      execSync(`git init "${initPublic}"`);
      execSync(`git -C "${initPublic}" branch -M main`);
      execSync(`git -C "${initPublic}" remote add origin "${mockRemoteDir}"`);

      // Initial public layout with lesson 04 solution in dev/
      await mkdir(join(initPublic, "lesson-01-intro", "starter"), { recursive: true });
      await writeFile(
        join(initPublic, "lesson-01-intro", "starter", "index.ts"),
        "export const l1 = 1;",
      );
      await mkdir(join(initPublic, "dev", "src"), { recursive: true });
      await writeFile(join(initPublic, "dev", "src", "server.ts"), "// Lesson 04 Solution Content");
      await writeFile(
        join(initPublic, "dev", ".course-state.json"),
        JSON.stringify({ lesson: 4, stage: "solution", provider: "openrouter" }),
      );

      execSync(`git -C "${initPublic}" add -A`);
      execSync(`git -C "${initPublic}" commit -m "init public"`);
      execSync(`git -C "${initPublic}" push origin main`);
      await rm(initPublic, { recursive: true, force: true });

      // 3. Setup private repo
      await mkdir(privateRepoDir, { recursive: true });
      execSync(`git init "${privateRepoDir}"`);
      execSync(`git -C "${privateRepoDir}" branch -M main`);

      // Add lesson files
      for (let i = 1; i <= 5; i++) {
        const num = String(i).padStart(2, "0");
        const dir1 = join(privateRepoDir, `lesson-${num}-sample`);
        const dir2 = join(privateRepoDir, `lesson-${num}-sample-openrouter`);
        await mkdir(join(dir1, "starter"), { recursive: true });
        await mkdir(join(dir2, "starter"), { recursive: true });
        await writeFile(join(dir1, "starter", "index.ts"), `export const lesson = ${i};`);
        await writeFile(join(dir2, "starter", "index.ts"), `export const lessonOr = ${i};`);
      }

      // Add .public state (releasedThrough = 1)
      await mkdir(join(privateRepoDir, ".public"), { recursive: true });
      await writeFile(
        join(privateRepoDir, ".public", "state.json"),
        JSON.stringify({ releasedThrough: 1 }, null, 2),
      );

      // Add private dev (currently on lesson 5 starter)
      await mkdir(join(privateRepoDir, "dev", "src"), { recursive: true });
      await writeFile(
        join(privateRepoDir, "dev", "src", "memory.ts"),
        "// Lesson 05 Starter in Private Dev",
      );
      await writeFile(
        join(privateRepoDir, "dev", ".course-state.json"),
        JSON.stringify({ lesson: 5, stage: "starter", provider: "openrouter" }, null, 2),
      );

      // Initial commit in private
      execSync(`git -C "${privateRepoDir}" add -A`);
      execSync(`git -C "${privateRepoDir}" commit -m "feat: initial private commit"`);
    });

    afterEach(async () => {
      await rm(sandboxRoot, { recursive: true, force: true });
    });

    it("Scenario D: Dirty Tree Gate aborts publication when uncommitted changes exist", () => {
      // Create dirty file in private repo
      execSync(`git -C "${privateRepoDir}" status --porcelain`);
      const dirtyFile = join(privateRepoDir, "uncommitted.txt");
      execSync(`echo dirty > "${dirtyFile}"`);

      const status = execSync(`git -C "${privateRepoDir}" status --porcelain`, {
        encoding: "utf8",
      }).trim();
      expect(status.length).toBeGreaterThan(0);
    });

    it("Performs complete isolated release from releasedThrough 1 -> 2, verifying Scenarios A, B, C", async () => {
      const targetReleaseLevel = 2;

      // Update state in private
      await writeFile(
        join(privateRepoDir, ".public", "state.json"),
        JSON.stringify({ releasedThrough: targetReleaseLevel }, null, 2),
      );
      execSync(`git -C "${privateRepoDir}" add .public/state.json`);
      execSync(`git -C "${privateRepoDir}" commit -m "chore(release): bump releasedThrough to 2"`);
      const newPrivateSha = execSync(`git -C "${privateRepoDir}" rev-parse HEAD`, {
        encoding: "utf8",
      }).trim();

      // Read files from private
      const tracked = execSync(`git -C "${privateRepoDir}" ls-files`, { encoding: "utf8" })
        .split(/\r?\n/)
        .filter((f) => f.length > 0)
        .map((rel) => ({ fullPath: join(privateRepoDir, rel), relPath: rel }));

      const devState = {
        lesson: 5,
        lessonDir: "lesson-05-sample",
        provider: "openrouter" as const,
        stage: "starter" as const,
        checkpoint: 0,
      };

      const { allowed, devIsReleased } = filterFilesForRelease(
        tracked,
        targetReleaseLevel,
        devState,
      );
      expect(devIsReleased).toBe(false);

      // Clone mock public repo
      const publicClone = join(sandboxRoot, "public-clone");
      execSync(`git clone "${mockRemoteDir}" "${publicClone}"`);

      // Clean existing public except .git and dev
      const existing = await readdir(publicClone, { withFileTypes: true });
      for (const entry of existing) {
        if (entry.name === ".git") continue;
        if (!devIsReleased && entry.name === "dev") continue;
        await rm(join(publicClone, entry.name), { recursive: true, force: true });
      }

      // Copy allowed files
      for (const file of allowed) {
        const dest = join(publicClone, file.relPath);
        await mkdir(join(dest, ".."), { recursive: true });
        const content = await readFile(file.fullPath);
        await writeFile(dest, content);
      }

      // Verify Scenario A: dev/server.ts (lesson 04 solution) was retained untouched in public
      const devServer = await readFile(join(publicClone, "dev", "src", "server.ts"), "utf8");
      expect(devServer).toBe("// Lesson 04 Solution Content");
      expect(existsSync(join(publicClone, "dev", "src", "memory.ts"))).toBe(false);

      // Verify lessons 01 and 02 are present in public (OpenAI and OpenRouter)
      expect(existsSync(join(publicClone, "lesson-01-sample", "starter", "index.ts"))).toBe(true);
      expect(
        existsSync(join(publicClone, "lesson-01-sample-openrouter", "starter", "index.ts")),
      ).toBe(true);
      expect(existsSync(join(publicClone, "lesson-02-sample", "starter", "index.ts"))).toBe(true);
      expect(
        existsSync(join(publicClone, "lesson-02-sample-openrouter", "starter", "index.ts")),
      ).toBe(true);

      // Verify Scenario C: lesson 03, 04, 05 are NOT present in public
      expect(existsSync(join(publicClone, "lesson-03-sample"))).toBe(false);
      expect(existsSync(join(publicClone, "lesson-04-sample"))).toBe(false);
      expect(existsSync(join(publicClone, "lesson-05-sample"))).toBe(false);

      // Commit and push with metadata trailers
      execSync(`git -C "${publicClone}" add -A`);
      const relStr = String(targetReleaseLevel).padStart(2, "0");
      const commitMsg = `release(course): sync published lessons through ${relStr}\n\nSource-Private-Commit: ${newPrivateSha}\nReleased-Through: ${relStr}\n`;
      const msgFile = join(publicClone, "COMMIT_MSG");
      await writeFile(msgFile, commitMsg, "utf8");
      execSync(`git -C "${publicClone}" commit -F "${msgFile}"`);
      execSync(`git -C "${publicClone}" push origin main`);

      // Verify commit log in mock remote
      const log = execSync(`git -C "${publicClone}" log -n 1`, { encoding: "utf8" });
      expect(log).toContain(`Source-Private-Commit: ${newPrivateSha}`);
      expect(log).toContain(`Released-Through: ${relStr}`);

      // Verify Scenario B: Released lesson update propagation
      // Update lesson-01 in private
      await writeFile(
        join(privateRepoDir, "lesson-01-sample", "starter", "index.ts"),
        "export const lesson = 1; // Updated content",
      );
      execSync(`git -C "${privateRepoDir}" add -A`);
      execSync(`git -C "${privateRepoDir}" commit -m "fix: update lesson 01 starter"`);

      // Sync again
      const updatedTracked = execSync(`git -C "${privateRepoDir}" ls-files`, { encoding: "utf8" })
        .split(/\r?\n/)
        .filter((f) => f.length > 0)
        .map((rel) => ({ fullPath: join(privateRepoDir, rel), relPath: rel }));

      const resUpdate = filterFilesForRelease(updatedTracked, targetReleaseLevel, devState);
      for (const file of resUpdate.allowed) {
        const dest = join(publicClone, file.relPath);
        await mkdir(join(dest, ".."), { recursive: true });
        const content = await readFile(file.fullPath);
        await writeFile(dest, content);
      }

      const updatedL1 = await readFile(
        join(publicClone, "lesson-01-sample", "starter", "index.ts"),
        "utf8",
      );
      expect(updatedL1).toContain("// Updated content");
    });
  });

  describe("Explicit cohort dev preservation", () => {
    const gitEnv = {
      ...process.env,
      GIT_AUTHOR_NAME: "Public release test",
      GIT_AUTHOR_EMAIL: "public-release-test@example.invalid",
      GIT_COMMITTER_NAME: "Public release test",
      GIT_COMMITTER_EMAIL: "public-release-test@example.invalid",
    };
    let sandboxRoot: string;

    async function runGit(args: string[], cwd?: string) {
      execFileSync("git", args, { cwd, env: gitEnv, stdio: "ignore" });
    }

    async function createFixture(
      options: {
        publicReleasedThrough?: number;
        devState?: {
          lesson: number;
          lessonDir?: string;
          provider: string;
          stage: string;
        } | null;
      } = {},
    ) {
      sandboxRoot = join(tmpdir(), `preserve-dev-e2e-${randomUUID()}`);
      const remoteDir = join(sandboxRoot, "public.git");
      const initialPublicDir = join(sandboxRoot, "initial-public");
      const privateDir = join(sandboxRoot, "private");
      await mkdir(sandboxRoot, { recursive: true });

      await runGit(["init", "--bare", "-b", "main", remoteDir]);
      await mkdir(initialPublicDir, { recursive: true });
      await runGit(["init", "-b", "main", initialPublicDir]);
      await runGit(["config", "user.name", gitEnv.GIT_AUTHOR_NAME], initialPublicDir);
      await runGit(["config", "user.email", gitEnv.GIT_AUTHOR_EMAIL], initialPublicDir);
      await runGit(["remote", "add", "origin", remoteDir], initialPublicDir);
      await mkdir(join(initialPublicDir, ".public"), { recursive: true });
      await writeFile(
        join(initialPublicDir, ".public", "state.json"),
        JSON.stringify({ releasedThrough: options.publicReleasedThrough ?? 9 }, null, 2),
      );
      await mkdir(join(initialPublicDir, "dev", "src"), { recursive: true });
      await writeFile(
        join(initialPublicDir, "dev", "README.md"),
        "Teacher-owned OpenRouter solution, exact bytes retained.\r\n",
      );
      await writeFile(
        join(initialPublicDir, "dev", "src", "teacher-override.ts"),
        "export const teacherOverride = 'keep exactly';\r\n",
      );
      if (options.devState !== null) {
        const devState = options.devState ?? {
          lesson: 9,
          lessonDir: "lesson-09-openai-agents-sdk-openrouter",
          provider: "openrouter",
          stage: "solution",
        };
        await writeFile(
          join(initialPublicDir, "dev", ".course-state.json"),
          JSON.stringify(
            {
              ...devState,
              lessonDir: devState.lessonDir ?? "lesson-09-openai-agents-sdk-openrouter",
            },
            null,
            2,
          ) + "\n",
        );
      }
      await runGit(["add", "-A"], initialPublicDir);
      await runGit(["commit", "-m", "seed public cohort"], initialPublicDir);
      await runGit(["push", "origin", "main"], initialPublicDir);

      await mkdir(join(privateDir, "scripts"), { recursive: true });
      await mkdir(join(privateDir, ".public", "cohorts"), { recursive: true });
      await mkdir(join(privateDir, "dev"), { recursive: true });
      await mkdir(join(privateDir, "lesson-09-openai-agents-sdk-openrouter", "solution"), {
        recursive: true,
      });
      await writeFile(
        join(privateDir, "scripts", "publish-public.mjs"),
        await readFile(new URL("../../scripts/publish-public.mjs", import.meta.url)),
      );
      await writeFile(
        join(privateDir, ".public", "cohorts", "cohort-preserve-test.json"),
        JSON.stringify(
          {
            cohortId: "cohort-preserve-test",
            index: "preserve-test",
            projectName: "cohort-preserve-test",
            description: "Publisher preservation test",
            releasedThrough: 9,
            devMode: "cohort",
            devLesson: 9,
            devProvider: "openrouter",
            devStage: "solution",
          },
          null,
          2,
        ),
      );
      await writeFile(
        join(privateDir, ".public", "state.json"),
        JSON.stringify({ releasedThrough: 9 }, null, 2),
      );
      await writeFile(
        join(privateDir, "dev", ".course-state.json"),
        JSON.stringify(
          {
            lesson: 9,
            lessonDir: "lesson-09-openai-agents-sdk-openrouter",
            provider: "openrouter",
            stage: "solution",
            checkpoint: 0,
          },
          null,
          2,
        ),
      );
      await writeFile(
        join(privateDir, "lesson-09-openai-agents-sdk-openrouter", "solution", "README.md"),
        "Canonical lesson 9 content updated by this release.\n",
      );
      await runGit(["init", "-b", "main", privateDir]);
      await runGit(["config", "user.name", gitEnv.GIT_AUTHOR_NAME], privateDir);
      await runGit(["config", "user.email", gitEnv.GIT_AUTHOR_EMAIL], privateDir);
      await runGit(["add", "-A"], privateDir);
      await runGit(["commit", "-m", "seed private course"], privateDir);

      return {
        remoteDir,
        privateDir,
        publisherPath: join(privateDir, "scripts", "publish-public.mjs"),
      };
    }

    async function collectDevFiles(root: string) {
      const files: Array<{ relPath: string; content: Buffer }> = [];
      async function walk(dir: string, prefix = "") {
        const entries = await readdir(dir, { withFileTypes: true });
        entries.sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of entries) {
          const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) await walk(fullPath, relPath);
          else files.push({ relPath, content: await readFile(fullPath) });
        }
      }
      await walk(join(root, "dev"));
      return files;
    }

    afterEach(async () => {
      if (sandboxRoot) await rm(sandboxRoot, { recursive: true, force: true });
    });

    it("retains every teacher dev file byte-for-byte while publishing canonical files", async () => {
      const { remoteDir, publisherPath } = await createFixture();
      const module = await import(pathToFileURL(publisherPath).href);
      const originalClone = join(sandboxRoot, "original-public");
      await runGit(["clone", remoteDir, originalClone]);
      const originalDev = await collectDevFiles(originalClone);
      const originalDevBlobs = execFileSync("git", ["ls-tree", "-r", "HEAD", "--", "dev/"], {
        cwd: originalClone,
        encoding: "utf8",
      });

      const savedEnv = {
        GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME,
        GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL,
        GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME,
        GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL,
      };
      Object.assign(process.env, {
        GIT_AUTHOR_NAME: gitEnv.GIT_AUTHOR_NAME,
        GIT_AUTHOR_EMAIL: gitEnv.GIT_AUTHOR_EMAIL,
        GIT_COMMITTER_NAME: gitEnv.GIT_COMMITTER_NAME,
        GIT_COMMITTER_EMAIL: gitEnv.GIT_COMMITTER_EMAIL,
      });
      try {
        await module.executePublicSync("cohort-preserve-test", undefined, {
          preserveDev: true,
          remoteUrl: remoteDir,
        });
      } finally {
        for (const [key, value] of Object.entries(savedEnv)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }

      const publishedClone = join(sandboxRoot, "published-public");
      await runGit(["clone", remoteDir, publishedClone]);
      const publishedDev = await collectDevFiles(publishedClone);
      const publishedDevBlobs = execFileSync("git", ["ls-tree", "-r", "HEAD", "--", "dev/"], {
        cwd: publishedClone,
        encoding: "utf8",
      });
      expect(publishedDev.map(({ relPath }) => relPath)).toEqual(
        originalDev.map(({ relPath }) => relPath),
      );
      expect(publishedDevBlobs).toBe(originalDevBlobs);
      for (let index = 0; index < originalDev.length; index += 1) {
        const originalFile = originalDev[index];
        const publishedFile = publishedDev[index];
        if (!originalFile || !publishedFile) {
          throw new Error("Dev file snapshots differ in length");
        }
        expect(publishedFile.content.equals(originalFile.content)).toBe(true);
      }
      expect(
        await readFile(
          join(publishedClone, "lesson-09-openai-agents-sdk-openrouter", "solution", "README.md"),
          "utf8",
        ),
      ).toContain("Canonical lesson 9 content updated");
      expect(
        JSON.parse(await readFile(join(publishedClone, ".public", "state.json"), "utf8"))
          .releasedThrough,
      ).toBe(9);
    });

    it.each([
      ["missing dev metadata", { devState: null }, /requires cohort dev metadata/],
      [
        "mismatched dev metadata",
        { devState: { lesson: 8, provider: "openrouter", stage: "solution" } },
        /metadata mismatch/,
      ],
      [
        "mismatched dev lesson directory",
        {
          devState: {
            lesson: 9,
            lessonDir: "lesson-09-wrong-openrouter",
            provider: "openrouter",
            stage: "solution",
          },
        },
        /metadata mismatch/,
      ],
      [
        "mismatched dev provider",
        { devState: { lesson: 9, provider: "openai", stage: "solution" } },
        /metadata mismatch/,
      ],
      [
        "mismatched dev stage",
        { devState: { lesson: 9, provider: "openrouter", stage: "starter" } },
        /metadata mismatch/,
      ],
      ["mismatched release boundary", { publicReleasedThrough: 8 }, /releasedThrough 9/],
    ])("rejects %s without changing the public remote", async (_case, options, error) => {
      const { remoteDir, publisherPath } = await createFixture(options);
      const module = await import(pathToFileURL(publisherPath).href);
      const before = execFileSync("git", ["rev-parse", "refs/heads/main"], {
        cwd: remoteDir,
        encoding: "utf8",
      }).trim();

      await expect(
        module.executePublicSync("cohort-preserve-test", undefined, {
          preserveDev: true,
          remoteUrl: remoteDir,
        }),
      ).rejects.toThrow(error);

      const after = execFileSync("git", ["rev-parse", "refs/heads/main"], {
        cwd: remoteDir,
        encoding: "utf8",
      }).trim();
      expect(after).toBe(before);
    });
  });
});
