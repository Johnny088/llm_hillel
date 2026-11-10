import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectLesson14OpenRouterCandidate } from "./lesson14-openrouter-contract.js";
import { requireSecurityEvalSummary } from "./verify-lesson12-openrouter-completion.js";
import { createLesson14TestEnvironment } from "./verify-lesson14-openrouter-test-environment.js";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

export async function verifyLesson14OpenRouterInheritedEvals(
  candidateInput = "lesson-14-react-sse-openrouter/solution",
): Promise<string[]> {
  const failures = await inspectLesson14OpenRouterCandidate(candidateInput, "solution");
  if (failures.length > 0) return failures;

  const candidateRoot = resolve(repositoryRoot, candidateInput);
  const environment = createLesson14TestEnvironment(process.env);
  let inheritedCases = 0;
  for (const entrypoint of [
    "evals/run.ts",
    "evals/run-agent-loop.ts",
    "evals/run-report-workflow.ts",
    "evals/run-agents-sdk.ts",
    "evals/run-content-review.ts",
  ]) {
    const output = runCandidateTsx(candidateRoot, entrypoint, environment);
    const summaries = [...output.matchAll(/\bResult:\s*(\d+)\s*\/\s*(\d+)\b/gu)];
    if (summaries.length === 0) throw new Error(`${entrypoint} did not report eval results`);
    for (const [, passedText, expectedText] of summaries) {
      const passed = Number(passedText);
      const expected = Number(expectedText);
      if (passed !== expected) throw new Error(`${entrypoint} failed: ${passed}/${expected}`);
      inheritedCases += expected;
    }
  }
  if (inheritedCases !== 29)
    throw new Error(`inherited Lesson 13 evals must pass 29 cases, found ${inheritedCases}`);

  const observability = runCandidateTsx(candidateRoot, "evals/run-observability.ts", environment, [
    "--offline",
  ]);
  requireOfflineProfiles(observability);

  const security = runCandidateTsx(candidateRoot, "evals/run-security.ts", environment);
  requireSecurityEvalSummary(security);

  const catalog = runCandidateTsx(candidateRoot, "evals/catalog-run.ts", environment);
  const catalogSummary = catalog.match(/Eval успішно завершено:\s*(\d+)\s*\/\s*(\d+)/u);
  if (
    catalogSummary === null ||
    catalogSummary[1] !== catalogSummary[2] ||
    catalogSummary[1] !== "7"
  )
    throw new Error("inherited pgvector catalog eval must pass all seven cases");

  const smoke = runCandidateTsx(
    candidateRoot,
    "scripts/smoke-content-review-graph.ts",
    environment,
  );
  for (const marker of [
    "PASS health=200",
    "PASS invalid-input=400",
    "PASS start (202 approval_required) -> decision resume (200 completed/approved)",
  ])
    if (!smoke.includes(marker))
      throw new Error(`inherited local HTTP smoke did not report ${marker}`);

  console.log(
    `PASS inherited Lesson 13 eval contract: ${inheritedCases} eval cases, two offline profiles, ` +
      "12/12 baseline + 12/12 security, 7/7 pgvector catalog, local HTTP smoke.",
  );
  return [];
}

export function requireOfflineProfiles(output: string): void {
  const rows = output
    .split(/\r?\n/u)
    .filter((line) => line.trimStart().startsWith("│"))
    .map((line) =>
      line
        .split("│")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
  const requiredHeaders = ["configuration", "mode", "total", "passed", "failed", "errored"];
  const headerIndex = rows.findIndex((cells) =>
    requiredHeaders.every((header) => cells.filter((cell) => cell === header).length === 1),
  );
  if (headerIndex < 0)
    throw new Error("inherited offline observability eval must include its complete table header");
  const header = rows[headerIndex]!;
  const indexOf = (name: string) => header.indexOf(name);
  const profiles = new Map<string, string[]>();
  for (const cells of rows.slice(headerIndex + 1)) {
    const profile = cells[indexOf("configuration")];
    if (profile !== "'fast'" && profile !== "'main'") continue;
    if (profiles.has(profile))
      throw new Error("inherited offline observability eval must report each profile once");
    profiles.set(profile, cells);
  }
  const complete = (profile: string) => {
    const cells = profiles.get(profile);
    return (
      cells?.[indexOf("mode")] === "'offline-fixture'" &&
      cells[indexOf("total")] === "12" &&
      cells[indexOf("passed")] === "12" &&
      cells[indexOf("failed")] === "0" &&
      cells[indexOf("errored")] === "0"
    );
  };
  if (profiles.size !== 2 || !complete("'fast'") || !complete("'main'"))
    throw new Error(
      "inherited offline observability eval must pass 12/12 in fast and main profiles",
    );
}

function runCandidateTsx(
  candidateRoot: string,
  entrypoint: string,
  environment: NodeJS.ProcessEnv,
  args: string[] = [],
): string {
  const result = spawnSync(
    process.execPath,
    [
      resolve(repositoryRoot, "scripts/run-tsx-entrypoint.mjs"),
      resolve(candidateRoot, entrypoint),
      ...args,
    ],
    { cwd: candidateRoot, encoding: "utf8", env: environment, maxBuffer: 24 * 1024 * 1024 },
  );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.error) throw new Error(`${entrypoint} could not start: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(`${entrypoint} failed with exit code ${String(result.status)}`);
  return output;
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  const candidate = process.argv[2];
  const failures = await verifyLesson14OpenRouterInheritedEvals(candidate);
  if (failures.length > 0) {
    console.error(`FAIL inherited Lesson 13 eval contract (${candidate ?? "canonical solution"}):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  }
}
