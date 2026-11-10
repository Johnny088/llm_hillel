import { once } from "node:events";
import { readdir, readFile } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Express } from "express";
import { getCanonicalCourseTransitions, verifyCourseInheritance } from "./course-inheritance.js";
import { createApp as createLesson02App } from "../lesson-02-llm-api/starter/src/app.js";
import type { DocumentAi } from "../lesson-02-llm-api/solution/src/services/document-ai.js";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

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

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}

async function verifyCanonicalScaffolding(): Promise<void> {
  const expectedStarterTodos = new Map<string, number>([
    ["lesson-01-intro", 14],
    ["lesson-02-llm-api", 12],
  ]);
  const actualTodoCounts: number[] = [];

  for (const [lesson, expectedTodoCount] of expectedStarterTodos) {
    const testFiles = (await listFiles(join(repositoryRoot, lesson, "starter", "tests"))).filter(
      (file) => /\.test\.tsx?$/u.test(file),
    );
    let actualTodoCount = 0;

    for (const testFile of testFiles) {
      const source = await readFile(testFile, "utf8");
      actualTodoCount += source.match(/\b(?:it|test)\.todo\s*\(/gu)?.length ?? 0;
    }

    if (actualTodoCount !== expectedTodoCount) {
      throw new Error(
        `${lesson}/starter: очікується ${expectedTodoCount} todo-тестів, отримано ${actualTodoCount}.`,
      );
    }

    actualTodoCounts.push(actualTodoCount);
  }

  const lesson02Baseline = await readFile(
    join(repositoryRoot, "lesson-02-llm-api", "starter", "tests", "scaffolding.test.ts"),
    "utf8",
  );
  const lesson02ActiveBaselineCount = lesson02Baseline.match(/\bit\s*\(/gu)?.length ?? 0;

  if (lesson02ActiveBaselineCount !== 5) {
    throw new Error(
      `lesson-02-llm-api/starter: очікується 5 активних baseline-тестів, отримано ${lesson02ActiveBaselineCount}.`,
    );
  }

  const requiredMarkers = [
    ["lesson-01-intro/starter/src/cli.ts", "TODO"],
    ["lesson-02-llm-api/starter/src/services/openai-document-ai.ts", "NOT_IMPLEMENTED"],
    ["lesson-02-llm-api/starter/src/app.ts", "NOT_IMPLEMENTED"],
  ] as const;

  for (const [relativePath, marker] of requiredMarkers) {
    const source = await readFile(join(repositoryRoot, relativePath), "utf8");

    if (!source.includes(marker)) {
      throw new Error(`${relativePath} не містить обов'язковий marker ${marker}.`);
    }
  }

  console.log(`PASS OpenAI canonical delta todo counts: ${actualTodoCounts.join("/")}`);
  console.log("PASS lesson-02-llm-api/starter: 5 active baseline tests");
  console.log("PASS OpenAI lesson-01 and lesson-02 starter markers");

  const transitions = getCanonicalCourseTransitions("openai");
  for (const transition of transitions) {
    const result = await verifyCourseInheritance(
      join(repositoryRoot, transition.sourceRoot),
      join(repositoryRoot, transition.targetRoot),
    );
    console.log(
      `PASS ${transition.fromLesson} solution -> ${transition.toLesson} starter: ` +
        `${result.matchedFiles.length} exact non-Markdown files`,
    );
  }
}

async function closeServer(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
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

await verifyCanonicalScaffolding();

for (const contract of contracts) {
  await verifyContract(contract);
}

console.log("PASS OpenAI starter HTTP contracts");
