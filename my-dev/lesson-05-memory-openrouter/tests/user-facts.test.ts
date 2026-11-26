import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type * as FileSystemPromises from "node:fs/promises";
import type { ChatCompletionMessageFunctionToolCall } from "openai/resources/chat/completions";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  executeSaveUserFactToolCall,
  JsonUserFactStore,
  SaveUserFactArgsSchema,
} from "../src/memory/user-facts.js";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof FileSystemPromises>();

  return {
    ...actual,
    writeFile: vi.fn(actual.writeFile),
  };
});

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("save_user_fact", () => {
  it("приймає лише дозволену категорію та безпечне коротке значення", () => {
    expect(
      SaveUserFactArgsSchema.parse({
        category: "preferredStack",
        value: " TypeScript та Node.js ",
      }),
    ).toEqual({
      category: "preferredStack",
      value: "TypeScript та Node.js",
    });
    expect(
      SaveUserFactArgsSchema.safeParse({
        category: "email",
        value: "student@example.test",
      }).success,
    ).toBe(false);
  });

  it.each([
    "OPENROUTER_API_KEY=sk-example123456",
    "Мій пароль: course-password",
    "Картка 4242 4242 4242 4242",
  ])("відхиляє чутливе значення: %s", (value) => {
    expect(
      SaveUserFactArgsSchema.safeParse({
        category: "learningGoal",
        value,
      }).success,
    ).toBe(false);
  });

  it("зберігає факт і читає його після повторної ініціалізації JSON store", async () => {
    const directory = await mkdtemp(join(tmpdir(), "lesson-05-openrouter-user-facts-"));
    temporaryDirectories.push(directory);
    const filePath = join(directory, "data", "user-memory.json");
    const firstStore = new JsonUserFactStore(filePath);
    const call = createFunctionCall({
      category: "displayName",
      value: "Олена",
    });

    const output = await executeSaveUserFactToolCall(call, firstStore);
    const secondStore = new JsonUserFactStore(filePath);

    expect(JSON.parse(output.content as string)).toEqual({
      status: "success",
      saved: {
        category: "displayName",
        value: "Олена",
      },
    });
    await expect(secondStore.list()).resolves.toEqual([
      {
        category: "displayName",
        value: "Олена",
      },
    ]);
  });

  it("не видаляє чужий тимчасовий файл при колізії унікального імені", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "lesson-05-openrouter-user-facts-temp-collision-"),
    );
    temporaryDirectories.push(directory);
    const filePath = join(directory, "user-memory.json");
    const store = new JsonUserFactStore(filePath);
    const previousFact = { category: "displayName" as const, value: "Олена" };
    await store.save(previousFact);
    const previousSnapshot = await readFile(filePath, "utf8");
    const foreignContents = "owned by another writer";
    const collisionError = Object.assign(new Error("Synthetic temporary path collision."), {
      code: "EEXIST",
    });
    const originalWriteFile = vi.mocked(writeFile).getMockImplementation();

    if (!originalWriteFile) {
      throw new Error("The real writeFile implementation was not retained by the mock.");
    }

    let collisionTemporaryPath: string | undefined;
    vi.mocked(writeFile).mockImplementationOnce(async (temporaryPath) => {
      if (typeof temporaryPath !== "string") {
        throw new TypeError("Expected the JSON store to use a string temporary path.");
      }

      collisionTemporaryPath = temporaryPath;
      await originalWriteFile(temporaryPath, foreignContents, "utf8");
      throw collisionError;
    });

    await expect(store.save({ category: "learningGoal", value: "Будувати API" })).rejects.toBe(
      collisionError,
    );

    if (!collisionTemporaryPath) {
      throw new Error("Expected the attempted temporary path to be recorded.");
    }

    await expect(readFile(filePath, "utf8")).resolves.toBe(previousSnapshot);
    await expect(readFile(collisionTemporaryPath, "utf8")).resolves.toBe(foreignContents);
    await expect(store.list()).resolves.toEqual([previousFact]);
  });

  it("зберігає паралельні зміни від окремих store в одному JSON-файлі", async () => {
    const directory = await mkdtemp(join(tmpdir(), "lesson-05-openrouter-user-facts-concurrent-"));
    temporaryDirectories.push(directory);
    const filePath = join(directory, "data", "user-memory.json");
    const firstStore = new JsonUserFactStore(filePath);
    const secondStore = new JsonUserFactStore(
      join(directory, "data", "..", "data", "user-memory.json"),
    );

    await firstStore.save({ category: "preferredStack", value: "TypeScript" });
    const originalWriteFile = vi.mocked(writeFile).getMockImplementation();

    if (!originalWriteFile) {
      throw new Error("The real writeFile implementation was not retained by the mock.");
    }

    let releaseWrite!: () => void;
    let signalWriteStarted!: () => void;
    const writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const writeStarted = new Promise<void>((resolve) => {
      signalWriteStarted = resolve;
    });
    vi.mocked(writeFile).mockImplementationOnce(async (temporaryPath, contents, options) => {
      signalWriteStarted();
      await writeGate;
      return originalWriteFile(temporaryPath, contents, options);
    });

    const firstSave = firstStore.save({ category: "displayName", value: "Олена" });
    await writeStarted;
    await expect(firstStore.list()).resolves.toEqual([
      { category: "preferredStack", value: "TypeScript" },
    ]);
    const secondList = vi.spyOn(secondStore, "list");
    const secondSave = secondStore.save({ category: "learningGoal", value: "Будувати API" });
    const secondSaveWaitedForFirst = secondList.mock.calls.length === 0;

    releaseWrite();
    await Promise.all([firstSave, secondSave]);

    expect(secondSaveWaitedForFirst).toBe(true);
    expect(secondList).toHaveBeenCalledTimes(1);

    await expect(firstStore.list()).resolves.toEqual([
      { category: "preferredStack", value: "TypeScript" },
      { category: "displayName", value: "Олена" },
      { category: "learningGoal", value: "Будувати API" },
    ]);
  });

  it("не змінює JSON store для невалідних аргументів", async () => {
    const directory = await mkdtemp(join(tmpdir(), "lesson-05-openrouter-user-facts-"));
    temporaryDirectories.push(directory);
    const store = new JsonUserFactStore(join(directory, "user-memory.json"));
    await store.save({
      category: "learningGoal",
      value: "Навчитися тестувати API",
    });
    const output = await executeSaveUserFactToolCall(
      createFunctionCall({
        category: "learningGoal",
        value: "Мій token: secret-value",
      }),
      store,
    );

    expect(JSON.parse(output.content as string)).toMatchObject({
      status: "error",
      code: "INVALID_TOOL_ARGUMENTS",
    });
    await expect(store.list()).resolves.toEqual([
      {
        category: "learningGoal",
        value: "Навчитися тестувати API",
      },
    ]);
  });

  it.each(["EACCES", "ENOSPC"] as const)(
    "зберігає попередній snapshot і очищає тимчасовий файл після %s",
    async (code) => {
      const directory = await mkdtemp(
        join(tmpdir(), "lesson-05-openrouter-user-facts-write-error-"),
      );
      temporaryDirectories.push(directory);
      const previousFact = { category: "displayName" as const, value: "Олена" };
      const nextFact = { category: "learningGoal" as const, value: "Навчитися будувати API" };
      const partialContents = '{"facts":[{"category":"learningGoal","value":"';
      const writeFailure = Object.assign(new Error(`Synthetic ${code} write failure.`), { code });
      const originalWriteFile = vi.mocked(writeFile).getMockImplementation();

      if (!originalWriteFile) {
        throw new Error("The real writeFile implementation was not retained by the mock.");
      }

      const installPartialWriteFailure = (): void => {
        vi.mocked(writeFile).mockImplementationOnce(async (temporaryPath) => {
          await originalWriteFile(temporaryPath, partialContents, "utf8");
          throw writeFailure;
        });
      };

      const directSavePath = join(directory, "direct", "user-memory.json");
      const directStore = new JsonUserFactStore(directSavePath);
      await directStore.save(previousFact);
      const directSnapshot = await readFile(directSavePath, "utf8");
      installPartialWriteFailure();
      await expect(directStore.save(nextFact)).rejects.toBe(writeFailure);
      await expect(readFile(directSavePath, "utf8")).resolves.toBe(directSnapshot);
      await expect(directStore.list()).resolves.toEqual([previousFact]);
      await expect(readdir(join(directory, "direct"))).resolves.toEqual(["user-memory.json"]);
      await directStore.save(nextFact);
      await expect(directStore.list()).resolves.toEqual([previousFact, nextFact]);

      const toolSavePath = join(directory, "tool", "user-memory.json");
      const toolStore = new JsonUserFactStore(toolSavePath);
      await toolStore.save(previousFact);
      const toolSnapshot = await readFile(toolSavePath, "utf8");
      installPartialWriteFailure();
      await expect(
        executeSaveUserFactToolCall(createFunctionCall(nextFact), toolStore),
      ).rejects.toBe(writeFailure);
      await expect(readFile(toolSavePath, "utf8")).resolves.toBe(toolSnapshot);
      await expect(toolStore.list()).resolves.toEqual([previousFact]);
      await expect(readdir(join(directory, "tool"))).resolves.toEqual(["user-memory.json"]);
      const retryOutput = await executeSaveUserFactToolCall(
        createFunctionCall(nextFact),
        toolStore,
      );
      expect(JSON.parse(retryOutput.content as string)).toMatchObject({ status: "success" });
      await expect(toolStore.list()).resolves.toEqual([previousFact, nextFact]);
    },
  );
});

function createFunctionCall(argumentsValue: unknown): ChatCompletionMessageFunctionToolCall {
  return {
    id: "call_1",
    type: "function",
    function: {
      name: "save_user_fact",
      arguments: JSON.stringify(argumentsValue),
    },
  };
}
