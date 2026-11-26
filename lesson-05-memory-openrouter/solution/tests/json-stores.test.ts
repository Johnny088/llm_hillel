import { mkdtemp, mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import type * as FileSystemPromises from "node:fs/promises";
import { JsonConversationHistoryStore } from "../src/memory/conversation-history.js";
import { JsonUserFactStore } from "../src/memory/user-facts.js";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof FileSystemPromises>();

  return {
    ...actual,
    readFile: vi.fn(actual.readFile),
    rename: vi.fn(actual.rename),
    writeFile: vi.fn(actual.writeFile),
  };
});

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "lesson05-json-store-"));
  temporaryDirectories.push(directory);
  return directory;
}

describe("JSON memory stores", () => {
  it("treats missing files as empty state and persists conversation and facts across store instances", async () => {
    const directory = await createTemporaryDirectory();
    const historyPath = join(directory, "history.json");
    const factsPath = join(directory, "facts.json");
    const history = new JsonConversationHistoryStore(historyPath, () => "conversation_1");
    const fact = { category: "preferredStack" as const, value: "TypeScript" };

    await expect(new JsonUserFactStore(factsPath).list()).resolves.toEqual([]);
    await expect(history.create()).resolves.toBe("conversation_1");
    await history.save("conversation_1", [
      { userMessage: "Я вивчаю TypeScript.", assistantMessage: { content: "Запам'ятала." } },
    ]);
    await new JsonUserFactStore(factsPath).save(fact);

    await expect(
      new JsonConversationHistoryStore(historyPath).load("conversation_1"),
    ).resolves.toEqual([
      { userMessage: "Я вивчаю TypeScript.", assistantMessage: { content: "Запам'ятала." } },
    ]);
    await expect(new JsonUserFactStore(factsPath).list()).resolves.toEqual([fact]);
  });

  it("серіалізує паралельне створення та збереження різних розмов", async () => {
    const directory = await createTemporaryDirectory();
    const historyPath = join(directory, "history.json");
    const firstStore = new JsonConversationHistoryStore(historyPath, () => "conversation_1");
    const secondStore = new JsonConversationHistoryStore(historyPath, () => "conversation_2");
    const originalWriteFile = vi.mocked(writeFile).getMockImplementation();

    if (!originalWriteFile) {
      throw new Error("The real writeFile implementation was not retained by the mock.");
    }

    const blockNextWrite = (): { release: () => void; started: Promise<void> } => {
      let release!: () => void;
      let signalStarted!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const started = new Promise<void>((resolve) => {
        signalStarted = resolve;
      });
      vi.mocked(writeFile).mockImplementationOnce(async (temporaryPath, contents, options) => {
        signalStarted();
        await gate;
        return originalWriteFile(temporaryPath, contents, options);
      });

      return { release, started };
    };

    vi.mocked(readFile).mockClear();
    const createWrite = blockNextWrite();
    const firstCreate = firstStore.create();
    await createWrite.started;
    const secondCreate = secondStore.create();
    const secondCreateWaitedForFirst = vi.mocked(readFile).mock.calls.length === 1;
    createWrite.release();

    await expect(Promise.all([firstCreate, secondCreate])).resolves.toEqual([
      "conversation_1",
      "conversation_2",
    ]);
    expect(secondCreateWaitedForFirst).toBe(true);

    vi.mocked(readFile).mockClear();
    const saveWrite = blockNextWrite();
    const firstSave = firstStore.save("conversation_1", [
      { userMessage: "Перше питання", assistantMessage: { content: "Перша відповідь" } },
    ]);
    await saveWrite.started;
    await expect(firstStore.load("conversation_1")).resolves.toEqual([]);
    const secondSave = secondStore.save("conversation_2", [
      { userMessage: "Друге питання", assistantMessage: { content: "Друга відповідь" } },
    ]);
    const secondSaveWaitedForFirst = vi.mocked(readFile).mock.calls.length === 2;
    saveWrite.release();
    await Promise.all([firstSave, secondSave]);
    expect(secondSaveWaitedForFirst).toBe(true);

    const reloadedStore = new JsonConversationHistoryStore(historyPath);
    await expect(
      Promise.all([reloadedStore.load("conversation_1"), reloadedStore.load("conversation_2")]),
    ).resolves.toEqual([
      [{ userMessage: "Перше питання", assistantMessage: { content: "Перша відповідь" } }],
      [{ userMessage: "Друге питання", assistantMessage: { content: "Друга відповідь" } }],
    ]);
  });

  it("зберігає попередній snapshot і звільняє блокування після помилки rename", async () => {
    const directory = await createTemporaryDirectory();
    const historyPath = join(directory, "history.json");
    const store = new JsonConversationHistoryStore(historyPath, () => "conversation_1");
    const previousTurns = [
      { userMessage: "Старе питання", assistantMessage: { content: "Стара відповідь" } },
    ];
    const nextTurns = [
      { userMessage: "Нове питання", assistantMessage: { content: "Нова відповідь" } },
    ];
    await store.create();
    await store.save("conversation_1", previousTurns);
    const previousSnapshot = await readFile(historyPath, "utf8");
    const renameFailure = new Error("Synthetic rename failure.");

    vi.mocked(rename).mockRejectedValueOnce(renameFailure);
    await expect(store.save("conversation_1", nextTurns)).rejects.toBe(renameFailure);
    await expect(readFile(historyPath, "utf8")).resolves.toBe(previousSnapshot);
    await expect(store.load("conversation_1")).resolves.toEqual(previousTurns);
    await expect(readdir(directory)).resolves.toEqual(["history.json"]);

    await store.save("conversation_1", nextTurns);
    await expect(store.load("conversation_1")).resolves.toEqual(nextTurns);
  });

  it("propagates directory read, malformed JSON, and invalid schema errors", async () => {
    const directory = await createTemporaryDirectory();
    const directoryPath = join(directory, "is-a-directory");
    await mkdir(directoryPath);

    await expect(new JsonConversationHistoryStore(directoryPath).create()).rejects.toMatchObject({
      code: expect.stringMatching(/EISDIR|EPERM/),
    });

    const malformedPath = join(directory, "malformed.json");
    await writeFile(malformedPath, "{ broken", "utf8");
    await expect(new JsonConversationHistoryStore(malformedPath).create()).rejects.toBeInstanceOf(
      SyntaxError,
    );

    const invalidHistoryPath = join(directory, "invalid-history.json");
    await writeFile(
      invalidHistoryPath,
      JSON.stringify({
        conversations: {
          conversation_1: [{ userMessage: "hello", assistantMessage: { content: 42 } }],
        },
      }),
      "utf8",
    );
    await expect(
      new JsonConversationHistoryStore(invalidHistoryPath).load("conversation_1"),
    ).rejects.toBeInstanceOf(ZodError);

    const invalidFactsPath = join(directory, "invalid-facts.json");
    await writeFile(
      invalidFactsPath,
      JSON.stringify({ facts: [{ category: "apiKey", value: "x" }] }),
      "utf8",
    );
    await expect(new JsonUserFactStore(invalidFactsPath).list()).rejects.toBeInstanceOf(ZodError);
  });

  it("does not turn unexpected read or durable write errors into empty state", async () => {
    const directory = await createTemporaryDirectory();
    const readError = new Error("synthetic read failure");
    vi.mocked(readFile).mockRejectedValueOnce(readError);
    await expect(new JsonUserFactStore(join(directory, "facts.json")).list()).rejects.toBe(
      readError,
    );

    const writeError = new Error("synthetic write failure");
    const store = new JsonConversationHistoryStore(
      join(directory, "history.json"),
      () => "conversation_2",
    );
    await store.create();
    vi.mocked(writeFile).mockRejectedValueOnce(writeError);
    await expect(store.save("conversation_2", [])).rejects.toBe(writeError);

    vi.mocked(writeFile).mockRejectedValueOnce(writeError);
    await expect(
      new JsonUserFactStore(join(directory, "facts.json")).save({
        category: "learningGoal",
        value: "Побудувати API",
      }),
    ).rejects.toBe(writeError);
  });
});
