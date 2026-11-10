import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as ts from "typescript";

const sourceExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const fallbackModelName = /(?:^|_)fallback_?models?$/iu;

export interface ModelFallbackViolation {
  file: string;
  line: number;
  rule: "fallback-model-config" | "request-model-list";
}

function propertyNameText(name: ts.PropertyName | ts.BindingName | undefined): string | undefined {
  if (name === undefined) {
    return undefined;
  }

  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  if (ts.isComputedPropertyName(name) && ts.isStringLiteral(name.expression)) {
    return name.expression.text;
  }

  return undefined;
}

function isFallbackModelName(name: string | undefined): boolean {
  return name !== undefined && fallbackModelName.test(name.replaceAll(/[-\s]/gu, "_"));
}

function isRequestModelList(
  node: ts.PropertyAssignment | ts.PropertySignature | ts.ShorthandPropertyAssignment,
): boolean {
  if (ts.isPropertySignature(node)) {
    const declaration = node.parent;
    const ownerName =
      ts.isInterfaceDeclaration(declaration) || ts.isTypeAliasDeclaration(declaration)
        ? declaration.name.text
        : "";
    return /request/iu.test(ownerName);
  }

  let current: ts.Node = node.parent;
  while (current.parent !== undefined) {
    const parent = current.parent;
    if (ts.isCallExpression(parent) && parent.arguments.some((argument) => argument === current)) {
      return (
        ts.isPropertyAccessExpression(parent.expression) && parent.expression.name.text === "create"
      );
    }

    if (ts.isVariableDeclaration(parent)) {
      const variableName = propertyNameText(parent.name);
      return variableName === "request" || /request/iu.test(parent.type?.getText() ?? "");
    }

    if (
      !ts.isObjectLiteralExpression(parent) &&
      !ts.isSpreadAssignment(parent) &&
      !ts.isConditionalExpression(parent) &&
      !ts.isParenthesizedExpression(parent)
    ) {
      return false;
    }

    current = parent;
  }

  return false;
}

function scanFile(filePath: string, lessonRoot: string): ModelFallbackViolation[] {
  const text = readFileSync(filePath, "utf8");
  const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
  const violations: ModelFallbackViolation[] = [];
  const relativeFile = relative(lessonRoot, filePath).split(sep).join("/");

  function add(node: ts.Node, rule: ModelFallbackViolation["rule"]): void {
    violations.push({
      file: relativeFile,
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      rule,
    });
  }

  function visit(node: ts.Node): void {
    if (
      (ts.isIdentifier(node) || ts.isStringLiteral(node)) &&
      (isFallbackModelName(node.text) || /OPENROUTER_FALLBACK_MODEL/iu.test(node.text))
    ) {
      add(node, "fallback-model-config");
    }

    if (
      (ts.isPropertyAssignment(node) ||
        ts.isPropertySignature(node) ||
        ts.isShorthandPropertyAssignment(node)) &&
      propertyNameText(node.name) === "models" &&
      isRequestModelList(node)
    ) {
      add(node, "request-model-list");
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
  return violations;
}

function collectSourceFiles(root: string, lessonRoot: string, inheritedScope = false): string[] {
  const metadata = lstatSync(root);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    return [];
  }

  const inSourceScope = inheritedScope || basename(root) === "src" || basename(root) === "evals";
  const files: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.isSymbolicLink()) {
      continue;
    }

    const entryPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(entryPath, lessonRoot, inSourceScope));
    } else if (
      inSourceScope &&
      entry.isFile() &&
      sourceExtensions.has(entry.name.slice(entry.name.lastIndexOf(".")))
    ) {
      files.push(entryPath);
    }
  }

  return files;
}

/** Finds fallback-model options/configuration and request model lists in one learning tree. */
export function findModelFallbackViolations(lessonRoot: string): ModelFallbackViolation[] {
  const absoluteRoot = resolve(lessonRoot);
  const rootMetadata = lstatSync(absoluteRoot);
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
    throw new Error("The supplied learning tree must be a real directory.");
  }

  return collectSourceFiles(absoluteRoot, absoluteRoot)
    .flatMap((filePath) => scanFile(filePath, absoluteRoot))
    .sort(
      (left, right) =>
        left.file.localeCompare(right.file) ||
        left.line - right.line ||
        left.rule.localeCompare(right.rule),
    );
}

function parseThroughArgument(args: readonly string[]): number {
  if (args.length === 0) {
    return 7;
  }

  if (args.length !== 2 || args[0] !== "--through" || !/^\d{1,2}$/u.test(args[1] ?? "")) {
    throw new Error("Usage: verify-no-model-fallback.ts [--through N]");
  }

  const through = Number(args[1]);
  if (through < 1 || through > 99) {
    throw new Error("--through must be between 1 and 99.");
  }

  return through;
}

/** Checks only the shared public example; real environment files remain outside policy scope. */
export function findExampleModelFallbackViolations(
  repositoryRoot: string,
): ModelFallbackViolation[] {
  const examplePath = join(resolve(repositoryRoot), ".env.example");
  if (!existsSync(examplePath)) {
    return [];
  }

  return readFileSync(examplePath, "utf8")
    .split(/\r?\n/u)
    .flatMap((line, index) => {
      const key = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/u.exec(line)?.[1];
      return isFallbackModelName(key)
        ? [{ file: ".env.example", line: index + 1, rule: "fallback-model-config" as const }]
        : [];
    });
}

function runCli(): void {
  const through = parseThroughArgument(process.argv.slice(2));
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const lessonDirectories = readdirSync(repositoryRoot, { withFileTypes: true })
    .filter((entry) => {
      const match = /^lesson-(\d{2})-/u.exec(entry.name);
      return (
        entry.isDirectory() &&
        !entry.isSymbolicLink() &&
        match !== null &&
        Number(match[1]) <= through
      );
    })
    .map((entry) => entry.name)
    .sort();
  const violations = lessonDirectories.flatMap((lessonName) => {
    const lessonRoot = join(repositoryRoot, lessonName);
    return findModelFallbackViolations(lessonRoot).map((violation) => ({
      ...violation,
      file: `${lessonName}/${violation.file}`,
    }));
  });
  violations.push(...findExampleModelFallbackViolations(repositoryRoot));

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(`${violation.file}:${violation.line} ${violation.rule}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `No model fallback configuration or request model lists found through Lesson ${through}.`,
  );
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Unable to verify model routing.");
    process.exitCode = 1;
  }
}
