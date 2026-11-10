import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_SCENARIOS = [
  "підключає адаптер до ContentReviewService з Lesson 10",
  "додає детерміновані graders і розмежовує failed та errored",
  "валідує Structured Output моделі-судді через Zod",
  "агрегує latency, usage, cache metrics і cost",
  "порівнює fast та main конфігурації на однаковому датасеті",
] as const;

export interface CompletionInspection {
  activeTests: number;
  todoTests: number;
  conditionalTests: number;
  missingScenarios: string[];
  passed: boolean;
}

export function inspectLesson11Completion(source: string): CompletionInspection {
  const activeDeclarations = [...source.matchAll(/\bit\s*\(\s*(["'`])(?<title>.*?)\1/gu)];
  const activeTitles = new Set(
    activeDeclarations
      .map((match) => match.groups?.title)
      .filter((title): title is string => title !== undefined),
  );
  const activeTests = activeDeclarations.length;
  const todoTests = source.match(/\bit\.todo\s*\(/gu)?.length ?? 0;
  const conditionalTests =
    source.match(/\b(?:describe|it|test)\.(?:skip|only|skipIf|runIf)\s*\(/gu)?.length ?? 0;
  const missingScenarios = REQUIRED_SCENARIOS.filter((scenario) => !activeTitles.has(scenario));
  return {
    activeTests,
    todoTests,
    conditionalTests,
    missingScenarios,
    passed:
      activeTests >= 6 &&
      todoTests === 0 &&
      conditionalTests === 0 &&
      missingScenarios.length === 0,
  };
}

export async function verifyLesson11Completion(
  starterTestPath = "lesson-11-evals-observability/starter/tests/eval-contract.test.ts",
): Promise<boolean> {
  const result = inspectLesson11Completion(await readFile(starterTestPath, "utf8"));
  if (!result.passed) {
    console.error("FAIL Lesson 11 OpenAI completion gate:");
    if (result.activeTests < 6) {
      console.error(`- потрібні 6 активних сценаріїв, знайдено ${result.activeTests}`);
    }
    if (result.todoTests > 0) console.error(`- залишилося todo-сценаріїв: ${result.todoTests}`);
    if (result.conditionalTests > 0) {
      console.error(`- знайдено conditional test declarations: ${result.conditionalTests}`);
    }
    for (const scenario of result.missingScenarios) {
      console.error(`- відсутній активний сценарій: ${scenario}`);
    }
    return false;
  }
  console.log(
    `PASS Lesson 11 OpenAI completion: active=${result.activeTests}, todo=0, conditional=0`,
  );
  return true;
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  const passed = await verifyLesson11Completion();
  if (!passed) process.exitCode = 1;
}
