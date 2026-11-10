import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const launcherPath = path.join(repositoryRoot, "scripts/run-tsx-entrypoint.mjs");
const temporaryRoot = path.join(repositoryRoot, ".tmp");
const fixtureDirectories: string[] = [];

async function createFixture() {
  await mkdir(temporaryRoot, { recursive: true });
  const fixtureDirectory = await mkdtemp(path.join(temporaryRoot, "tsx-entrypoint-"));
  fixtureDirectories.push(fixtureDirectory);
  return fixtureDirectory;
}

function runLauncher(args: string[], cwd: string) {
  return spawnSync(process.execPath, [launcherPath, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 10_000,
  });
}

function waitForMessage(child: ReturnType<typeof spawn>) {
  return new Promise<number>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      child.off("message", onMessage);
      child.off("error", onError);
      child.off("exit", onExit);
    };
    const onMessage = (message: unknown) => {
      cleanup();
      if (
        typeof message !== "object" ||
        message === null ||
        !("port" in message) ||
        typeof message.port !== "number"
      ) {
        reject(new Error(`Unexpected fixture server message: ${JSON.stringify(message)}`));
        return;
      }

      resolve(message.port);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup();
      reject(new Error(`Fixture server exited before listening (${code ?? signal})`));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for the fixture server"));
    }, 5_000);
    child.once("message", onMessage);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}

function waitForExit(child: ReturnType<typeof spawn>, timeoutMessage: string) {
  return new Promise<[number | null, NodeJS.Signals | null]>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      child.off("exit", onExit);
      child.off("error", onError);
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup();
      resolve([code, signal]);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(timeoutMessage));
    }, 3_000);
    child.once("exit", onExit);
    child.once("error", onError);
  });
}

afterEach(async () => {
  const temporaryRootWithSeparator = `${path.resolve(temporaryRoot)}${path.sep}`;

  for (const fixtureDirectory of fixtureDirectories.splice(0)) {
    const resolvedDirectory = path.resolve(fixtureDirectory);
    if (!resolvedDirectory.startsWith(temporaryRootWithSeparator)) {
      throw new Error(`Refusing to remove fixture outside .tmp: ${resolvedDirectory}`);
    }

    await rm(resolvedDirectory, { force: true, recursive: true });
  }
});

describe("run-tsx-entrypoint", () => {
  it("runs the direct module once, keeps imported guards inactive, resolves .js imports, and forwards argv and cwd", async () => {
    const fixtureDirectory = await createFixture();
    const resultPath = path.join(fixtureDirectory, "result.json");
    const secondaryMarkerPath = path.join(fixtureDirectory, "secondary-started");

    await writeFile(
      path.join(fixtureDirectory, "secondary.ts"),
      `import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  writeFileSync(${JSON.stringify(secondaryMarkerPath)}, "started");
}
`,
    );
    await writeFile(
      path.join(fixtureDirectory, "entry.ts"),
      `import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import "./secondary.js";

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  writeFileSync(${JSON.stringify(resultPath)}, JSON.stringify({
    args: process.argv.slice(2),
    cwd: process.cwd(),
  }) + "\\n", { flag: "a" });
}
`,
    );

    const forwardedArguments = ["argument with spaces", "--mode=all"];
    const result = runLauncher(
      [
        path.relative(repositoryRoot, path.join(fixtureDirectory, "entry.ts")),
        ...forwardedArguments,
      ],
      fixtureDirectory,
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(await readFile(resultPath, "utf8")).toBe(
      `${JSON.stringify({ args: forwardedArguments, cwd: repositoryRoot })}\n`,
    );
    await expect(readFile(secondaryMarkerPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("propagates a failing entrypoint as a nonzero child exit", async () => {
    const fixtureDirectory = await createFixture();
    await writeFile(
      path.join(fixtureDirectory, "failure.ts"),
      `throw new Error("fixture entrypoint failed");\n`,
    );

    const result = runLauncher(
      [path.relative(repositoryRoot, path.join(fixtureDirectory, "failure.ts"))],
      fixtureDirectory,
    );

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("fixture entrypoint failed");
  });

  it("keeps a guarded server alive for a health request and stops it cleanly", async () => {
    const fixtureDirectory = await createFixture();
    const entryPath = path.join(fixtureDirectory, "server.ts");
    await writeFile(
      entryPath,
      `import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("healthy");
  });
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (address && typeof address !== "string") process.send?.({ port: address.port });
  });
  process.on("message", (message) => {
    if (message === "stop") server.close(() => process.exit(0));
  });
}
`,
    );

    const child = spawn(
      process.execPath,
      [launcherPath, path.relative(repositoryRoot, entryPath)],
      { cwd: fixtureDirectory, stdio: ["ignore", "ignore", "pipe", "ipc"] },
    );
    let stderr = "";
    child.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });

    try {
      const port = await waitForMessage(child);
      const response = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(3_000),
      });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("healthy");

      child.send("stop");
      const [code] = await waitForExit(child, "Fixture server did not stop cleanly");
      expect(code).toBe(0);
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill();
        await waitForExit(child, "Fixture server remained alive after kill");
      }
    }

    expect(stderr).toBe("");
  }, 10_000);

  it("preserves usage and missing-file errors", () => {
    const usageResult = runLauncher([], repositoryRoot);
    const missingResult = runLauncher([".tmp/tsx-entrypoint-missing.ts"], repositoryRoot);

    expect(usageResult.status).toBe(2);
    expect(usageResult.stderr).toContain("Usage: node scripts/run-tsx-entrypoint.mjs");
    expect(missingResult.status).toBe(2);
    expect(missingResult.stderr).toContain(
      "TypeScript entrypoint does not exist: .tmp/tsx-entrypoint-missing.ts",
    );
  });
});
