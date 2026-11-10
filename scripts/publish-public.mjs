#!/usr/bin/env node
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repositoryRoot = dirname(__dirname);

const DEFAULT_PUBLIC_PROJECT_NAME = "ai-agents-for-developers-practical-cohort-1";
const PUBLIC_STATE_FILE = join(repositoryRoot, ".public", "state.json");
const DEV_STATE_FILE = join(repositoryRoot, "dev", ".course-state.json");
const COHORTS_DIR = join(repositoryRoot, ".public", "cohorts");

// Absolute security forbidden patterns
const FORBIDDEN_PATH_PATTERNS = [
  /(?:^|[\\/])\.private(?:[\\/]|$)/i,
  /(?:^|[\\/])\.agents(?:[\\/]|$)/i,
  /(?:^|[\\/])skills(?:[\\/]|$)/i,
  /(?:^|[\\/])SKILL\.md$/i,
  /\.skill$/i,
  /\.prompt$/i,
  /(?:^|[\\/])\.env(?:\..+)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.pfx$/i,
  /id_rsa/i,
  /\.log$/i,
  /user-memory\.json$/i,
];

// Patterns ignored from public sync (build artifacts, caches, git internals)
const IGNORED_SYNC_PATTERNS = [
  /(?:^|[\\/])\.git(?:[\\/]|$)/,
  /(?:^|[\\/])node_modules(?:[\\/]|$)/,
  /(?:^|[\\/])\.yarn(?:[\\/]|$)/,
  /(?:^|[\\/])dist(?:[\\/]|$)/,
  /(?:^|[\\/])coverage(?:[\\/]|$)/,
  /(?:^|[\\/])\.vscode(?:[\\/]|$)/,
  /(?:^|[\\/])\.idea(?:[\\/]|$)/,
  /(?:^|[\\/])\.DS_Store$/,
  /(?:^|[\\/])\.public[\\/]cohorts(?:[\\/]|$)/,
];

// Content secret patterns
const SECRET_REGEXES = [
  /glpat-[0-9a-zA-Z_\-]{20,}/,
  /sk-[a-zA-Z0-9]{32,}/,
  /sk-or-v1-[a-zA-Z0-9]{32,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

export function parseLessonNumber(lessonInput) {
  if (typeof lessonInput === "number") return lessonInput;
  const match = String(lessonInput).match(/lesson-(\d+)/i) || String(lessonInput).match(/^(\d+)$/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return 1;
}

export function findLessonDir(lessonNum, provider = "openrouter") {
  const numStr = String(lessonNum).padStart(2, "0");
  const prefix = `lesson-${numStr}-`;
  const suffix = provider === "openrouter" ? "-openrouter" : "";
  const rootEntries = readdirSync(repositoryRoot, { withFileTypes: true });

  for (const entry of rootEntries) {
    if (entry.isDirectory() && entry.name.startsWith(prefix)) {
      if (provider === "openrouter" && entry.name.endsWith("-openrouter")) {
        return entry.name;
      }
      if (provider !== "openrouter" && !entry.name.endsWith("-openrouter")) {
        return entry.name;
      }
    }
  }

  for (const entry of rootEntries) {
    if (entry.isDirectory() && entry.name.startsWith(prefix)) {
      return entry.name;
    }
  }

  return `lesson-${numStr}-intro${suffix}`;
}

export async function listCohorts() {
  if (!existsSync(COHORTS_DIR)) {
    return [];
  }
  const entries = await readdir(COHORTS_DIR, { withFileTypes: true });
  const cohorts = [];
  for (const e of entries) {
    if (e.isFile() && e.name.endsWith(".json")) {
      try {
        const raw = await readFile(join(COHORTS_DIR, e.name), "utf8");
        cohorts.push(JSON.parse(raw));
      } catch {
        // ignore invalid json
      }
    }
  }
  return cohorts.sort((a, b) => a.cohortId.localeCompare(b.cohortId));
}

export async function readCohort(cohortInput) {
  const all = await listCohorts();

  if (!cohortInput) {
    const found =
      all.find(
        (c) =>
          c.cohortId === "cohort-2608" ||
          c.cohortId === "cohort-1" ||
          c.index === "2608" ||
          c.devMode === "live",
      ) || all[0];
    if (found) return found;

    const pubState = await readPublicState();
    return {
      cohortId: "cohort-2608",
      index: "2608",
      projectName: DEFAULT_PUBLIC_PROJECT_NAME,
      description: "AI Agents for Developers (Practical Course) - Група 2608 (Public Edition)",
      releasedThrough: pubState.releasedThrough,
      devMode: "live",
    };
  }

  const query = String(cohortInput).trim().toLowerCase();

  const matched = all.find((c) => {
    if (c.cohortId && c.cohortId.toLowerCase() === query) return true;
    if (c.index && String(c.index).toLowerCase() === query) return true;
    if (Array.isArray(c.aliases) && c.aliases.some((a) => String(a).toLowerCase() === query))
      return true;
    if (`cohort-${c.index}`.toLowerCase() === query) return true;
    return false;
  });

  if (matched) {
    return matched;
  }

  throw new Error(
    `Когорта "${cohortInput}" не знайдена. Доступні когорти: ${all
      .map((c) => `${c.cohortId} (індекс: ${c.index || "не вказано"})`)
      .join(", ")}`,
  );
}

export async function writeCohort(cohort) {
  await mkdir(COHORTS_DIR, { recursive: true });
  const filePath = join(COHORTS_DIR, `${cohort.cohortId}.json`);
  await writeFile(filePath, JSON.stringify(cohort, null, 2) + "\n", "utf8");

  if (
    cohort.cohortId === "cohort-2608" ||
    cohort.cohortId === "cohort-1" ||
    cohort.index === "2608" ||
    cohort.projectName === DEFAULT_PUBLIC_PROJECT_NAME
  ) {
    await writePublicState({ releasedThrough: cohort.releasedThrough });
  }
}

export async function readPublicState() {
  if (!existsSync(PUBLIC_STATE_FILE)) {
    return { releasedThrough: 1 };
  }
  const raw = await readFile(PUBLIC_STATE_FILE, "utf8");
  const data = JSON.parse(raw);
  return {
    releasedThrough: parseLessonNumber(data.releasedThrough ?? 1),
  };
}

export async function writePublicState(state) {
  await mkdir(dirname(PUBLIC_STATE_FILE), { recursive: true });
  await writeFile(PUBLIC_STATE_FILE, JSON.stringify(state, null, 2) + "\n", "utf8");
}

export async function readDevCourseState() {
  if (!existsSync(DEV_STATE_FILE)) {
    return {
      lesson: 1,
      lessonDir: "lesson-01-intro-openrouter",
      provider: "openrouter",
      stage: "starter",
      checkpoint: 0,
    };
  }

  const raw = await readFile(DEV_STATE_FILE, "utf8");
  const data = JSON.parse(raw);
  const lessonNum = parseLessonNumber(data.lesson ?? data.lessonDir ?? 1);
  const lessonDir =
    data.lessonDir ?? `lesson-${String(lessonNum).padStart(2, "0")}-intro-openrouter`;

  return {
    lesson: lessonNum,
    lessonDir,
    provider: data.provider || "openrouter",
    stage: data.stage || "starter",
    checkpoint: data.checkpoint || 0,
  };
}

function isForbiddenPath(relPath) {
  const normalized = relPath.replace(/\\/g, "/");

  // Explicit whitelist for safe example files
  if (normalized === ".env.example" || normalized.endsWith("/.env.example")) {
    return false;
  }

  for (const pattern of FORBIDDEN_PATH_PATTERNS) {
    if (pattern.test(normalized)) {
      return true;
    }
  }
  return false;
}

function isIgnoredPath(relPath) {
  const normalized = relPath.replace(/\\/g, "/");
  for (const pattern of IGNORED_SYNC_PATTERNS) {
    if (pattern.test(normalized)) {
      return true;
    }
  }
  return false;
}

export async function collectAllTrackedAndWorkspaceFiles() {
  let trackedFiles = [];
  try {
    const raw = execSync("git ls-files", { cwd: repositoryRoot, encoding: "utf8" });
    trackedFiles = raw
      .split(/\r?\n/)
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  } catch {
    trackedFiles = [];
  }

  const extraDirs = ["dev", ".private", ".agents", ".public"];
  const extraFiles = [];
  for (const extra of extraDirs) {
    const dirPath = join(repositoryRoot, extra);
    if (existsSync(dirPath)) {
      async function walk(dir) {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = join(dir, entry.name);
          const rel = relative(repositoryRoot, full).replace(/\\/g, "/");
          if (isIgnoredPath(rel)) continue;
          if (entry.isDirectory()) {
            await walk(full);
          } else if (entry.isFile()) {
            extraFiles.push(rel);
          }
        }
      }
      await walk(dirPath);
    }
  }

  const combined = Array.from(new Set([...trackedFiles, ...extraFiles]));
  const result = [];

  for (const rel of combined) {
    if (isIgnoredPath(rel)) continue;
    const fullPath = join(repositoryRoot, rel);
    if (existsSync(fullPath)) {
      result.push({ fullPath, relPath: rel.replace(/\\/g, "/") });
    }
  }

  return result;
}

export function filterFilesForRelease(allFiles, releasedThrough, devState, cohort) {
  const allowed = [];
  const excludedFuture = [];
  const excludedPrivate = [];

  const isCohortDev = cohort && cohort.devMode === "cohort";
  const devIsReleased = isCohortDev ? false : devState.lesson <= releasedThrough;

  for (const file of allFiles) {
    const rel = file.relPath;

    // Check private & secret patterns
    if (isForbiddenPath(rel)) {
      excludedPrivate.push(file);
      continue;
    }

    // Check lesson directories (lesson-01-..., lesson-02-..., etc.)
    const lessonMatch = rel.match(/^lesson-(\d+)[^/]*\//i);
    if (lessonMatch && lessonMatch[1]) {
      const num = parseInt(lessonMatch[1], 10);
      if (num <= releasedThrough) {
        allowed.push(file);
      } else {
        excludedFuture.push(file);
      }
      continue;
    }

    // Check tsconfig files for specific lessons (e.g. tsconfig.lesson-05.build.json)
    const tsconfigMatch = rel.match(/^tsconfig\.lesson-(\d+)[^/]*\.json$/i);
    if (tsconfigMatch && tsconfigMatch[1]) {
      const num = parseInt(tsconfigMatch[1], 10);
      if (num <= releasedThrough) {
        allowed.push(file);
      } else {
        excludedFuture.push(file);
      }
      continue;
    }

    // dev/ directory handling
    if (rel.startsWith("dev/")) {
      if (isCohortDev) {
        // Excluded from live direct copy; populated freshly from cohort lesson snapshot
        excludedFuture.push(file);
      } else if (devIsReleased) {
        allowed.push(file);
      } else {
        excludedFuture.push(file);
      }
      continue;
    }

    // Do not copy .public/state.json directly; written explicitly for target cohort
    if (rel === ".public/state.json") {
      continue;
    }

    // Standard root configuration & scripts
    allowed.push(file);
  }

  return { allowed, excludedFuture, excludedPrivate, devIsReleased };
}

export function transformCohortSnapshotPackageJson(packageJsonText, cohort, releasedThrough) {
  const effectiveDevLesson = cohort?.devLesson || releasedThrough;
  if (cohort?.devMode !== "cohort" || effectiveDevLesson !== 1) return packageJsonText;

  const packageJson = JSON.parse(packageJsonText);
  packageJson.scripts = {
    ...packageJson.scripts,
    dev: "node scripts/run-tsx-entrypoint.mjs dev/src/index.ts",
    "dev:current": "node scripts/run-tsx-entrypoint.mjs dev/src/index.ts",
  };
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

export async function validateSecurityAndBoundaries(files, releasedThrough) {
  const violations = [];

  for (const file of files) {
    const rel = file.relPath;

    // 1. Forbidden path check
    if (isForbiddenPath(rel)) {
      violations.push({
        file: rel,
        reason: "Forbidden path pattern (matches private / skill / secret pattern)",
      });
      continue;
    }

    // 2. Future lesson boundary check
    const lessonMatch = rel.match(/^lesson-(\d+)[^/]*\//i);
    if (lessonMatch && lessonMatch[1]) {
      const num = parseInt(lessonMatch[1], 10);
      if (num > releasedThrough) {
        violations.push({
          file: rel,
          reason: `Future lesson leak: lesson-${String(num).padStart(2, "0")} exceeds releasedThrough ${releasedThrough}`,
        });
        continue;
      }
    }

    const tsconfigMatch = rel.match(/^tsconfig\.lesson-(\d+)[^/]*\.json$/i);
    if (tsconfigMatch && tsconfigMatch[1]) {
      const num = parseInt(tsconfigMatch[1], 10);
      if (num > releasedThrough) {
        violations.push({
          file: rel,
          reason: `Future tsconfig leak: ${rel} exceeds releasedThrough ${releasedThrough}`,
        });
        continue;
      }
    }

    // 3. Content secret scan
    if (/\.(?:ts|tsx|js|mjs|cjs|json|md|txt|env\.example|yml|yaml|sql|html|css)$/i.test(rel)) {
      const content = await readFile(file.fullPath, "utf8");
      for (const secretRegex of SECRET_REGEXES) {
        if (secretRegex.test(content)) {
          violations.push({
            file: rel,
            reason: `Potential secret or private credential detected (matched ${secretRegex})`,
          });
          break;
        }
      }
    }
  }

  return violations;
}

export function checkPrivateWorkingTreeClean() {
  try {
    const status = execSync("git status --porcelain", {
      cwd: repositoryRoot,
      encoding: "utf8",
    }).trim();
    if (status.length > 0) {
      return { clean: false, status };
    }
    return { clean: true, status: "" };
  } catch {
    return { clean: true, status: "" };
  }
}

export function getPrivateHeadSha() {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: repositoryRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    return "UNKNOWN";
  }
}

export async function copyDir(src, dest) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = join(src, e.name);
    const d = join(dest, e.name);
    if (e.isDirectory()) {
      await copyDir(s, d);
    } else if (e.isFile()) {
      const data = await readFile(s);
      await writeFile(d, data);
    }
  }
}

async function snapshotDirectory(dir) {
  const rootStat = await lstat(dir);
  if (!rootStat.isDirectory()) {
    throw new Error(`Expected a real directory at ${dir}`);
  }

  const files = [];
  async function walk(current, prefix = "") {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(fullPath, relPath);
      } else if (entry.isFile()) {
        const stat = await lstat(fullPath);
        if (!stat.isFile()) {
          throw new Error(`Unsupported filesystem entry in preserved dev/: ${relPath}`);
        }
        files.push({ relPath, content: await readFile(fullPath) });
      } else {
        throw new Error(`Unsupported filesystem entry in preserved dev/: ${relPath}`);
      }
    }
  }

  await walk(dir);
  return files;
}

function validatePreservedDevMetadata(devFiles, publicStateContent, releasedThrough, cohort) {
  const getJson = (relPath, description) => {
    const file = devFiles.find((entry) => entry.relPath === relPath);
    if (!file) throw new Error(`--preserve-dev requires ${description} (${relPath})`);
    try {
      return JSON.parse(file.content.toString("utf8"));
    } catch {
      throw new Error(`--preserve-dev found invalid JSON in ${relPath}`);
    }
  };

  let publicState;
  try {
    publicState = JSON.parse(publicStateContent.toString("utf8"));
  } catch {
    throw new Error("--preserve-dev found invalid JSON in cloned .public/state.json");
  }
  if (publicState.releasedThrough !== releasedThrough) {
    throw new Error(
      `--preserve-dev requires cloned releasedThrough ${releasedThrough}; found ${String(publicState.releasedThrough)}`,
    );
  }

  const state = getJson(".course-state.json", "cohort dev metadata");
  const expectedLesson = cohort.devLesson;
  const expectedProvider = cohort.devProvider || "openrouter";
  const expectedStage = cohort.devStage || "starter";
  const expectedLessonDir = Number.isInteger(expectedLesson)
    ? findLessonDir(expectedLesson, expectedProvider)
    : "<invalid lesson>";
  if (
    !Number.isInteger(expectedLesson) ||
    state.lesson !== expectedLesson ||
    state.lessonDir !== expectedLessonDir ||
    state.provider !== expectedProvider ||
    state.stage !== expectedStage
  ) {
    throw new Error(
      `--preserve-dev metadata mismatch: expected lesson ${String(expectedLesson)} (${expectedLessonDir}), provider ${expectedProvider}, stage ${expectedStage}; found lesson ${String(state.lesson)} (${String(state.lessonDir)}), provider ${String(state.provider)}, stage ${String(state.stage)}`,
    );
  }
}

function assertSnapshotsEqual(before, after) {
  if (before.length !== after.length) {
    throw new Error("--preserve-dev detected a changed dev/ file set");
  }
  for (let index = 0; index < before.length; index += 1) {
    if (
      before[index].relPath !== after[index].relPath ||
      !before[index].content.equals(after[index].content)
    ) {
      throw new Error(`--preserve-dev detected a changed dev/${before[index].relPath}`);
    }
  }
}

function snapshotGitDevTree(publicDir, staged = false) {
  const args = staged
    ? ["-C", publicDir, "ls-files", "--stage", "-z", "--", "dev/"]
    : ["-C", publicDir, "ls-tree", "-r", "-z", "HEAD", "--", "dev/"];
  const raw = execFileSync("git", args);
  return raw
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const tab = entry.indexOf("\t");
      if (tab === -1) throw new Error("Could not parse Git dev/ tree entry");
      const [mode, objectOrType, objectId] = entry.slice(0, tab).split(" ");
      const path = entry.slice(tab + 1);
      return staged ? `${path}\0${mode}\0${objectOrType}` : `${path}\0${mode}\0${objectId}`;
    })
    .sort();
}

function assertGitDevTreesEqual(before, after) {
  if (before.length !== after.length || before.some((entry, index) => entry !== after[index])) {
    throw new Error("--preserve-dev detected changed Git blobs or file modes in dev/");
  }
}

export async function showStatus(cohortInput) {
  const cohort = await readCohort(cohortInput);
  const devState = await readDevCourseState();

  const releasedThrough = cohort.releasedThrough;
  const relStr = String(releasedThrough).padStart(2, "0");
  const devNumStr = String(devState.lesson).padStart(2, "0");

  const allFiles = await collectAllTrackedAndWorkspaceFiles();
  const { allowed, excludedFuture, excludedPrivate, devIsReleased } = filterFilesForRelease(
    allFiles,
    releasedThrough,
    devState,
    cohort,
  );

  const rootEntries = await readdir(repositoryRoot, { withFileTypes: true });
  const allLessonDirs = rootEntries
    .filter((e) => e.isDirectory() && /^lesson-\d+/i.test(e.name))
    .map((e) => e.name)
    .sort();

  const includedLessons = [];
  const excludedLessons = [];

  for (const l of allLessonDirs) {
    const num = parseLessonNumber(l);
    if (num <= releasedThrough) {
      includedLessons.push(l);
    } else {
      excludedLessons.push(l);
    }
  }

  console.log("==================================================");
  console.log(` 🌐 RELEASE PREVIEW & STATUS [${cohort.cohortId}]`);
  console.log("==================================================");
  console.log(`Cohort ID:         ${cohort.cohortId}`);
  console.log(`Group Index:       ${cohort.index || "N/A"}`);
  console.log(`Aliases:           ${(cohort.aliases || []).join(", ") || "none"}`);
  console.log(`Target Repo:       AndreyFomenko/${cohort.projectName}`);
  console.log(`Description:       ${cohort.description}`);
  console.log(`Released through:  ${relStr} (lessons 01..${relStr})`);
  console.log(
    `Dev Mode:          ${cohort.devMode} (${cohort.devMode === "cohort" ? `lesson ${cohort.devLesson}, stage: ${cohort.devStage || "starter"}` : "live local dev"})`,
  );

  console.log("\nCurrent Local DEV:");
  console.log(`  lesson:          ${devNumStr} (${devState.lessonDir})`);
  console.log(`  provider:        ${devState.provider}`);
  console.log(`  stage:           ${devState.stage}`);

  console.log("\nReleased lessons for this cohort:");
  for (const l of includedLessons) {
    console.log(`  ✓ ${l}`);
  }

  console.log("\nFuture/private lessons (EXCLUDED):");
  for (const l of excludedLessons) {
    console.log(`  ✗ ${l}`);
  }

  console.log("\nDEV publication behavior:");
  if (cohort.devMode === "cohort") {
    console.log(
      `  ✓ dev/ will be populated from lesson ${String(cohort.devLesson).padStart(2, "0")} snapshot (${cohort.devStage || "starter"})`,
    );
  } else if (devIsReleased) {
    console.log(`  ✓ dev/ will be published from live working state (${devState.lessonDir})`);
  } else {
    console.log(
      `  🔒 dev/ retained untouched from previous public state (live dev=${devNumStr} > releasedThrough=${relStr})`,
    );
  }

  console.log("\nPrivate exclusions (NEVER in public):");
  console.log("  ✗ .private/ (skills, prompts, audits, internal)");
  console.log("  ✗ .agents/ & agent customizations");
  console.log("  ✗ .public/cohorts/ (cohort registry configs)");
  console.log("  ✗ .env & private credentials");
  console.log("  ✗ Private Git history (.git/)");

  console.log("\nStatistics:");
  console.log(` • Files to be published:  ${allowed.length}`);
  console.log(` • Future files excluded:  ${excludedFuture.length}`);
  console.log(` • Private files excluded: ${excludedPrivate.length}`);
  console.log("==================================================");

  return { cohort, devState, releasedThrough, allowed, excludedFuture, excludedPrivate };
}

export async function checkOnly(cohortInput) {
  const cohort = await readCohort(cohortInput);
  const devState = await readDevCourseState();
  const releasedThrough = cohort.releasedThrough;
  const relStr = String(releasedThrough).padStart(2, "0");

  console.log("==================================================");
  console.log(` 🛡️  PUBLIC RELEASE SECURITY CHECK [${cohort.cohortId}]`);
  console.log("==================================================");
  console.log(`• Cohort:                  ${cohort.cohortId}`);
  console.log(`• Target Repo:             AndreyFomenko/${cohort.projectName}`);
  console.log(`• Checking releasedThrough: ${relStr}`);

  const allFiles = await collectAllTrackedAndWorkspaceFiles();
  const { allowed } = filterFilesForRelease(allFiles, releasedThrough, devState, cohort);
  const violations = await validateSecurityAndBoundaries(allowed, releasedThrough);

  if (violations.length > 0) {
    console.error("\n❌ ================================================");
    console.error("   PUBLICATION ABORTED: ПОРУШЕННЯ БЕЗПЕКИ АБО МЕЖ РЕЛІЗУ!");
    console.error("   ================================================");
    for (const v of violations) {
      console.error(`   ❌ [${v.file}]: ${v.reason}`);
    }
    process.exit(1);
  }

  console.log(`• Total sanitized public files: ${allowed.length}`);
  console.log("\n✔️ PASS: Жодних private skills, secrets або майбутніх lessons не виявлено.");
  console.log("✔️ PASS: Релізні межі та перевірка безпеки повністю успішні (Dry-Run).");
  console.log("==================================================");
}

export async function ensurePublicGitLabProject(projectName, description) {
  const projectPath = `AndreyFomenko/${projectName}`;
  console.log(`\n🔍 Перевірка наявності GitLab проєкту ${projectPath}...`);
  try {
    execSync(`glab repo view ${projectPath}`, { stdio: "ignore" });
    console.log(`✔️ Репозиторій ${projectPath} вже існує.`);
  } catch {
    console.log(`⚡ Репозиторій ${projectPath} не знайдено. Створюємо новий PUBLIC проєкт...`);
    execSync(
      `glab repo create ${projectName} --public -d "${description || projectName}" --skipGitInit`,
      { stdio: "inherit" },
    );
    console.log(`✔️ Публічний репозиторій ${projectPath} успішно створено!`);
  }
}

export async function executePublicSync(cohortInput, targetReleaseLevel, options = {}) {
  const cohort = await readCohort(cohortInput);
  const preserveDev = options.preserveDev === true;
  if (options.preserveDev !== undefined && typeof options.preserveDev !== "boolean") {
    throw new Error("preserveDev must be a boolean");
  }
  if (preserveDev && cohort.devMode !== "cohort") {
    throw new Error("--preserve-dev is available only for cohort-mode publications");
  }
  if (preserveDev && typeof targetReleaseLevel === "number") {
    throw new Error("--preserve-dev cannot be combined with --release");
  }
  if (options.remoteUrl && !preserveDev) {
    throw new Error("remoteUrl is supported only with preserveDev");
  }
  const projectName = cohort.projectName;
  const projectPath = `AndreyFomenko/${projectName}`;
  const remoteSsh = `git@gitlab.com:${projectPath}.git`;

  console.log("==================================================");
  console.log(` 🚀 PUBLIC SYNCHRONIZATION / RELEASE [${cohort.cohortId}]`);
  console.log("==================================================");

  // 1. Check if private working tree is clean
  if (!options.allowDirty) {
    const treeCheck = checkPrivateWorkingTreeClean();
    if (!treeCheck.clean) {
      console.error("\n❌ ================================================");
      console.error("   PUBLICATION ABORTED:");
      console.error("   Private working tree contains uncommitted changes.");
      console.error("   Будь ласка, створіть commit у PRIVATE репозиторії перед публікацією.");
      console.error("   (Або передайте --allow-dirty для тестування).");
      console.error("   ================================================");
      console.error(treeCheck.status);
      process.exit(1);
    }
  }

  // 2. Adjust target release level if requested
  if (typeof targetReleaseLevel === "number") {
    if (targetReleaseLevel < cohort.releasedThrough) {
      console.error(
        `\n❌ Помилка: target release level (${targetReleaseLevel}) менший за поточний (${cohort.releasedThrough}). Зменшення рівня релізу заборонено.`,
      );
      process.exit(1);
    }
    cohort.releasedThrough = targetReleaseLevel;
    if (cohort.devMode === "cohort") {
      cohort.devLesson = targetReleaseLevel;
    }
    await writeCohort(cohort);
  }

  const devState = await readDevCourseState();
  const releasedThrough = cohort.releasedThrough;
  const relStr = String(releasedThrough).padStart(2, "0");
  const privateSha = getPrivateHeadSha();

  console.log(`• Cohort:           ${cohort.cohortId}`);
  console.log(`• Target Repo:      ${projectPath}`);
  console.log(`• Released through: ${relStr}`);
  console.log(
    `• Dev mode:         ${cohort.devMode} (${cohort.devMode === "cohort" ? `lesson ${cohort.devLesson}` : `live dev ${devState.lesson}`})`,
  );
  console.log(`• Source Commit:    ${privateSha}`);

  // 3. Collect sanitized files
  const allFiles = await collectAllTrackedAndWorkspaceFiles();
  const { allowed, devIsReleased } = filterFilesForRelease(
    allFiles,
    releasedThrough,
    devState,
    cohort,
  );

  // 4. Security Gate
  console.log("\n🛡️  Виконання Security Gate...");
  const violations = await validateSecurityAndBoundaries(allowed, releasedThrough);
  if (violations.length > 0) {
    console.error("\n❌ ================================================");
    console.error("   PUBLICATION ABORTED: ПОРУШЕННЯ БЕЗПЕКИ!");
    console.error("   ================================================");
    for (const v of violations) {
      console.error(`   ❌ [${v.file}]: ${v.reason}`);
    }
    process.exit(1);
  }
  console.log(`✔️ Security Gate passed (${allowed.length} файлів підготовлено).`);

  // 5. Ensure GitLab repo
  if (!preserveDev) {
    await ensurePublicGitLabProject(projectName, cohort.description);
  }

  // 6. Isolated temp clone
  const tempPublicDir = join(tmpdir(), `ai-agents-practical-${cohort.cohortId}-dist`);
  console.log(`\n📂 Підготовка ізольованої директорії: ${tempPublicDir}`);

  if (existsSync(tempPublicDir)) {
    await rm(tempPublicDir, { recursive: true, force: true });
  }
  await mkdir(tempPublicDir, { recursive: true });

  const cloneRemote = options.remoteUrl || remoteSsh;
  console.log(`📥 Клонування публічного репозиторію з ${cloneRemote}...`);
  try {
    execFileSync("git", ["clone", cloneRemote, tempPublicDir], { stdio: "inherit" });
  } catch (error) {
    if (preserveDev) {
      await rm(tempPublicDir, { recursive: true, force: true });
      throw new Error(
        `--preserve-dev requires an existing public repository; clone failed: ${error.message}`,
      );
    }
    console.log("⚡ Ініціалізуємо нову гілку main у публічному репозиторії...");
    execSync(`git init "${tempPublicDir}"`, { stdio: "inherit" });
    execSync(`git -C "${tempPublicDir}" branch -M main`, { stdio: "inherit" });
    execSync(`git -C "${tempPublicDir}" remote add origin ${remoteSsh}`, {
      stdio: "inherit",
    });
  }

  let preservedDevSnapshot;
  let preservedDevGitTree;
  if (preserveDev) {
    try {
      const devDir = join(tempPublicDir, "dev");
      preservedDevSnapshot = await snapshotDirectory(devDir);
      preservedDevGitTree = snapshotGitDevTree(tempPublicDir);
      const publicDir = join(tempPublicDir, ".public");
      const publicDirStat = await lstat(publicDir);
      if (!publicDirStat.isDirectory()) {
        throw new Error("--preserve-dev requires a real cloned .public directory");
      }
      const publicStatePath = join(tempPublicDir, ".public", "state.json");
      const publicStateStat = await lstat(publicStatePath);
      if (!publicStateStat.isFile()) {
        throw new Error("--preserve-dev requires a regular cloned .public/state.json");
      }
      const publicStateContent = await readFile(publicStatePath);
      validatePreservedDevMetadata(
        preservedDevSnapshot,
        publicStateContent,
        releasedThrough,
        cohort,
      );
    } catch (error) {
      await rm(tempPublicDir, { recursive: true, force: true });
      throw error;
    }
  }

  // 7. Clean existing files (except .git and conditionally dev)
  console.log("\n🧹 Очищення публічного working tree від застарілих файлів...");
  const existingPublicEntries = await readdir(tempPublicDir, { withFileTypes: true });
  for (const entry of existingPublicEntries) {
    if (entry.name === ".git") continue;
    if (entry.name === "dev" && (preserveDev || (cohort.devMode !== "cohort" && !devIsReleased))) {
      // Keep the validated cohort snapshot or unreleased legacy dev/ untouched.
      continue;
    }
    await rm(join(tempPublicDir, entry.name), { recursive: true, force: true });
  }

  // 8. Copy sanitized files
  console.log(`📦 Копіювання ${allowed.length} санітизованих файлів...`);
  for (const file of allowed) {
    const destPath = join(tempPublicDir, file.relPath);
    await mkdir(dirname(destPath), { recursive: true });

    if (file.relPath === "STUDENTS.md" && projectName !== DEFAULT_PUBLIC_PROJECT_NAME) {
      let text = await readFile(file.fullPath, "utf8");
      text = text.replace(new RegExp(DEFAULT_PUBLIC_PROJECT_NAME, "g"), projectName);
      await writeFile(destPath, text, "utf8");
    } else if (file.relPath === "package.json") {
      const content = await readFile(file.fullPath, "utf8");
      await writeFile(
        destPath,
        transformCohortSnapshotPackageJson(content, cohort, releasedThrough),
        "utf8",
      );
    } else {
      const content = await readFile(file.fullPath);
      await writeFile(destPath, content);
    }
  }

  // 9. dev/ directory handling
  if (preserveDev) {
    console.log(
      `🔒 Збережено перевірений публічний dev/ snapshot для lesson ${cohort.devLesson} (${cohort.devProvider || "openrouter"}/${cohort.devStage || "starter"}).`,
    );
  } else if (cohort.devMode === "cohort") {
    const targetLessonNum = cohort.devLesson || releasedThrough;
    const targetLessonDir = findLessonDir(targetLessonNum, cohort.devProvider || "openrouter");
    const targetStage = cohort.devStage || "starter";
    const starterDir = join(repositoryRoot, targetLessonDir, targetStage);

    const publicDevDir = join(tempPublicDir, "dev");
    if (existsSync(publicDevDir)) {
      await rm(publicDevDir, { recursive: true, force: true });
    }
    await mkdir(publicDevDir, { recursive: true });

    if (existsSync(starterDir)) {
      console.log(
        `📦 Ініціалізація dev/ для ${cohort.cohortId} з ${targetLessonDir}/${targetStage}...`,
      );
      await copyDir(starterDir, publicDevDir);
    }

    const safeState = {
      lesson: targetLessonNum,
      lessonDir: targetLessonDir,
      provider: cohort.devProvider || "openrouter",
      stage: targetStage,
      checkpoint: 0,
    };
    await writeFile(
      join(publicDevDir, ".course-state.json"),
      JSON.stringify(safeState, null, 2) + "\n",
      "utf8",
    );
  } else if (!devIsReleased) {
    const publicDevDir = join(tempPublicDir, "dev");
    if (existsSync(publicDevDir)) {
      console.log(
        `🔒 Збережено попередній публічний стан dev/ (оскільки поточний dev=${devState.lesson} > releasedThrough=${relStr}).`,
      );
    } else {
      console.log(
        `🔒 dev/ відсутній у публічному checkout: ініціалізація базового snapshot dev/ для lesson ${relStr}...`,
      );
      await mkdir(publicDevDir, { recursive: true });
      const fallbackLesson = findLessonDir(releasedThrough, "openrouter");
      const fallbackStarter = join(repositoryRoot, fallbackLesson, "starter");
      if (existsSync(fallbackStarter)) {
        await copyDir(fallbackStarter, publicDevDir);
      }
      const safeState = {
        lesson: releasedThrough,
        lessonDir: fallbackLesson,
        provider: "openrouter",
        stage: "starter",
        checkpoint: 0,
      };
      await writeFile(
        join(publicDevDir, ".course-state.json"),
        JSON.stringify(safeState, null, 2) + "\n",
        "utf8",
      );
    }
  }

  // 10. Write cohort's public state file
  await mkdir(join(tempPublicDir, ".public"), { recursive: true });
  await writeFile(
    join(tempPublicDir, ".public", "state.json"),
    JSON.stringify({ releasedThrough: cohort.releasedThrough }, null, 2) + "\n",
    "utf8",
  );

  // 11. Physical verification of public clone (DOUBLE CHECK)
  console.log("🛡️  Повторна перевірка безпеки у public checkout...");
  const checkoutFiles = [];
  async function walkCheckout(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".git") continue;
      const full = join(dir, entry.name);
      const rel = relative(tempPublicDir, full).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        await walkCheckout(full);
      } else if (entry.isFile()) {
        checkoutFiles.push({ fullPath: full, relPath: rel });
      }
    }
  }
  await walkCheckout(tempPublicDir);

  const checkoutViolations = await validateSecurityAndBoundaries(checkoutFiles, releasedThrough);
  if (checkoutViolations.length > 0) {
    console.error("\n❌ ================================================");
    console.error("   PUBLICATION ABORTED: ЗНАЙДЕНО ПОРУШЕННЯ У PUBLIC TREE!");
    console.error("   ================================================");
    for (const v of checkoutViolations) {
      console.error(`   ❌ [${v.file}]: ${v.reason}`);
    }
    await rm(tempPublicDir, { recursive: true, force: true });
    process.exit(1);
  }

  if (preservedDevSnapshot) {
    try {
      assertSnapshotsEqual(
        preservedDevSnapshot,
        await snapshotDirectory(join(tempPublicDir, "dev")),
      );
    } catch (error) {
      await rm(tempPublicDir, { recursive: true, force: true });
      throw error;
    }
  }

  // 12. Check Git status in public clone
  execSync(`git -C "${tempPublicDir}" add -A`, { stdio: "inherit" });
  const statusOutput = execSync(`git -C "${tempPublicDir}" status --porcelain`, {
    encoding: "utf8",
  }).trim();

  if (preservedDevGitTree) {
    try {
      assertGitDevTreesEqual(preservedDevGitTree, snapshotGitDevTree(tempPublicDir, true));
    } catch (error) {
      await rm(tempPublicDir, { recursive: true, force: true });
      throw error;
    }
  }

  if (!statusOutput) {
    console.log(
      "\n✔️ Публічний репозиторій вже містить актуальний стан для release level " +
        relStr +
        ". Змін немає.",
    );
    await rm(tempPublicDir, { recursive: true, force: true });
    return;
  }

  // 13. Create commit with private commit trailer
  const commitSubject = `release(${cohort.cohortId}): sync published lessons through ${relStr}`;
  const commitBody = `Source-Private-Commit: ${privateSha}\nReleased-Through: ${relStr}\nCohort: ${cohort.cohortId}`;
  const fullCommitMessage = `${commitSubject}\n\n${commitBody}\n`;

  console.log(`\n📝 Створення коміту в публічному репозиторії:`);
  console.log(`   ${commitSubject}`);
  console.log(`   Source-Private-Commit: ${privateSha}`);
  console.log(`   Released-Through:      ${relStr}`);

  const msgFile = join(tempPublicDir, ".git", "RELEASE_COMMIT_MSG");
  await writeFile(msgFile, fullCommitMessage, "utf8");
  execSync(`git -C "${tempPublicDir}" commit -F "${msgFile}"`, { stdio: "inherit" });

  // 14. Push
  console.log(`\n🚀 Push у публічний репозиторій ${projectPath} (origin/main)...`);
  execSync(`git -C "${tempPublicDir}" push origin main`, { stdio: "inherit" });

  // 15. Cleanup
  console.log("\n🧹 Очищення тимчасової директорії...");
  await rm(tempPublicDir, { recursive: true, force: true });

  console.log("\n==================================================");
  console.log(` 🎉 ПУБЛІКАЦІЮ ДЛЯ ${cohort.cohortId} УСПІШНО ЗАВЕРШЕНО!`);
  console.log(` 🌐 URL: https://gitlab.com/${projectPath}`);
  console.log(` 📦 Released through: lesson ${relStr}`);
  console.log(` 🔗 Source Commit:    ${privateSha}`);
  console.log("==================================================");
}

async function main() {
  const args = process.argv.slice(2);
  let cohortInput = null;
  const cohortIdx = args.findIndex((a) => a === "--cohort" || a === "-c" || a === "--group");
  if (cohortIdx !== -1 && args[cohortIdx + 1]) {
    cohortInput = args[cohortIdx + 1];
  }

  const allowDirty = args.includes("--allow-dirty");
  const preserveDev = args.includes("--preserve-dev");

  if (args.includes("--list-cohorts") || args.includes("-l")) {
    const cohorts = await listCohorts();
    console.log("==================================================");
    console.log(" 👥 REGISTERED COHORTS");
    console.log("==================================================");
    for (const c of cohorts) {
      console.log(` • ID:              ${c.cohortId}`);
      console.log(`   Group Index:     ${c.index || "N/A"}`);
      console.log(`   Aliases:         ${(c.aliases || []).join(", ") || "none"}`);
      console.log(`   Project:         ${c.projectName}`);
      console.log(`   Released:        lesson ${String(c.releasedThrough).padStart(2, "0")}`);
      console.log(
        `   Dev Mode:        ${c.devMode} (${c.devMode === "cohort" ? `lesson ${c.devLesson}` : "live dev"})`,
      );
      console.log(`   Description:     ${c.description}`);
      console.log("--------------------------------------------------");
    }
    return;
  }

  if (args.includes("--status") || args.includes("-s")) {
    await showStatus(cohortInput);
  } else if (args.includes("--check-only") || (args.includes("-c") && !cohortInput)) {
    await checkOnly(cohortInput);
  } else if (args.includes("--release") || args.includes("-r")) {
    const idx = args.indexOf("--release") !== -1 ? args.indexOf("--release") : args.indexOf("-r");
    const target = parseLessonNumber(args[idx + 1] || 1);
    await executePublicSync(cohortInput, target, { allowDirty, preserveDev });
  } else {
    // Default: sync current releasedThrough
    await executePublicSync(cohortInput, undefined, { allowDirty, preserveDev });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("\n❌ Помилка під час виконання:", err);
    process.exit(1);
  });
}
