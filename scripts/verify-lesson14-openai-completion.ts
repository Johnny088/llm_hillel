import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const testRoot = "lesson-14-react-sse/starter/tests";
const testFiles = (await readdir(testRoot)).filter((name) => name.endsWith(".test.ts"));
const source = (
  await Promise.all(testFiles.map((name) => readFile(join(testRoot, name), "utf8")))
).join("\n");
const active = source.match(/\bit\s*\(/gu)?.length ?? 0;
const todo = source.match(/\bit\.todo\s*\(/gu)?.length ?? 0;
const disabled =
  source.match(/\b(?:describe|it|test)\.(?:skip|only|skipIf|runIf|todoIf)\s*\(/gu)?.length ?? 0;

if (active < 12 || todo !== 0 || disabled !== 0) {
  console.error(
    `FAIL Lesson 14 OpenAI completion: active=${active}, todo=${todo}, disabled=${disabled}`,
  );
  process.exitCode = 1;
} else {
  console.info(`PASS Lesson 14 OpenAI completion: active=${active}, todo=0, disabled=0`);
}
