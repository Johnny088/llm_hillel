import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  findExampleModelFallbackViolations,
  findModelFallbackViolations,
} from "../../scripts/verify-no-model-fallback.js";

const temporaryRoots: string[] = [];
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryBase = join(
  repositoryRoot,
  ".tmp",
  "lesson01-07-no-fallback-20261006",
  "early",
  "test-fixtures",
);

async function createLearningTree(): Promise<string> {
  await mkdir(temporaryBase, { recursive: true });
  const root = await mkdtemp(join(temporaryBase, "tree-"));
  temporaryRoots.push(root);
  await mkdir(join(root, "solution", "src"), { recursive: true });
  await mkdir(join(root, "solution", "evals"), { recursive: true });
  return root;
}

afterEach(async () => {
  const baseRealPath = await realpath(temporaryBase);
  const roots = temporaryRoots.splice(0);
  for (const root of roots) {
    const rootRealPath = await realpath(root);
    const rootRelative = relative(baseRealPath, rootRealPath);
    if (
      rootRelative === "" ||
      rootRelative === ".." ||
      rootRelative.startsWith(`..${sep}`) ||
      isAbsolute(rootRelative)
    ) {
      throw new Error("Fallback policy test fixture escaped its task-scoped temporary directory.");
    }
    await rm(rootRealPath, { recursive: true, force: true });
  }
});

describe("findModelFallbackViolations", () => {
  it("rejects fallback keys in the shared example without reading a real environment file", async () => {
    const root = await createLearningTree();
    await writeFile(join(root, ".env"), "OPENROUTER_FALLBACK_MODEL=private");
    expect(findExampleModelFallbackViolations(root)).toEqual([]);

    await writeFile(
      join(root, ".env.example"),
      "OPENROUTER_MODEL=chosen\nOPENROUTER_FALLBACK_MODEL=backup\n# FALLBACK_MODEL=comment\n",
    );
    expect(findExampleModelFallbackViolations(root)).toEqual([
      { file: ".env.example", line: 2, rule: "fallback-model-config" },
    ]);

    await writeFile(join(root, ".env.example"), "OPENROUTER_MODEL=chosen\n");
    expect(findExampleModelFallbackViolations(root)).toEqual([]);
  });

  it("allows model roles, catalog entries, and ordinary defaulting", async () => {
    const root = await createLearningTree();
    await writeFile(
      join(root, "solution", "src", "models.ts"),
      [
        'export type ModelTask = "fast" | "main";',
        "const defaultModel = environment.OPENROUTER_MODEL ?? DEFAULT_MODEL;",
        'export const MODEL_CATALOG = { models: ["deepseek/model", "openrouter/free"] };',
        'export const resolveModel = (task: ModelTask) => task === "fast" ? fastModel ?? defaultModel : mainModel ?? defaultModel;',
      ].join("\n"),
    );

    expect(findModelFallbackViolations(root)).toEqual([]);
  });

  it("finds fallback configuration, typed request lists, and SDK request lists", async () => {
    const root = await createLearningTree();
    await writeFile(
      join(root, "solution", "src", "client.ts"),
      [
        'export const OPENROUTER_FALLBACK_MODEL = "openrouter/free";',
        "interface ChatCompletionRequest { model: string; models?: string[] }",
        'client.chat.completions.create({ model: "main", models: ["backup"] });',
        "const request = { model: chosen, ...(ready ? { models: alternates } : {}) };",
        "sdk.responses.create(request);",
      ].join("\n"),
    );
    await writeFile(
      join(root, "solution", "evals", "run.ts"),
      'const options = { fallbackModel: "backup" };',
    );

    const findings = findModelFallbackViolations(root);
    expect(findings.map(({ rule }) => rule)).toEqual([
      "fallback-model-config",
      "fallback-model-config",
      "request-model-list",
      "request-model-list",
      "request-model-list",
    ]);
    expect(findings.map(({ file }) => file)).toEqual([
      "solution/evals/run.ts",
      "solution/src/client.ts",
      "solution/src/client.ts",
      "solution/src/client.ts",
      "solution/src/client.ts",
    ]);
  });

  it("does not inspect hidden files or files outside source and eval trees", async () => {
    const root = await createLearningTree();
    await writeFile(
      join(root, "solution", "src", ".private.ts"),
      'const fallbackModel = "secret";',
    );
    await writeFile(join(root, "solution", "README.md"), 'const fallbackModel = "example";');
    await writeFile(join(root, ".env"), "OPENROUTER_FALLBACK_MODEL=private");

    expect(findModelFallbackViolations(root)).toEqual([]);
  });
});
