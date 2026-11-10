import { readFile } from "node:fs/promises";

const paths = new Map<string, readonly string[]>([
  [
    "lesson-14-react-sse/solution/src/server.ts",
    [
      "lesson-13-databases/solution/src/agent-runtime.js",
      "createPostgresCatalogAgentRuntime",
      "lesson-13-databases/solution/src/catalog-repository.js",
      "lesson-13-databases/solution/src/database.js",
      "lesson-13-databases/solution/src/embedding.js",
      "lesson-13-databases/solution/src/env.js",
    ],
  ],
  [
    "lesson-14-react-sse/solution/src/chat-service.ts",
    ["lesson-13-databases/solution/src/catalog-agent.js", "streamText"],
  ],
  [
    "tsconfig.lesson-14.starter.build.json",
    ["lesson-14-react-sse/starter/src", "lesson-13-databases/solution/src"],
  ],
]);
const failures: string[] = [];

for (const [path, markers] of paths) {
  const source = await readFile(path, "utf8");
  for (const marker of markers) {
    if (!source.includes(marker)) failures.push(`${path}: missing ${marker}`);
  }
}

const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
  scripts: Record<string, string>;
};
if (!packageJson.scripts["check:lesson14"]?.includes("test:lesson13:solution")) {
  failures.push("check:lesson14 must run inherited Lesson 13 solution tests");
}
if (!packageJson.scripts["check:lesson14:solution"]?.includes("verify:lesson14:continuity")) {
  failures.push("solution check must run Lesson 14 continuity verification");
}

if (failures.length > 0) {
  console.error("FAIL Lesson 14 OpenAI continuity:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.info(
    "PASS Lesson 14 OpenAI continuity: Lesson 13 agent, repository, embedding and tests retained",
  );
}
