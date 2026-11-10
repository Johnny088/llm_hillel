import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getCanonicalCourseTransitions, verifyCourseInheritance } from "./course-inheritance.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const targetLesson = "lesson-14-react-sse";
const failures: string[] = [];
const transition = getCanonicalCourseTransitions("openai").find(
  (candidate) => candidate.toLesson === targetLesson,
);

if (transition === undefined) {
  throw new Error(`No OpenAI inheritance transition targets ${targetLesson}.`);
}

const inherited = await verifyCourseInheritance(
  join(repositoryRoot, transition.sourceRoot),
  join(repositoryRoot, transition.targetRoot),
);
const solutionTestFiles = await listFiles(join(repositoryRoot, targetLesson, "solution", "tests"));
for (const path of solutionTestFiles.filter((file) => /\.test\.tsx?$/u.test(file))) {
  const source = await readFile(path, "utf8");
  if (/\b(?:describe|it|test)\.(?:todo|skip|only|skipIf|runIf|todoIf)\s*\(/u.test(source)) {
    failures.push(`${path}: solution contains a todo, skipped, focused, or conditional test.`);
  }
}

if (failures.length > 0) {
  console.error("FAIL Lesson 14 OpenAI scaffolding:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.info(
    `PASS Lesson 14 OpenAI scaffolding: inherited=${inherited.matchedFiles.length} exact files, solution tests clean`,
  );
}

async function listFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort();
}
