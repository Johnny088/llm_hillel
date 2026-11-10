import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const devRoot = join(repositoryRoot, "dev");
const stateFilePath = join(devRoot, ".course-state.json");
const DEV_LOCAL_ENV_FILES = [".env", ".env.example"] as const;

export interface CourseState {
  lesson: number;
  lessonDir: string;
  provider: "openrouter";
  stage: "starter" | "development" | "solution";
  checkpoint: number;
}

export const OPENROUTER_LESSONS = [
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
  "lesson-11-evals-observability-openrouter",
  "lesson-12-security-openrouter",
  "lesson-13-databases-openrouter",
  "lesson-14-react-sse-openrouter",
  "lesson-15-final-project-workshop-openrouter",
] as const;

export function parseLessonNumber(lessonInput: string | number): number {
  if (typeof lessonInput === "number") return lessonInput;
  const match = lessonInput.match(/lesson-(\d+)/i) || lessonInput.match(/^(\d+)$/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return 1;
}

export function findOpenRouterLessonDir(lessonNum: number): string | null {
  const numStr = String(lessonNum).padStart(2, "0");
  const exact = OPENROUTER_LESSONS.find((l) => parseLessonNumber(l) === lessonNum);
  if (exact && existsSync(join(repositoryRoot, exact))) {
    return exact;
  }
  // Check filesystem dynamically for any lesson-NN-*-openrouter
  try {
    const entries = execSync("git ls-files", { cwd: repositoryRoot, encoding: "utf8" }).split(
      /\r?\n/,
    );
    const regex = new RegExp(`^lesson-${numStr}-[^/]+-openrouter`, "i");
    for (const e of entries) {
      const match = e.match(regex);
      if (match) {
        return match[0];
      }
    }
  } catch {
    // Ignore git error
  }
  return null;
}

export async function readCourseState(): Promise<CourseState> {
  if (!existsSync(stateFilePath)) {
    const defaultState: CourseState = {
      lesson: 1,
      lessonDir: "lesson-01-intro-openrouter",
      provider: "openrouter",
      stage: "starter",
      checkpoint: 0,
    };
    return defaultState;
  }

  const raw = await readFile(stateFilePath, "utf8");
  const data = JSON.parse(raw) as Record<string, unknown>;

  const lessonNum = parseLessonNumber(
    (data["lesson"] as string | number) ?? (data["lessonDir"] as string) ?? 1,
  );
  let lessonDir = (data["lessonDir"] as string) || "";
  if (!lessonDir || !lessonDir.includes("openrouter")) {
    const found = findOpenRouterLessonDir(lessonNum);
    lessonDir = found || `lesson-${String(lessonNum).padStart(2, "0")}-intro-openrouter`;
  }

  return {
    lesson: lessonNum,
    lessonDir,
    provider: "openrouter",
    stage: (data["stage"] as "starter" | "development" | "solution") || "starter",
    checkpoint: typeof data["checkpoint"] === "number" ? data["checkpoint"] : 0,
  };
}

export async function writeCourseState(state: CourseState): Promise<void> {
  await mkdir(devRoot, { recursive: true });
  await writeFile(stateFilePath, JSON.stringify(state, null, 2) + "\n", "utf8");
}

function readDotenvValue(source: string, name: string): string | null {
  const line = source
    .split(/\r?\n/u)
    .find((candidate) => candidate.trimStart().startsWith(`${name}=`));

  if (!line) {
    return null;
  }

  const value = line.slice(line.indexOf("=") + 1).trim();
  const unquoted =
    (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))
      ? value.slice(1, -1).trim()
      : value;

  return unquoted.length > 0 ? unquoted : null;
}

export async function assertRepositoryEnvironmentReady(
  lesson: number,
  rootDirectory: string = repositoryRoot,
): Promise<void> {
  if (lesson < 2) {
    return;
  }

  const rootEnvPath = join(rootDirectory, ".env");

  if (!existsSync(rootEnvPath)) {
    throw new Error(
      "Починаючи з Lesson 02 потрібен кореневий .env. Створіть його з .env.example до міграції dev/.",
    );
  }

  const rootEnvironment = await readFile(rootEnvPath, "utf8");

  if (!readDotenvValue(rootEnvironment, "OPENROUTER_API_KEY")) {
    throw new Error(
      "У кореневому .env потрібно задати OPENROUTER_API_KEY до видалення локального dev/.env.",
    );
  }
}

export async function removeDevLocalEnvironmentFiles(
  destinationDirectory: string = devRoot,
): Promise<string[]> {
  const removed: string[] = [];

  for (const filename of DEV_LOCAL_ENV_FILES) {
    const filePath = join(destinationDirectory, filename);

    if (existsSync(filePath)) {
      await rm(filePath, { force: true });
      removed.push(filename);
    }
  }

  return removed;
}

export async function listAllFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
        continue;
      }
      files.push(...(await listAllFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

export interface DiffReport {
  added: string[];
  modified: string[];
  deleted: string[];
  identical: string[];
}

export async function compareDirectories(
  currentDir: string,
  targetDir: string,
  ignoredRelPaths: string[] = [".course-state.json"],
): Promise<DiffReport> {
  const currentFiles = await listAllFiles(currentDir);
  const targetFiles = await listAllFiles(targetDir);

  const currentMap = new Map<string, string>();
  for (const file of currentFiles) {
    const rel = relative(currentDir, file).replace(/\\/g, "/");
    if (!ignoredRelPaths.includes(rel)) {
      currentMap.set(rel, file);
    }
  }

  const targetMap = new Map<string, string>();
  for (const file of targetFiles) {
    const rel = relative(targetDir, file).replace(/\\/g, "/");
    if (!ignoredRelPaths.includes(rel)) {
      targetMap.set(rel, file);
    }
  }

  const added: string[] = [];
  const modified: string[] = [];
  const identical: string[] = [];
  const deleted: string[] = [];

  for (const [rel, targetPath] of targetMap.entries()) {
    const currentPath = currentMap.get(rel);
    if (!currentPath) {
      added.push(rel);
    } else {
      const currentContent = await readFile(currentPath);
      const targetContent = await readFile(targetPath);
      if (currentContent.equals(targetContent)) {
        identical.push(rel);
      } else {
        modified.push(rel);
      }
    }
  }

  for (const rel of currentMap.keys()) {
    if (!targetMap.has(rel)) {
      deleted.push(rel);
    }
  }

  return {
    added: added.sort(),
    modified: modified.sort(),
    deleted: deleted.sort(),
    identical: identical.sort(),
  };
}

export async function applySafeSync(
  targetDir: string,
  diff: DiffReport,
  destinationDir: string = devRoot,
  preserveCustomFiles: boolean = true,
): Promise<{ applied: boolean; preserved: string[] }> {
  const preserved: string[] = [];

  // 1. Delete obsolete files that belonged to previous target, but preserve unrecognized custom files if flag set
  for (const rel of diff.deleted) {
    const destPath = join(destinationDir, rel);
    if (preserveCustomFiles) {
      if (rel.startsWith("src/") || rel.startsWith("tests/") || rel.startsWith("evals/")) {
        if (existsSync(destPath)) {
          await rm(destPath, { force: true });
        }
      } else {
        preserved.push(rel);
      }
    } else {
      if (existsSync(destPath)) {
        await rm(destPath, { force: true });
      }
    }
  }

  // 2. Add or update files
  for (const rel of [...diff.added, ...diff.modified]) {
    const srcPath = join(targetDir, rel);
    const destPath = join(destinationDir, rel);
    await mkdir(dirname(destPath), { recursive: true });
    const content = await readFile(srcPath);
    await writeFile(destPath, content);
  }

  return { applied: true, preserved };
}

export function getNextOpenRouterLesson(currentLessonDir: string): {
  nextLessonNum: number;
  nextLessonDir: string;
} {
  const currentNum = parseLessonNumber(currentLessonDir);
  const nextNum = currentNum + 1;
  const nextDir = findOpenRouterLessonDir(nextNum);

  if (!nextDir) {
    const numStr = String(nextNum).padStart(2, "0");
    throw new Error(`OpenRouter variant for lesson ${numStr} is not available.`);
  }

  return {
    nextLessonNum: nextNum,
    nextLessonDir: nextDir,
  };
}

export function getLessonCheckCommand(
  lessonDir: string,
  stage: "starter" | "development" | "solution",
): string {
  const num = parseLessonNumber(lessonDir);
  const numStr = String(num).padStart(2, "0");

  if (num === 10 && lessonDir === "lesson-10-langgraph-openrouter") {
    return stage === "solution"
      ? "yarn check:lesson10:openrouter:solution"
      : "yarn check:dev:lesson10:openrouter";
  }

  if (num === 11 && lessonDir === "lesson-11-evals-observability-openrouter") {
    return "yarn check:dev:lesson11:openrouter";
  }

  if (num === 12 && lessonDir === "lesson-12-security-openrouter") {
    return "yarn check:dev:lesson12:openrouter";
  }

  if (num === 13 && lessonDir === "lesson-13-databases-openrouter") {
    return "yarn check:dev:lesson13:openrouter";
  }

  if (num === 14 && lessonDir === "lesson-14-react-sse-openrouter") {
    return "yarn check:dev:lesson14:openrouter";
  }

  if (num === 15 && lessonDir === "lesson-15-final-project-workshop-openrouter") {
    return "yarn check:dev:lesson15:openrouter";
  }

  if (stage === "solution") {
    if (num === 5 && lessonDir === "lesson-05-memory-openrouter") {
      return "yarn check:lesson05:openrouter:solution";
    }
    if (num === 6 && lessonDir === "lesson-06-rag-openrouter") {
      return "yarn check:lesson06:openrouter:solution";
    }
    if (num === 7 && lessonDir === "lesson-07-agent-loop-openrouter") {
      return "yarn check:lesson07:openrouter:solution";
    }
    if (num === 8 && lessonDir === "lesson-08-multi-agent-workflow-openrouter") {
      return "yarn check:lesson08:openrouter:solution";
    }
    if (num === 9 && lessonDir === "lesson-09-openai-agents-sdk-openrouter") {
      return "yarn check:lesson09:openrouter:solution";
    }
    if (num === 10 && lessonDir === "lesson-10-langgraph-openrouter") {
      return "yarn check:lesson10:openrouter:solution";
    }
    return `yarn test:lesson${numStr}:openrouter:solution && yarn build:lesson${numStr}:openrouter`;
  }

  return "yarn typecheck:dev && yarn lint:dev && yarn format:check:dev && yarn vitest run --dir dev/tests";
}

export function getNextStarterCheckCommand(lessonDir: string): string {
  if (lessonDir === "lesson-10-langgraph-openrouter") {
    return "yarn check:lesson10:openrouter:starter";
  }
  if (lessonDir === "lesson-11-evals-observability-openrouter") {
    return "yarn check:lesson11:openrouter:starter";
  }
  if (lessonDir === "lesson-12-security-openrouter") {
    return "yarn check:lesson12:openrouter:starter";
  }
  if (lessonDir === "lesson-13-databases-openrouter") {
    return "yarn check:lesson13:openrouter:starter";
  }
  if (lessonDir === "lesson-14-react-sse-openrouter") {
    return "yarn check:dev:lesson14:openrouter:starter";
  }
  if (lessonDir === "lesson-15-final-project-workshop-openrouter") {
    return "yarn check:dev:lesson15:openrouter:starter";
  }
  return getLessonCheckCommand(lessonDir, "starter");
}

export async function runStatus(): Promise<void> {
  const state = await readCourseState();
  const numStr = String(state.lesson).padStart(2, "0");

  console.log("==========================================");
  console.log(" 📍 Стан робочої версії курсу (dev/ — OpenRouter)");
  console.log("==========================================");
  console.log(` • Номер заняття:    ${numStr} (lesson ${state.lesson})`);
  console.log(` • Директорія:       ${state.lessonDir}`);
  console.log(` • Провайдер:        ${state.provider} (лише OpenRouter)`);
  console.log(` • Поточна стадія:   ${state.stage}`);
  console.log(` • Чекпоінт:         ${state.checkpoint}`);
  console.log(
    ` • Джерело env:      ${state.lesson >= 2 ? "кореневий .env" : "локальний dev/.env"}`,
  );

  if (state.lesson >= 2 && DEV_LOCAL_ENV_FILES.some((name) => existsSync(join(devRoot, name)))) {
    console.log(" ⚠ Локальний dev/.env або dev/.env.example більше не повинен існувати.");
  }

  const lessonRoot = join(repositoryRoot, state.lessonDir);
  const starterRoot = join(lessonRoot, "starter");
  const solutionRoot = join(lessonRoot, "solution");

  if (existsSync(starterRoot)) {
    const diffStarter = await compareDirectories(devRoot, starterRoot);
    console.log("\nВідмінності від OpenRouter starter:");
    console.log(` • Спільних однакових файлів: ${diffStarter.identical.length}`);
    console.log(` • Змінених файлів:           ${diffStarter.modified.length}`);
    console.log(` • Доданих у dev:             ${diffStarter.deleted.length}`);
    console.log(` • Відсутніх у dev:           ${diffStarter.added.length}`);
  }

  if (existsSync(solutionRoot)) {
    const diffSolution = await compareDirectories(devRoot, solutionRoot);
    console.log("\nВідмінності від OpenRouter solution:");
    console.log(` • Спільних однакових файлів: ${diffSolution.identical.length}`);
    console.log(` • Змінених файлів:           ${diffSolution.modified.length}`);
    console.log(` • Доданих у dev:             ${diffSolution.deleted.length}`);
    console.log(` • Відсутніх у dev:           ${diffSolution.added.length}`);
  }

  console.log("\nКоманда перевірки:");
  console.log(` 👉 ${getLessonCheckCommand(state.lessonDir, state.stage)}`);
  console.log("==========================================");
}

export async function runSolution(): Promise<void> {
  const state = await readCourseState();
  console.log(`\n🔄 Перехід dev/ → OpenRouter solution для [${state.lessonDir}]...`);

  await assertRepositoryEnvironmentReady(state.lesson);

  const solutionRoot = join(repositoryRoot, state.lessonDir, "solution");
  if (!existsSync(solutionRoot)) {
    throw new Error(`Директорія OpenRouter solution не знайдена: ${solutionRoot}`);
  }

  const diff = await compareDirectories(devRoot, solutionRoot);

  console.log("\n--- Звіт семантичних змін (OpenRouter Solution) ---");
  if (diff.added.length > 0) {
    console.log(`\n+ Буде додано (${diff.added.length}):`);
    for (const file of diff.added) console.log(`   + ${file}`);
  }
  if (diff.modified.length > 0) {
    console.log(`\n~ Буде змінено (${diff.modified.length}):`);
    for (const file of diff.modified) console.log(`   ~ ${file}`);
  }
  if (diff.deleted.length > 0) {
    console.log(`\n- Буде видалено (${diff.deleted.length}):`);
    for (const file of diff.deleted) console.log(`   - ${file}`);
  }
  if (diff.added.length === 0 && diff.modified.length === 0 && diff.deleted.length === 0) {
    console.log(" dev/ вже повністю відповідає OpenRouter solution.");
  }

  // Validate the canonical solution before mutating dev/. If the gate fails,
  // the student's current working state remains untouched.
  const checkCmd =
    state.lessonDir === "lesson-11-evals-observability-openrouter"
      ? "yarn check:lesson11:openrouter:solution"
      : state.lessonDir === "lesson-12-security-openrouter"
        ? "yarn check:lesson12:openrouter:solution"
        : state.lessonDir === "lesson-13-databases-openrouter"
          ? "yarn check:lesson13:openrouter:solution"
          : state.lessonDir === "lesson-14-react-sse-openrouter"
            ? "yarn check:lesson14:openrouter:solution"
            : state.lessonDir === "lesson-15-final-project-workshop-openrouter"
              ? "yarn check:lesson15:openrouter:solution"
              : getLessonCheckCommand(state.lessonDir, "solution");
  console.log(`\n🧪 Попередня валідація OpenRouter solution (${checkCmd})...`);
  try {
    execSync(checkCmd, { cwd: repositoryRoot, stdio: "inherit" });
    console.log("\n✔️ Перевірка solution успішно пройдена!");
  } catch (err) {
    console.error("\n❌ Помилка під час валідації solution.");
    throw err;
  }

  await applySafeSync(solutionRoot, diff);
  const removedEnvironmentFiles =
    state.lesson >= 2 ? await removeDevLocalEnvironmentFiles(devRoot) : [];

  if (removedEnvironmentFiles.length > 0) {
    console.log(
      `\nℹ️ Видалено локальні env-файли (${removedEnvironmentFiles.join(", ")}): використовується кореневий .env.`,
    );
  }

  state.stage = "solution";
  await writeCourseState(state);

  console.log("\n✔️ dev/ успішно оновлено до OpenRouter solution!");
}

export async function runNext(): Promise<void> {
  const state = await readCourseState();
  const nextInfo = getNextOpenRouterLesson(state.lessonDir);

  console.log(`\n➡️ Перехід до наступного заняття: ${state.lessonDir} → ${nextInfo.nextLessonDir}`);

  await assertRepositoryEnvironmentReady(nextInfo.nextLessonNum);

  const nextStarterRoot = join(repositoryRoot, nextInfo.nextLessonDir, "starter");
  if (!existsSync(nextStarterRoot)) {
    throw new Error(`Starter наступного заняття не знайдено: ${nextStarterRoot}`);
  }

  if (nextInfo.nextLessonDir === "lesson-11-evals-observability-openrouter") {
    const preflight = "yarn verify:lesson11:openrouter:scaffolding dev";
    console.log(`\n🧪 Попередня перевірка фізичної основи dev перед переходом (${preflight})...`);
    execSync(preflight, { cwd: repositoryRoot, stdio: "inherit" });
  }

  if (nextInfo.nextLessonDir === "lesson-12-security-openrouter") {
    const completion = "yarn verify:lesson11:openrouter:completion dev";
    console.log(
      `\n🧪 Перевірка завершеного Lesson 11 кандидата dev перед переходом (${completion})...`,
    );
    execSync(completion, { cwd: repositoryRoot, stdio: "inherit" });
    const foundation = "yarn verify:lesson12:openrouter:scaffolding dev";
    console.log(`\n🧪 Перевірка 156-файлової основи Lesson 12 перед переходом (${foundation})...`);
    execSync(foundation, { cwd: repositoryRoot, stdio: "inherit" });
  }

  if (nextInfo.nextLessonDir === "lesson-13-databases-openrouter") {
    const completion = "yarn verify:lesson12:openrouter:completion dev";
    console.log(
      `\n🧪 Перевірка завершеного Lesson 12 кандидата dev перед переходом (${completion})...`,
    );
    execSync(completion, { cwd: repositoryRoot, stdio: "inherit" });
    const foundation = "yarn verify:lesson13:openrouter:scaffolding dev";
    console.log(`\n🧪 Перевірка 169-файлової основи Lesson 13 перед переходом (${foundation})...`);
    execSync(foundation, { cwd: repositoryRoot, stdio: "inherit" });
  }

  if (nextInfo.nextLessonDir === "lesson-14-react-sse-openrouter") {
    const completion = "yarn verify:lesson13:openrouter:completion dev";
    console.log(
      `\n🧪 Перевірка завершеного Lesson 13 кандидата dev перед переходом (${completion})...`,
    );
    execSync(completion, { cwd: repositoryRoot, stdio: "inherit" });
  }

  if (nextInfo.nextLessonDir === "lesson-15-final-project-workshop-openrouter") {
    const completion = "yarn verify:lesson14:openrouter:dev";
    console.log(
      `\n🧪 Перевірка завершеного Lesson 14 кандидата dev перед переходом (${completion})...`,
    );
    execSync(completion, { cwd: repositoryRoot, stdio: "inherit" });
  }

  const diff = await compareDirectories(devRoot, nextStarterRoot);

  if (nextInfo.nextLessonDir === "lesson-12-security-openrouter") {
    const unexpected = [...diff.added, ...diff.modified, ...diff.deleted].filter(
      (path) => path !== "README.md",
    );
    if (unexpected.length > 0) {
      throw new Error(
        `Lesson 11 → 12 transition may update only README.md and course metadata; unexpected file changes: ${unexpected.join(", ")}`,
      );
    }
  }

  if (nextInfo.nextLessonDir === "lesson-13-databases-openrouter") {
    const unexpected = [...diff.added, ...diff.modified, ...diff.deleted].filter(
      (path) => path !== "README.md",
    );
    if (unexpected.length > 0) {
      throw new Error(
        `Lesson 12 → 13 transition may update only README.md and course metadata; unexpected file changes: ${unexpected.join(", ")}`,
      );
    }
  }

  if (nextInfo.nextLessonDir === "lesson-14-react-sse-openrouter") {
    const unexpected = [...diff.added, ...diff.modified, ...diff.deleted].filter(
      (path) => path !== "README.md",
    );
    if (unexpected.length > 0) {
      throw new Error(
        `Lesson 13 → 14 transition may update only README.md and course metadata; unexpected file changes: ${unexpected.join(", ")}`,
      );
    }
  }

  if (nextInfo.nextLessonDir === "lesson-15-final-project-workshop-openrouter") {
    const unexpected = [...diff.added, ...diff.modified, ...diff.deleted].filter(
      (path) => path !== "README.md",
    );
    if (unexpected.length > 0) {
      throw new Error(
        `Lesson 14 → 15 transition may update only README.md and course metadata; unexpected file changes: ${unexpected.join(", ")}`,
      );
    }
  }

  console.log("\n--- Семантична міграція до нового OpenRouter starter ---");
  if (diff.added.length > 0) {
    console.log(`\n+ Додаються нові файли (${diff.added.length}):`);
    for (const file of diff.added) console.log(`   + ${file}`);
  }
  if (diff.modified.length > 0) {
    console.log(`\n~ Оновлюються файли (${diff.modified.length}):`);
    for (const file of diff.modified) console.log(`   ~ ${file}`);
  }
  if (diff.deleted.length > 0) {
    console.log(`\n- Видаляються застарілі файли попереднього стану (${diff.deleted.length}):`);
    for (const file of diff.deleted) console.log(`   - ${file}`);
  }

  // Apply migration
  const result = await applySafeSync(nextStarterRoot, diff);
  const removedEnvironmentFiles =
    nextInfo.nextLessonNum >= 2 ? await removeDevLocalEnvironmentFiles(devRoot) : [];
  const removedEnvironmentFileSet = new Set(removedEnvironmentFiles);
  const preservedFiles = result.preserved.filter((file) => !removedEnvironmentFileSet.has(file));

  if (preservedFiles.length > 0) {
    console.log(`\nℹ️ Збережено додаткові локальні файли:`);
    for (const file of preservedFiles) console.log(`   * ${file}`);
  }

  if (removedEnvironmentFiles.length > 0) {
    console.log(
      `\nℹ️ Видалено локальні env-файли (${removedEnvironmentFiles.join(", ")}): Lesson 02+ використовує кореневий .env.`,
    );
  }

  // Update state (CRITICAL: NEVER pushes or publishes)
  state.lesson = nextInfo.nextLessonNum;
  state.lessonDir = nextInfo.nextLessonDir;
  state.provider = "openrouter";
  state.stage = "starter";
  state.checkpoint = 0;
  await writeCourseState(state);

  console.log(`\n✔️ dev/ успішно переведено на ${nextInfo.nextLessonDir} (starter)!`);

  // Run validation
  const checkCmd = getNextStarterCheckCommand(nextInfo.nextLessonDir);
  console.log(`\n🧪 Запуск валідації starter (${checkCmd})...`);
  try {
    execSync(checkCmd, { cwd: repositoryRoot, stdio: "inherit" });
    console.log("\n✔️ Перевірка нового OpenRouter starter успішно пройдена!");
  } catch (err) {
    console.error("\n❌ Помилка під час валідації starter.");
    throw err;
  }
}

export async function runCheck(): Promise<void> {
  const state = await readCourseState();
  console.log(`\n🔍 Перевірка dev/ для [${state.lessonDir}] (стадія: ${state.stage})...`);
  const checkCmd = getLessonCheckCommand(state.lessonDir, state.stage);
  console.log(`Виконується команда: ${checkCmd}`);
  execSync(checkCmd, { cwd: repositoryRoot, stdio: "inherit" });
}

export async function runInit(targetInput: string | number = 1): Promise<void> {
  const lessonNum = parseLessonNumber(targetInput);
  const lessonDir =
    findOpenRouterLessonDir(lessonNum) ||
    `lesson-${String(lessonNum).padStart(2, "0")}-intro-openrouter`;

  const starterRoot = join(repositoryRoot, lessonDir, "starter");
  if (!existsSync(starterRoot)) {
    const numStr = String(lessonNum).padStart(2, "0");
    throw new Error(`OpenRouter variant for lesson ${numStr} is not available.`);
  }

  await assertRepositoryEnvironmentReady(lessonNum);

  await mkdir(devRoot, { recursive: true });
  const diff = await compareDirectories(devRoot, starterRoot);
  await applySafeSync(starterRoot, diff, devRoot, false);
  const removedEnvironmentFiles =
    lessonNum >= 2 ? await removeDevLocalEnvironmentFiles(devRoot) : [];

  const state: CourseState = {
    lesson: lessonNum,
    lessonDir,
    provider: "openrouter",
    stage: "starter",
    checkpoint: 0,
  };
  await writeCourseState(state);
  console.log(`✔️ dev/ успішно ініціалізовано для ${lessonDir} (lesson ${lessonNum}, OpenRouter).`);

  if (removedEnvironmentFiles.length > 0) {
    console.log(
      `ℹ️ Видалено локальні env-файли (${removedEnvironmentFiles.join(", ")}): використовується кореневий .env.`,
    );
  }
}

async function main(): Promise<void> {
  const command = process.argv[2] || "status";

  switch (command) {
    case "status":
      await runStatus();
      break;
    case "solution":
      await runSolution();
      break;
    case "next":
      await runNext();
      break;
    case "check":
      await runCheck();
      break;
    case "init":
      await runInit(process.argv[3] || 1);
      break;
    default:
      console.error(`Невідома команда: ${command}`);
      console.error("Доступні команди: status, solution, next, check, init [lessonNumber]");
      process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Помилка dev-manager:", err);
    process.exit(1);
  });
}
