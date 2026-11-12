import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".cts"]);

function walkSourceFiles(directory: string): string[] {
  if (!statSync(directory, { throwIfNoEntry: false })?.isDirectory()) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".tmp", "coverage"].includes(entry.name)) return [];
      return walkSourceFiles(join(directory, entry.name));
    }

    return entry.isFile() && sourceExtensions.has(extname(entry.name))
      ? [join(directory, entry.name)]
      : [];
  });
}

function propertyName(name: ts.PropertyName | ts.BindingName): string | undefined {
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name) && ts.isStringLiteral(name.expression)) {
    return name.expression.text;
  }
  return undefined;
}

function isCatalogMetadataFile(filePath: string): boolean {
  const normalized = relative(repositoryRoot, filePath).split(sep).join("/").toLowerCase();
  return /(?:^|\/)(?:catalog|catalogs|model-capabilities)(?:\/|\.|-)/.test(normalized);
}

function legacyCompletionTokenDeclarations(filePath: string): string[] {
  const sourceText = readFileSync(filePath, "utf8");
  const scriptKind = extname(filePath) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const catalogMetadata = isCatalogMetadataFile(filePath);
  const findings: string[] = [];

  function visit(node: ts.Node): void {
    if (
      !catalogMetadata &&
      ts.isPropertyAssignment(node) &&
      propertyName(node.name) === "max_tokens"
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.name.getStart(sourceFile));
      findings.push(`${relative(repositoryRoot, filePath)}:${line + 1} outgoing/object property`);
    }

    if (
      !catalogMetadata &&
      ts.isPropertySignature(node) &&
      propertyName(node.name) === "max_tokens"
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.name.getStart(sourceFile));
      findings.push(`${relative(repositoryRoot, filePath)}:${line + 1} request/type property`);
    }

    if (
      !catalogMetadata &&
      ts.isPropertyDeclaration(node) &&
      propertyName(node.name) === "max_tokens"
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.name.getStart(sourceFile));
      findings.push(`${relative(repositoryRoot, filePath)}:${line + 1} class request property`);
    }

    if (
      !catalogMetadata &&
      ts.isShorthandPropertyAssignment(node) &&
      node.name.text === "max_tokens"
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.name.getStart(sourceFile));
      findings.push(`${relative(repositoryRoot, filePath)}:${line + 1} shorthand request property`);
    }

    visitChildren(node, visit);
  }

  visit(sourceFile);
  return findings;
}

function visitChildren(node: ts.Node, visit: (child: ts.Node) => void): void {
  ts.forEachChild(node, visit);
}

describe("OpenRouter completion token source contract", () => {
  it("covers every released OpenRouter lesson, source checkpoint, and development source", () => {
    const lessonDirectories = readdirSync(repositoryRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^lesson-\d{2}-.+-openrouter$/.test(entry.name))
      .map((entry) => join(repositoryRoot, entry.name))
      .sort();

    const publicState = JSON.parse(
      readFileSync(join(repositoryRoot, ".public", "state.json"), "utf8"),
    ) as { releasedThrough: number };
    expect(publicState.releasedThrough).toBeGreaterThan(0);
    expect(publicState.releasedThrough).toBeLessThanOrEqual(15);
    expect(lessonDirectories).toHaveLength(publicState.releasedThrough);
    expect(
      lessonDirectories.map((directory) => Number(relative(repositoryRoot, directory).slice(7, 9))),
    ).toEqual(Array.from({ length: publicState.releasedThrough }, (_, index) => index + 1));

    const sourceFiles: string[] = [];
    for (const lessonDirectory of lessonDirectories) {
      for (const stage of ["starter", "solution"] as const) {
        const stageSource = join(lessonDirectory, stage, "src");
        const stageFiles = walkSourceFiles(stageSource);
        expect(
          stageFiles.length,
          `${relative(repositoryRoot, stageSource)} source files`,
        ).toBeGreaterThan(0);
        sourceFiles.push(...stageFiles);
      }

      const checkpointRoot = join(lessonDirectory, "checkpoints");
      sourceFiles.push(...walkSourceFiles(checkpointRoot));
    }

    sourceFiles.push(...walkSourceFiles(join(repositoryRoot, "dev", "src")));
    expect(sourceFiles.length).toBeGreaterThan(0);

    const findings = sourceFiles.flatMap(legacyCompletionTokenDeclarations);
    expect(findings).toEqual([]);
  });
});
