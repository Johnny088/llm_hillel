import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const targetRoot = "lesson-13-databases";
const failures: string[] = [];
const requiredMarkers = new Map<string, readonly string[]>([
  [
    `${targetRoot}/solution/src/catalog-agent.ts`,
    [
      "lesson-12-security/solution/src/security.js",
      "defaultInputGuardrail",
      "defaultOutputGuardrail",
      "humanInTheLoopMiddleware",
      "update_product_stock",
    ],
  ],
  [
    `${targetRoot}/solution/src/contracts.ts`,
    ["lesson-12-security/solution/src/security.js", "actorIdSchema", "tenantIdSchema"],
  ],
  [
    `${targetRoot}/solution/src/catalog-repository.ts`,
    ["embedding <=> $1::vector", "ORDER BY embedding <=> $1::vector ASC"],
  ],
  [
    `${targetRoot}/solution/src/embedding.ts`,
    ["OpenAIEmbeddingProvider", "LESSON13_EMBEDDING_DIMENSIONS"],
  ],
  [
    `${targetRoot}/solution/evals/run.ts`,
    ["resetDeterministicCatalog", "catalogEvalDataset", "Eval успішно завершено"],
  ],
]);

for (const [path, markers] of requiredMarkers) {
  const source = await readFile(path, "utf8");
  for (const marker of markers)
    if (!source.includes(marker))
      failures.push(`${path}: missing continuity marker ${JSON.stringify(marker)}.`);
}

for (const path of await listTypeScriptFiles(targetRoot)) {
  const source = await readFile(path, "utf8");
  if (
    /lesson-(?:03-function-calling|11-evals-observability|12-security|13-databases)-openrouter/u.test(
      source,
    )
  )
    failures.push(`${path}: OpenRouter runtime import in OpenAI variant.`);
  if (/lesson-13-databases-openrouter/u.test(source))
    failures.push(`${path}: OpenRouter Lesson 13 runtime import.`);
  if (
    path.includes("/solution/") &&
    /\b(?:describe|it|test)\.(?:todo|skip|only|skipIf|runIf|todoIf)\s*\(/u.test(source)
  )
    failures.push(`${path}: solution contains disabled test declaration.`);
}

const dataset = await readFile(`${targetRoot}/solution/evals/dataset.ts`, "utf8");
const evalCaseCount = dataset.match(/kind:\s*"(?:category|semantic)",/gu)?.length ?? 0;
if (evalCaseCount !== 5) failures.push(`Expected 5 eval cases, found ${evalCaseCount}.`);

const migration = await readFile(`${targetRoot}/db/migrations/001_catalog.sql`, "utf8");
if (!migration.includes("text-embedding-3-small"))
  failures.push("Migration must pin the OpenAI embedding model in its CHECK constraint.");
if (!migration.includes("vector(1536)"))
  failures.push("Migration must keep the real vector(1536) column.");

if (failures.length > 0) {
  console.error("FAIL Lesson 13 OpenAI continuity:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `PASS Lesson 13 OpenAI continuity: imported OpenAI Lesson 12 security, evalCases=${evalCaseCount}`,
  );
}

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await listTypeScriptFiles(path)));
    else if (entry.isFile() && entry.name.endsWith(".ts"))
      result.push(relative(".", path).replaceAll("\\", "/"));
  }
  return result.sort();
}
