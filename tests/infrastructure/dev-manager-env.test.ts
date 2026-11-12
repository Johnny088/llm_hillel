import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applySafeSync,
  assertRepositoryEnvironmentReady,
  compareDirectories,
  ensureRepositoryEnvironmentFile,
  preserveLesson01LocalEnvironment,
  removeDevLocalEnvironmentFiles,
} from "../../scripts/dev-manager.js";

const temporaryRoots: string[] = [];

async function createTemporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dev-manager-env-"));
  temporaryRoots.push(root);
  return root;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("dev-manager environment boundary", () => {
  it("creates the root env from the example once and preserves existing user values", async () => {
    const root = await createTemporaryRoot();
    const example = "OPENROUTER_API_KEY=replace-me\nOPENROUTER_MODEL=sample\n";
    await writeFile(join(root, ".env.example"), example, "utf8");

    await expect(assertRepositoryEnvironmentReady(1, root)).resolves.toBeUndefined();
    await expect(ensureRepositoryEnvironmentFile(root)).resolves.toBe(false);
    await expect(readFile(join(root, ".env"), "utf8")).resolves.toBe(example);
    const userValues = "OPENROUTER_API_KEY=existing-user-value\n";
    await writeFile(join(root, ".env"), userValues, "utf8");
    await expect(assertRepositoryEnvironmentReady(1, root)).resolves.toBeUndefined();
    await expect(readFile(join(root, ".env"), "utf8")).resolves.toBe(userValues);
  });

  it("preserves the old dev/.env during Lesson 01 sync", async () => {
    const root = await createTemporaryRoot();
    const dev = join(root, "dev");
    const starter = join(root, "starter");
    const localEnvironment = "OPENROUTER_API_KEY=local-fixture\n";
    await mkdir(dev);
    await mkdir(starter);
    await writeFile(join(dev, ".env"), localEnvironment, "utf8");
    await writeFile(join(dev, "README.md"), "old starter\n", "utf8");
    await writeFile(join(starter, "README.md"), "new starter\n", "utf8");

    const diff = await compareDirectories(dev, starter);
    await applySafeSync(starter, preserveLesson01LocalEnvironment(diff), dev, false);

    await expect(readFile(join(dev, ".env"), "utf8")).resolves.toBe(localEnvironment);
    await expect(readFile(join(dev, "README.md"), "utf8")).resolves.toBe("new starter\n");
  });

  it("does not remove a local key when the repository env is not ready", async () => {
    const root = await createTemporaryRoot();
    const dev = join(root, "dev");
    await mkdir(dev);
    await writeFile(join(root, ".env.example"), "OPENROUTER_API_KEY=\n", "utf8");
    await writeFile(join(dev, ".env"), "OPENROUTER_API_KEY=local-secret\n", "utf8");

    await expect(assertRepositoryEnvironmentReady(2, root)).rejects.toThrow("OPENROUTER_API_KEY");
    await expect(pathExists(join(dev, ".env"))).resolves.toBe(true);
  });

  it("removes only local env files after the root key is ready", async () => {
    const root = await createTemporaryRoot();
    const dev = join(root, "dev");
    await mkdir(dev);
    await writeFile(join(root, ".env"), "OPENROUTER_API_KEY=root-secret\n", "utf8");
    await writeFile(join(dev, ".env"), "OPENROUTER_API_KEY=local-secret\n", "utf8");
    await writeFile(join(dev, ".env.example"), "OPENROUTER_API_KEY=\n", "utf8");
    await writeFile(join(dev, "README.md"), "keep\n", "utf8");

    await expect(assertRepositoryEnvironmentReady(2, root)).resolves.toBeUndefined();
    await expect(removeDevLocalEnvironmentFiles(dev)).resolves.toEqual([".env", ".env.example"]);
    await expect(pathExists(join(dev, ".env"))).resolves.toBe(false);
    await expect(pathExists(join(dev, ".env.example"))).resolves.toBe(false);
    await expect(pathExists(join(dev, "README.md"))).resolves.toBe(true);
  });
});
