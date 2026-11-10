import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const lessonRoot = join(repositoryRoot, "lesson-07-agent-loop-openrouter");
const solutionRoot = join(lessonRoot, "solution");
const requiredMarkers = new Map<string, readonly string[]>([
  ["src/app.ts", ['"/api/agent/loop"', "AgentLoopService"]],
  ["src/runtime.ts", ["createLesson07OpenRouterRuntime", "agentLoop"]],
  ["src/server.ts", ["startLesson07Server", "createLesson07OpenRouterRuntime"]],
  [
    "src/services/agent-loop.ts",
    ["AgentLoopService", "OpenRouterResponsesAgentModel", "MAX_AGENT_STEPS"],
  ],
  ["src/config/agent-model.ts", ["DEFAULT_OPENROUTER_MODEL"]],
  ["evals/cases.ts", ["agentLoopEvalCases", "successful-rag-tool-call"]],
  ["evals/evaluate-agent-loop.ts", ["evaluateAgentLoopCases"]],
  ["evals/run-agent-loop.ts", ["evaluateAgentLoopCases", "Result:"]],
]);
const failures: string[] = [];

for (const [relativePath, markers] of requiredMarkers) {
  const path = join(solutionRoot, relativePath);
  try {
    const source = await readFile(path, "utf8");
    for (const marker of markers) {
      if (!source.includes(marker)) {
        failures.push(`${relative(repositoryRoot, path)}: missing ${JSON.stringify(marker)}.`);
      }
    }
  } catch {
    failures.push(`${relative(repositoryRoot, path)}: required local Lesson 07 file is missing.`);
  }
}

const sourceFiles = await listTypeScriptFiles(lessonRoot);
for (const path of sourceFiles) {
  const source = await readFile(path, "utf8");
  if (
    /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["'][^"']*lesson-\d{2}[^"']*\/(?:starter|solution)\//iu.test(
      source,
    )
  ) {
    failures.push(`${relative(repositoryRoot, path)} imports another canonical lesson.`);
  }
  if (/lesson-08-multi-agent-workflow/u.test(source)) {
    failures.push(`${relative(repositoryRoot, path)} references a future Lesson 08 dependency.`);
  }
}

if (failures.length > 0) {
  console.error("FAIL Lesson 07 OpenRouter continuity:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `PASS Lesson 07 OpenRouter continuity: local inherited foundation, local OpenRouter agent loop, ` +
      `and recorded eval runner; checked ${sourceFiles.length} TypeScript files.`,
  );
}

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...(await listTypeScriptFiles(path)));
    else if (entry.isFile() && /\.tsx?$/u.test(entry.name)) files.push(path);
  }

  return files.sort((left, right) =>
    relative(repositoryRoot, left).localeCompare(relative(repositoryRoot, right)),
  );
}
