#!/usr/bin/env node

import { access } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [entrypointArgument, ...forwardedArguments] = process.argv.slice(2);

if (!entrypointArgument) {
  console.error("Usage: node scripts/run-tsx-entrypoint.mjs <entrypoint.ts> [arguments...]");
  process.exit(2);
}

const entrypointPath = path.resolve(repositoryRoot, entrypointArgument);

try {
  await access(entrypointPath);
} catch {
  console.error(`TypeScript entrypoint does not exist: ${entrypointArgument}`);
  process.exit(2);
}

if (process.platform === "win32" && typeof process.geteuid !== "function") {
  Object.defineProperty(process, "geteuid", {
    configurable: true,
    value: () => 0,
  });
}

const requireFromProject = createRequire(path.join(repositoryRoot, "__tsx_runtime__.cjs"));
process.chdir(repositoryRoot);

const { register } = requireFromProject("tsx/esm/api");
register();

process.argv = [process.execPath, entrypointPath, ...forwardedArguments];

await import(pathToFileURL(entrypointPath).href);
