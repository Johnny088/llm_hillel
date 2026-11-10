import { readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface CompletionInspection {
  activeTests: number;
  todoTests: number;
  conditionalTests: number;
  passed: boolean;
}

const MINIMUM_COMPLETED_ACTIVE_TESTS = 13;

export function inspectLesson13Completion(source: string): CompletionInspection {
  const activeTests = source.match(/\bit\s*\(\s*(["'`])/gu)?.length ?? 0;
  const todoTests = source.match(/\bit\.todo\s*\(/gu)?.length ?? 0;
  const conditionalTests =
    source.match(/\b(?:describe|it|test)\.(?:skip|only|skipIf|runIf|todoIf)\s*\(/gu)?.length ?? 0;

  return {
    activeTests,
    todoTests,
    conditionalTests,
    passed:
      activeTests >= MINIMUM_COMPLETED_ACTIVE_TESTS && todoTests === 0 && conditionalTests === 0,
  };
}

export async function verifyLesson13Completion(
  testRoot = "lesson-13-databases/starter/tests",
): Promise<boolean> {
  const sources = await collectTestSources(resolve(testRoot));
  const result = inspectLesson13Completion(sources.join("\n"));
  if (!result.passed) {
    console.error("FAIL Lesson 13 OpenAI completion gate:");
    if (result.activeTests < MINIMUM_COMPLETED_ACTIVE_TESTS)
      console.error(
        `- потрібні щонайменше ${MINIMUM_COMPLETED_ACTIVE_TESTS} активних сценаріїв, знайдено ${result.activeTests}`,
      );
    if (result.todoTests > 0) console.error(`- залишилося todo-сценаріїв: ${result.todoTests}`);
    if (result.conditionalTests > 0)
      console.error(`- знайдено conditional test declarations: ${result.conditionalTests}`);
    return false;
  }

  console.log(
    `PASS Lesson 13 OpenAI completion: active=${result.activeTests}, todo=0, conditional=0`,
  );
  return true;
}

async function collectTestSources(path: string): Promise<string[]> {
  const targetStat = await stat(path);
  if (targetStat.isFile()) return [await readFile(path, "utf8")];

  const sources: string[] = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) sources.push(...(await collectTestSources(child)));
    else if (entry.isFile() && entry.name.endsWith(".ts"))
      sources.push(await readFile(child, "utf8"));
  }
  return sources;
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  if (!(await verifyLesson13Completion(process.argv[2] ?? undefined))) process.exitCode = 1;
}
