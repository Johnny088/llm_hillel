import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface CompletionInspection {
  activeTests: number;
  todoTests: number;
  conditionalTests: number;
  passed: boolean;
}

export function inspectLesson12Completion(source: string): CompletionInspection {
  const activeTests = source.match(/\bit\s*\(\s*(["'`])/gu)?.length ?? 0;
  const todoTests = source.match(/\bit\.todo\s*\(/gu)?.length ?? 0;
  const conditionalTests =
    source.match(/\b(?:describe|it|test)\.(?:skip|only|skipIf|runIf)\s*\(/gu)?.length ?? 0;

  return {
    activeTests,
    todoTests,
    conditionalTests,
    passed: activeTests >= 8 && todoTests === 0 && conditionalTests === 0,
  };
}

export async function verifyLesson12Completion(
  starterTestPath = "lesson-12-security/starter/tests",
): Promise<boolean> {
  const sources = await collectTestSources(starterTestPath);
  const result = inspectLesson12Completion(sources.join("\n"));
  if (!result.passed) {
    console.error("FAIL Lesson 12 OpenAI completion gate:");
    if (result.activeTests < 8) {
      console.error(`- потрібні щонайменше 8 активних сценаріїв, знайдено ${result.activeTests}`);
    }
    if (result.todoTests > 0) console.error(`- залишилося todo-сценаріїв: ${result.todoTests}`);
    if (result.conditionalTests > 0) {
      console.error(`- знайдено conditional test declarations: ${result.conditionalTests}`);
    }
    return false;
  }

  console.log(
    `PASS Lesson 12 OpenAI completion: active=${result.activeTests}, todo=0, conditional=0`,
  );
  return true;
}

async function collectTestSources(path: string): Promise<string[]> {
  const { readdir, stat } = await import("node:fs/promises");
  const target = resolve(path);
  const targetStat = await stat(target);
  if (targetStat.isFile()) return [await readFile(target, "utf8")];

  const sources: string[] = [];
  for (const entry of await readdir(target, { withFileTypes: true })) {
    const child = resolve(target, entry.name);
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
  const passed = await verifyLesson12Completion();
  if (!passed) process.exitCode = 1;
}
