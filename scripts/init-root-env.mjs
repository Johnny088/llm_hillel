#!/usr/bin/env node

import { copyFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const examplePath = path.join(repositoryRoot, ".env.example");
const environmentPath = path.join(repositoryRoot, ".env");

try {
  await stat(environmentPath);
  console.log("Root .env already exists; it was left unchanged.");
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw error;
  }

  await copyFile(examplePath, environmentPath);
  console.log("Created root .env from .env.example.");
  console.log("Add OPENROUTER_API_KEY to .env before running the migration.");
}
