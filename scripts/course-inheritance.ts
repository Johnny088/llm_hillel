import { lstat, readFile, readdir } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

const lessonDirectories = [
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
const ignoredDirectoryNames = new Set([
  ".git",
  ".tmp",
  ".cache",
  ".vite",
  "coverage",
  "dist",
  "node_modules",
]);

export type CourseProvider = "openai" | "openrouter";

export interface CourseInheritanceTransition {
  provider: CourseProvider;
  fromLesson: string;
  toLesson: string;
  sourceRoot: string;
  targetRoot: string;
}

export interface CourseInheritanceOptions {
  includeMarkdown?: boolean;
}

export interface CourseInheritanceResult {
  sourceRoot: string;
  targetRoot: string;
  sourceFiles: string[];
  targetFiles: string[];
  matchedFiles: string[];
  missingFiles: string[];
  extraFiles: string[];
  changedFiles: string[];
  unsafeEntries: string[];
  ok: boolean;
}

interface ListedFiles {
  files: string[];
  unsafeEntries: string[];
}

/** Returns the required same-provider transitions, deliberately excluding 01 → 02. */
export function getCanonicalCourseTransitions(
  provider: CourseProvider,
): CourseInheritanceTransition[] {
  const names = lessonDirectories.map((lesson) =>
    provider === "openrouter" ? `${lesson}-openrouter` : lesson,
  );

  return names.slice(1, -1).map((fromLesson, index) => {
    const toLesson = names[index + 2];
    if (toLesson === undefined) {
      throw new Error(`Missing successor lesson after ${fromLesson}.`);
    }

    return {
      provider,
      fromLesson,
      toLesson,
      sourceRoot: `${fromLesson}/solution`,
      targetRoot: `${toLesson}/starter`,
    };
  });
}

/** Compares the exact relative file set and bytes, excluding Markdown unless requested. */
export async function inspectCourseInheritance(
  sourceRoot: string,
  targetRoot: string,
  options: CourseInheritanceOptions = {},
): Promise<CourseInheritanceResult> {
  const absoluteSourceRoot = resolve(sourceRoot);
  const absoluteTargetRoot = resolve(targetRoot);
  await requireDirectory(absoluteSourceRoot, "source");
  await requireDirectory(absoluteTargetRoot, "target");

  const includeMarkdown = options.includeMarkdown ?? false;
  const [sourceListing, targetListing] = await Promise.all([
    listFiles(absoluteSourceRoot, includeMarkdown),
    listFiles(absoluteTargetRoot, includeMarkdown),
  ]);
  const sourceSet = new Set(sourceListing.files);
  const targetSet = new Set(targetListing.files);
  const sharedFiles = sourceListing.files.filter((file) => targetSet.has(file));
  const changedFiles: string[] = [];
  const unreadableEntries: string[] = [];

  for (const relativePath of sharedFiles) {
    try {
      const [source, target] = await Promise.all([
        readFile(resolve(absoluteSourceRoot, relativePath)),
        readFile(resolve(absoluteTargetRoot, relativePath)),
      ]);
      if (!source.equals(target)) changedFiles.push(relativePath);
    } catch (error) {
      unreadableEntries.push(
        `${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const unsafeEntries = [
    ...sourceListing.unsafeEntries.map((path) => `source/${path}`),
    ...targetListing.unsafeEntries.map((path) => `target/${path}`),
    ...unreadableEntries.map((path) => `unreadable/${path}`),
  ].sort();
  const missingFiles = sourceListing.files.filter((file) => !targetSet.has(file));
  const extraFiles = targetListing.files.filter((file) => !sourceSet.has(file));
  const result: CourseInheritanceResult = {
    sourceRoot: absoluteSourceRoot,
    targetRoot: absoluteTargetRoot,
    sourceFiles: sourceListing.files,
    targetFiles: targetListing.files,
    matchedFiles: sharedFiles.filter((file) => !changedFiles.includes(file)),
    missingFiles,
    extraFiles,
    changedFiles,
    unsafeEntries,
    ok: false,
  };
  result.ok =
    result.missingFiles.length === 0 &&
    result.extraFiles.length === 0 &&
    result.changedFiles.length === 0 &&
    result.unsafeEntries.length === 0;
  return result;
}

/** Throws a concise, path-specific error unless the inherited trees match exactly. */
export async function verifyCourseInheritance(
  sourceRoot: string,
  targetRoot: string,
  options: CourseInheritanceOptions = {},
): Promise<CourseInheritanceResult> {
  const result = await inspectCourseInheritance(sourceRoot, targetRoot, options);
  if (!result.ok) throw new Error(formatCourseInheritanceFailure(result));
  return result;
}

export function formatCourseInheritanceFailure(result: CourseInheritanceResult): string {
  const details = [
    ...result.missingFiles.map((path) => `missing from target: ${path}`),
    ...result.extraFiles.map((path) => `extra in target: ${path}`),
    ...result.changedFiles.map((path) => `byte mismatch: ${path}`),
    ...result.unsafeEntries.map((path) => `unsafe or unreadable entry: ${path}`),
  ];
  return `Course inheritance mismatch (${result.sourceRoot} → ${result.targetRoot}):\n${details.join("\n")}`;
}

async function requireDirectory(path: string, label: string): Promise<void> {
  const metadata = await lstat(path).catch((error: unknown) => {
    throw new Error(
      `Course inheritance ${label} root is unavailable: ${path} (${error instanceof Error ? error.message : String(error)}).`,
    );
  });
  if (!metadata.isDirectory()) {
    throw new Error(`Course inheritance ${label} root is not a directory: ${path}.`);
  }
}

async function listFiles(root: string, includeMarkdown: boolean): Promise<ListedFiles> {
  const files: string[] = [];
  const unsafeEntries: string[] = [];

  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = resolve(directory, entry.name);
      const relativePath = relative(root, absolutePath).split(sep).join("/");

      if (entry.isSymbolicLink()) {
        unsafeEntries.push(relativePath);
      } else if (entry.isDirectory()) {
        if (!ignoredDirectoryNames.has(entry.name)) await visit(absolutePath);
      } else if (entry.isFile()) {
        if (includeMarkdown || extname(entry.name).toLowerCase() !== ".md") {
          files.push(relativePath);
        }
      } else {
        unsafeEntries.push(relativePath);
      }
    }
  };

  await visit(root);
  files.sort();
  unsafeEntries.sort();
  return { files, unsafeEntries };
}
