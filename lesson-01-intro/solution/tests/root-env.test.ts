import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { loadRootEnvironment } from "../src/cli.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

async function createFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "lesson01-root-env-"));
  temporaryRoots.push(root);
  await writeFile(join(root, "package.json"), "{}", "utf8");
  await writeFile(
    join(root, ".env"),
    "OPENAI_API_KEY=root-fixture\nOPENAI_MODEL_FAST=root-model\n",
    "utf8",
  );
  await mkdir(join(root, "lesson-01-intro", "starter", "src"), { recursive: true });
  await writeFile(
    join(root, "lesson-01-intro", "starter", ".env"),
    "OPENAI_MODEL_FAST=local-model\n",
    "utf8",
  );
  return root;
}

describe("loadRootEnvironment", () => {
  it("walks from source and compiled entrypoints, ignores local env, and prefers process values", async () => {
    const root = await createFixture();
    const sourceUrl = pathToFileURL(
      join(root, "lesson-01-intro", "starter", "src", "index.ts"),
    ).href;
    const compiledUrl = pathToFileURL(
      join(root, "dist", "lesson-01-intro", "src", "index.js"),
    ).href;

    expect(loadRootEnvironment(sourceUrl, { OPENAI_MODEL_FAST: "process-model" })).toMatchObject({
      OPENAI_API_KEY: "root-fixture",
      OPENAI_MODEL_FAST: "process-model",
    });
    expect(loadRootEnvironment(compiledUrl, {})).toMatchObject({
      OPENAI_API_KEY: "root-fixture",
      OPENAI_MODEL_FAST: "root-model",
    });
  });
});
