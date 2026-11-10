import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertRepositoryEnvironmentReady,
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
  it("keeps the Lesson 01 local env contract", async () => {
    const root = await createTemporaryRoot();

    await expect(assertRepositoryEnvironmentReady(1, root)).resolves.toBeUndefined();
  });

  it("does not remove a local key when the repository env is not ready", async () => {
    const root = await createTemporaryRoot();
    const dev = join(root, "dev");
    await mkdir(dev);
    await writeFile(join(dev, ".env"), "OPENROUTER_API_KEY=local-secret\n", "utf8");

    await expect(assertRepositoryEnvironmentReady(2, root)).rejects.toThrow("кореневий .env");
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
