import { readdir, readFile, stat } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const testFileExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const todoPattern = /\b(?:describe|it|test)\.todo\s*\(/g;

export interface TodoTestLocation {
  file: string;
  line: number;
}

async function collectTestFiles(target: string): Promise<string[]> {
  const targetPath = resolve(target);
  const targetStat = await stat(targetPath);

  if (targetStat.isFile()) {
    return testFileExtensions.has(extname(targetPath)) ? [targetPath] : [];
  }

  if (!targetStat.isDirectory()) return [];

  const entries = await readdir(targetPath, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map((entry) => collectTestFiles(resolve(targetPath, entry.name))),
  );

  return nestedFiles.flat();
}

export async function findTodoTests(targets: string[]): Promise<TodoTestLocation[]> {
  const files = (await Promise.all(targets.map(collectTestFiles))).flat().sort();
  const locations: TodoTestLocation[] = [];

  for (const file of files) {
    const lines = (await readFile(file, "utf8")).split(/\r?\n/);

    for (const [index, line] of lines.entries()) {
      for (const _match of line.matchAll(todoPattern)) {
        locations.push({ file, line: index + 1 });
      }
    }
  }

  return locations;
}

async function main(): Promise<void> {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    throw new Error("Expected at least one test file or directory.");
  }

  const locations = await findTodoTests(targets);
  if (locations.length === 0) {
    console.log("Lesson verification gate: active tests only; no test.todo remains.");
    return;
  }

  console.error(`Lesson verification gate failed: ${locations.length} todo test(s) remain.`);
  for (const location of locations) {
    console.error(`- ${relative(process.cwd(), location.file)}:${location.line}`);
  }
  process.exitCode = 1;
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(resolve(entryPath)).href) {
  await main();
}
