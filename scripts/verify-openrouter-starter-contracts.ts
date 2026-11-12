import { once } from "node:events";
import { execFileSync } from "node:child_process";
import { lstat, readdir, readFile } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Express } from "express";
import { getCanonicalCourseTransitions, verifyCourseInheritance } from "./course-inheritance.js";
import type { DocumentAi } from "../lesson-02-llm-api-openrouter/solution/src/services/document-ai.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);

if (process.argv[2] === "--lesson04-openrouter") {
  if (process.argv.length !== 3) {
    throw new Error("Usage: verify-openrouter-starter-contracts.ts --lesson04-openrouter");
  }
  await verifyLesson04PhysicalInheritance();
  process.exit(process.exitCode ?? 0);
}

if (process.argv[2] === "--lesson05-openrouter") {
  if (process.argv.length !== 3) {
    throw new Error("Usage: verify-openrouter-starter-contracts.ts --lesson05-openrouter");
  }
  await verifyLesson05PhysicalInheritance();
  process.exit(process.exitCode ?? 0);
}

if (process.argv[2] === "--lesson06-openrouter") {
  if (process.argv.length !== 3) {
    throw new Error("Usage: verify-openrouter-starter-contracts.ts --lesson06-openrouter");
  }
  await verifyLesson06PhysicalInheritance();
  process.exit(process.exitCode ?? 0);
}

if (process.argv[2] === "--lesson07-openrouter") {
  if (process.argv.length !== 3 && process.argv.length !== 5) {
    throw new Error(
      "Usage: verify-openrouter-starter-contracts.ts --lesson07-openrouter [starter-root source-root]",
    );
  }
  await verifyLesson07PhysicalInheritance(process.argv[3], process.argv[4]);
  process.exit(process.exitCode ?? 0);
}

const { createApp: createLesson02App } =
  await import("../lesson-02-llm-api-openrouter/starter/src/app.js");

const documentAi: DocumentAi = {
  async extract() {
    throw new Error("Document AI не повинен викликатися під час перевірки starter-заглушок.");
  },
  async *streamSummary() {
    return;
  },
};

interface StarterContract {
  label: string;
  app: Express;
  path: string;
  body: Readonly<Record<string, unknown>>;
}

async function closeServer(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function verifyContract(contract: StarterContract): Promise<void> {
  const server = contract.app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${contract.path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(contract.body),
    });
    const payload = (await response.json()) as { error?: { code?: string } };

    if (response.status !== 501 || payload.error?.code !== "NOT_IMPLEMENTED") {
      throw new Error(
        `${contract.label}: очікувався HTTP 501 NOT_IMPLEMENTED, отримано ` +
          `${response.status} ${JSON.stringify(payload)}`,
      );
    }

    console.log(`PASS ${contract.label}: HTTP 501 NOT_IMPLEMENTED`);
  } finally {
    await closeServer(server);
  }
}

const contracts: StarterContract[] = [
  {
    label: "Lesson 02 extract",
    app: createLesson02App({ ai: documentAi }),
    path: "/api/documents/extract",
    body: { content: "Тестовий документ" },
  },
  {
    label: "Lesson 02 stream",
    app: createLesson02App({ ai: documentAi }),
    path: "/api/documents/summary/stream",
    body: { content: "Тестовий документ" },
  },
];

const expectedTodoCounts = new Map<string, number>([
  ["lesson-01-intro-openrouter", 20],
  ["lesson-02-llm-api-openrouter", 12],
  ["lesson-07-agent-loop-openrouter", 0],
]);

for (const [lesson, expectedCount] of expectedTodoCounts) {
  const testFiles = (await listFiles(join(repositoryRoot, lesson, "starter", "tests"))).filter(
    (file) => /\.test\.tsx?$/u.test(file),
  );
  let actualCount = 0;

  for (const testFile of testFiles) {
    const source = await readFile(testFile, "utf8");
    actualCount += source.match(/\b(?:it|test)\.todo\s*\(/gu)?.length ?? 0;
  }

  if (actualCount !== expectedCount) {
    throw new Error(`${lesson}: очікується ${expectedCount} todo, отримано ${actualCount}.`);
  }

  console.log(`PASS ${lesson}: ${actualCount} canonical todo`);
}

const lesson02Baseline = await readFile(
  join(repositoryRoot, "lesson-02-llm-api-openrouter", "starter", "tests", "scaffolding.test.ts"),
  "utf8",
);
const lesson02ActiveBaselineCount = lesson02Baseline.match(/\bit\s*\(/gu)?.length ?? 0;

if (lesson02ActiveBaselineCount !== 5) {
  throw new Error(
    `lesson-02-llm-api-openrouter/starter: очікується 5 активних baseline-тестів, отримано ${lesson02ActiveBaselineCount}.`,
  );
}

console.log("PASS lesson-02-llm-api-openrouter/starter: 5 active baseline tests");

const requiredMarkers = [
  ["lesson-02-llm-api-openrouter/starter/src/config/model-capabilities.ts", "MODEL_CAPABILITIES"],
  [
    "lesson-13-databases-openrouter/solution/src/model-contract.ts",
    "INHERITED_FROM_PREVIOUS_OPENROUTER",
  ],
  ["lesson-13-databases-openrouter/solution/src/catalog-agent.ts", 'from "./security.js"'],
] as const;

for (const [path, marker] of requiredMarkers) {
  const source = await readFile(join(repositoryRoot, path), "utf8");
  if (!source.includes(marker)) {
    throw new Error(`${path} не містить обов’язковий marker ${marker}.`);
  }
}

for (const contract of contracts) {
  await verifyContract(contract);
}

await verifyLesson04PhysicalInheritance();

for (const transition of getCanonicalCourseTransitions("openrouter")) {
  const result = await verifyCourseInheritance(
    join(repositoryRoot, transition.sourceRoot),
    join(repositoryRoot, transition.targetRoot),
  );
  console.log(
    `PASS ${transition.fromLesson} solution -> ${transition.toLesson} starter: ` +
      `${result.matchedFiles.length} exact non-Markdown files`,
  );
}

console.log("PASS OpenRouter current-delta, HTTP and exact inheritance contracts");

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(absolutePath)));
    else if (entry.isFile()) files.push(absolutePath);
  }

  return files.sort((left, right) =>
    relative(repositoryRoot, left).localeCompare(relative(repositoryRoot, right)),
  );
}

async function verifyLesson04PhysicalInheritance(): Promise<void> {
  const previousSolution = join(
    repositoryRoot,
    "lesson-03-function-calling-openrouter",
    "solution",
  );
  const currentStarter = join(repositoryRoot, "lesson-04-mcp-built-in-tools-openrouter", "starter");
  const documentExceptions = new Set(["README.md", "final-project-ideas.md"]);
  const previousFiles = await listFiles(previousSolution);
  const starterFiles = await listFiles(currentStarter);
  const previousRelative = new Set(
    previousFiles.map((file) => relative(previousSolution, file).replaceAll("\\", "/")),
  );
  const starterRelative = new Set(
    starterFiles.map((file) => relative(currentStarter, file).replaceAll("\\", "/")),
  );
  const failures: string[] = [];
  let exactMatches = 0;

  for (const relativePath of previousRelative) {
    if (documentExceptions.has(relativePath)) {
      if (!starterRelative.has(relativePath)) {
        failures.push(`missing permitted lesson-specific document ${relativePath}`);
      }
      continue;
    }
    if (!starterRelative.has(relativePath)) {
      failures.push(`starter is missing inherited file ${relativePath}`);
      continue;
    }
    const previous = await readFile(join(previousSolution, relativePath));
    const current = await readFile(join(currentStarter, relativePath));
    if (!previous.equals(current)) {
      failures.push(`starter/${relativePath} differs byte-for-byte from Lesson 03 solution`);
    } else {
      exactMatches += 1;
    }
  }

  for (const relativePath of starterRelative) {
    if (!previousRelative.has(relativePath) && !documentExceptions.has(relativePath)) {
      failures.push(`unaccounted starter file ${relativePath}`);
    }
  }

  for (const file of starterFiles) {
    const relativePath = relative(currentStarter, file).replaceAll("\\", "/");
    if (documentExceptions.has(relativePath) || !sourceExtensions.has(extname(file))) continue;
    const source = await readFile(file, "utf8");
    if (
      /\b(?:describe|it|test)\.(?:todo|skip|skipIf|runIf)\s*\(|\b(?:NOT_IMPLEMENTED|STARTER_TODO)\b/u.test(
        source,
      )
    ) {
      failures.push(`canonical starter contains an incomplete marker in ${relativePath}`);
    }
  }

  if (failures.length > 0) {
    for (const failure of failures)
      console.error(`FAIL Lesson 04 OpenRouter inheritance: ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `PASS Lesson 04 OpenRouter canonical inheritance: ${exactMatches} byte-identical inherited files; ` +
      `${documentExceptions.size} explicit document exceptions; no extra files or incomplete code markers.`,
  );
}

async function verifyLesson05PhysicalInheritance(): Promise<void> {
  const sourceRoot = join(repositoryRoot, "lesson-04-mcp-built-in-tools-openrouter", "solution");
  const starterRoot = join(repositoryRoot, "lesson-05-memory-openrouter", "starter");
  const sourcePrefix = "lesson-04-mcp-built-in-tools-openrouter/solution/";
  const documentExceptions = new Set(["README.md"]);
  const trackedSourceFiles = execFileSync(
    "git",
    ["ls-files", "--", "lesson-04-mcp-built-in-tools-openrouter/solution"],
    { cwd: repositoryRoot, encoding: "utf8" },
  )
    .split(/\r?\n/u)
    .filter((file) => file.startsWith(sourcePrefix))
    .map((file) => file.slice(sourcePrefix.length))
    .sort((left, right) => left.localeCompare(right));
  const starterEntries = await listLesson05GitTree(starterRoot);
  const starterFiles = starterEntries
    .filter((entry) => !entry.isSymbolicLink)
    .map((entry) => entry.path);
  const starterRelative = new Set(
    starterEntries.map((entry) => relative(starterRoot, entry.path).replaceAll("\\", "/")),
  );
  const failures: string[] = [];
  let exactMatches = 0;

  if (trackedSourceFiles.length !== 52) {
    failures.push(
      `expected the current 52-file Lesson 04 solution manifest, found ${trackedSourceFiles.length}.`,
    );
  }

  for (const relativePath of trackedSourceFiles) {
    if (documentExceptions.has(relativePath)) {
      const rootReadme = starterEntries.find(
        (entry) => relative(starterRoot, entry.path).replaceAll("\\", "/") === relativePath,
      );
      if (!rootReadme || rootReadme.isSymbolicLink) {
        failures.push(`missing lesson-specific root README ${relativePath}`);
      } else {
        try {
          const [source, starter] = await Promise.all([
            readFile(join(sourceRoot, relativePath)),
            readFile(join(starterRoot, relativePath)),
          ]);
          if (source.equals(starter)) {
            failures.push(
              "starter/README.md must carry Lesson 05-specific instructional metadata.",
            );
          }
        } catch {
          failures.push("the root README inheritance exception must be a readable file.");
        }
      }
      continue;
    }
    if (!starterRelative.has(relativePath)) {
      failures.push(`starter is missing tracked inherited file ${relativePath}`);
      continue;
    }
    if (
      starterEntries.some(
        (entry) =>
          entry.isSymbolicLink &&
          relative(starterRoot, entry.path).replaceAll("\\", "/") === relativePath,
      )
    ) {
      failures.push(`tracked inherited file ${relativePath} must not be a symlink`);
      continue;
    }
    const sourcePath = join(sourceRoot, relativePath);
    const starterPath = join(starterRoot, relativePath);
    try {
      const [source, starter] = await Promise.all([readFile(sourcePath), readFile(starterPath)]);
      if (!source.equals(starter)) {
        failures.push(`starter/${relativePath} differs byte-for-byte from Lesson 04 solution`);
      } else {
        exactMatches += 1;
      }
    } catch {
      failures.push(`tracked Lesson 04 source file is unavailable: ${relativePath}`);
    }
  }

  const trackedRelative = new Set(trackedSourceFiles);
  for (const entry of starterEntries.filter((candidate) => candidate.isSymbolicLink)) {
    failures.push(
      `unaccounted Lesson 05 starter symlink ${relative(starterRoot, entry.path).replaceAll("\\", "/")}`,
    );
  }
  for (const relativePath of starterRelative) {
    if (!trackedRelative.has(relativePath)) {
      failures.push(`unaccounted Lesson 05 starter file ${relativePath}`);
    }
  }

  if (exactMatches !== 51) {
    failures.push(`expected exactly 51 byte-identical inherited files, found ${exactMatches}.`);
  }

  for (const file of starterFiles) {
    const relativePath = relative(starterRoot, file).replaceAll("\\", "/");
    if (documentExceptions.has(relativePath)) continue;
    if (!sourceExtensions.has(extname(file))) continue;
    const source = await readFile(file, "utf8");
    if (
      /\b(?:describe|it|test)\.(?:todo|skip|skipIf|runIf)\s*\(|\b(?:NOT_IMPLEMENTED|STARTER_TODO)\b/u.test(
        source,
      )
    ) {
      failures.push(`canonical Lesson 05 starter contains an incomplete marker in ${relativePath}`);
    }
  }

  if (failures.length > 0) {
    for (const failure of failures)
      console.error(`FAIL Lesson 05 OpenRouter inheritance: ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `PASS Lesson 05 OpenRouter canonical inheritance: ${exactMatches} byte-identical git-tracked Lesson 04 files; ` +
      `only root README differs; no extra files or incomplete code markers.`,
  );
}

async function verifyLesson06PhysicalInheritance(): Promise<void> {
  const sourceRoot = join(repositoryRoot, "lesson-05-memory-openrouter", "solution");
  const starterRoot = join(repositoryRoot, "lesson-06-rag-openrouter", "starter");
  const sourcePrefix = "lesson-05-memory-openrouter/solution/";
  const documentExceptions = new Set(["README.md"]);
  const trackedSourceFiles = execFileSync(
    "git",
    ["ls-files", "--", "lesson-05-memory-openrouter/solution"],
    { cwd: repositoryRoot, encoding: "utf8" },
  )
    .split(/\r?\n/u)
    .filter((file) => file.startsWith(sourcePrefix))
    .map((file) => file.slice(sourcePrefix.length))
    .sort((left, right) => left.localeCompare(right));
  const starterEntries = await listLesson05GitTree(starterRoot);
  const starterRelative = new Set(
    starterEntries.map((entry) => relative(starterRoot, entry.path).replaceAll("\\", "/")),
  );
  const failures: string[] = [];
  let exactMatches = 0;

  if (trackedSourceFiles.length !== 66) {
    failures.push(
      `expected the current 66-file Lesson 05 solution manifest, found ${trackedSourceFiles.length}.`,
    );
  }

  if (!trackedSourceFiles.includes("README.md")) {
    failures.push("the Lesson 05 solution manifest must include its root README.md exception.");
  }

  for (const relativePath of trackedSourceFiles) {
    if (documentExceptions.has(relativePath)) {
      const starterReadme = starterEntries.find(
        (entry) => relative(starterRoot, entry.path).replaceAll("\\", "/") === relativePath,
      );
      if (!starterReadme || starterReadme.isSymbolicLink) {
        failures.push("missing lesson-specific root README.md");
      } else {
        try {
          const [source, starter] = await Promise.all([
            readFile(join(sourceRoot, relativePath)),
            readFile(join(starterRoot, relativePath)),
          ]);
          if (source.equals(starter)) {
            failures.push("starter/README.md must contain Lesson 06-specific instructions.");
          }
        } catch {
          failures.push("the root README.md exception must be a readable file.");
        }
      }
      continue;
    }

    if (!starterRelative.has(relativePath)) {
      failures.push(`starter is missing inherited file ${relativePath}`);
      continue;
    }
    if (
      starterEntries.some(
        (entry) =>
          entry.isSymbolicLink &&
          relative(starterRoot, entry.path).replaceAll("\\", "/") === relativePath,
      )
    ) {
      failures.push(`inherited file ${relativePath} must not be a symlink`);
      continue;
    }

    try {
      const [source, starter] = await Promise.all([
        readFile(join(sourceRoot, relativePath)),
        readFile(join(starterRoot, relativePath)),
      ]);
      if (!source.equals(starter)) {
        failures.push(`starter/${relativePath} differs byte-for-byte from Lesson 05 solution`);
      } else {
        exactMatches += 1;
      }
    } catch {
      failures.push(`tracked Lesson 05 source file is unavailable: ${relativePath}`);
    }
  }

  const trackedRelative = new Set(trackedSourceFiles);
  for (const entry of starterEntries) {
    const relativePath = relative(starterRoot, entry.path).replaceAll("\\", "/");
    if (!trackedRelative.has(relativePath)) {
      failures.push(`unaccounted Lesson 06 starter file ${relativePath}`);
    }
    if (entry.isSymbolicLink) {
      failures.push(`Lesson 06 starter files must not be symlinks: ${relativePath}`);
    }
  }

  if (starterRelative.size !== trackedSourceFiles.length) {
    failures.push(
      `expected exactly ${trackedSourceFiles.length} starter paths, found ${starterRelative.size}.`,
    );
  }
  if (exactMatches !== 65) {
    failures.push(`expected exactly 65 byte-identical inherited files, found ${exactMatches}.`);
  }

  if (failures.length > 0) {
    for (const failure of failures)
      console.error(`FAIL Lesson 06 OpenRouter inheritance: ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `PASS Lesson 06 OpenRouter physical inheritance: ${exactMatches} byte-identical Git-tracked Lesson 05 files; ` +
      `one root README.md exception; no extra starter paths.`,
  );
}

async function verifyLesson07PhysicalInheritance(
  starterRootInput?: string,
  sourceRootInput?: string,
): Promise<void> {
  const sourcePrefix = "lesson-06-rag-openrouter/solution/";
  const sourceRoot = resolve(
    repositoryRoot,
    sourceRootInput ?? "lesson-06-rag-openrouter/solution",
  );
  const starterRoot = resolve(
    repositoryRoot,
    starterRootInput ?? "lesson-07-agent-loop-openrouter/starter",
  );
  const trackedSourceFiles = execFileSync(
    "git",
    ["ls-files", "--", "lesson-06-rag-openrouter/solution"],
    { cwd: repositoryRoot, encoding: "utf8" },
  )
    .split(/\r?\n/u)
    .filter((file) => file.startsWith(sourcePrefix))
    .map((file) => file.slice(sourcePrefix.length))
    .sort((left, right) => left.localeCompare(right));
  const isFixture = starterRootInput !== undefined || sourceRootInput !== undefined;
  const starterEntries = isFixture
    ? await listPhysicalTree(starterRoot)
    : await listLesson05GitTree(starterRoot);
  const starterRelative = new Set(
    starterEntries.map((entry) => relative(starterRoot, entry.path).replaceAll("\\", "/")),
  );
  const failures: string[] = [];
  let exactMatches = 0;

  if (trackedSourceFiles.length === 0) {
    failures.push("the current Git-tracked Lesson 06 solution manifest must not be empty.");
  }
  if (!trackedSourceFiles.includes("README.md")) {
    failures.push("the Lesson 06 solution manifest must include its root README.md exception.");
  }

  for (const relativePath of trackedSourceFiles) {
    const starterEntry = starterEntries.find(
      (entry) => relative(starterRoot, entry.path).replaceAll("\\", "/") === relativePath,
    );
    if (!starterEntry) {
      failures.push(`starter is missing inherited file ${relativePath}`);
      continue;
    }
    if (starterEntry.isSymbolicLink) {
      failures.push(`inherited file ${relativePath} must not be a symlink`);
      continue;
    }

    try {
      const [source, starter] = await Promise.all([
        readFile(join(sourceRoot, relativePath)),
        readFile(join(starterRoot, relativePath)),
      ]);
      if (relativePath === "README.md") {
        if (source.equals(starter)) {
          failures.push("starter/README.md must contain Lesson 07-specific instructions.");
        }
      } else if (!source.equals(starter)) {
        failures.push(`starter/${relativePath} differs byte-for-byte from Lesson 06 solution`);
      } else {
        exactMatches += 1;
      }
    } catch {
      failures.push(`tracked Lesson 06 source file is unavailable: ${relativePath}`);
    }
  }

  const trackedRelative = new Set(trackedSourceFiles);
  for (const entry of starterEntries) {
    const relativePath = relative(starterRoot, entry.path).replaceAll("\\", "/");
    if (!trackedRelative.has(relativePath)) {
      failures.push(`unaccounted Lesson 07 starter file ${relativePath}`);
    }
    if (entry.isSymbolicLink) {
      failures.push(`Lesson 07 starter files must not be symlinks: ${relativePath}`);
    }
  }

  if (starterRelative.size !== trackedSourceFiles.length) {
    failures.push(
      `expected exactly ${trackedSourceFiles.length} starter paths, found ${starterRelative.size}.`,
    );
  }
  const expectedExactMatches = trackedSourceFiles.filter((file) => file !== "README.md").length;
  if (exactMatches !== expectedExactMatches) {
    failures.push(
      `expected exactly ${expectedExactMatches} byte-identical inherited files, found ${exactMatches}.`,
    );
  }

  if (failures.length > 0) {
    for (const failure of failures)
      console.error(`FAIL Lesson 07 OpenRouter inheritance: ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `PASS Lesson 07 OpenRouter physical inheritance: ${exactMatches} byte-identical Git-tracked Lesson 06 files; ` +
      "one root README.md exception; no extra starter paths.",
  );
}

async function listPhysicalTree(
  root: string,
): Promise<Array<{ path: string; isSymbolicLink: boolean }>> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: Array<{ path: string; isSymbolicLink: boolean }> = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await listPhysicalTree(path)));
    else if (entry.isFile() || entry.isSymbolicLink()) {
      files.push({ path, isSymbolicLink: entry.isSymbolicLink() });
    }
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function listLesson05GitTree(
  root: string,
): Promise<Array<{ path: string; isSymbolicLink: boolean }>> {
  const rootRelative = relative(repositoryRoot, root).replaceAll("\\", "/");
  const indexedAndUnignoredFiles = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", rootRelative],
    { cwd: repositoryRoot, encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean);
  const results: Array<{ path: string; isSymbolicLink: boolean }> = [];

  for (const indexedPath of indexedAndUnignoredFiles) {
    const path = join(repositoryRoot, indexedPath);
    try {
      const metadata = await lstat(path);
      results.push({ path, isSymbolicLink: metadata.isSymbolicLink() });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        continue;
      }
      throw error;
    }
  }
  return results;
}
