import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, normalize, resolve } from "node:path";

const fileLocks = new Map<string, Promise<void>>();

export async function withJsonFileLock<T>(
  filePath: string,
  operation: () => Promise<T>,
): Promise<T> {
  const lockKey = getLockKey(filePath);
  const previousLock = fileLocks.get(lockKey) ?? Promise.resolve();
  let releaseLock!: () => void;
  const currentLock = new Promise<void>((resolveLock) => {
    releaseLock = resolveLock;
  });

  fileLocks.set(lockKey, currentLock);
  await previousLock;

  try {
    return await operation();
  } finally {
    releaseLock();

    if (fileLocks.get(lockKey) === currentLock) {
      fileLocks.delete(lockKey);
    }
  }
}

export async function writeJsonFileAtomically(filePath: string, contents: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;

  try {
    await writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx" });
  } catch (error: unknown) {
    if (isFileAlreadyExistsError(error)) {
      throw error;
    }

    await cleanupTemporaryFile(temporaryPath, error);
  }

  try {
    await rename(temporaryPath, filePath);
  } catch (error: unknown) {
    await cleanupTemporaryFile(temporaryPath, error);
  }
}

async function cleanupTemporaryFile(temporaryPath: string, originalError: unknown): Promise<never> {
  try {
    await rm(temporaryPath, { force: true });
  } catch (cleanupError: unknown) {
    throw new AggregateError(
      [originalError, cleanupError],
      "JSON snapshot update failed and its temporary file could not be removed.",
    );
  }

  throw originalError;
}

function isFileAlreadyExistsError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

function getLockKey(filePath: string): string {
  const normalizedPath = normalize(resolve(filePath));
  return process.platform === "win32" ? normalizedPath.toLocaleLowerCase("en-US") : normalizedPath;
}
