import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const configuredCourseRoot = process.env.COURSE_CONTENT_ROOT?.trim();
const courseRoot = resolve(
  configuredCourseRoot === undefined || configuredCourseRoot === ""
    ? join(dirname(repositoryRoot), "AI Agents for Developers")
    : configuredCourseRoot,
);
const lessons = [
  "lesson-01-intro",
  "lesson-02-llm-api",
  "lesson-03-function-calling",
  "lesson-04-mcp-built-in-tools",
  "lesson-05-memory",
  "lesson-06-rag",
  "lesson-07-agent-loop",
  "lesson-08-multi-agent-workflow",
  "lesson-09-openai-agents-sdk",
  "lesson-10-langgraph",
  "lesson-11-evals-observability",
  "lesson-12-security",
  "lesson-13-databases",
  "lesson-14-react-sse",
  "lesson-15-final-project-workshop",
] as const;
const lectureDirectories = [
  "01. LLM Applications та Responses API",
  "02. Instructions, Structured Outputs та Streaming",
  "03. Function Calling і Tool Design",
  "04. Model Context Protocol (MCP) та вбудовані інструменти",
  "05. Conversation State та Memory",
  "06. RAG (Retrieval Augmented Generation)",
  "07. Agent Loop та ReAct Pattern",
  "08. Workflows та мультиагентні системи",
  "09. OpenAI Agents SDK для TypeScript",
  "10. LangChain 1.x і LangGraph 1.x від createAgent до StateGraph",
  "11. Testing, Evals та Observability",
  "12. Безпека AI та MCP Security",
  "13. PostgreSQL та pgvector (AI + Databases)",
  "14. React UI та Streaming (SSE)",
  "15. Final Project Workshop",
  "16. Захист проєктів та Code Review",
] as const;
const states = ["starter", "solution"] as const;
const expectedLectureRootFiles = [
  "01 Вступ.md",
  "02 План.md",
  "03 Конспект лекції.md",
  "04 Підсумки.md",
  "05 Квіз.md",
  "06 Домашнє завдання.md",
] as const;
const moduleNavigationTitle = "> [!abstract] Навігація по модулю";
const moduleNavigationLinks =
  "> 🚀 **[[01 Вступ|Вступ]]** | 📋 **[[02 План|План]]** | " +
  "📖 **[[03 Конспект лекції|Лекція]]** | 📝 **[[04 Підсумки|Підсумки]]** | " +
  "🧠 **[[05 Квіз|Квіз]]** | 📚 **[[06 Домашнє завдання|Домашнє завдання]]**";
const topicNavigationTitle = "> [!abstract] Навігація";

interface StateSummary {
  testFiles: number;
  activeTests: number;
  todoTests: number;
  evalFiles: number;
}

const failures: string[] = [];
const summaries: string[] = [];
const packageJson = JSON.parse(await readFile(join(repositoryRoot, "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
const scripts = packageJson.scripts ?? {};
const scopedLesson04OpenRouter = process.argv.includes("--lesson04-openrouter");
const scopedLesson05OpenRouter = process.argv.includes("--lesson05-openrouter");
const scopedLesson06OpenRouter = process.argv.includes("--lesson06-openrouter");
const scopedLesson07OpenRouter = process.argv.includes("--lesson07-openrouter");
const scopedLesson08OpenRouter = process.argv.includes("--lesson08-openrouter");
const scopedLesson09OpenRouter = process.argv.includes("--lesson09-openrouter");
const scopedLesson10OpenRouter = process.argv.includes("--lesson10-openrouter");
const scopedLesson11OpenRouter = process.argv.includes("--lesson11-openrouter");
const scopedLesson12OpenRouter = process.argv.includes("--lesson12-openrouter");
const scopedLesson13OpenRouter = process.argv.includes("--lesson13-openrouter");
const scopedLesson14OpenRouter = process.argv.includes("--lesson14-openrouter");
const scopedLesson15OpenRouter = process.argv.includes("--lesson15-openrouter");

if (
  [
    scopedLesson04OpenRouter,
    scopedLesson05OpenRouter,
    scopedLesson06OpenRouter,
    scopedLesson07OpenRouter,
    scopedLesson08OpenRouter,
    scopedLesson09OpenRouter,
    scopedLesson10OpenRouter,
    scopedLesson11OpenRouter,
    scopedLesson12OpenRouter,
    scopedLesson13OpenRouter,
    scopedLesson14OpenRouter,
    scopedLesson15OpenRouter,
  ].filter(Boolean).length > 1
) {
  throw new Error("Choose one scoped OpenRouter lesson audit at a time.");
}

if (scopedLesson04OpenRouter) {
  await inspectLesson04OpenRouterScopedContract();
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  for (const summary of summaries) console.log(summary);
  console.log("PASS scoped Lesson 04 OpenRouter contract");
  process.exit(0);
}

if (scopedLesson05OpenRouter) {
  await inspectLesson05OpenRouterScopedContract();
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  for (const summary of summaries) console.log(summary);
  console.log("PASS scoped Lesson 05 OpenRouter contract");
  process.exit(0);
}

if (scopedLesson06OpenRouter) {
  await inspectLesson06OpenRouterVariant();
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  for (const summary of summaries) console.log(summary);
  console.log("PASS scoped Lesson 06 OpenRouter contract");
  process.exit(0);
}

if (scopedLesson07OpenRouter) {
  await inspectLesson07OpenRouterVariant();
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  for (const summary of summaries) console.log(summary);
  console.log("PASS scoped Lesson 07 OpenRouter contract");
  process.exit(0);
}
if (scopedLesson08OpenRouter) {
  await inspectLesson08OpenRouterVariant();
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  for (const summary of summaries) console.log(summary);
  console.log("PASS scoped Lesson 08 OpenRouter contract");
  process.exit(0);
}
if (scopedLesson09OpenRouter) {
  await inspectLesson09OpenRouterVariant();
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  for (const summary of summaries) console.log(summary);
  console.log("PASS scoped Lesson 09 OpenRouter contract");
  process.exit(0);
}
if (scopedLesson10OpenRouter) {
  await inspectLesson10OpenRouterVariant();
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  for (const summary of summaries) console.log(summary);
  console.log("PASS scoped Lesson 10 OpenRouter contract");
  process.exit(0);
}
if (scopedLesson11OpenRouter) {
  await inspectLesson11OpenRouterVariant();
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  for (const summary of summaries) console.log(summary);
  console.log("PASS scoped Lesson 11 OpenRouter contract");
  process.exit(0);
}
if (scopedLesson12OpenRouter) {
  await inspectLesson12OpenRouterScopedContract();
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  for (const summary of summaries) console.log(summary);
  console.log("PASS scoped Lesson 12 OpenRouter contract");
  process.exit(0);
}
if (scopedLesson13OpenRouter) {
  await inspectLesson13OpenRouterScopedContract();
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  for (const summary of summaries) console.log(summary);
  console.log("PASS scoped Lesson 13 OpenRouter contract");
  process.exit(0);
}

if (scopedLesson14OpenRouter) {
  await inspectLesson14OpenRouterVariant();
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  for (const summary of summaries) console.log(summary);
  console.log("PASS scoped Lesson 14 OpenRouter contract");
  process.exit(0);
}
if (scopedLesson15OpenRouter) {
  await inspectLesson15OpenRouterVariant();
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  for (const summary of summaries) console.log(summary);
  console.log("PASS scoped Lesson 15 OpenRouter contract");
  process.exit(0);
}
const expectedLectureDirectories = new Set<string>(lectureDirectories);
const unexpectedLectureDirectories = (await readdir(courseRoot, { withFileTypes: true }))
  .filter(
    (entry) =>
      entry.isDirectory() &&
      /^\d{2}(?:\D|$)/u.test(entry.name) &&
      !expectedLectureDirectories.has(entry.name),
  )
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right, "uk"));

for (const lectureDirectory of unexpectedLectureDirectories) {
  failures.push(`корінь курсу містить неочікувану директорію лекції: ${lectureDirectory}.`);
}

for (const [index, lesson] of lessons.entries()) {
  const lessonRoot = join(repositoryRoot, lesson);
  const lessonNumber = String(index + 1).padStart(2, "0");

  await requireFile(join(lessonRoot, "homework.md"), `${lesson}/homework.md`);
  const isEvalOnlyLesson = lesson === "lesson-11-evals-observability";

  if (!isEvalOnlyLesson) {
    requireScriptPath(`dev:lesson${lessonNumber}`, `${lesson}/starter/`);
    requireScriptPath(`dev:lesson${lessonNumber}:solution`, `${lesson}/solution/`);
  }
  requireScriptPath(`test:lesson${lessonNumber}`, `${lesson}/starter/tests`);
  requireScriptPath(`test:lesson${lessonNumber}:solution`, `${lesson}/solution/tests`);

  if (lesson === "lesson-04-mcp-built-in-tools") {
    requireScriptPath("verify:lesson04", `${lesson}/starter/tests`);
    requireScriptPath("check:lesson04", "verify:lesson04");
  }

  if (lesson === "lesson-05-memory") {
    await requireFile(
      join(repositoryRoot, "tsconfig.lesson-05.starter.build.json"),
      "tsconfig.lesson-05.starter.build.json",
    );
    await requireFile(
      join(lessonRoot, "solution", "data", "user-memory.example.json"),
      `${lesson}/solution/data/user-memory.example.json`,
    );
    await requireTextAbsent(lessonRoot, "openrouter", `${lesson} official OpenAI variant`);
    await requireTextAbsent(lessonRoot, "OpenRouter", `${lesson} official OpenAI variant`);
    await requireTextAbsent(join(lessonRoot, "solution"), "lesson-06-rag", `${lesson}/solution`);
    requireScriptPath("verify:lesson05", `${lesson}/starter/tests`);
    requireScriptPath("check:lesson05", "verify:lesson05");
    requireScriptPath("build:lesson05:starter", "tsconfig.lesson-05.starter.build.json");
    requireScriptPath("build:lesson05:solution", "tsconfig.lesson-05.build.json");
    requireScriptPath("eval:lesson05:solution:live", `${lesson}/solution/evals/run-live.ts`);
    requireScriptPath(
      "smoke:lesson05:solution",
      `${lesson}/solution/scripts/smoke-conversation-api.ts`,
    );
    requireScriptPath("check:lesson05", "test:lesson04:solution");
    requireScriptPath("check:lesson05", "eval:lesson04:solution");
    requireScriptPath("check:lesson05", "smoke:lesson04:mcp:solution");
    requireScriptPath("check:lesson05", "build:lesson05:starter");
    requireScriptPath("check:lesson05:solution", "smoke:lesson05:solution");
    requireScriptPath("check:lesson05:solution", "build:lesson05:solution");
    requireScriptPath("check:lesson06:solution", "smoke:lesson05:solution");
    requireScriptPath("check:solution", "smoke:lesson05:solution");
  }

  if (lesson === "lesson-06-rag") {
    await requireFile(join(lessonRoot, "README.md"), `${lesson}/README.md`);
    await requireFile(
      join(repositoryRoot, "tsconfig.lesson-06.starter.build.json"),
      "tsconfig.lesson-06.starter.build.json",
    );
    await requireFile(
      join(repositoryRoot, "tsconfig.lesson-06.build.json"),
      "tsconfig.lesson-06.build.json",
    );
    requireScriptPath("verify:lesson06", `${lesson}/starter/src`);
    requireScriptPath("verify:lesson06", `${lesson}/starter/tests`);
    requireScriptPath("verify:lesson06", `${lesson}/starter/evals`);
    requireScriptPath("build:lesson06:starter", "tsconfig.lesson-06.starter.build.json");
    requireScriptPath("build:lesson06:solution", "tsconfig.lesson-06.build.json");
    requireScriptPath("build:lesson06", "build:lesson06:starter");
    requireScriptPath("build:lesson06", "build:lesson06:solution");
    requireScriptPath("check:lesson06", "test:lesson05:solution");
    requireScriptPath("check:lesson06", "eval:lesson05:solution");
    requireScriptPath("check:lesson06", "smoke:lesson05:solution");
    requireScriptPath("check:lesson06", "verify:lesson06");
    requireScriptPath("check:lesson06", "build:lesson06:starter");
    requireScriptPath("check:lesson06:solution", "test:lesson05:solution");
    requireScriptPath("check:lesson06:solution", "test:lesson06:solution");
    requireScriptPath("check:lesson06:solution", "smoke:lesson05:solution");
    requireScriptPath("check:lesson06:solution", "build:lesson06:solution");
  }

  if (lesson === "lesson-10-langgraph") {
    await requireFile(
      join(repositoryRoot, "tsconfig.lesson-10.build.json"),
      "tsconfig.lesson-10.build.json",
    );
    requireScriptPath("verify:lesson10", `${lesson}/starter/src`);
    requireScriptPath("verify:lesson10", `${lesson}/starter/tests`);
    requireScriptPath("verify:lesson10", `${lesson}/starter/evals`);
    requireScriptPath("eval:lesson10", `${lesson}/starter/evals/run.ts`);
    requireScriptPath("eval:lesson10:solution", `${lesson}/solution/evals/run.ts`);
    requireScriptPath(
      "verify:lesson10:scaffolding",
      "scripts/verify-lesson10-openai-scaffolding.ts",
    );
    requireScriptPath("verify:lesson10:continuity", "scripts/verify-lesson10-openai-continuity.ts");
    requireScriptPath(
      "smoke:lesson10:graph",
      `dist/${lesson}/${lesson}/solution/scripts/smoke-langgraph.js`,
    );
    requireScriptPath("build:lesson10", "tsconfig.lesson-10.build.json");
    requireScriptPath("check:lesson10", "test:lesson09:solution");
    requireScriptPath("check:lesson10", "eval:lesson09:solution");
    requireScriptPath("check:lesson10", "smoke:lesson09:sdk");
    requireScriptPath("check:lesson10", "verify:lesson10:continuity");
    requireScriptPath("check:lesson10", "verify:lesson10");
    requireScriptPath("check:lesson10", "eval:lesson10");
    requireScriptPath("check:lesson10:solution", "test:lesson09:solution");
    requireScriptPath("check:lesson10:solution", "eval:lesson09:solution");
    requireScriptPath("check:lesson10:solution", "smoke:lesson09:sdk");
    requireScriptPath("check:lesson10:solution", "verify:lesson10:scaffolding");
    requireScriptPath("check:lesson10:solution", "verify:lesson10:continuity");
    requireScriptPath("check:lesson10:solution", "test:lesson10:solution");
    requireScriptPath("check:lesson10:solution", "eval:lesson10:solution");
    requireScriptPath("check:lesson10:solution", "smoke:lesson10:graph");
    requireScriptPath("check:lesson10:solution", "build:lesson10");
    requireScriptPath("eval", "eval:lesson10");
    requireScriptPath("eval:solution", "eval:lesson10:solution");
  }

  if (lesson === "lesson-11-evals-observability") {
    await requireFile(
      join(repositoryRoot, "tsconfig.lesson-11.build.json"),
      "tsconfig.lesson-11.build.json",
    );
    requireScriptPath("verify:lesson11", `${lesson}/starter/tests`);
    requireScriptPath("verify:lesson11", "scripts/assert-starter-complete.ts");
    requireScriptPath("verify:lesson11", "scripts/verify-lesson11-openai-completion.ts");
    requireScriptPath(
      "verify:lesson11:scaffolding",
      "scripts/verify-lesson11-openai-scaffolding.ts",
    );
    requireScriptPath("verify:lesson11:continuity", "scripts/verify-lesson11-openai-continuity.ts");
    requireScriptPath("build:lesson11", "tsconfig.lesson-11.build.json");
    requireScriptPath("check:lesson11", "test:lesson10:solution");
    requireScriptPath("check:lesson11", "smoke:lesson10:graph");
    requireScriptPath("check:lesson11", "verify:lesson11:continuity");
    requireScriptPath("check:lesson11", "verify:lesson11");
    requireScriptPath("check:lesson11", "eval:lesson11");
    requireScriptPath("check:lesson11", "build:lesson11");
    requireScriptPath("check:lesson11:solution", "test:lesson10:solution");
    requireScriptPath("check:lesson11:solution", "verify:lesson11:scaffolding");
    requireScriptPath("check:lesson11:solution", "verify:lesson11:continuity");
    requireScriptPath("check:lesson11:solution", "test:lesson11:solution");
    requireScriptPath("check:lesson11:solution", "eval:lesson11:solution:offline");
    requireScriptPath("check:lesson11:solution", "smoke:lesson10:graph");
    requireScriptPath("check:lesson11:solution", "build:lesson11");
  }

  if (index > 0) {
    requireScriptPath(`eval:lesson${lessonNumber}`, `${lesson}/starter/evals`);
    requireScriptPath(`eval:lesson${lessonNumber}:solution`, `${lesson}/solution/evals`);
  }

  for (const state of states) {
    const stateRoot = join(lessonRoot, state);
    const label = `${lesson}/${state}`;

    await requireDirectory(stateRoot, label);
    await requireDirectory(join(stateRoot, "src"), `${label}/src`);
    await requireDirectory(join(stateRoot, "tests"), `${label}/tests`);
    await requireDirectory(join(stateRoot, "evals"), `${label}/evals`);
    await requireFile(join(stateRoot, "README.md"), `${label}/README.md`);

    const summary = await inspectState(stateRoot, label, true);
    summaries.push(
      `PASS ${label}: ${summary.testFiles} test files, ` +
        `${summary.activeTests} active, ${summary.todoTests} todo, ` +
        `${summary.evalFiles} eval files`,
    );
  }
}

await inspectOpenAiScaffolding();
await inspectOpenRouterVariant();
await inspectLesson02OpenRouterVariant();
await inspectLesson03OpenRouterVariant();
await inspectLesson04OpenRouterVariant();
await inspectLesson05OpenRouterVariant();
await inspectLesson06OpenRouterVariant();
await inspectLesson07OpenRouterVariant();
await inspectLesson08OpenRouterVariant();
await inspectLesson09OpenRouterVariant();
await inspectLesson10OpenRouterVariant();
await inspectLesson11OpenRouterVariant();
await inspectLesson12OpenRouterVariant();
await inspectLesson13OpenAiVariant();
await inspectLesson13OpenRouterVariant();
await inspectLesson14OpenAiVariant();
await inspectLesson14OpenRouterVariant();
await inspectLesson15OpenRouterVariant();
await inspectOpenRouterScaffolding();
await inspectLesson14And15Separation();

for (const lectureDirectory of lectureDirectories) {
  await inspectLectureModule(lectureDirectory);
}

async function inspectLesson05OpenRouterScopedContract(): Promise<void> {
  const lesson = "lesson-05-memory-openrouter";
  const lessonRoot = join(repositoryRoot, lesson);
  const starterRoot = join(lessonRoot, "starter");
  const solutionRoot = join(lessonRoot, "solution");
  const localConfigs = [
    ["tsconfig.lesson-05-openrouter.starter.build.json", "starter"],
    ["tsconfig.lesson-05-openrouter.build.json", "solution"],
  ] as const;

  await requireDirectory(lessonRoot, lesson);
  await requireFile(join(lessonRoot, "homework.md"), `${lesson}/homework.md`);
  await requireFile(join(lessonRoot, "README.md"), `${lesson}/README.md`);
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-05.my-openrouter.json"),
    "tsconfig.lesson-05.my-openrouter.json",
  );

  for (const root of [starterRoot, solutionRoot]) {
    const label = relative(repositoryRoot, root);
    await requireDirectory(root, label);
    await requireDirectory(join(root, "src"), `${label}/src`);
    await requireDirectory(join(root, "tests"), `${label}/tests`);
    await requireDirectory(join(root, "evals"), `${label}/evals`);
    await requireFile(join(root, "README.md"), `${label}/README.md`);
    await requireFile(join(root, "evals", "README.md"), `${label}/evals/README.md`);
  }

  for (const [configName, state] of localConfigs) {
    const configPath = join(repositoryRoot, configName);
    await requireFile(configPath, configName);
    try {
      const config = JSON.parse(await readFile(configPath, "utf8")) as {
        include?: string[];
      };
      const expected = `${lesson}/${state}/src/**/*.ts`;
      if (config.include?.length !== 1 || config.include[0] !== expected) {
        failures.push(`${configName} must include only the local Lesson 05 ${state} source root.`);
      }
      if (config.include?.some((path) => /lesson-0[34]-/u.test(path))) {
        failures.push(
          `${configName} must not list canonical Lesson 03 or Lesson 04 sources directly.`,
        );
      }
    } catch {
      failures.push(`${configName} is not valid JSON.`);
    }
  }

  try {
    const myConfig = JSON.parse(
      await readFile(join(repositoryRoot, "tsconfig.lesson-05.my-openrouter.json"), "utf8"),
    ) as { include?: string[] };
    if (
      myConfig.include?.length !== 1 ||
      myConfig.include[0] !== "my-dev/lesson-05-memory-openrouter/**/*.ts"
    ) {
      failures.push(
        "tsconfig.lesson-05.my-openrouter.json must include only the local my-dev Lesson 05 source.",
      );
    }
  } catch {
    failures.push("tsconfig.lesson-05.my-openrouter.json is not valid JSON.");
  }

  const requiredScriptFragments: ReadonlyArray<readonly [string, string]> = [
    ["dev:lesson05:openrouter", `${lesson}/starter/`],
    ["dev:lesson05:openrouter:solution", `${lesson}/solution/`],
    ["test:lesson05:openrouter", "--dir"],
    ["test:lesson05:openrouter", `${lesson}/starter/tests`],
    ["test:lesson05:openrouter:solution", "--dir"],
    ["test:lesson05:openrouter:solution", `${lesson}/solution/tests`],
    ["test:lesson05:openrouter:coverage", "--dir"],
    ["test:lesson05:openrouter:coverage", `${lesson}/solution/tests`],
    ["eval:lesson05:openrouter", `${lesson}/starter/evals/run.ts`],
    ["eval:lesson05:openrouter:solution", `${lesson}/solution/evals/run.ts`],
    ["eval:lesson05:openrouter:solution:live", `${lesson}/solution/evals/run-live.ts`],
    ["smoke:lesson05:openrouter:solution", `${lesson}/solution/scripts/smoke-conversation-api.ts`],
    ["verify:lesson05:openrouter", "--lesson05-openrouter"],
    ["verify:lesson05:openrouter", `${lesson}/starter`],
    ["verify:lesson05:openrouter:solution", "--lesson05-openrouter"],
    ["verify:lesson05:openrouter:solution", `${lesson}/solution`],
    ["verify:lesson05:openrouter:scaffolding", "--lesson05-openrouter"],
    ["verify:lesson05:openrouter:scaffolding", "verify-openrouter-starter-contracts.ts"],
    ["verify:my:lesson05:openrouter", "--lesson05-openrouter"],
    ["verify:my:lesson05:openrouter", "my-dev/lesson-05-memory-openrouter"],
    ["build:lesson05:openrouter:starter", "tsconfig.lesson-05-openrouter.starter.build.json"],
    ["build:lesson05:openrouter:solution", "tsconfig.lesson-05-openrouter.build.json"],
    ["build:lesson05:openrouter", "build:lesson05:openrouter:starter"],
    ["check:lesson05:openrouter", "--lesson05-openrouter"],
    ["check:lesson05:openrouter", "verify:lesson05:openrouter"],
    ["check:lesson05:openrouter:solution", "--lesson05-openrouter"],
    ["check:lesson05:openrouter:solution", "verify:lesson05:openrouter:solution"],
    ["check:lesson05:openrouter:solution", "build:lesson05:openrouter"],
    ["test", "test:lesson05:openrouter"],
    ["test:solution", "test:lesson05:openrouter:solution"],
    ["eval", "eval:lesson05:openrouter"],
    ["eval:solution", "eval:lesson05:openrouter:solution"],
    ["build", "build:lesson05:openrouter"],
    ["dev:my:lesson05:openrouter", "my-dev/lesson-05-memory-openrouter/src/server.ts"],
    ["test:my:lesson05:openrouter", "--dir"],
    ["test:my:lesson05:openrouter", "my-dev/lesson-05-memory-openrouter/tests"],
    ["eval:my:lesson05:openrouter", "my-dev/lesson-05-memory-openrouter/evals/run.ts"],
    ["eval:my:lesson05:openrouter", "--mode=all"],
    ["eval:my:lesson05:openrouter", "my-dev/lesson-05-memory-openrouter/evals/run-tool-calling.ts"],
    ["typecheck:my:lesson05:openrouter", "tsconfig.lesson-05.my-openrouter.json"],
    ["lint:my:lesson05:openrouter", "my-dev/lesson-05-memory-openrouter/**/*.ts"],
    [
      "format:check:my:lesson05:openrouter",
      "my-dev/lesson-05-memory-openrouter/**/*.{md,json,ts,tsx}",
    ],
    ["check:my:lesson05:openrouter", "typecheck:my:lesson05:openrouter"],
    ["check:my:lesson05:openrouter", "test:my:lesson05:openrouter"],
    ["check:my:lesson05:openrouter", "eval:my:lesson05:openrouter"],
    ["check:my:lesson05:openrouter", "verify:my:lesson05:openrouter"],
  ];

  for (const [scriptName, fragment] of requiredScriptFragments) {
    requireScriptPath(scriptName, fragment);
  }

  const solutionTestFiles = (await listFiles(join(solutionRoot, "tests"))).filter((file) =>
    /\.test\.tsx?$/u.test(file),
  );
  const requiredSolutionTests = [
    "tests/agent-route.test.ts",
    "tests/app.test.ts",
    "tests/config-and-metrics.test.ts",
    "tests/conversation-manager.test.ts",
    "tests/evals.test.ts",
    "tests/filesystem-client.test.ts",
    "tests/filesystem-tools.test.ts",
    "tests/json-stores.test.ts",
    "tests/mcp-web-search-agent.test.ts",
    "tests/openrouter-document-ai.test.ts",
    "tests/runtime.test.ts",
    "tests/server-lifecycle.test.ts",
    "tests/tool-calling.test.ts",
    "tests/tool-evals.test.ts",
    "tests/user-facts.test.ts",
  ];
  for (const requiredFile of requiredSolutionTests) {
    await requireFile(join(solutionRoot, requiredFile), `${lesson}/solution/${requiredFile}`);
  }
  if (solutionTestFiles.length === 0) {
    failures.push(`${lesson}/solution has no acceptance test files.`);
  }

  let activeSolutionTests = 0;
  for (const testFile of solutionTestFiles) {
    const source = await readFile(testFile, "utf8");
    const counts = countDirectTestCalls(source, testFile);
    activeSolutionTests += counts.active;
    if (
      counts.todo > 0 ||
      /\b(?:describe|it|test)\.(?:skip|skipIf|runIf|only)\s*\(/u.test(source)
    ) {
      failures.push(
        `${relative(repositoryRoot, testFile)} contains todo, skipped, or conditional tests.`,
      );
    }
  }
  if (activeSolutionTests === 0) {
    failures.push(`${lesson}/solution has no active acceptance tests.`);
  }

  for (const requiredFile of [
    "src/memory/conversation-history.ts",
    "src/memory/user-facts.ts",
    "src/schemas/conversation-request.ts",
    "src/services/conversation-manager.ts",
    "evals/memory.eval.ts",
    "evals/run.ts",
    "scripts/smoke-conversation-api.ts",
  ]) {
    await requireFile(join(solutionRoot, requiredFile), `${lesson}/solution/${requiredFile}`);
  }

  summaries.push(
    `PASS ${lesson}: isolated scoped audit, local Lesson 05 source configs, ` +
      `${activeSolutionTests} direct solution test declarations, exact starter/solution/my-dev command wiring`,
  );
}

async function inspectLesson04OpenRouterScopedContract(): Promise<void> {
  const lesson = "lesson-04-mcp-built-in-tools-openrouter";
  const lessonRoot = join(repositoryRoot, lesson);
  const starterRoot = join(lessonRoot, "starter");
  const solutionRoot = join(lessonRoot, "solution");

  for (const root of [starterRoot, solutionRoot]) {
    await requireDirectory(root, relative(repositoryRoot, root));
    await requireDirectory(join(root, "src"), `${relative(repositoryRoot, root)}/src`);
    await requireDirectory(join(root, "tests"), `${relative(repositoryRoot, root)}/tests`);
    await requireDirectory(join(root, "evals"), `${relative(repositoryRoot, root)}/evals`);
    await requireFile(join(root, "README.md"), `${relative(repositoryRoot, root)}/README.md`);
  }

  await requireFile(join(lessonRoot, "homework.md"), `${lesson}/homework.md`);
  await requireFile(join(lessonRoot, "README.md"), `${lesson}/README.md`);
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-04-openrouter.build.json"),
    "tsconfig.lesson-04-openrouter.build.json",
  );
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-04.my-openrouter.json"),
    "tsconfig.lesson-04.my-openrouter.json",
  );

  requireScriptPath("verify:lesson04:openrouter", "--lesson04-openrouter");
  requireScriptPath("verify:lesson04:openrouter", `${lesson}/starter`);
  requireScriptPath("verify:lesson04:openrouter:solution", "--lesson04-openrouter");
  requireScriptPath("verify:lesson04:openrouter:solution", `${lesson}/solution`);
  requireScriptPath("verify:lesson04:openrouter:scaffolding", "--lesson04-openrouter");
  requireScriptPath(
    "verify:lesson04:openrouter:scaffolding",
    "verify-openrouter-starter-contracts.ts",
  );
  requireScriptPath("test:lesson04:openrouter", `${lesson}/starter/tests`);
  requireScriptPath("test:lesson04:openrouter", "--dir");
  requireScriptPath("test:lesson04:openrouter:solution", `${lesson}/solution/tests`);
  requireScriptPath("test:lesson04:openrouter:solution", "--dir");
  requireScriptPath("eval:lesson04:openrouter", `${lesson}/starter/evals`);
  requireScriptPath("eval:lesson04:openrouter:solution", `${lesson}/solution/evals`);
  requireScriptPath("build:lesson04:openrouter", "tsconfig.lesson-04-openrouter.build.json");
  requireScriptPath("verify:my:lesson04:openrouter", "--lesson04-openrouter");
  requireScriptPath(
    "verify:my:lesson04:openrouter",
    "my-dev/lesson-04-mcp-built-in-tools-openrouter",
  );
  requireScriptPath("check:my:lesson04:openrouter", "verify:my:lesson04:openrouter");
  for (const requiredScript of [
    "test:lesson04:openrouter:solution",
    "eval:lesson04:openrouter:solution",
    "smoke:lesson04:mcp:openrouter:solution",
    "build:lesson04:openrouter",
    "verify:lesson04:openrouter:solution",
  ]) {
    requireScriptPath("check:lesson04:openrouter:solution", requiredScript);
  }

  const solutionTestFiles = (await listFiles(join(solutionRoot, "tests"))).filter((file) =>
    /\.test\.tsx?$/u.test(file),
  );
  if (solutionTestFiles.length === 0) {
    failures.push(`${lesson}/solution has no acceptance test files.`);
  }
  let activeSolutionTests = 0;
  for (const testFile of solutionTestFiles) {
    const source = await readFile(testFile, "utf8");
    const counts = countDirectTestCalls(source, testFile);
    activeSolutionTests += counts.active;
    if (
      counts.todo > 0 ||
      /\b(?:describe|it|test)\.(?:skip|skipIf|runIf|only)\s*\(/u.test(source)
    ) {
      failures.push(
        `${relative(repositoryRoot, testFile)} contains todo, skip, or conditional tests.`,
      );
    }
  }
  if (activeSolutionTests === 0) {
    failures.push(`${lesson}/solution has no active acceptance tests.`);
  }

  for (const root of [starterRoot, solutionRoot]) {
    const files = (await listFiles(root)).filter((file) => /\.(?:[cm]?[jt]sx?)$/u.test(file));
    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (/from\s+["'][^"']*\/solution\/|import\s*\(["'][^"']*\/solution\//u.test(source)) {
        failures.push(`${relative(repositoryRoot, file)} imports a ready solution tree.`);
      }
    }
  }

  summaries.push(
    `PASS ${lesson}: student completion route, local solution gates, ` +
      `${activeSolutionTests} direct solution test declarations, no solution-tree imports`,
  );
}

async function inspectLesson04OpenRouterVariant(): Promise<void> {
  const lesson = "lesson-04-mcp-built-in-tools-openrouter";
  const lessonRoot = join(repositoryRoot, lesson);

  await requireDirectory(lessonRoot, lesson);
  await requireFile(join(lessonRoot, "homework.md"), `${lesson}/homework.md`);
  await requireFile(join(lessonRoot, "README.md"), `${lesson}/README.md`);
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-04-openrouter.build.json"),
    "tsconfig.lesson-04-openrouter.build.json",
  );

  requireScriptPath("dev:lesson04:openrouter", `${lesson}/starter/`);
  requireScriptPath("dev:lesson04:openrouter:solution", `${lesson}/solution/`);
  requireScriptPath("verify:lesson04:openrouter", "--lesson04-openrouter");
  requireScriptPath("verify:lesson04:openrouter", `${lesson}/starter`);
  requireScriptPath("verify:lesson04:openrouter:solution", "--lesson04-openrouter");
  requireScriptPath("verify:lesson04:openrouter:solution", `${lesson}/solution`);
  requireScriptPath("verify:lesson04:openrouter:scaffolding", "--lesson04-openrouter");
  requireScriptPath(
    "verify:lesson04:openrouter:scaffolding",
    "verify-openrouter-starter-contracts.ts",
  );
  requireScriptPath("test:lesson04:openrouter", `${lesson}/starter/tests`);
  requireScriptPath("test:lesson04:openrouter", "--dir");
  requireScriptPath("test:lesson04:openrouter:solution", `${lesson}/solution/tests`);
  requireScriptPath("test:lesson04:openrouter:solution", "--dir");
  requireScriptPath("test:lesson04:openrouter:coverage", lesson);
  requireScriptPath("eval:lesson04:openrouter", `${lesson}/starter/evals`);
  requireScriptPath("eval:lesson04:openrouter:solution", `${lesson}/solution/evals`);
  requireScriptPath("eval:lesson04:openrouter:solution:live", `${lesson}/solution/evals`);
  requireScriptPath(
    "smoke:lesson04:mcp:openrouter:solution",
    `${lesson}/solution/scripts/smoke-filesystem-mcp.ts`,
  );
  requireScriptPath("build:lesson04:openrouter", "tsconfig.lesson-04-openrouter.build.json");
  requireScriptPath("check:lesson04:openrouter", "verify:lesson04:openrouter");
  requireScriptPath("check:lesson04:openrouter:solution", "test:lesson04:openrouter:solution");
  requireScriptPath("check:lesson04:openrouter:solution", "verify:lesson04:openrouter:solution");
  requireScriptPath("check:lesson04:openrouter:solution", "build:lesson04:openrouter");
  requireScriptPath("build", "build:lesson04:openrouter");
  requireScriptPath("test", "test:lesson04:openrouter");
  requireScriptPath("test:watch", `${lesson}/starter/tests`);
  requireScriptPath("test:solution", "test:lesson04:openrouter:solution");
  requireScriptPath("eval", "eval:lesson04:openrouter");
  requireScriptPath("eval:solution", "eval:lesson04:openrouter:solution");

  for (const state of states) {
    const stateRoot = join(lessonRoot, state);
    const label = `${lesson}/${state}`;

    await requireDirectory(stateRoot, label);
    await requireDirectory(join(stateRoot, "src"), `${label}/src`);
    await requireDirectory(join(stateRoot, "tests"), `${label}/tests`);
    await requireDirectory(join(stateRoot, "evals"), `${label}/evals`);
    await requireFile(join(stateRoot, "README.md"), `${label}/README.md`);
    await requireFile(join(stateRoot, "final-project-ideas.md"), `${label}/final-project-ideas.md`);

    const summary = await inspectState(stateRoot, label, true);
    summaries.push(
      `PASS ${label}: ${summary.testFiles} test files, ` +
        `${summary.activeTests} active, ${summary.todoTests} todo, ` +
        `${summary.evalFiles} eval files`,
    );
  }
}

async function inspectLesson05OpenRouterVariant(): Promise<void> {
  const lesson = "lesson-05-memory-openrouter";
  const lessonRoot = join(repositoryRoot, lesson);

  await requireDirectory(lessonRoot, lesson);
  await requireFile(join(lessonRoot, "homework.md"), `${lesson}/homework.md`);
  await requireFile(join(lessonRoot, "README.md"), `${lesson}/README.md`);
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-05-openrouter.starter.build.json"),
    "tsconfig.lesson-05-openrouter.starter.build.json",
  );
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-05-openrouter.build.json"),
    "tsconfig.lesson-05-openrouter.build.json",
  );
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-05.my-openrouter.json"),
    "tsconfig.lesson-05.my-openrouter.json",
  );

  requireScriptPath("dev:lesson05:openrouter", `${lesson}/starter/`);
  requireScriptPath("dev:lesson05:openrouter:solution", `${lesson}/solution/`);
  requireScriptPath("verify:lesson05:openrouter", "--lesson05-openrouter");
  requireScriptPath("verify:lesson05:openrouter", `${lesson}/starter`);
  requireScriptPath("verify:lesson05:openrouter:solution", "--lesson05-openrouter");
  requireScriptPath("verify:lesson05:openrouter:solution", `${lesson}/solution`);
  requireScriptPath("verify:lesson05:openrouter:scaffolding", "--lesson05-openrouter");
  requireScriptPath(
    "verify:lesson05:openrouter:scaffolding",
    "verify-openrouter-starter-contracts.ts",
  );
  requireScriptPath("test:lesson05:openrouter", "--dir");
  requireScriptPath("test:lesson05:openrouter", `${lesson}/starter/tests`);
  requireScriptPath("test:lesson05:openrouter:solution", "--dir");
  requireScriptPath("test:lesson05:openrouter:solution", `${lesson}/solution/tests`);
  requireScriptPath("test:lesson05:openrouter:coverage", "--dir");
  requireScriptPath("test:lesson05:openrouter:coverage", `${lesson}/solution/tests`);
  requireScriptPath("eval:lesson05:openrouter", `${lesson}/starter/evals`);
  requireScriptPath("eval:lesson05:openrouter", "--mode=all");
  requireScriptPath("eval:lesson05:openrouter", `${lesson}/starter/evals/run-tool-calling.ts`);
  requireScriptPath("eval:lesson05:openrouter:solution", `${lesson}/solution/evals`);
  requireScriptPath("eval:lesson05:openrouter:solution", "--mode=all");
  requireScriptPath(
    "eval:lesson05:openrouter:solution",
    `${lesson}/solution/evals/run-tool-calling.ts`,
  );
  requireScriptPath(
    "eval:lesson05:openrouter:solution:live",
    `${lesson}/solution/evals/run-live.ts`,
  );
  requireScriptPath(
    "smoke:lesson05:openrouter:solution",
    `${lesson}/solution/scripts/smoke-conversation-api.ts`,
  );
  requireScriptPath(
    "build:lesson05:openrouter:starter",
    "tsconfig.lesson-05-openrouter.starter.build.json",
  );
  requireScriptPath(
    "build:lesson05:openrouter:solution",
    "tsconfig.lesson-05-openrouter.build.json",
  );
  requireScriptPath("build:lesson05:openrouter", "build:lesson05:openrouter:starter");
  requireScriptPath("build:lesson05:openrouter", "build:lesson05:openrouter:solution");
  requireScriptPath("check:lesson05:openrouter", "--lesson05-openrouter");
  requireScriptPath("check:lesson05:openrouter", "verify:lesson05:openrouter");
  requireScriptPath("check:lesson05:openrouter", "test:lesson05:openrouter");
  requireScriptPath("check:lesson05:openrouter", "eval:lesson05:openrouter");
  requireScriptPath("check:lesson05:openrouter", "build:lesson05:openrouter:starter");
  requireScriptPath("check:lesson05:openrouter:solution", "test:lesson04:openrouter:solution");
  requireScriptPath("check:lesson05:openrouter:solution", "test:lesson05:openrouter:solution");
  requireScriptPath("check:lesson05:openrouter:solution", "verify:lesson05:openrouter:solution");
  requireScriptPath("check:lesson05:openrouter:solution", "build:lesson05:openrouter");
  requireScriptPath("build", "build:lesson05:openrouter");
  requireScriptPath("test", "test:lesson05:openrouter");
  requireScriptPath("test:solution", "test:lesson05:openrouter:solution");
  requireScriptPath("eval", "eval:lesson05:openrouter");
  requireScriptPath("eval:solution", "eval:lesson05:openrouter:solution");
  requireScriptPath("check:solution", "smoke:lesson05:openrouter:solution");
  requireScriptPath(
    "dev:my:lesson05:openrouter",
    "my-dev/lesson-05-memory-openrouter/src/server.ts",
  );
  requireScriptPath("test:my:lesson05:openrouter", "--dir");
  requireScriptPath("test:my:lesson05:openrouter", "my-dev/lesson-05-memory-openrouter/tests");
  requireScriptPath(
    "eval:my:lesson05:openrouter",
    "my-dev/lesson-05-memory-openrouter/evals/run.ts",
  );
  requireScriptPath("typecheck:my:lesson05:openrouter", "tsconfig.lesson-05.my-openrouter.json");
  requireScriptPath("check:my:lesson05:openrouter", "verify:my:lesson05:openrouter");

  for (const state of states) {
    const stateRoot = join(lessonRoot, state);
    const label = `${lesson}/${state}`;

    await requireDirectory(stateRoot, label);
    await requireDirectory(join(stateRoot, "src"), `${label}/src`);
    await requireDirectory(join(stateRoot, "tests"), `${label}/tests`);
    await requireDirectory(join(stateRoot, "evals"), `${label}/evals`);
    await requireFile(join(stateRoot, "README.md"), `${label}/README.md`);
    await requireFile(join(stateRoot, "evals", "README.md"), `${label}/evals/README.md`);
    if (state === "solution") {
      await requireFile(
        join(stateRoot, "data", "user-memory.example.json"),
        `${label}/data/user-memory.example.json`,
      );
      await requireFile(
        join(stateRoot, "data", "conversation-history.example.json"),
        `${label}/data/conversation-history.example.json`,
      );
    }
    await requireTextAbsent(join(stateRoot, "src"), "previous_response_id", `${label}/src`);
    await requireTextAbsent(join(stateRoot, "src"), "context_management", `${label}/src`);
    await requireTextAbsent(join(stateRoot, "src"), "client.responses", `${label}/src`);

    const codeFiles = (await listFiles(stateRoot)).filter((file) =>
      /\.(?:[cm]?[jt]sx?)$/u.test(file),
    );
    for (const file of codeFiles) {
      const source = await readFile(file, "utf8");
      if (/lesson-05-memory-openrouter\/(?:starter|solution)\//u.test(source)) {
        failures.push(`${relative(repositoryRoot, file)} imports another Lesson 05 state.`);
      }
    }

    const summary = await inspectState(stateRoot, label, true);
    summaries.push(
      `PASS ${label}: ${summary.testFiles} test files, ` +
        `${summary.activeTests} active, ${summary.todoTests} todo, ` +
        `${summary.evalFiles} eval files`,
    );
  }
}

async function inspectLesson06OpenRouterVariant(): Promise<void> {
  const lesson = "lesson-06-rag-openrouter";
  const lessonRoot = join(repositoryRoot, lesson);
  const starterRoot = join(lessonRoot, "starter");
  const solutionRoot = join(lessonRoot, "solution");

  await requireDirectory(lessonRoot, lesson);
  await requireFile(join(lessonRoot, "homework.md"), `${lesson}/homework.md`);
  await requireFile(join(lessonRoot, "README.md"), `${lesson}/README.md`);
  for (const root of [starterRoot, solutionRoot]) {
    await requireDirectory(root, relative(repositoryRoot, root));
    await requireDirectory(join(root, "src"), `${relative(repositoryRoot, root)}/src`);
    await requireDirectory(join(root, "tests"), `${relative(repositoryRoot, root)}/tests`);
    await requireDirectory(join(root, "evals"), `${relative(repositoryRoot, root)}/evals`);
    await requireFile(join(root, "README.md"), `${relative(repositoryRoot, root)}/README.md`);
  }
  for (const requiredFile of [
    "src/services/rag-assistant.ts",
    "src/schemas/rag-request.ts",
    "src/runtime.ts",
    "data/prepared-index.ts",
    "evals/refusal.eval.ts",
    "evals/run.ts",
    "tests/rag-assistant.test.ts",
    "tests/evals.test.ts",
  ]) {
    await requireFile(join(solutionRoot, requiredFile), `${lesson}/solution/${requiredFile}`);
  }
  for (const absentFile of [
    "src/services/rag-assistant.ts",
    "src/schemas/rag-request.ts",
    "data/prepared-index.ts",
    "evals/refusal.eval.ts",
    "tests/rag-assistant.test.ts",
  ]) {
    await requireAbsentFile(join(starterRoot, absentFile), `${lesson}/starter/${absentFile}`);
  }
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-06-openrouter.starter.build.json"),
    "tsconfig.lesson-06-openrouter.starter.build.json",
  );
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-06-openrouter.build.json"),
    "tsconfig.lesson-06-openrouter.build.json",
  );
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-06.my-openrouter.json"),
    "tsconfig.lesson-06.my-openrouter.json",
  );

  requireScriptPath("dev:lesson06:openrouter", `${lesson}/starter/`);
  requireScriptPath("dev:lesson06:openrouter:solution", `${lesson}/solution/`);
  requireScriptPath("demo:lesson06:openrouter:solution", `${lesson}/solution/src/demo.ts`);
  requireScriptPath("verify:lesson06:openrouter", "--lesson06-openrouter");
  requireScriptPath("verify:lesson06:openrouter", `${lesson}/starter`);
  requireScriptPath("verify:lesson06:openrouter:solution", "--lesson06-openrouter");
  requireScriptPath("verify:lesson06:openrouter:solution", `${lesson}/solution`);
  requireScriptPath("verify:lesson06:openrouter:scaffolding", "--lesson06-openrouter");
  requireScriptPath(
    "verify:lesson06:openrouter:scaffolding",
    "verify-openrouter-starter-contracts.ts",
  );
  requireScriptPath("test:lesson06:openrouter", `${lesson}/starter/tests`);
  requireScriptPath("test:lesson06:openrouter:solution", `${lesson}/solution/tests`);
  requireScriptPath("test:lesson06:openrouter:coverage", lesson);
  requireScriptPath("eval:lesson06:openrouter", `${lesson}/starter/evals`);
  requireScriptPath("eval:lesson06:openrouter:solution", `${lesson}/solution/evals`);
  requireScriptPath("eval:lesson06:openrouter:solution", "--mode=memory");
  requireScriptPath("eval:lesson06:openrouter:solution", "--mode=all");
  requireScriptPath(
    "eval:lesson06:openrouter:solution:live",
    `${lesson}/solution/evals/run-live.ts`,
  );
  requireScriptPath(
    "build:lesson06:openrouter:starter",
    "tsconfig.lesson-06-openrouter.starter.build.json",
  );
  requireScriptPath(
    "build:lesson06:openrouter:solution",
    "tsconfig.lesson-06-openrouter.build.json",
  );
  requireScriptPath("build:lesson06:openrouter", "build:lesson06:openrouter:starter");
  requireScriptPath("build:lesson06:openrouter", "build:lesson06:openrouter:solution");
  requireScriptPath("check:lesson06:openrouter", "verify:lesson06:openrouter:scaffolding");
  requireScriptPath("check:lesson06:openrouter", "test:lesson06:openrouter");
  requireScriptPath("check:lesson06:openrouter", "eval:lesson06:openrouter");
  requireScriptPath("check:lesson06:openrouter", "build:lesson06:openrouter:starter");
  requireScriptPath("check:lesson06:openrouter:solution", "verify:lesson06:openrouter:scaffolding");
  requireScriptPath("check:lesson06:openrouter:solution", "verify:lesson06:openrouter:solution");
  requireScriptPath("check:lesson06:openrouter:solution", "eval:lesson06:openrouter:solution");
  requireScriptPath("check:lesson06:openrouter:solution", "build:lesson06:openrouter:solution");
  requireScriptPath("build", "build:lesson06:openrouter");
  requireScriptPath("test", "test:lesson06:openrouter");
  requireScriptPath("test:watch", `${lesson}/starter/tests`);
  requireScriptPath("test:solution", "test:lesson06:openrouter:solution");
  requireScriptPath("eval", "eval:lesson06:openrouter");
  requireScriptPath("eval:solution", "eval:lesson06:openrouter:solution");
  requireScriptPath("dev:my:lesson06:openrouter", "my-dev/lesson-06-rag-openrouter/src/server.ts");
  requireScriptPath("test:my:lesson06:openrouter", "my-dev/lesson-06-rag-openrouter/tests");
  requireScriptPath("eval:my:lesson06:openrouter", "my-dev/lesson-06-rag-openrouter/evals/run.ts");
  requireScriptPath("eval:my:lesson06:openrouter", "--mode=memory");
  requireScriptPath("eval:my:lesson06:openrouter", "--mode=all");
  requireScriptPath("typecheck:my:lesson06:openrouter", "tsconfig.lesson-06.my-openrouter.json");
  requireScriptPath("lint:my:lesson06:openrouter", "my-dev/lesson-06-rag-openrouter/**/*.ts");
  requireScriptPath(
    "format:check:my:lesson06:openrouter",
    "my-dev/lesson-06-rag-openrouter/**/*.{md,json,ts,tsx}",
  );
  requireScriptPath("verify:my:lesson06:openrouter", "--lesson06-openrouter");
  requireScriptPath("verify:my:lesson06:openrouter", "my-dev/lesson-06-rag-openrouter");
  for (const requiredScript of [
    "typecheck:my:lesson06:openrouter",
    "lint:my:lesson06:openrouter",
    "format:check:my:lesson06:openrouter",
    "verify:my:lesson06:openrouter",
  ]) {
    requireScriptPath("check:my:lesson06:openrouter", requiredScript);
  }

  for (const checkName of ["check:lesson06:openrouter", "check:lesson06:openrouter:solution"]) {
    const checkCommand = scripts[checkName] ?? "";
    if (
      /audit:structure|\.private|lesson-0[789]-|\byarn\s+(?:lint|format:check|typecheck)\b/u.test(
        checkCommand,
      )
    ) {
      failures.push(`${checkName} must stay within Lesson 06 and inherited local dependencies.`);
    }
  }

  for (const configName of [
    "tsconfig.lesson-06-openrouter.starter.build.json",
    "tsconfig.lesson-06-openrouter.build.json",
    "tsconfig.lesson-06.my-openrouter.json",
  ]) {
    const configText = await readFile(join(repositoryRoot, configName), "utf8");
    if (/lesson-(?:0[1-5]|0[7-9])-|\.private/u.test(configText)) {
      failures.push(`${configName} must include only local Lesson 06 source files.`);
    }
  }

  for (const state of states) {
    const stateRoot = join(lessonRoot, state);
    const label = `${lesson}/${state}`;

    await requireDirectory(stateRoot, label);
    await requireDirectory(join(stateRoot, "src"), `${label}/src`);
    await requireDirectory(join(stateRoot, "tests"), `${label}/tests`);
    await requireDirectory(join(stateRoot, "evals"), `${label}/evals`);
    await requireFile(join(stateRoot, "README.md"), `${label}/README.md`);

    const summary = await inspectState(stateRoot, label, true);
    if (state === "starter" && summary.todoTests !== 0) {
      failures.push(
        `${label} must retain the inherited suite with 0 todo test declarations; found ` +
          `${summary.todoTests} todo.`,
      );
    }

    const sourceFiles = (await listFiles(join(stateRoot, "src"))).filter((file) =>
      /\.(?:[cm]?[jt]sx?)$/u.test(file),
    );
    if (state === "solution") {
      for (const sourceFile of sourceFiles) {
        const source = await readFile(sourceFile, "utf8");
        if (/lesson-\d{2}[^"']*\/(?:starter|solution)\//u.test(source)) {
          failures.push(`${relative(repositoryRoot, sourceFile)} imports a canonical lesson tree.`);
        }
      }
    }
    const testCountLabel =
      lesson === "lesson-06-rag-openrouter" ? "source test declarations" : "active";
    summaries.push(
      `PASS ${label}: ${summary.testFiles} test files, ` +
        `${summary.activeTests} ${testCountLabel}, ${summary.todoTests} todo, ` +
        `${summary.evalFiles} eval files`,
    );
  }
}

async function inspectLesson07OpenRouterVariant(): Promise<void> {
  const lesson = "lesson-07-agent-loop-openrouter";
  const lessonRoot = join(repositoryRoot, lesson);

  await requireDirectory(lessonRoot, lesson);
  await requireDirectory(join(lessonRoot, "evals"), `${lesson}/evals`);
  await requireFile(join(lessonRoot, "homework.md"), `${lesson}/homework.md`);
  await requireFile(join(lessonRoot, "README.md"), `${lesson}/README.md`);
  await requireFile(join(lessonRoot, "evals", "README.md"), `${lesson}/evals/README.md`);
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-07-openrouter.starter.build.json"),
    "tsconfig.lesson-07-openrouter.starter.build.json",
  );
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-07-openrouter.build.json"),
    "tsconfig.lesson-07-openrouter.build.json",
  );
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-07.my-openrouter.json"),
    "tsconfig.lesson-07.my-openrouter.json",
  );

  requireScriptPath("dev:lesson07:openrouter", `${lesson}/starter/`);
  requireScriptPath("dev:lesson07:openrouter:solution", `${lesson}/solution/`);
  requireScriptPath(
    "demo:lesson07:openrouter:solution",
    `${lesson}/solution/src/demo-agent-loop.ts`,
  );
  requireScriptPath("audit:lesson07:openrouter", "--lesson07-openrouter");
  requireScriptPath("verify:lesson07:openrouter", "--lesson07-openrouter");
  requireScriptPath("verify:lesson07:openrouter", `${lesson}/starter`);
  requireScriptPath("verify:lesson07:openrouter:scaffolding", "--lesson07-openrouter");
  requireScriptPath(
    "verify:lesson07:openrouter:scaffolding",
    "verify-openrouter-starter-contracts.ts",
  );
  requireScriptPath(
    "verify:lesson07:openrouter:continuity",
    "scripts/verify-lesson07-openrouter-continuity.ts",
  );
  requireScriptPath("verify:my:lesson07:openrouter", "--lesson07-openrouter");
  requireScriptPath("verify:my:lesson07:openrouter", "my-dev/lesson-07-agent-loop-openrouter");
  requireScriptPath("test:lesson07:openrouter", `${lesson}/starter/tests`);
  requireScriptPath("test:lesson07:openrouter:solution", `${lesson}/solution/tests`);
  requireScriptPath("test:lesson07:openrouter:coverage", lesson);
  requireScriptPath("eval:lesson07:openrouter", `${lesson}/starter/evals`);
  requireScriptPath("eval:lesson07:openrouter:solution", `${lesson}/solution/evals/run.ts`);
  requireScriptPath(
    "eval:lesson07:openrouter:solution:agent-loop",
    `${lesson}/solution/evals/run-agent-loop.ts`,
  );
  requireScriptPath(
    "eval:lesson07:openrouter:solution:live",
    `${lesson}/solution/evals/run-live.ts`,
  );
  requireScriptPath(
    "eval:lesson07:openrouter:solution:agent-loop:live",
    `${lesson}/solution/evals/run-agent-loop-live.ts`,
  );
  requireScriptPath(
    "smoke:lesson07:openrouter:solution",
    `${lesson}/solution/scripts/smoke-agent-loop-api.ts`,
  );
  requireScriptPath(
    "build:lesson07:openrouter:starter",
    "tsconfig.lesson-07-openrouter.starter.build.json",
  );
  requireScriptPath(
    "build:lesson07:openrouter:solution",
    "tsconfig.lesson-07-openrouter.build.json",
  );
  requireScriptPath("build:lesson07:openrouter", "build:lesson07:openrouter:starter");
  requireScriptPath("build:lesson07:openrouter", "build:lesson07:openrouter:solution");
  requireScriptPath("check:lesson07:openrouter", "verify:lesson07:openrouter");
  requireScriptPath("check:lesson07:openrouter", "verify:lesson07:openrouter:continuity");
  requireScriptPath("check:lesson07:openrouter", "test:lesson07:openrouter");
  requireScriptPath(
    "check:lesson07:openrouter:solution",
    "eval:lesson07:openrouter:solution:agent-loop",
  );
  requireScriptPath("check:lesson07:openrouter:solution", "test:lesson07:openrouter:solution");
  requireScriptPath("check:lesson07:openrouter:solution", "smoke:lesson07:openrouter:solution");
  requireScriptPath("build", "build:lesson07:openrouter");
  requireScriptPath("test", "test:lesson07:openrouter");
  requireScriptPath("test:watch", `${lesson}/starter/tests`);
  requireScriptPath("test:solution", "test:lesson07:openrouter:solution");
  requireScriptPath("eval", "eval:lesson07:openrouter");
  requireScriptPath("eval:solution", "eval:lesson07:openrouter:solution");
  requireScriptPath("check:solution", "smoke:lesson07:openrouter:solution");

  requireScriptPath(
    "dev:my:lesson07:openrouter",
    "my-dev/lesson-07-agent-loop-openrouter/src/server.ts",
  );
  requireScriptPath("test:my:lesson07:openrouter", "my-dev/lesson-07-agent-loop-openrouter/tests");
  requireScriptPath(
    "eval:my:lesson07:openrouter",
    "my-dev/lesson-07-agent-loop-openrouter/evals/run.ts",
  );
  requireScriptPath(
    "eval:my:lesson07:openrouter",
    "my-dev/lesson-07-agent-loop-openrouter/evals/run-agent-loop.ts",
  );
  requireScriptPath("typecheck:my:lesson07:openrouter", "tsconfig.lesson-07.my-openrouter.json");
  requireScriptPath(
    "lint:my:lesson07:openrouter",
    "my-dev/lesson-07-agent-loop-openrouter/**/*.ts",
  );
  requireScriptPath(
    "format:check:my:lesson07:openrouter",
    "my-dev/lesson-07-agent-loop-openrouter/**/*.{md,json,ts,tsx}",
  );
  for (const requiredScript of [
    "typecheck:my:lesson07:openrouter",
    "lint:my:lesson07:openrouter",
    "format:check:my:lesson07:openrouter",
    "test:my:lesson07:openrouter",
    "eval:my:lesson07:openrouter",
    "verify:my:lesson07:openrouter",
  ]) {
    requireScriptPath("check:my:lesson07:openrouter", requiredScript);
  }

  const lessonSourceFiles = (await listFiles(lessonRoot)).filter((path) => path.endsWith(".ts"));
  for (const path of lessonSourceFiles) {
    const source = await readFile(path, "utf8");
    if (
      /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["'][^"']*lesson-\d{2}[^"']*\/(?:starter|solution)\//iu.test(
        source,
      )
    ) {
      failures.push(
        `${relative(repositoryRoot, path)} imports a canonical lesson starter/solution.`,
      );
    }
    if (/lesson-08-multi-agent-workflow/u.test(source)) {
      failures.push(`${relative(repositoryRoot, path)} depends on future Lesson 08 behavior.`);
    }
  }

  for (const state of states) {
    const stateRoot = join(lessonRoot, state);
    const label = `${lesson}/${state}`;

    await requireDirectory(stateRoot, label);
    await requireDirectory(join(stateRoot, "src"), `${label}/src`);
    await requireDirectory(join(stateRoot, "tests"), `${label}/tests`);
    await requireDirectory(join(stateRoot, "evals"), `${label}/evals`);
    await requireFile(join(stateRoot, "README.md"), `${label}/README.md`);

    const summary = await inspectState(stateRoot, label, true);
    summaries.push(
      `PASS ${label}: ${summary.testFiles} test files, ` +
        `${summary.activeTests} active, ${summary.todoTests} todo, ` +
        `${summary.evalFiles} eval files`,
    );
  }

  for (const checkName of [
    "check:lesson07:openrouter",
    "check:lesson07:openrouter:solution",
    "check:my:lesson07:openrouter",
  ]) {
    const checkCommand = scripts[checkName] ?? "";
    if (
      /audit:structure|\.private|lesson-08-multi-agent-workflow|\byarn\s+(?:lint|format:check|typecheck)(?=\s|$)/u.test(
        checkCommand,
      )
    ) {
      failures.push(`${checkName} must stay within Lesson 07 and its inherited local foundation.`);
    }
  }

  for (const configName of [
    "tsconfig.lesson-07-openrouter.starter.build.json",
    "tsconfig.lesson-07-openrouter.build.json",
    "tsconfig.lesson-07.my-openrouter.json",
  ]) {
    const configText = await readFile(join(repositoryRoot, configName), "utf8");
    if (/lesson-(?:0[1-6]|0[89])-|\.private/u.test(configText)) {
      failures.push(`${configName} must include only Lesson 07 OpenRouter source files.`);
    }
  }
}

async function inspectLesson08OpenRouterVariant(): Promise<void> {
  const lesson = "lesson-08-multi-agent-workflow-openrouter";
  const lessonRoot = join(repositoryRoot, lesson);
  await requireDirectory(lessonRoot, lesson);
  for (const file of [
    "README.md",
    "homework.md",
    "student-guide.md",
    "starter-code-guide.md",
    "roadmap-code-guide.md",
    "dev-migration-guide.md",
    "evals/README.md",
  ]) {
    await requireFile(join(lessonRoot, file), `${lesson}/${file}`);
  }
  for (const config of [
    "tsconfig.lesson-08-openrouter.starter.build.json",
    "tsconfig.lesson-08-openrouter.build.json",
    "tsconfig.lesson-08.my-openrouter.json",
  ]) {
    await requireFile(join(repositoryRoot, config), config);
    const text = await readFile(join(repositoryRoot, config), "utf8");
    if (/lesson-(?:0[1-7]|09|1\d)-|\.private/u.test(text))
      failures.push(`${config} must include only Lesson 08 OpenRouter source files.`);
  }
  const scriptPaths: ReadonlyArray<readonly [string, string]> = [
    ["audit:lesson08:openrouter", "--lesson08-openrouter"],
    ["dev:lesson08:openrouter", `${lesson}/starter/src/server.ts`],
    ["dev:lesson08:openrouter:solution", `${lesson}/solution/src/server.ts`],
    ["demo:lesson08:openrouter:solution", `${lesson}/solution/src/demo-report-workflow.ts`],
    ["verify:lesson08:openrouter", "--lesson08-openrouter"],
    ["verify:lesson08:openrouter", `${lesson}/starter`],
    ["verify:lesson08:openrouter:scaffolding", "scripts/verify-lesson08-openrouter-scaffolding.ts"],
    ["verify:lesson08:openrouter:continuity", "scripts/verify-lesson08-openrouter-continuity.ts"],
    ["verify:my:lesson08:openrouter", "--lesson08-openrouter"],
    ["verify:my:lesson08:openrouter", `my-dev/${lesson}`],
    ["test:lesson08:openrouter", `${lesson}/starter/tests`],
    ["test:lesson08:openrouter:solution", `${lesson}/solution/tests`],
    ["eval:lesson08:openrouter", `${lesson}/starter/evals/run.ts`],
    ["eval:lesson08:openrouter:solution", `${lesson}/solution/evals/run.ts`],
    ["eval:lesson08:openrouter:solution:agent-loop", `${lesson}/solution/evals/run-agent-loop.ts`],
    [
      "eval:lesson08:openrouter:solution:workflow",
      `${lesson}/solution/evals/run-report-workflow.ts`,
    ],
    [
      "smoke:lesson08:openrouter:solution",
      `${lesson}/solution/scripts/smoke-report-workflow-api.ts`,
    ],
    ["build:lesson08:openrouter:starter", "tsconfig.lesson-08-openrouter.starter.build.json"],
    ["build:lesson08:openrouter:solution", "tsconfig.lesson-08-openrouter.build.json"],
    ["typecheck:my:lesson08:openrouter", "tsconfig.lesson-08.my-openrouter.json"],
  ];
  for (const [script, expectedPath] of scriptPaths) requireScriptPath(script, expectedPath);
  for (const check of [
    "check:lesson08:openrouter",
    "check:lesson08:openrouter:solution",
    "check:my:lesson08:openrouter",
  ]) {
    const command = scripts[check] ?? "";
    if (
      /audit:structure|\.private|lesson-09-|\byarn\s+(?:lint|format:check|typecheck)(?=\s|$)/u.test(
        command,
      )
    )
      failures.push(`${check} must stay within Lesson 08 and its local inherited foundation.`);
  }
  if (
    (scripts["check:lesson08:openrouter"] ?? "").includes("verify:lesson08:openrouter:scaffolding")
  )
    failures.push(
      "Lesson 08 completion check must accept an implemented starter; pristine inheritance is a separate gate.",
    );
  for (const file of [
    "src/services/report-workflow.ts",
    "src/services/openrouter-report-workers.ts",
    "src/demo-report-workflow.ts",
    "evals/run-report-workflow.ts",
    "tests/report-workflow.test.ts",
    "tests/report-workflow-app.test.ts",
  ]) {
    await requireFile(join(lessonRoot, "solution", file), `${lesson}/solution/${file}`);
  }
  for (const state of states) {
    const stateRoot = join(lessonRoot, state);
    const label = `${lesson}/${state}`;
    await requireFile(join(stateRoot, "README.md"), `${label}/README.md`);
    const summary = await inspectState(stateRoot, label, true);
    for (const file of (await listFiles(stateRoot)).filter((path) => path.endsWith(".ts"))) {
      const source = await readFile(file, "utf8");
      if (
        /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["'][^"']*lesson-\d{2}[^"']*\/(?:starter|solution)\//iu.test(
          source,
        )
      )
        failures.push(
          `${relative(repositoryRoot, file)} imports a canonical lesson starter/solution.`,
        );
      if (/\b(?:describe|it|test)\.(?:todo|skip|skipIf|runIf|only)\s*\(/u.test(source))
        failures.push(`${relative(repositoryRoot, file)} contains incomplete or filtered tests.`);
    }
    summaries.push(
      `PASS ${label}: ${summary.testFiles} test files, ${summary.activeTests} active, ${summary.todoTests} todo, ${summary.evalFiles} eval files`,
    );
  }
}

async function inspectLesson09OpenRouterVariant(): Promise<void> {
  const lesson = "lesson-09-openai-agents-sdk-openrouter";
  const lessonRoot = join(repositoryRoot, lesson);

  await requireDirectory(lessonRoot, lesson);
  await requireDirectory(join(lessonRoot, "evals"), `${lesson}/evals`);
  await requireFile(join(lessonRoot, "homework.md"), `${lesson}/homework.md`);
  await requireFile(join(lessonRoot, "README.md"), `${lesson}/README.md`);
  await requireFile(
    join(lessonRoot, "solution", "evals", "evaluate-agents-sdk.ts"),
    `${lesson}/solution/evals/evaluate-agents-sdk.ts`,
  );
  await requireFile(
    join(lessonRoot, "solution", "evals", "run-agents-sdk.ts"),
    `${lesson}/solution/evals/run-agents-sdk.ts`,
  );
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-09-openrouter.starter.build.json"),
    "tsconfig.lesson-09-openrouter.starter.build.json",
  );
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-09-openrouter.build.json"),
    "tsconfig.lesson-09-openrouter.build.json",
  );

  requireScriptPath("dev:lesson09:openrouter", `${lesson}/starter/`);
  requireScriptPath("dev:lesson09:openrouter:solution", `${lesson}/solution/`);
  requireScriptPath(
    "demo:lesson09:openrouter:solution",
    `${lesson}/solution/src/demo-agents-sdk.ts`,
  );
  requireScriptPath("verify:lesson09:openrouter", "--lesson09-openrouter");
  requireScriptPath("verify:lesson09:openrouter", `${lesson}/starter`);
  requireScriptPath("verify:lesson09:openrouter", "scripts/assert-starter-complete.ts");
  requireScriptPath(
    "verify:lesson09:openrouter:scaffolding",
    "scripts/verify-lesson09-openrouter-scaffolding.ts",
  );
  requireScriptPath(
    "verify:lesson09:openrouter:continuity",
    "scripts/verify-lesson09-openrouter-continuity.ts",
  );
  requireScriptPath("test:lesson09:openrouter", `${lesson}/starter/tests`);
  requireScriptPath("test:lesson09:openrouter:solution", `${lesson}/solution/tests`);
  requireScriptPath("test:lesson09:openrouter:coverage", lesson);
  requireScriptPath("eval:lesson09:openrouter", `${lesson}/starter/evals/run.ts`);
  requireScriptPath("eval:lesson09:openrouter:solution", `${lesson}/solution/evals/run.ts`);
  requireScriptPath(
    "eval:lesson09:openrouter:solution:sdk",
    `${lesson}/solution/evals/run-agents-sdk.ts`,
  );
  requireScriptPath(
    "eval:lesson09:openrouter:solution:catalog",
    `${lesson}/solution/evals/live-agents-sdk-catalog.ts`,
  );
  requireScriptPath(
    "eval:lesson09:openrouter:solution:live",
    `${lesson}/solution/evals/run-agents-sdk-live.ts`,
  );
  requireScriptPath(
    "smoke:lesson09:openrouter:sdk",
    `${lesson}/solution/scripts/smoke-agents-sdk.ts`,
  );
  requireScriptPath("audit:lesson09:openrouter", "--lesson09-openrouter");
  requireScriptPath("check:lesson09:openrouter", "audit:lesson09:openrouter");
  requireScriptPath("check:lesson09:openrouter:solution", "audit:lesson09:openrouter");
  requireScriptPath(
    "build:lesson09:openrouter:starter",
    "tsconfig.lesson-09-openrouter.starter.build.json",
  );
  requireScriptPath(
    "build:lesson09:openrouter:solution",
    "tsconfig.lesson-09-openrouter.build.json",
  );
  requireScriptPath("build:lesson09:openrouter", "build:lesson09:openrouter:starter");
  requireScriptPath("build:lesson09:openrouter", "build:lesson09:openrouter:solution");
  requireScriptPath("check:lesson09:openrouter", "test:lesson09:openrouter");
  requireScriptPath("check:lesson09:openrouter", "verify:lesson09:openrouter:continuity");
  requireScriptPath("check:lesson09:openrouter", "build:lesson09:openrouter:starter");
  requireScriptPath("check:lesson09:openrouter:solution", "verify:lesson09:openrouter:continuity");
  requireScriptPath("check:lesson09:openrouter:solution", "verify:lesson09:openrouter:scaffolding");
  requireScriptPath("check:lesson09:openrouter:solution", "test:lesson09:openrouter:solution");
  requireScriptPath("check:lesson09:openrouter:solution", "smoke:lesson09:openrouter:sdk");
  requireScriptPath("check:lesson09:openrouter:solution", "build:lesson09:openrouter:solution");
  requireScriptPath("build", "build:lesson09:openrouter");
  requireScriptPath("test", "test:lesson09:openrouter");
  requireScriptPath("test:watch", `${lesson}/starter/tests`);
  requireScriptPath("test:solution", "test:lesson09:openrouter:solution");
  requireScriptPath("eval", "eval:lesson09:openrouter");
  requireScriptPath("eval:solution", "eval:lesson09:openrouter:solution");
  requireScriptPath("check:solution", "smoke:lesson09:openrouter:sdk");

  for (const state of states) {
    const stateRoot = join(lessonRoot, state);
    const label = `${lesson}/${state}`;

    await requireDirectory(stateRoot, label);
    await requireDirectory(join(stateRoot, "src"), `${label}/src`);
    await requireDirectory(join(stateRoot, "tests"), `${label}/tests`);
    await requireDirectory(join(stateRoot, "evals"), `${label}/evals`);
    await requireFile(join(stateRoot, "README.md"), `${label}/README.md`);

    const summary = await inspectState(stateRoot, label, true);
    summaries.push(
      `PASS ${label}: ${summary.testFiles} test files, ` +
        `${summary.activeTests} active, ${summary.todoTests} todo, ` +
        `${summary.evalFiles} eval files`,
    );
  }
}

async function inspectLesson10OpenRouterVariant(): Promise<void> {
  const lesson = "lesson-10-langgraph-openrouter";
  const lessonRoot = join(repositoryRoot, lesson);

  await requireDirectory(lessonRoot, lesson);
  await requireFile(join(lessonRoot, "homework.md"), `${lesson}/homework.md`);
  await requireFile(join(lessonRoot, "README.md"), `${lesson}/README.md`);
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-10-openrouter.starter.build.json"),
    "tsconfig.lesson-10-openrouter.starter.build.json",
  );
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-10-openrouter.build.json"),
    "tsconfig.lesson-10-openrouter.build.json",
  );
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-10.my-openrouter.json"),
    "tsconfig.lesson-10.my-openrouter.json",
  );

  requireScriptPath("dev:lesson10:openrouter", `${lesson}/starter/`);
  requireScriptPath("dev:lesson10:openrouter:solution", `${lesson}/solution/`);
  requireScriptPath("demo:lesson10:openrouter:solution", `${lesson}/solution/src/demo.ts`);
  requireScriptPath("verify:lesson10:openrouter", "scripts/assert-starter-complete.ts");
  requireScriptPath("verify:lesson10:openrouter", "--lesson10-openrouter");
  requireScriptPath(
    "verify:lesson10:openrouter:scaffolding",
    "scripts/verify-lesson10-openrouter-scaffolding.ts",
  );
  requireScriptPath(
    "verify:lesson10:openrouter:continuity",
    "scripts/verify-lesson10-openrouter-continuity.ts",
  );
  requireScriptPath(
    "verify:lesson10:openrouter:completion",
    "scripts/verify-lesson10-openrouter-completion.ts",
  );
  requireScriptPath("audit:lesson10:openrouter", "--lesson10-openrouter");
  requireScriptPath("verify:my:lesson10:openrouter", "my-dev/lesson-10-langgraph-openrouter");
  requireScriptPath("eval:lesson10:openrouter", `${lesson}/starter/evals/run.ts`);
  requireScriptPath(
    "eval:lesson10:openrouter:solution",
    `${lesson}/solution/evals/run-content-review.ts`,
  );
  requireScriptPath(
    "eval:lesson10:openrouter:solution:live",
    `${lesson}/solution/evals/live-content-review.ts`,
  );
  requireScriptPath(
    "verify:lesson10:openrouter:scaffolding",
    "scripts/verify-lesson10-openrouter-scaffolding.ts",
  );
  requireScriptPath(
    "verify:lesson10:openrouter:continuity",
    "scripts/verify-lesson10-openrouter-continuity.ts",
  );
  requireScriptPath("test:lesson10:openrouter", `${lesson}/starter/tests`);
  requireScriptPath("test:lesson10:openrouter:solution", `${lesson}/solution/tests`);
  requireScriptPath("test:lesson10:openrouter:coverage", lesson);
  requireScriptPath(
    "verify:lesson10:openrouter:catalog",
    `${lesson}/solution/scripts/verify-content-review-catalog.ts`,
  );
  requireScriptPath(
    "smoke:lesson10:openrouter:graph",
    `${lesson}/solution/scripts/smoke-content-review-graph.ts`,
  );
  requireScriptPath(
    "build:lesson10:openrouter:starter",
    "tsconfig.lesson-10-openrouter.starter.build.json",
  );
  requireScriptPath(
    "build:lesson10:openrouter:solution",
    "tsconfig.lesson-10-openrouter.build.json",
  );
  requireScriptPath("build:lesson10:openrouter", "build:lesson10:openrouter:starter");
  requireScriptPath("build:lesson10:openrouter", "build:lesson10:openrouter:solution");
  requireScriptPath("check:lesson10:openrouter", "audit:lesson10:openrouter");
  requireScriptPath("check:lesson10:openrouter", "verify:mvp:no-fallback");
  requireScriptPath("check:lesson10:openrouter", "verify:lesson10:openrouter:continuity");
  requireScriptPath("check:lesson10:openrouter", "verify:lesson10:openrouter");
  requireScriptPath("check:lesson10:openrouter", "eval:lesson10:openrouter");
  requireScriptPath("check:lesson10:openrouter", "build:lesson10:openrouter:starter");
  requireScriptPath("check:lesson10:openrouter:starter", "verify:lesson10:openrouter:scaffolding");
  requireScriptPath("check:lesson10:openrouter:starter", "verify:mvp:no-fallback");
  requireScriptPath("check:lesson10:openrouter:starter", "build:lesson10:openrouter:starter");
  requireScriptPath("check:lesson10:openrouter:solution", "audit:lesson10:openrouter");
  requireScriptPath("check:lesson10:openrouter:solution", "verify:mvp:no-fallback");
  requireScriptPath("check:lesson10:openrouter:solution", "verify:lesson10:openrouter:continuity");
  requireScriptPath("check:lesson10:openrouter:solution", "build:lesson10:openrouter:solution");
  requireScriptPath("check:lesson10:openrouter:solution", "verify:lesson10:openrouter:completion");
  requireScriptPath("check:dev:lesson10:openrouter", "typecheck:dev");
  requireScriptPath("check:dev:lesson10:openrouter", "lint:dev");
  requireScriptPath("check:dev:lesson10:openrouter", "format:check:dev");
  requireScriptPath("check:dev:lesson10:openrouter", "verify:lesson10:openrouter:completion dev");
  const completionSource = await readFile(
    join(repositoryRoot, "scripts", "verify-lesson10-openrouter-completion.ts"),
    "utf8",
  );
  for (const marker of [
    '"tests", entry.relativePath',
    '"evals/run.ts"',
    '"evals/run-agent-loop.ts"',
    '"evals/run-report-workflow.ts"',
    '"evals/run-agents-sdk.ts"',
    '"evals/run-content-review.ts"',
    '"scripts/smoke-content-review-graph.ts"',
  ]) {
    if (!completionSource.includes(marker)) {
      failures.push(
        `Lesson 10 completion verifier does not include required source-bound gate ${marker}.`,
      );
    }
  }
  requireScriptPath("check:my:lesson10:openrouter", "verify:my:lesson10:openrouter");
  requireScriptPath("eval", "eval:lesson10:openrouter");
  requireScriptPath("eval:solution", "eval:lesson10:openrouter:solution");
  requireScriptPath("build", "build:lesson10:openrouter");
  requireScriptPath("test", "test:lesson10:openrouter");
  requireScriptPath("test:watch", `${lesson}/starter/tests`);
  requireScriptPath("test:solution", "test:lesson10:openrouter:solution");
  requireScriptPath("check:solution", "smoke:lesson10:openrouter:graph");

  const requiredMarkers = [
    ["solution/src/app.ts", '"/api/workflows/content-review"'],
    ["solution/src/app.ts", '"/api/workflows/content-review/:threadId/decision"'],
    ["solution/src/runtime.ts", 'REPORT_MODEL_SOURCE = "INHERITED_FROM_PREVIOUS_OPENROUTER"'],
    ["solution/src/runtime.ts", "createLesson10OpenRouterRuntime"],
    ["solution/src/services/openrouter-draft-generator.ts", "require_parameters: true"],
    ["solution/src/services/content-review-graph.ts", "StateGraph"],
  ] as const;

  for (const [relativePath, marker] of requiredMarkers) {
    const source = await readFile(join(lessonRoot, relativePath), "utf8");
    if (!source.includes(marker)) {
      failures.push(`${lesson}/${relativePath} не містить обов'язковий marker ${marker}.`);
    }
  }

  for (const state of states) {
    const stateRoot = join(lessonRoot, state);
    const label = `${lesson}/${state}`;

    await requireDirectory(stateRoot, label);
    await requireDirectory(join(stateRoot, "src"), `${label}/src`);
    await requireDirectory(join(stateRoot, "tests"), `${label}/tests`);
    await requireDirectory(join(stateRoot, "evals"), `${label}/evals`);
    await requireFile(join(stateRoot, "README.md"), `${label}/README.md`);

    const summary = await inspectState(stateRoot, label, true);

    summaries.push(
      `PASS ${label}: ${summary.testFiles} test files, ` +
        `${summary.activeTests} active, ${summary.todoTests} todo, ` +
        `${summary.evalFiles} eval files`,
    );
  }
}

async function inspectLesson12OpenRouterScopedContract(): Promise<void> {
  const lesson = "lesson-12-security-openrouter";
  const lessonRoot = join(repositoryRoot, lesson);
  await requireDirectory(lessonRoot, lesson);
  await requireDirectory(join(lessonRoot, "starter"), `${lesson}/starter`);
  await requireDirectory(join(lessonRoot, "solution"), `${lesson}/solution`);
  for (const path of [
    "tsconfig.lesson-12-openrouter.starter.build.json",
    "tsconfig.lesson-12-openrouter.build.json",
    "tsconfig.lesson-12.my-openrouter.json",
  ])
    await requireFile(join(repositoryRoot, path), path);

  requireScriptPath("dev:lesson12:openrouter", `${lesson}/starter/src/demo.ts`);
  requireScriptPath("dev:lesson12:openrouter:solution", `${lesson}/solution/src/demo-security.ts`);
  requireScriptPath(
    "demo:lesson12:openrouter:solution",
    `${lesson}/solution/scripts/run-security-live-demo.ts`,
  );
  requireScriptPath("verify:lesson12:openrouter", "--lesson12-openrouter");
  requireScriptPath(
    "verify:lesson12:openrouter:scaffolding",
    "scripts/verify-lesson12-openrouter-scaffolding.ts",
  );
  requireScriptPath(
    "verify:lesson12:openrouter:continuity",
    "scripts/verify-lesson12-openrouter-continuity.ts",
  );
  requireScriptPath(
    "verify:lesson12:openrouter:completion",
    "scripts/verify-lesson12-openrouter-completion.ts",
  );
  requireScriptPath("audit:lesson12:openrouter", "--lesson12-openrouter");
  requireScriptPath("verify:mvp:no-fallback:through12", "--through 12");
  requireScriptPath(
    "verify:lesson12:openrouter:catalog",
    `${lesson}/solution/scripts/verify-security-catalog.ts`,
  );
  requireScriptPath("test:lesson12:openrouter", `${lesson}/starter/tests`);
  requireScriptPath("test:lesson12:openrouter:solution", `${lesson}/solution/tests`);
  requireScriptPath("eval:lesson12:openrouter", `${lesson}/starter/evals/run-observability.ts`);
  requireScriptPath("eval:lesson12:openrouter", "--offline");
  requireScriptPath(
    "eval:lesson12:openrouter:solution:offline",
    `${lesson}/solution/evals/run-security.ts`,
  );
  requireScriptPath(
    "eval:lesson12:openrouter:solution:live",
    `${lesson}/solution/evals/run-security-live.ts`,
  );
  requireScriptPath(
    "build:lesson12:openrouter:starter",
    "tsconfig.lesson-12-openrouter.starter.build.json",
  );
  requireScriptPath(
    "build:lesson12:openrouter:solution",
    "tsconfig.lesson-12-openrouter.build.json",
  );
  requireScriptPath("build:lesson12:openrouter", "build:lesson12:openrouter:starter");
  requireScriptPath("build:lesson12:openrouter", "build:lesson12:openrouter:solution");
  requireScriptPath("check:lesson12:openrouter", "check:lesson12:openrouter:starter");
  requireScriptPath(
    "check:lesson12:openrouter:starter",
    "tests/infrastructure/lesson12-openrouter-gates.test.ts",
  );
  requireScriptPath("check:lesson12:openrouter:starter", "build:lesson12:openrouter:starter");
  requireScriptPath("check:lesson12:openrouter:solution", "audit:lesson12:openrouter");
  requireScriptPath("check:lesson12:openrouter:solution", "verify:lesson12:openrouter:completion");
  requireScriptPath("check:lesson12:openrouter:solution", "build:lesson12:openrouter:solution");
  requireScriptPath("check:dev:lesson12:openrouter", "verify:lesson12:openrouter:completion dev");
  requireScriptPath("typecheck:my:lesson12:openrouter", "tsconfig.lesson-12.my-openrouter.json");
  requireScriptPath("check:my:lesson12:openrouter", "verify:my:lesson12:openrouter");
  requireScriptPath("verify:my:lesson12:openrouter", "my-dev/lesson-12-security-openrouter");
  requireScriptPath(
    "dev:my:lesson12:openrouter",
    "my-dev/lesson-12-security-openrouter/src/demo-security.ts",
  );

  for (const name of [
    "dev:lesson12:openrouter",
    "dev:lesson12:openrouter:solution",
    "demo:lesson12:openrouter:solution",
    "verify:lesson12:openrouter",
    "verify:lesson12:openrouter:scaffolding",
    "verify:lesson12:openrouter:continuity",
    "verify:lesson12:openrouter:completion",
    "verify:lesson12:openrouter:catalog",
    "eval:lesson12:openrouter",
    "eval:lesson12:openrouter:solution:offline",
    "eval:lesson12:openrouter:solution:live",
  ]) {
    if (!scripts[name]?.includes("run-tsx-entrypoint.mjs"))
      failures.push(
        `script ${name} must use scripts/run-tsx-entrypoint.mjs for the native Windows tsx boundary.`,
      );
  }
  for (const name of ["check:lesson12:openrouter:starter", "check:lesson12:openrouter:solution"]) {
    if (
      /audit:structure|yarn lint(?:\s|&)|yarn format:check(?:\s|&)|yarn typecheck(?:\s|&)/u.test(
        scripts[name] ?? "",
      )
    ) {
      failures.push(
        `script ${name} must remain scoped to Lesson 12 and its inherited OpenRouter contract.`,
      );
    }
  }
  if (!scripts["check:dev:lesson12:openrouter"]?.includes("dev"))
    failures.push("check:dev:lesson12:openrouter must target the actual dev candidate root.");
  summaries.push(
    "Lesson 12 OpenRouter starter, solution, actual-dev, optional my-dev, offline eval, and scoped-build aliases are wired.",
  );
}

async function inspectLesson13OpenRouterScopedContract(): Promise<void> {
  const lesson = "lesson-13-databases-openrouter";
  const lessonRoot = join(repositoryRoot, lesson);
  await requireDirectory(lessonRoot, lesson);
  await requireDirectory(join(lessonRoot, "starter"), `${lesson}/starter`);
  await requireDirectory(join(lessonRoot, "solution"), `${lesson}/solution`);
  for (const path of [
    "tsconfig.lesson-13-openrouter.starter.build.json",
    "tsconfig.lesson-13-openrouter.build.json",
    "tsconfig.lesson-13.my-openrouter.json",
    "tests/infrastructure/lesson13-openrouter-gates.test.ts",
    "scripts/lesson13-openrouter-contract.ts",
  ])
    await requireFile(join(repositoryRoot, path), path);

  for (const [name, marker] of [
    ["dev:lesson13:openrouter", `${lesson}/starter/src/demo.ts`],
    ["dev:lesson13:openrouter:solution", `${lesson}/solution/src/demo.ts`],
    ["verify:lesson13:openrouter:scaffolding", "verify-lesson13-openrouter-scaffolding.ts"],
    ["verify:lesson13:openrouter:continuity", "verify-lesson13-openrouter-continuity.ts"],
    ["verify:lesson13:openrouter:completion", "verify-lesson13-openrouter-completion.ts"],
    [
      "verify:lesson13:openrouter:catalog",
      `${lesson}/solution/scripts/verify-openrouter-catalog.ts`,
    ],
    ["eval:lesson13:openrouter", `${lesson}/starter/evals/run.ts`],
    ["eval:lesson13:openrouter:solution", `${lesson}/solution/evals/run.ts`],
    ["test:lesson13:openrouter:solution", `${lesson}/solution/tests`],
    ["test:lesson13:openrouter:integration", `${lesson}/solution/integration-tests`],
    ["build:lesson13:openrouter:starter", "tsconfig.lesson-13-openrouter.starter.build.json"],
    ["build:lesson13:openrouter:solution", "tsconfig.lesson-13-openrouter.build.json"],
    ["audit:lesson13:openrouter", "--lesson13-openrouter"],
    ["verify:mvp:no-fallback:through13", "--through 13"],
  ] as const)
    requireScriptPath(name, marker);

  requireScriptPath("verify:lesson13:openrouter", "--lesson13-openrouter");
  requireScriptPath("verify:lesson13:openrouter", `${lesson}/solution`);
  requireScriptPath("check:lesson13:openrouter:starter", "verify:lesson13:openrouter");
  requireScriptPath(
    "check:lesson13:openrouter:starter",
    "tests/infrastructure/lesson13-openrouter-gates.test.ts",
  );
  requireScriptPath("check:lesson13:openrouter:solution", "verify:lesson13:openrouter:completion");
  requireScriptPath("check:lesson13:openrouter:solution", "test:lesson13:openrouter:integration");
  requireScriptPath("check:dev:lesson13:openrouter", "verify:lesson13:openrouter:completion dev");
  requireScriptPath("check:dev:lesson13:openrouter", "verify:mvp:no-fallback:through13");
  requireScriptPath("typecheck:my:lesson13:openrouter", "tsconfig.lesson-13.my-openrouter.json");
  requireScriptPath("check:my:lesson13:openrouter", "verify:my:lesson13:openrouter");

  for (const name of [
    "dev:lesson13:openrouter",
    "dev:lesson13:openrouter:solution",
    "verify:lesson13:openrouter",
    "verify:lesson13:openrouter:scaffolding",
    "verify:lesson13:openrouter:continuity",
    "verify:lesson13:openrouter:completion",
    "verify:lesson13:openrouter:catalog",
    "eval:lesson13:openrouter",
    "eval:lesson13:openrouter:solution",
    "eval:lesson13:openrouter:catalog",
  ]) {
    if (!scripts[name]?.includes("run-tsx-entrypoint.mjs"))
      failures.push(
        `script ${name} must use scripts/run-tsx-entrypoint.mjs for the native Windows tsx boundary.`,
      );
  }
  for (const name of ["check:lesson13:openrouter:starter", "check:lesson13:openrouter:solution"]) {
    if (
      /audit:structure|yarn lint(?:\s|&)|yarn format:check(?:\s|&)|yarn typecheck(?:\s|&)/u.test(
        scripts[name] ?? "",
      )
    )
      failures.push(`script ${name} must remain scoped to Lesson 13 OpenRouter.`);
  }
  const buildConfig = await readFile(
    join(repositoryRoot, "tsconfig.lesson-13-openrouter.build.json"),
    "utf8",
  );
  if (/lesson-(?:03|11|12)-[^"\r\n]*solution/u.test(buildConfig))
    failures.push("Lesson 13 OpenRouter solution build must use its local inherited foundation.");
  const completionContract = await readFile(
    join(repositoryRoot, "scripts", "lesson13-openrouter-contract.ts"),
    "utf8",
  );
  if (!completionContract.includes('"evals/catalog-run.ts"'))
    failures.push("Lesson 13 OpenRouter completion must run the offline catalog eval.");
  summaries.push(
    "Lesson 13 OpenRouter starter, solution, actual-dev, offline database eval, scoped-build, and database integration aliases are wired.",
  );
}

async function inspectLesson11OpenRouterVariant(): Promise<void> {
  const lesson = "lesson-11-evals-observability-openrouter";
  const lessonRoot = join(repositoryRoot, lesson);

  await requireDirectory(lessonRoot, lesson);
  await requireDirectory(join(lessonRoot, "evals"), `${lesson}/evals`);
  await requireDirectory(join(lessonRoot, "checkpoints"), `${lesson}/checkpoints`);
  await requireFile(join(lessonRoot, "README.md"), `${lesson}/README.md`);
  await requireFile(join(lessonRoot, "homework.md"), `${lesson}/homework.md`);
  await requireFile(join(lessonRoot, "evals", "README.md"), `${lesson}/evals/README.md`);
  await requireFile(
    join(lessonRoot, "checkpoints", "README.md"),
    `${lesson}/checkpoints/README.md`,
  );
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-11-openrouter.starter.build.json"),
    "tsconfig.lesson-11-openrouter.starter.build.json",
  );
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-11-openrouter.build.json"),
    "tsconfig.lesson-11-openrouter.build.json",
  );
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-11.my-openrouter.json"),
    "tsconfig.lesson-11.my-openrouter.json",
  );

  requireScriptPath(
    "demo:lesson11:openrouter:solution",
    `${lesson}/solution/scripts/run-live-demo.ts`,
  );
  requireScriptPath("verify:lesson11:openrouter", "scripts/assert-starter-complete.ts");
  requireScriptPath("verify:lesson11:openrouter", "--lesson11-openrouter");
  requireScriptPath(
    "verify:lesson11:openrouter:scaffolding",
    "scripts/verify-lesson11-openrouter-scaffolding.ts",
  );
  requireScriptPath(
    "verify:lesson11:openrouter:continuity",
    "scripts/verify-lesson11-openrouter-continuity.ts",
  );
  requireScriptPath("verify:lesson11:openrouter:continuity", `${lesson}/solution`);
  requireScriptPath(
    "verify:lesson11:openrouter:completion",
    "scripts/verify-lesson11-openrouter-completion.ts",
  );
  requireScriptPath("audit:lesson11:openrouter", "--lesson11-openrouter");
  requireScriptPath("verify:mvp:no-fallback:through11", "--through 11");
  requireScriptPath(
    "verify:lesson11:openrouter:catalog",
    `${lesson}/solution/scripts/verify-openrouter-catalog.ts`,
  );
  requireScriptPath("test:lesson11:openrouter", `${lesson}/starter/tests`);
  requireScriptPath("test:lesson11:openrouter:solution", `${lesson}/solution/tests`);
  requireScriptPath("test:lesson11:openrouter:coverage", lesson);
  requireScriptPath("eval:lesson11:openrouter", `${lesson}/starter/evals/run.ts`);
  requireScriptPath(
    "eval:lesson11:openrouter:solution",
    `${lesson}/solution/evals/run-observability.ts`,
  );
  requireScriptPath(
    "eval:lesson11:openrouter:solution:offline",
    `${lesson}/solution/evals/run-observability.ts`,
  );
  requireScriptPath(
    "eval:lesson11:openrouter:solution:live",
    `${lesson}/solution/evals/run-observability.ts`,
  );
  requireScriptPath("eval:lesson11:openrouter:solution", "--offline");
  requireScriptPath("eval:lesson11:openrouter:solution:live", "--live");
  requireScriptPath(
    "build:lesson11:openrouter:starter",
    "tsconfig.lesson-11-openrouter.starter.build.json",
  );
  requireScriptPath(
    "build:lesson11:openrouter:solution",
    "tsconfig.lesson-11-openrouter.build.json",
  );
  requireScriptPath("build:lesson11:openrouter", "build:lesson11:openrouter:starter");
  requireScriptPath("build:lesson11:openrouter", "build:lesson11:openrouter:solution");
  requireScriptPath("check:lesson11:openrouter", "check:lesson11:openrouter:starter");
  requireScriptPath(
    "check:lesson11:openrouter:starter",
    "tests/infrastructure/lesson11-openrouter-gates.test.ts",
  );
  requireScriptPath("check:lesson11:openrouter:starter", "build:lesson11:openrouter:starter");
  requireScriptPath("check:lesson11:openrouter:solution", "audit:lesson11:openrouter");
  requireScriptPath("check:lesson11:openrouter:solution", "verify:mvp:no-fallback:through11");
  requireScriptPath(
    "check:lesson11:openrouter:solution",
    "tests/infrastructure/lesson11-openrouter-gates.test.ts",
  );
  requireScriptPath("check:lesson11:openrouter:solution", "verify:lesson11:openrouter:completion");
  requireScriptPath("check:dev:lesson11:openrouter", "dev");
  requireScriptPath("check:dev:lesson11:openrouter", "verify:lesson11:openrouter:completion");
  requireScriptPath("typecheck:my:lesson11:openrouter", "tsconfig.lesson-11.my-openrouter.json");
  requireScriptPath(
    "dev:my:lesson11:openrouter",
    "my-dev/lesson-11-evals-observability-openrouter/src/server.ts",
  );
  requireScriptPath(
    "test:my:lesson11:openrouter",
    "my-dev/lesson-11-evals-observability-openrouter/tests",
  );
  requireScriptPath(
    "eval:my:lesson11:openrouter",
    "my-dev/lesson-11-evals-observability-openrouter/evals/run-observability.ts",
  );
  requireScriptPath(
    "lint:my:lesson11:openrouter",
    "my-dev/lesson-11-evals-observability-openrouter/**/*.ts",
  );
  requireScriptPath(
    "format:check:my:lesson11:openrouter",
    "my-dev/lesson-11-evals-observability-openrouter/**/*.{md,json,ts,tsx}",
  );
  requireScriptPath("build:my:lesson11:openrouter", "tsconfig.lesson-11.my-openrouter.json");
  requireScriptPath("check:my:lesson11:openrouter", "build:my:lesson11:openrouter");
  requireScriptPath(
    "verify:my:lesson11:openrouter",
    "my-dev/lesson-11-evals-observability-openrouter",
  );
  requireScriptPath(
    "verify:my:lesson11:openrouter:scaffolding",
    "my-dev/lesson-11-evals-observability-openrouter",
  );
  for (const name of [
    "audit:lesson11:openrouter",
    "verify:lesson11:openrouter",
    "verify:lesson11:openrouter:scaffolding",
    "verify:lesson11:openrouter:continuity",
    "verify:lesson11:openrouter:completion",
    "verify:lesson11:openrouter:catalog",
    "eval:lesson11:openrouter:solution",
    "eval:lesson11:openrouter:solution:offline",
    "eval:lesson11:openrouter:solution:live",
    "demo:lesson11:openrouter:solution",
    "verify:my:lesson11:openrouter",
    "verify:my:lesson11:openrouter:scaffolding",
  ]) {
    if (!scripts[name]?.includes("run-tsx-entrypoint.mjs")) {
      failures.push(
        `script ${name} must use scripts/run-tsx-entrypoint.mjs for the native Windows tsx boundary.`,
      );
    }
  }
  requireScriptPath("build", "build:lesson11:openrouter");
  requireScriptPath("test", "test:lesson11:openrouter");
  requireScriptPath("test:watch", `${lesson}/starter/tests`);
  requireScriptPath("test:solution", "test:lesson11:openrouter:solution");
  requireScriptPath("eval", "eval:lesson11:openrouter");
  requireScriptPath("eval:solution", "eval:lesson11:openrouter:solution:offline");

  const requiredMarkers = [
    ["solution/src/agent-adapter.ts", "./services/content-review-graph.js"],
    ["solution/src/agent-adapter.ts", "ContentReviewService"],
    [
      "solution/src/model-contract.ts",
      'REPORT_MODEL_SOURCE = "INHERITED_FROM_PREVIOUS_OPENROUTER"',
    ],
    ["solution/src/model-contract.ts", "resolveEvaluationModels"],
    ["solution/src/model-contract.ts", "FAST_PROVIDER_SORT"],
    ["solution/src/model-contract.ts", "MAIN_PROVIDER_SORT"],
    ["solution/src/model-contract.ts", "JUDGE_PROVIDER_SORT"],
    ["solution/src/model-contract.ts", "FAST_PROMPT_CACHE_KEY"],
    ["solution/src/model-contract.ts", "MAIN_PROMPT_CACHE_KEY"],
    ["solution/src/model-contract.ts", "JUDGE_PROMPT_CACHE_KEY"],
    ["solution/src/model-contract.ts", "providerSort"],
    ["solution/src/model-contract.ts", "promptCacheKey"],
    ["solution/src/observed-openrouter-client.ts", "providerSort"],
    ["solution/src/observed-openrouter-client.ts", "hasPromptCacheKey"],
    ["solution/src/observed-openrouter-client.ts", "prompt_cache_key"],
    ["solution/src/judge.ts", "require_parameters: true"],
    ["solution/src/judge.ts", 'type: "json_schema"'],
    ["solution/src/judge.ts", "prompt_cache_key"],
    ["solution/src/judge.ts", "JUDGE_PROVIDER_SORT"],
    ["solution/src/judge.ts", "JUDGE_PROMPT_CACHE_KEY"],
    ["solution/src/evaluator.ts", "getRequestSignature"],
    ["solution/src/evaluator.ts", "usesIdenticalRequestConfiguration"],
    ["solution/src/report.ts", "providerSort"],
    ["solution/src/report.ts", "hasPromptCacheKey"],
    ["solution/src/report.ts", "sticky routing"],
    ["solution/evals/run-observability.ts", "JUDGE_PROVIDER_SORT"],
    ["solution/evals/run-observability.ts", "JUDGE_PROMPT_CACHE_KEY"],
    ["solution/evals/run-observability.ts", "--offline"],
    ["solution/evals/observability-cases.ts", "contentReviewEvalDataset"],
    ["solution/scripts/run-live-demo.ts", "hasPromptCacheKey"],
    ["solution/scripts/run-live-demo.ts", "не виводиться"],
  ] as const;

  for (const [relativePath, marker] of requiredMarkers) {
    const source = await readFile(join(lessonRoot, relativePath), "utf8");
    if (!source.includes(marker)) {
      failures.push(`${lesson}/${relativePath} не містить обов'язковий marker ${marker}.`);
    }
  }

  const inheritedEvalRoot = join(
    repositoryRoot,
    "lesson-10-langgraph-openrouter",
    "solution",
    "evals",
  );
  for (const relativePath of ["cases.ts", "run.ts"]) {
    const source = await readFile(join(inheritedEvalRoot, relativePath));
    const target = await readFile(join(lessonRoot, "solution", "evals", relativePath));
    if (!source.equals(target)) {
      failures.push(
        `${lesson}/solution/evals/${relativePath} is not byte-identical to inherited Lesson 10.`,
      );
    }
  }
  const modelContract = await readFile(
    join(lessonRoot, "solution", "src", "model-contract.ts"),
    "utf8",
  );
  if (/\b(?:fallbackModels|fallbackState|hasModels)\b/u.test(modelContract)) {
    failures.push(
      `${lesson}/solution/src/model-contract.ts contains prohibited fallback/family-validation state.`,
    );
  }

  for (const state of states) {
    const stateRoot = join(lessonRoot, state);
    const label = `${lesson}/${state}`;
    await requireDirectory(stateRoot, label);
    await requireDirectory(join(stateRoot, "src"), `${label}/src`);
    await requireDirectory(join(stateRoot, "tests"), `${label}/tests`);
    await requireDirectory(join(stateRoot, "evals"), `${label}/evals`);
    await requireFile(join(stateRoot, "README.md"), `${label}/README.md`);

    const summary = await inspectState(stateRoot, label, true);
    summaries.push(
      `PASS ${label}: ${summary.testFiles} test files, ${summary.activeTests} active, ` +
        `${summary.todoTests} todo, ${summary.evalFiles} eval files`,
    );
  }
}

async function inspectLesson12OpenRouterVariant(): Promise<void> {
  const { inspectLesson12OpenRouterCandidate } =
    await import("./verify-lesson12-openrouter-completion.js");
  const { inspectLesson12OpenRouterContinuity } =
    await import("./verify-lesson12-openrouter-continuity.js");
  const { inspectLesson12OpenRouterScaffolding } =
    await import("./verify-lesson12-openrouter-scaffolding.js");
  const lesson = "lesson-12-security-openrouter";
  const lessonRoot = join(repositoryRoot, lesson);
  await requireDirectory(lessonRoot, lesson);
  await requireDirectory(join(lessonRoot, "evals"), `${lesson}/evals`);
  await requireDirectory(join(lessonRoot, "checkpoints"), `${lesson}/checkpoints`);
  await requireFile(join(lessonRoot, "README.md"), `${lesson}/README.md`);
  await requireFile(join(lessonRoot, "homework.md"), `${lesson}/homework.md`);
  await requireFile(join(lessonRoot, "threat-model.md"), `${lesson}/threat-model.md`);
  await requireFile(join(lessonRoot, "evals", "README.md"), `${lesson}/evals/README.md`);
  await requireFile(
    join(lessonRoot, "checkpoints", "README.md"),
    `${lesson}/checkpoints/README.md`,
  );
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-12-openrouter.starter.build.json"),
    "tsconfig.lesson-12-openrouter.starter.build.json",
  );
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-12-openrouter.build.json"),
    "tsconfig.lesson-12-openrouter.build.json",
  );
  requireScriptPath("dev:lesson12:openrouter", `${lesson}/starter/`);
  requireScriptPath("dev:lesson12:openrouter:solution", `${lesson}/solution/`);
  requireScriptPath(
    "demo:lesson12:openrouter:solution",
    `${lesson}/solution/scripts/run-security-live-demo.ts`,
  );
  requireScriptPath("verify:lesson12:openrouter", "--lesson12-openrouter");
  requireScriptPath(
    "verify:lesson12:openrouter:scaffolding",
    "scripts/verify-lesson12-openrouter-scaffolding.ts",
  );
  requireScriptPath(
    "verify:lesson12:openrouter:continuity",
    "scripts/verify-lesson12-openrouter-continuity.ts",
  );
  requireScriptPath(
    "verify:lesson12:openrouter:catalog",
    `${lesson}/solution/scripts/verify-security-catalog.ts`,
  );
  requireScriptPath("test:lesson12:openrouter", `${lesson}/starter/tests`);
  requireScriptPath("test:lesson12:openrouter:solution", `${lesson}/solution/tests`);
  requireScriptPath("test:lesson12:openrouter:coverage", lesson);
  requireScriptPath(
    "eval:lesson12:openrouter",
    `${lesson}/starter/evals/run-observability.ts --offline`,
  );
  requireScriptPath(
    "eval:lesson12:openrouter:solution:offline",
    `${lesson}/solution/evals/run-security.ts --offline`,
  );
  requireScriptPath(
    "eval:lesson12:openrouter:solution:live",
    `${lesson}/solution/evals/run-security-live.ts`,
  );
  requireScriptPath(
    "build:lesson12:openrouter:starter",
    "tsconfig.lesson-12-openrouter.starter.build.json",
  );
  requireScriptPath(
    "build:lesson12:openrouter:solution",
    "tsconfig.lesson-12-openrouter.build.json",
  );
  requireScriptPath("build:lesson12:openrouter", "build:lesson12:openrouter:starter");
  requireScriptPath("build:lesson12:openrouter", "build:lesson12:openrouter:solution");
  requireScriptPath("check:lesson12:openrouter", "check:lesson12:openrouter:starter");
  requireScriptPath("check:lesson12:openrouter:solution", "verify:mvp:no-fallback:through12");
  requireScriptPath("check:lesson12:openrouter:solution", "audit:lesson12:openrouter");
  requireScriptPath("check:lesson12:openrouter:solution", "verify:lesson12:openrouter:continuity");
  requireScriptPath(
    "check:lesson12:openrouter:solution",
    "verify:lesson12:openrouter:completion lesson-12-security-openrouter/solution",
  );
  requireScriptPath("check:lesson12:openrouter:solution", "build:lesson12:openrouter:solution");

  const starterFailures = await inspectLesson12OpenRouterScaffolding(`${lesson}/starter`);
  const continuityFailures = await inspectLesson12OpenRouterContinuity(`${lesson}/solution`);
  const completionFailures = await inspectLesson12OpenRouterCandidate(`${lesson}/solution`);
  for (const [label, results] of [
    ["scaffolding", starterFailures],
    ["continuity", continuityFailures],
    ["completion", completionFailures],
  ] as const) {
    if (results.length === 1 && results[0]?.startsWith("PASS ")) summaries.push(results[0]);
    else for (const result of results) failures.push(`${lesson} ${label}: ${result}`);
  }
}

async function inspectLesson13OpenAiVariant(): Promise<void> {
  const lesson = "lesson-13-databases";
  const lessonRoot = join(repositoryRoot, lesson);
  await requireDirectory(lessonRoot, lesson);
  await requireDirectory(join(lessonRoot, "db"), `${lesson}/db`);
  await requireFile(join(lessonRoot, "README.md"), `${lesson}/README.md`);
  await requireFile(join(lessonRoot, "homework.md"), `${lesson}/homework.md`);
  await requireFile(join(lessonRoot, "docker-compose.yml"), `${lesson}/docker-compose.yml`);
  await requireFile(
    join(lessonRoot, "db", "migrations", "001_catalog.sql"),
    `${lesson}/db/migrations/001_catalog.sql`,
  );
  await requireFile(join(lessonRoot, "db", "seed.sql"), `${lesson}/db/seed.sql`);
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-13.build.json"),
    "tsconfig.lesson-13.build.json",
  );
  requireScriptPath("dev:lesson13", `${lesson}/starter/`);
  requireScriptPath("dev:lesson13:solution", `${lesson}/solution/`);
  requireScriptPath("verify:lesson13", "scripts/verify-lesson13-openai-completion.ts");
  requireScriptPath("verify:lesson13:scaffolding", "scripts/verify-lesson13-openai-scaffolding.ts");
  requireScriptPath("verify:lesson13:continuity", "scripts/verify-lesson13-openai-continuity.ts");
  requireScriptPath("test:lesson13", `${lesson}/starter/tests`);
  requireScriptPath("test:lesson13:solution", `${lesson}/solution/tests`);
  requireScriptPath("test:lesson13:integration", `${lesson}/solution/integration-tests`);
  requireScriptPath("eval:lesson13", `${lesson}/starter/evals/run.ts`);
  requireScriptPath("eval:lesson13:solution", "build:lesson13");
  requireScriptPath("build:lesson13", "tsconfig.lesson-13.build.json");
  requireScriptPath("check:lesson13", "verify:lesson13");
  requireScriptPath("check:lesson13:solution", "verify:lesson13:scaffolding");
  requireScriptPath("check:lesson13:solution", "verify:lesson13:continuity");
  requireScriptPath("db:lesson13:up", `${lesson}/docker-compose.yml`);
  requireScriptPath("db:lesson13:migrate", `${lesson}/solution/scripts/migrate.ts`);
  requireScriptPath("db:lesson13:seed", `${lesson}/solution/scripts/seed.ts`);

  const requiredMarkers = [
    ["solution/src/contracts.ts", "LESSON13_EMBEDDING_DIMENSIONS = 1536"],
    ["solution/src/catalog-agent.ts", "humanInTheLoopMiddleware"],
    ["solution/src/catalog-agent.ts", "update_product_stock"],
    ["solution/src/catalog-repository.ts", "embedding <=> $1::vector"],
    ["solution/src/contracts.ts", "text-embedding-3-small"],
    ["db/migrations/001_catalog.sql", "vector(1536)"],
  ] as const;
  for (const [relativePath, marker] of requiredMarkers) {
    const source = await readFile(join(lessonRoot, relativePath), "utf8");
    if (!source.includes(marker))
      failures.push(`${lesson}/${relativePath} не містить marker ${marker}.`);
  }

  for (const state of states) {
    const stateRoot = join(lessonRoot, state);
    const label = `${lesson}/${state}`;
    await requireDirectory(stateRoot, label);
    await requireDirectory(join(stateRoot, "src"), `${label}/src`);
    await requireDirectory(join(stateRoot, "tests"), `${label}/tests`);
    await requireDirectory(join(stateRoot, "evals"), `${label}/evals`);
    await requireFile(join(stateRoot, "README.md"), `${label}/README.md`);
    const summary = await inspectState(stateRoot, label, true);
    summaries.push(
      `PASS ${label}: ${summary.testFiles} test files, ${summary.activeTests} active, ${summary.todoTests} todo, ${summary.evalFiles} eval files`,
    );
  }
}

async function inspectLesson13OpenRouterVariant(): Promise<void> {
  const {
    inspectLesson13OpenRouterCandidate,
    inspectLesson13OpenRouterContinuity,
    inspectLesson13OpenRouterScaffolding,
  } = await import("./lesson13-openrouter-contract.js");
  const lesson = "lesson-13-databases-openrouter";
  const lessonRoot = join(repositoryRoot, lesson);
  await requireDirectory(lessonRoot, lesson);
  await requireDirectory(join(lessonRoot, "solution", "db"), `${lesson}/solution/db`);
  await requireDirectory(join(lessonRoot, "evals"), `${lesson}/evals`);
  await requireFile(join(lessonRoot, "README.md"), `${lesson}/README.md`);
  await requireFile(join(lessonRoot, "homework.md"), `${lesson}/homework.md`);
  await requireFile(
    join(lessonRoot, "solution", "docker-compose.yml"),
    `${lesson}/solution/docker-compose.yml`,
  );
  await requireFile(join(lessonRoot, "evals", "README.md"), `${lesson}/evals/README.md`);
  await requireFile(
    join(lessonRoot, "solution", "db", "migrations", "001_catalog.sql"),
    `${lesson}/solution/db/migrations/001_catalog.sql`,
  );
  await requireFile(
    join(lessonRoot, "solution", "db", "seed.sql"),
    `${lesson}/solution/db/seed.sql`,
  );
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-13-openrouter.starter.build.json"),
    "tsconfig.lesson-13-openrouter.starter.build.json",
  );
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-13-openrouter.build.json"),
    "tsconfig.lesson-13-openrouter.build.json",
  );
  requireScriptPath("dev:lesson13:openrouter", `${lesson}/starter/`);
  requireScriptPath("dev:lesson13:openrouter:solution", `${lesson}/solution/`);
  requireScriptPath("verify:lesson13:openrouter", "--lesson13-openrouter");
  requireScriptPath(
    "verify:lesson13:openrouter:scaffolding",
    "scripts/verify-lesson13-openrouter-scaffolding.ts",
  );
  requireScriptPath(
    "verify:lesson13:openrouter:continuity",
    "scripts/verify-lesson13-openrouter-continuity.ts",
  );
  requireScriptPath(
    "verify:lesson13:openrouter:catalog",
    `${lesson}/solution/scripts/verify-openrouter-catalog.ts`,
  );
  requireScriptPath("test:lesson13:openrouter", `${lesson}/starter/tests`);
  requireScriptPath("test:lesson13:openrouter:solution", `${lesson}/solution/tests`);
  requireScriptPath("test:lesson13:openrouter:coverage", lesson);
  requireScriptPath("eval:lesson13:openrouter", `${lesson}/starter/evals/run.ts`);
  requireScriptPath("eval:lesson13:openrouter:solution", `${lesson}/solution/evals/run.ts`);
  requireScriptPath(
    "build:lesson13:openrouter:starter",
    "tsconfig.lesson-13-openrouter.starter.build.json",
  );
  requireScriptPath(
    "build:lesson13:openrouter:solution",
    "tsconfig.lesson-13-openrouter.build.json",
  );
  requireScriptPath("build:lesson13:openrouter", "build:lesson13:openrouter:starter");
  requireScriptPath("build:lesson13:openrouter", "build:lesson13:openrouter:solution");
  requireScriptPath("check:lesson13:openrouter", "check:lesson13:openrouter:starter");
  requireScriptPath("check:lesson13:openrouter:solution", "test:lesson13:openrouter:solution");
  requireScriptPath("check:lesson13:openrouter:solution", "verify:lesson13:openrouter:completion");
  requireScriptPath("db:lesson13:openrouter:up", `${lesson}/solution/docker-compose.yml`);
  requireScriptPath("db:lesson13:openrouter:migrate", "solution/scripts/migrate-catalog.ts");
  requireScriptPath("db:lesson13:openrouter:seed", "solution/scripts/seed-catalog.ts");

  const requiredMarkers = [
    ["solution/src/model-contract.ts", "./config/models.js"],
    ["solution/src/model-contract.ts", "INHERITED_FROM_PREVIOUS_OPENROUTER"],
    ["solution/src/model-contract.ts", "./config/openrouter.js"],
    ["solution/src/catalog-agent.ts", "./security.js"],
    ["solution/src/catalog-embeddings.ts", "maxRetries: options.maxRetries ?? 0"],
    ["solution/src/catalog-embeddings.ts", "OpenRouterEmbeddingProvider"],
    ["solution/src/catalog-repository.ts", "embedding <=> $1::vector"],
    ["solution/evals/catalog-run.ts", "catalogEvalDataset"],
    ["solution/db/migrations/001_catalog.sql", "openai/text-embedding-3-small"],
  ] as const;
  for (const [relativePath, marker] of requiredMarkers) {
    const source = await readFile(join(lessonRoot, relativePath), "utf8");
    if (!source.includes(marker))
      failures.push(`${lesson}/${relativePath} не містить marker ${marker}.`);
  }
  const starterContract = await inspectLesson13OpenRouterScaffolding(`${lesson}/starter`);
  const continuityContract = await inspectLesson13OpenRouterContinuity(`${lesson}/solution`);
  const completionContract = await inspectLesson13OpenRouterCandidate(`${lesson}/solution`);
  for (const [label, results] of [
    ["scaffolding", starterContract],
    ["continuity", continuityContract],
    ["completion", completionContract],
  ] as const) {
    if (results.length === 0) summaries.push(`PASS ${lesson} ${label}: strict contract validated`);
    else for (const result of results) failures.push(`${lesson} ${label}: ${result}`);
  }
  for (const state of states) {
    const stateRoot = join(lessonRoot, state);
    const label = `${lesson}/${state}`;
    await requireDirectory(stateRoot, label);
    await requireDirectory(join(stateRoot, "src"), `${label}/src`);
    await requireDirectory(join(stateRoot, "tests"), `${label}/tests`);
    await requireDirectory(join(stateRoot, "evals"), `${label}/evals`);
    await requireFile(join(stateRoot, "README.md"), `${label}/README.md`);
    const summary = await inspectState(stateRoot, label, true);
    if (state === "starter") {
      const canonical = summary.activeTests === 8 && summary.todoTests === 5;
      const completed = summary.activeTests >= 13 && summary.todoTests === 0;
      if (!canonical && !completed)
        failures.push(
          `${label} має бути canonical (8 active, 5 todo) або completed (>=13 active, 0 todo); отримано ${summary.activeTests}/${summary.todoTests}.`,
        );
    }
    summaries.push(
      `PASS ${label}: ${summary.testFiles} test files, ${summary.activeTests} active, ${summary.todoTests} todo, ${summary.evalFiles} eval files`,
    );
  }
}
async function inspectLesson14OpenAiVariant(): Promise<void> {
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-14.starter.build.json"),
    "tsconfig.lesson-14.starter.build.json",
  );
  requireScriptPath("verify:lesson14", "scripts/assert-starter-complete.ts");
  requireScriptPath("verify:lesson14", "scripts/verify-lesson14-openai-completion.ts");
  requireScriptPath("verify:lesson14:scaffolding", "scripts/verify-lesson14-openai-scaffolding.ts");
  requireScriptPath("verify:lesson14:continuity", "scripts/verify-lesson14-openai-continuity.ts");
  requireScriptPath("check:lesson14", "verify:lesson14");
  requireScriptPath("check:lesson14:solution", "verify:lesson14:scaffolding");
  requireScriptPath("check:lesson14:solution", "verify:lesson14:continuity");
  requireScriptPath("build:lesson14", "build:lesson14:starter");
}

async function inspectLesson14OpenRouterVariant(): Promise<void> {
  const { inspectLesson14OpenRouterCandidate, lesson14OpenRouter } =
    await import("./lesson14-openrouter-contract.js");
  const lesson = lesson14OpenRouter;
  const lessonRoot = join(repositoryRoot, lesson);
  await requireDirectory(lessonRoot, lesson);

  for (const publicDocument of [
    "README.md",
    "homework.md",
    "student-guide.md",
    "starter-code-guide.md",
    "roadmap-code-guide.md",
    "dev-migration-guide.md",
    "checkpoints/README.md",
    "evals/README.md",
    "starter/README.md",
    "solution/README.md",
  ])
    await requireFile(join(lessonRoot, publicDocument), `${lesson}/${publicDocument}`);

  for (const config of [
    "tsconfig.lesson-14-openrouter.starter.build.json",
    "tsconfig.lesson-14-openrouter.build.json",
    "tsconfig.lesson-14-openrouter.client.json",
  ])
    await requireFile(join(repositoryRoot, config), config);

  const starterFailures = await inspectLesson14OpenRouterCandidate(`${lesson}/starter`, "starter");
  const solutionFailures = await inspectLesson14OpenRouterCandidate(
    `${lesson}/solution`,
    "solution",
  );
  failures.push(...starterFailures.map((failure) => `${lesson}/starter: ${failure}`));
  failures.push(...solutionFailures.map((failure) => `${lesson}/solution: ${failure}`));

  requireScriptPath("dev:lesson14:openrouter:api", `${lesson}/solution/src/lesson14/server.ts`);
  requireScriptPath(
    "dev:lesson14:openrouter:solution",
    `${lesson}/solution/src/lesson14/server.ts`,
  );
  requireScriptPath(
    "start:lesson14:openrouter:solution",
    `${lesson}/solution/src/lesson14/server.ts`,
  );
  requireScriptPath("dev:lesson14:openrouter:web", `${lesson}/solution/client/vite.config.ts`);
  requireScriptPath("verify:mvp:no-fallback:through14", "--through 14");
  requireScriptPath(
    "verify:lesson14:openrouter",
    "scripts/verify-lesson14-openrouter-completion.ts",
  );
  requireScriptPath("verify:lesson14:openrouter:scaffolding", "audit:lesson14:openrouter");
  requireScriptPath("audit:lesson14:openrouter", "--lesson14-openrouter");
  requireScriptPath(
    "verify:lesson14:openrouter:continuity",
    "scripts/verify-lesson14-openrouter-continuity.ts",
  );
  requireScriptPath("test:lesson14:openrouter:solution", `${lesson}/solution/tests`);
  requireScriptPath("test:lesson14:openrouter:integration", `${lesson}/solution/integration-tests`);
  requireScriptPath(
    "test:lesson14:openrouter:integration",
    "--maxWorkers=1 --fileParallelism=false",
  );
  requireScriptPath(
    "eval:lesson14:openrouter:solution",
    "scripts/verify-lesson14-openrouter-inherited-evals.ts",
  );
  requireScriptPath(
    "build:lesson14:openrouter:starter",
    "tsconfig.lesson-14-openrouter.starter.build.json",
  );
  requireScriptPath(
    "build:lesson14:openrouter:solution",
    "tsconfig.lesson-14-openrouter.build.json",
  );
  requireScriptPath("build:lesson14:openrouter:web", `${lesson}/solution/client/vite.config.ts`);
  requireScriptPath("check:dev:lesson14:openrouter", "verify:lesson14:openrouter:dev");
  requireScriptPath("check:lesson14:openrouter:solution", "verify:lesson14:openrouter");

  for (const obsolete of [
    "demo:lesson14:openrouter:solution",
    "eval:lesson14:openrouter:solution:live",
    "verify:lesson14:openrouter:catalog",
  ])
    if (scripts[obsolete] !== undefined)
      failures.push(`obsolete live/catalog alias must be removed: ${obsolete}`);

  summaries.push(
    `PASS ${lesson}: source-bound 202-file foundation, foundation-only starter, exact namespaced solution delta.`,
  );
}
async function inspectLesson15OpenRouterVariant(): Promise<void> {
  const { inspectLesson15OpenRouterCandidate, lesson15OpenRouter } =
    await import("./lesson15-openrouter-contract.js");
  const lesson = lesson15OpenRouter;
  const lessonRoot = join(repositoryRoot, lesson);
  await requireDirectory(lessonRoot, lesson);
  for (const document of [
    "README.md",
    "homework.md",
    "student-guide.md",
    "starter-code-guide.md",
    "roadmap-code-guide.md",
    "dev-migration-guide.md",
    "checkpoints/README.md",
    "evals/README.md",
    "starter/README.md",
    "solution/README.md",
  ])
    await requireFile(join(lessonRoot, document), `${lesson}/${document}`);
  for (const config of [
    "tsconfig.lesson-15-openrouter.starter.build.json",
    "tsconfig.lesson-15-openrouter.build.json",
    "tsconfig.lesson-15-openrouter.client.json",
  ])
    await requireFile(join(repositoryRoot, config), config);

  // The structural audit also accepts a completed student starter.
  for (const [state, kind] of [
    ["starter", "structural"],
    ["solution", "solution"],
  ] as const) {
    const candidateFailures = await inspectLesson15OpenRouterCandidate(`${lesson}/${state}`, kind);
    failures.push(...candidateFailures.map((failure) => `${lesson}/${state}: ${failure}`));
  }
  for (const state of ["starter", "solution"] as const) {
    const apiAlias =
      state === "starter" ? "dev:lesson15:openrouter:api" : "dev:lesson15:openrouter:solution:api";
    const webAlias =
      state === "starter" ? "dev:lesson15:openrouter:web" : "dev:lesson15:openrouter:solution:web";
    requireScriptPath(apiAlias, `${lesson}/${state}/src/lesson14/server.ts`);
    requireScriptPath(apiAlias, "scripts/run-tsx-entrypoint.mjs");
    requireScriptPath(webAlias, `${lesson}/${state}/client/vite.config.ts`);
  }
  requireScriptPath("dev:lesson15:openrouter:dev", "dev/src/lesson14/server.ts");
  requireScriptPath("dev:lesson15:openrouter:dev", "dev/client/vite.config.ts");
  requireScriptPath("verify:mvp:no-fallback:through15", "--through 15");
  requireScriptPath("audit:lesson15:openrouter", "--lesson15-openrouter");
  requireScriptPath(
    "verify:lesson15:openrouter",
    "scripts/verify-lesson15-openrouter-completion.ts",
  );
  requireScriptPath("verify:lesson15:openrouter", `${lesson}/starter`);
  requireScriptPath(
    "verify:lesson15:openrouter:completion",
    "scripts/verify-lesson15-openrouter-completion.ts",
  );
  requireScriptPath("verify:lesson15:openrouter:completion", `${lesson}/starter`);
  requireScriptPath(
    "verify:lesson15:openrouter:solution:completion",
    "scripts/verify-lesson15-openrouter-completion.ts",
  );
  requireScriptPath("verify:lesson15:openrouter:solution:completion", `${lesson}/solution`);
  requireScriptPath(
    "verify:lesson15:openrouter:scaffolding",
    "scripts/verify-lesson15-openrouter-scaffolding.ts",
  );
  requireScriptPath(
    "verify:lesson15:openrouter:continuity",
    "scripts/verify-lesson15-openrouter-continuity.ts",
  );
  requireScriptPath("verify:lesson15:openrouter:model", "verify:mvp:no-fallback:through15");
  requireScriptPath(
    "verify:lesson15:openrouter:model",
    "scripts/verify-lesson15-openrouter-model.ts",
  );
  requireScriptPath("test:lesson15:openrouter:solution", `${lesson}/solution/tests`);
  requireScriptPath(
    "test:lesson15:openrouter:integration",
    "--maxWorkers=1 --fileParallelism=false",
  );
  requireScriptPath("test:lesson15:openrouter:integration", `${lesson}/solution/integration-tests`);
  requireScriptPath(
    "eval:lesson15:openrouter:solution",
    "scripts/verify-lesson15-openrouter-inherited-evals.ts",
  );
  requireScriptPath(
    "db:lesson15:openrouter:migrate",
    `${lesson}/solution/scripts/lesson14/migrate-chat.ts`,
  );
  requireScriptPath(
    "build:lesson15:openrouter:starter:api",
    "tsconfig.lesson-15-openrouter.starter.build.json",
  );
  requireScriptPath(
    "build:lesson15:openrouter:solution:api",
    "tsconfig.lesson-15-openrouter.build.json",
  );
  requireScriptPath(
    "build:lesson15:openrouter:solution:web",
    `${lesson}/solution/client/vite.config.ts`,
  );
  requireScriptPath("check:lesson15:openrouter:solution", "audit:lesson15:openrouter");
  requireScriptPath(
    "check:lesson15:openrouter:solution",
    "verify:lesson15:openrouter:solution:completion",
  );
  requireScriptPath("check:dev:lesson15:openrouter", "verify:lesson15:openrouter:dev");
  requireScriptPath(
    "check:dev:lesson15:openrouter:starter",
    "verify:lesson15:openrouter:dev:starter",
  );
  for (const obsolete of [
    "demo:lesson15:openrouter:solution",
    "eval:lesson15:openrouter:solution:live",
    "verify:lesson15:openrouter:catalog",
  ])
    if (scripts[obsolete] !== undefined)
      failures.push(`obsolete Lesson 15 live/catalog alias must be removed: ${obsolete}`);
  summaries.push(
    `PASS ${lesson}: unchanged 236-file Lesson 14 foundation; only six release-candidate documents are new.`,
  );
}

async function inspectOpenAiScaffolding(): Promise<void> {
  requireScriptPath("verify:lesson03", "lesson-03-function-calling/starter/tests");
  requireScriptPath("check:lesson03", "verify:lesson03");
  requireScriptPath("check:lesson03:solution", "audit:structure");
  requireScriptPath("verify:lesson05", "lesson-05-memory/starter/tests");
  requireScriptPath("check:lesson05", "verify:lesson05");
  requireScriptPath("verify:lesson07", "lesson-07-agent-loop/starter/tests");
  requireScriptPath("check:lesson07", "test:lesson06:solution");
  requireScriptPath("check:lesson07", "eval:lesson06:solution");
  requireScriptPath("check:lesson07", "verify:lesson07");
  requireScriptPath("check:lesson07", "build:lesson07:starter");
  requireScriptPath("check:lesson07:solution", "test:lesson07:solution");
  requireScriptPath("check:lesson07:solution", "build:lesson07:solution");
  requireScriptPath("build:lesson07", "build:lesson07:starter");
  requireScriptPath("build:lesson07", "build:lesson07:solution");
  requireScriptPath("verify:lesson08", "lesson-08-multi-agent-workflow/starter/tests");
  requireScriptPath("check:lesson08", "test:lesson07:solution");
  requireScriptPath("check:lesson08", "eval:lesson07:solution");
  requireScriptPath("check:lesson08", "verify:lesson08");
  requireScriptPath("check:lesson08", "build:lesson08:starter");
  requireScriptPath("check:lesson08:solution", "test:lesson08:solution");
  requireScriptPath("check:lesson08:solution", "build:lesson08:solution");
  requireScriptPath("build:lesson08", "build:lesson08:starter");
  requireScriptPath("build:lesson08", "build:lesson08:solution");
  requireScriptPath("verify:openai:scaffolding", "scripts/verify-openai-starter-contracts.ts");
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-07.starter.build.json"),
    "tsconfig.lesson-07.starter.build.json",
  );
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-08.starter.build.json"),
    "tsconfig.lesson-08.starter.build.json",
  );

  const openAiSolutions = [
    "lesson-01-intro",
    "lesson-02-llm-api",
    "lesson-03-function-calling",
    "lesson-04-mcp-built-in-tools",
    "lesson-05-memory",
    "lesson-06-rag",
    "lesson-07-agent-loop",
    "lesson-08-multi-agent-workflow",
  ] as const;

  for (const lesson of openAiSolutions) {
    const solutionTests = (
      await listFiles(join(repositoryRoot, lesson, "solution", "tests"))
    ).filter((file) => /\.test\.tsx?$/u.test(file));

    for (const testFile of solutionTests) {
      const source = await readFile(testFile, "utf8");
      const unfinishedCount =
        source.match(/\b(?:it|test|describe)\.(?:todo|skip|skipIf|runIf)\s*\(/gu)?.length ?? 0;

      if (unfinishedCount > 0) {
        failures.push(
          `${relative(repositoryRoot, testFile)} містить ${unfinishedCount} todo/skip/conditional test declarations.`,
        );
      }
    }
  }

  summaries.push(
    "PASS OpenAI scaffolding: lesson scripts and clean solution tests verified; canonical inheritance and starter markers are checked by the dedicated verifier",
  );
}

async function inspectOpenRouterScaffolding(): Promise<void> {
  requireScriptPath(
    "verify:openrouter:scaffolding",
    "scripts/verify-openrouter-starter-contracts.ts",
  );
  const lesson02SolutionRoot = join(repositoryRoot, "lesson-02-llm-api-openrouter", "solution");
  const lesson03StarterRoot = join(
    repositoryRoot,
    "lesson-03-function-calling-openrouter",
    "starter",
  );
  const lessonSpecificDocuments = new Set(["README.md", "evals/README.md"]);
  const lesson02Files = await listFiles(lesson02SolutionRoot);
  const lesson03Files = await listFiles(lesson03StarterRoot);
  const lesson02RelativeFiles = new Set(
    lesson02Files.map((file) => relative(lesson02SolutionRoot, file).replaceAll("\\", "/")),
  );
  const lesson03RelativeFiles = new Set(
    lesson03Files.map((file) => relative(lesson03StarterRoot, file).replaceAll("\\", "/")),
  );
  let exactInheritedFileCount = 0;
  let documentedDocumentExceptions = 0;

  for (const relativePath of lesson02RelativeFiles) {
    if (lessonSpecificDocuments.has(relativePath)) {
      if (!lesson03RelativeFiles.has(relativePath)) {
        failures.push(`OpenRouter required lesson-specific document is missing: ${relativePath}.`);
      } else {
        documentedDocumentExceptions += 1;
      }
      continue;
    }

    if (!lesson03RelativeFiles.has(relativePath)) {
      failures.push(
        `OpenRouter inheritance regression: lesson-03 starter is missing L02 solution file ${relativePath}.`,
      );
      continue;
    }

    const lesson02Source = await readFile(join(lesson02SolutionRoot, relativePath));
    const lesson03Source = await readFile(join(lesson03StarterRoot, relativePath));

    if (!lesson02Source.equals(lesson03Source)) {
      failures.push(
        `OpenRouter inheritance drift: lesson-03 starter/${relativePath} differs byte-for-byte from lesson-02 solution/${relativePath}.`,
      );
    } else {
      exactInheritedFileCount += 1;
    }
  }

  for (const relativePath of lesson03RelativeFiles) {
    if (!lesson02RelativeFiles.has(relativePath)) {
      failures.push(
        `OpenRouter inheritance drift: lesson-03 starter/${relativePath} is not part of the L02 solution tree.`,
      );
    }
  }

  const openRouterSolutions = [
    "lesson-01-intro-openrouter",
    "lesson-02-llm-api-openrouter",
    "lesson-03-function-calling-openrouter",
    "lesson-04-mcp-built-in-tools-openrouter",
    "lesson-05-memory-openrouter",
    "lesson-06-rag-openrouter",
    "lesson-07-agent-loop-openrouter",
    "lesson-08-multi-agent-workflow-openrouter",
    "lesson-09-openai-agents-sdk-openrouter",
    "lesson-10-langgraph-openrouter",
  ] as const;

  for (const lesson of openRouterSolutions) {
    const solutionTests = (
      await listFiles(join(repositoryRoot, lesson, "solution", "tests"))
    ).filter((file) => /\.test\.tsx?$/u.test(file));

    for (const testFile of solutionTests) {
      const source = await readFile(testFile, "utf8");
      const unfinishedCount =
        source.match(/\b(?:it|test|describe)\.(?:todo|skip|skipIf|runIf)\s*\(/gu)?.length ?? 0;

      if (unfinishedCount > 0) {
        failures.push(
          `${relative(repositoryRoot, testFile)} містить ${unfinishedCount} todo/skip/conditional test declarations.`,
        );
      }
    }
  }

  summaries.push(
    `PASS OpenRouter scaffolding: Lesson 03 starter inherits ${exactInheritedFileCount} L02 solution files byte-for-byte; ` +
      `${documentedDocumentExceptions} lesson-specific Markdown exceptions are present; ` +
      "solutions have no todo or skipped tests; canonical starter markers are checked by the dedicated verifier",
  );
}

async function inspectLesson03OpenRouterVariant(): Promise<void> {
  const lesson = "lesson-03-function-calling-openrouter";
  const lessonRoot = join(repositoryRoot, lesson);

  await requireDirectory(lessonRoot, lesson);
  await requireFile(join(lessonRoot, "homework.md"), `${lesson}/homework.md`);
  await requireFile(join(lessonRoot, "README.md"), `${lesson}/README.md`);
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-03-openrouter.build.json"),
    "tsconfig.lesson-03-openrouter.build.json",
  );

  requireScriptPath("dev:lesson03:openrouter", `${lesson}/starter/`);
  requireScriptPath("dev:lesson03:openrouter:solution", `${lesson}/solution/`);
  requireScriptPath("verify:lesson03:openrouter", "--lesson03-openrouter");
  requireScriptPath("verify:lesson03:openrouter", `${lesson}/starter`);
  requireScriptPath("test:lesson03:openrouter", `${lesson}/starter/tests`);
  requireScriptPath("test:lesson03:openrouter:solution", `${lesson}/solution/tests`);
  requireScriptPath("test:lesson03:openrouter:coverage", lesson);
  requireScriptPath("eval:lesson03:openrouter", `${lesson}/starter/evals`);
  requireScriptPath("eval:lesson03:openrouter:solution", `${lesson}/solution/evals`);
  requireScriptPath("eval:lesson03:openrouter:solution:live", `${lesson}/solution/evals`);
  requireScriptPath("build:lesson03:openrouter", "tsconfig.lesson-03-openrouter.build.json");
  requireScriptPath("check:lesson03:openrouter", "verify:lesson03:openrouter");
  requireScriptPath("check:lesson03:openrouter:solution", "test:lesson03:openrouter:solution");
  requireScriptPath("check:lesson03:openrouter:solution", "build:lesson03:openrouter");
  requireScriptPath("build", "build:lesson03:openrouter");
  requireScriptPath("test", "test:lesson03:openrouter");
  requireScriptPath("test:watch", `${lesson}/starter/tests`);
  requireScriptPath("test:solution", "test:lesson03:openrouter:solution");
  requireScriptPath("eval", "eval:lesson03:openrouter");
  requireScriptPath("eval:solution", "eval:lesson03:openrouter:solution");

  for (const state of states) {
    const stateRoot = join(lessonRoot, state);
    const label = `${lesson}/${state}`;

    await requireDirectory(stateRoot, label);
    await requireDirectory(join(stateRoot, "src"), `${label}/src`);
    await requireDirectory(join(stateRoot, "tests"), `${label}/tests`);
    await requireDirectory(join(stateRoot, "evals"), `${label}/evals`);
    await requireFile(join(stateRoot, "README.md"), `${label}/README.md`);
    await requireFile(join(stateRoot, "final-project-ideas.md"), `${label}/final-project-ideas.md`);

    const summary = await inspectState(stateRoot, label, true);
    summaries.push(
      `PASS ${label}: ${summary.testFiles} test files, ` +
        `${summary.activeTests} active, ${summary.todoTests} todo, ` +
        `${summary.evalFiles} eval files`,
    );
  }
}

async function inspectLesson14And15Separation(): Promise<void> {
  const lesson14Solution = join(repositoryRoot, "lesson-14-react-sse", "solution");
  const lesson15Starter = join(repositoryRoot, "lesson-15-final-project-workshop", "starter");
  const lesson15Solution = join(repositoryRoot, "lesson-15-final-project-workshop", "solution");
  const rcArtifacts = [
    "ARCHITECTURE.md",
    "PRODUCTION_READINESS.md",
    "SECURITY.md",
    "EVAL_REPORT.md",
    "KNOWN_LIMITATIONS.md",
    "DEMO_PLAN.md",
  ] as const;

  for (const artifact of rcArtifacts) {
    await requireAbsentFile(
      join(lesson14Solution, artifact),
      `lesson-14-react-sse/solution/${artifact}`,
    );
    await requireAbsentFile(
      join(lesson15Starter, artifact),
      `lesson-15-final-project-workshop/starter/${artifact}`,
    );
    await requireFile(
      join(lesson15Solution, artifact),
      `lesson-15-final-project-workshop/solution/${artifact}`,
    );
  }

  await requireTextAbsent(lesson14Solution, "LESSON15_", "Lesson 14 solution");
  await requireTextAbsent(lesson15Solution, "LESSON14_", "Lesson 15 solution");
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL ${failure}`);
  }

  process.exitCode = 1;
} else {
  for (const summary of summaries) {
    console.log(summary);
  }

  console.log(
    "PASS course contract: Lectures 01–16, practical Lessons 01–15 and the official OpenAI/OpenRouter variants are complete",
  );
}

async function inspectOpenRouterVariant(): Promise<void> {
  const lesson = "lesson-01-intro-openrouter";
  const lessonRoot = join(repositoryRoot, lesson);

  await requireDirectory(lessonRoot, lesson);
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-01-openrouter.build.json"),
    "tsconfig.lesson-01-openrouter.build.json",
  );

  requireScriptPath("dev:lesson01:openrouter", `${lesson}/starter/`);
  requireScriptPath("dev:lesson01:openrouter:solution", `${lesson}/solution/`);
  requireScriptPath("test:lesson01:openrouter", `${lesson}/starter/tests`);
  requireScriptPath("verify:lesson01:openrouter", `${lesson}/starter/tests`);
  requireScriptPath("test:lesson01:openrouter:solution", `${lesson}/solution/tests`);
  requireScriptPath("test:lesson01:openrouter:coverage", lesson);
  requireScriptPath("build:lesson01:openrouter", "tsconfig.lesson-01-openrouter.build.json");
  requireScriptPath("check:lesson01:openrouter", "verify:lesson01:openrouter");
  requireScriptPath("check:lesson01:openrouter:solution", "test:lesson01:openrouter:solution");
  requireScriptPath("check:lesson01:openrouter:solution", "build:lesson01:openrouter");
  requireScriptPath("build", "build:lesson01:openrouter");
  requireScriptPath("test", "test:lesson01:openrouter");
  requireScriptPath("test:watch", `${lesson}/starter/tests`);
  requireScriptPath("test:solution", "test:lesson01:openrouter:solution");

  for (const state of states) {
    const stateRoot = join(lessonRoot, state);
    const label = `${lesson}/${state}`;

    await requireDirectory(stateRoot, label);
    await requireDirectory(join(stateRoot, "src"), `${label}/src`);
    await requireDirectory(join(stateRoot, "tests"), `${label}/tests`);
    await requireDirectory(join(stateRoot, "evals"), `${label}/evals`);
    await requireFile(join(stateRoot, "README.md"), `${label}/README.md`);

    const summary = await inspectState(stateRoot, label, true);
    summaries.push(
      `PASS ${label}: ${summary.testFiles} test files, ` +
        `${summary.activeTests} active, ${summary.todoTests} todo, ` +
        `${summary.evalFiles} eval files`,
    );
  }
}

async function inspectLesson02OpenRouterVariant(): Promise<void> {
  const lesson = "lesson-02-llm-api-openrouter";
  const lessonRoot = join(repositoryRoot, lesson);

  await requireDirectory(lessonRoot, lesson);
  await requireFile(join(lessonRoot, "homework.md"), `${lesson}/homework.md`);
  await requireFile(join(lessonRoot, "README.md"), `${lesson}/README.md`);
  await requireDirectory(join(lessonRoot, "checkpoints"), `${lesson}/checkpoints`);
  await requireDirectory(
    join(lessonRoot, "checkpoints", "01-streaming"),
    `${lesson}/checkpoints/01-streaming`,
  );
  await requireFile(
    join(repositoryRoot, "tsconfig.lesson-02-openrouter.build.json"),
    "tsconfig.lesson-02-openrouter.build.json",
  );

  requireScriptPath("dev:lesson02:openrouter", `${lesson}/starter/`);
  requireScriptPath("dev:lesson02:openrouter:solution", `${lesson}/solution/`);
  requireScriptPath("verify:lesson02:openrouter", `${lesson}/starter/tests`);
  requireScriptPath("test:lesson02:openrouter", `${lesson}/starter/tests`);
  requireScriptPath("test:lesson02:openrouter:solution", `${lesson}/solution/tests`);
  requireScriptPath("test:lesson02:openrouter:coverage", lesson);
  requireScriptPath("test:lesson02:openrouter:checkpoints", `${lesson}/checkpoints`);
  requireScriptPath("eval:lesson02:openrouter", `${lesson}/starter/evals`);
  requireScriptPath("eval:lesson02:openrouter:solution", `${lesson}/solution/evals`);
  requireScriptPath("eval:lesson02:openrouter:solution:live", `${lesson}/solution/evals`);
  requireScriptPath("build:lesson02:openrouter", "tsconfig.lesson-02-openrouter.build.json");
  requireScriptPath("check:lesson02:openrouter", "verify:lesson02:openrouter");
  requireScriptPath("check:lesson02:openrouter:solution", "test:lesson02:openrouter:solution");
  requireScriptPath("check:lesson02:openrouter:solution", "build:lesson02:openrouter");
  requireScriptPath("build", "build:lesson02:openrouter");
  requireScriptPath("test", "test:lesson02:openrouter");
  requireScriptPath("test:watch", `${lesson}/starter/tests`);
  requireScriptPath("test:solution", "test:lesson02:openrouter:solution");
  requireScriptPath("test:checkpoints", `${lesson}/checkpoints`);
  requireScriptPath("eval", "eval:lesson02:openrouter");
  requireScriptPath("eval:solution", "eval:lesson02:openrouter:solution");

  for (const state of states) {
    const stateRoot = join(lessonRoot, state);
    const label = `${lesson}/${state}`;

    await requireDirectory(stateRoot, label);
    await requireDirectory(join(stateRoot, "src"), `${label}/src`);
    await requireDirectory(join(stateRoot, "tests"), `${label}/tests`);
    await requireDirectory(join(stateRoot, "evals"), `${label}/evals`);
    await requireFile(join(stateRoot, "README.md"), `${label}/README.md`);
    await requireFile(join(stateRoot, "final-project-ideas.md"), `${label}/final-project-ideas.md`);

    const summary = await inspectState(stateRoot, label, true);
    summaries.push(
      `PASS ${label}: ${summary.testFiles} test files, ` +
        `${summary.activeTests} active, ${summary.todoTests} todo, ` +
        `${summary.evalFiles} eval files`,
    );
  }
}

async function inspectState(
  stateRoot: string,
  label: string,
  requiresEvalDirectory: boolean,
): Promise<StateSummary> {
  const sourceFiles = (await listFiles(join(stateRoot, "src"))).filter((file) =>
    file.endsWith(".ts"),
  );
  const testFiles = (await listFiles(join(stateRoot, "tests"))).filter((file) =>
    /\.test\.tsx?$/u.test(file),
  );
  const evalFiles = await listFiles(join(stateRoot, "evals"));

  if (sourceFiles.length === 0) {
    failures.push(`${label}/src не містить TypeScript-файлів.`);
  }

  if (testFiles.length === 0) {
    failures.push(`${label}/tests не містить *.test.ts або *.test.tsx.`);
  }

  if (requiresEvalDirectory && evalFiles.length === 0) {
    failures.push(`${label}/evals є порожньою.`);
  }

  let activeTests = 0;
  let todoTests = 0;

  for (const testFile of testFiles) {
    const source = await readFile(testFile, "utf8");
    const counts = countDirectTestCalls(source, testFile);
    activeTests += counts.active;
    todoTests += counts.todo;
  }

  if (activeTests + todoTests === 0) {
    failures.push(`${label}/tests не містить тестових сценаріїв.`);
  }

  if (label.endsWith("/solution") && activeTests === 0) {
    failures.push(`${label}/tests не містить активних тестів.`);
  }

  if (label.endsWith("/solution") && todoTests > 0) {
    failures.push(`${label}/tests містить ${todoTests} незавершених todo-тестів.`);
  }

  return {
    testFiles: testFiles.length,
    activeTests,
    todoTests,
    evalFiles: evalFiles.length,
  };
}

async function inspectLectureModule(lectureDirectory: string): Promise<void> {
  const lectureRoot = join(courseRoot, lectureDirectory);
  const actualRootFiles = (await readdir(lectureRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /^\d{2} .+\.md$/u.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "uk"));
  const expectedRootFiles = [...expectedLectureRootFiles];

  if (JSON.stringify(actualRootFiles) !== JSON.stringify(expectedRootFiles)) {
    failures.push(`${lectureDirectory}: кореневі файли не відповідають послідовності 01–06.`);
  }

  for (const rootFile of expectedRootFiles) {
    const source = await readFile(join(lectureRoot, rootFile), "utf8").catch(() => "");
    const lines = source.split(/\r?\n/);
    const navigationCount = lines.filter((line) => line === moduleNavigationTitle).length;

    if (
      lines[0] !== moduleNavigationTitle ||
      lines[1] !== moduleNavigationLinks ||
      lines[2] !== ""
    ) {
      failures.push(`${lectureDirectory}/${rootFile}: некоректна коренева навігація.`);
    }

    if (navigationCount !== 1) {
      failures.push(`${lectureDirectory}/${rootFile}: коренева навігація має з’являтися один раз.`);
    }

    if ((source.match(/^# /gm) ?? []).length !== 1) {
      failures.push(`${lectureDirectory}/${rootFile}: очікується рівно один H1.`);
    }
  }

  const topicRoot = join(lectureRoot, "lecture");
  const topicFiles = (await readdir(topicRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "uk"));
  const moc = await readFile(join(lectureRoot, "03 Конспект лекції.md"), "utf8");
  const requiresEncodedMarkdownMoc =
    lectureDirectory.startsWith("08.") || lectureDirectory.startsWith("10.");
  const mocLinks = requiresEncodedMarkdownMoc
    ? [...moc.matchAll(/\]\((lecture\/[^)]+\.md)\)/g)].map((match) => match[1] ?? "")
    : [...moc.matchAll(/\[\[(lecture\/[^|\]]+)(?:\|[^\]]+)?\]\]|\]\((lecture\/[^)]+\.md)\)/g)].map(
        (match) => {
          const target = decodeURIComponent(match[1] ?? match[2] ?? "");
          return target.endsWith(".md") ? target : `${target}.md`;
        },
      );
  const expectedMocLinks = requiresEncodedMarkdownMoc
    ? topicFiles.map((topicFile) => `lecture/${topicFile.replaceAll(" ", "%20")}`)
    : topicFiles.map((topicFile) => `lecture/${topicFile}`);

  if (requiresEncodedMarkdownMoc) {
    if (moc.includes("[[lecture/")) {
      failures.push(`${lectureDirectory}: MOC не повинен використовувати wikilinks.`);
    }

    if (mocLinks.some((target) => target.includes(" ") || /%D[01]/i.test(target))) {
      failures.push(
        `${lectureDirectory}: MOC має кодувати лише пробіли як %20, без повного encodeURI.`,
      );
    }
  }

  if (JSON.stringify(mocLinks) !== JSON.stringify(expectedMocLinks)) {
    failures.push(`${lectureDirectory}: MOC не відповідає фактичним файлам lecture/.`);
  }

  for (const [index, topicFile] of topicFiles.entries()) {
    const source = await readFile(join(topicRoot, topicFile), "utf8");
    const trimmedSource = source.trimEnd();
    const navigationCount = source.split(topicNavigationTitle).length - 1;
    const previousTopic = topicFiles[index - 1]?.replace(/\.md$/, "");
    const nextTopic = topicFiles[index + 1]?.replace(/\.md$/, "");

    if (!source.startsWith(topicNavigationTitle) || navigationCount !== 2) {
      failures.push(`${lectureDirectory}/lecture/${topicFile}: потрібна верхня й нижня навігація.`);
    }

    if (trimmedSource.lastIndexOf(topicNavigationTitle) <= 0) {
      failures.push(`${lectureDirectory}/lecture/${topicFile}: нижня навігація відсутня.`);
    }

    if (!source.includes("[[../03 Конспект лекції|Зміст лекції]]")) {
      failures.push(`${lectureDirectory}/lecture/${topicFile}: відсутнє посилання на MOC.`);
    }

    if (previousTopic !== undefined && !source.includes(`[[${previousTopic}|`)) {
      failures.push(
        `${lectureDirectory}/lecture/${topicFile}: некоректне посилання на попередню тему.`,
      );
    }

    if (nextTopic !== undefined && !source.includes(`[[${nextTopic}|`)) {
      failures.push(
        `${lectureDirectory}/lecture/${topicFile}: некоректне посилання на наступну тему.`,
      );
    }

    if ((source.match(/^# /gm) ?? []).length !== 1) {
      failures.push(`${lectureDirectory}/lecture/${topicFile}: очікується рівно один H1.`);
    }
  }

  summaries.push(
    `PASS ${lectureDirectory}: ${expectedRootFiles.length} root files, ` +
      `${topicFiles.length} topics, valid MOC and navigation`,
  );
}

async function requireDirectory(path: string, label: string): Promise<void> {
  const exists = await stat(path)
    .then((entry) => entry.isDirectory())
    .catch(() => false);

  if (!exists) {
    failures.push(`відсутня директорія ${label}.`);
  }
}

async function requireFile(path: string, label: string): Promise<void> {
  const exists = await stat(path)
    .then((entry) => entry.isFile())
    .catch(() => false);

  if (!exists) {
    failures.push(`відсутній файл ${label}.`);
  }
}

async function requireAbsentFile(path: string, label: string): Promise<void> {
  const exists = await stat(path)
    .then((entry) => entry.isFile())
    .catch(() => false);

  if (exists) {
    failures.push(`${label} не повинен існувати в цьому snapshot.`);
  }
}

async function requireTextAbsent(root: string, token: string, label: string): Promise<void> {
  const textFiles = (await listFiles(root)).filter((file) => {
    return (
      /\.(?:css|html|json|md|sql|ts|tsx)$/u.test(file) &&
      basename(file).toUpperCase() !== "SLIDES.MD"
    );
  });

  for (const file of textFiles) {
    const source = await readFile(file, "utf8");
    if (source.includes(token)) {
      failures.push(
        `${label} містить чужий namespace ${token} у ${relative(repositoryRoot, file)}.`,
      );
    }
  }
}

function requireScriptPath(scriptName: string, expectedPath: string): void {
  const command = scripts[scriptName];

  if (command === undefined) {
    failures.push(`package.json не містить script ${scriptName}.`);
    return;
  }

  if (!command.includes(expectedPath)) {
    failures.push(`script ${scriptName} не посилається на ${expectedPath} (отримано: ${command}).`);
  }
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolutePath)));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files.sort((left, right) =>
    relative(repositoryRoot, left).localeCompare(relative(repositoryRoot, right)),
  );
}

function countDirectTestCalls(source: string, fileName: string): { active: number; todo: number } {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  let active = 0;
  let todo = 0;

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isIdentifier(expression) && (expression.text === "it" || expression.text === "test")) {
        active += 1;
      } else if (
        ts.isPropertyAccessExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        (expression.expression.text === "it" || expression.expression.text === "test") &&
        expression.name.text === "todo"
      ) {
        todo += 1;
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { active, todo };
}
