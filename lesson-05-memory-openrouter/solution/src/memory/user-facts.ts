import { readFile } from "node:fs/promises";
import { zodFunction } from "openai/helpers/zod";
import type {
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";
import { z } from "zod";
import { withJsonFileLock, writeJsonFileAtomically } from "./json-file.js";

export const UserFactCategorySchema = z.enum(["displayName", "preferredStack", "learningGoal"]);

const SensitiveValuePattern =
  /(?:(?<![\p{L}\p{N}_])sk-[a-z0-9_-]{8,}(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])(?:api[ _-]?key|password|парол\p{L}*|token|токен\p{L}*)(?![\p{L}\p{N}_])\s*[:=]\s*\S+|(?:\d[ -]*?){13,19})/iu;

export const SaveUserFactArgsSchema = z.strictObject({
  category: UserFactCategorySchema,
  value: z
    .string()
    .trim()
    .min(1, "Значення факту не може бути порожнім.")
    .max(120, "Значення факту не може перевищувати 120 символів.")
    .refine((value) => !SensitiveValuePattern.test(value), {
      message: "Чутливі дані не можна зберігати в навчальній пам’яті.",
    }),
});

export type SaveUserFactArgs = z.infer<typeof SaveUserFactArgsSchema>;
export type UserFact = SaveUserFactArgs;

const UserFactsFileSchema = z.strictObject({
  facts: z.array(SaveUserFactArgsSchema),
});

export const saveUserFactTool: ChatCompletionTool = zodFunction({
  name: "save_user_fact",
  description:
    "Зберігає один дозволений синтетичний факт про навчальні вподобання: displayName, preferredStack або learningGoal. Секрети та чутливі дані зберігати не можна.",
  parameters: SaveUserFactArgsSchema,
});

export interface UserFactStore {
  list(): Promise<UserFact[]>;
  save(fact: UserFact): Promise<void>;
}

export class InMemoryUserFactStore implements UserFactStore {
  private readonly facts = new Map<UserFact["category"], string>();

  public constructor(initialFacts: UserFact[] = []) {
    for (const fact of initialFacts) {
      this.facts.set(fact.category, fact.value);
    }
  }

  public async list(): Promise<UserFact[]> {
    return [...this.facts].map(([category, value]) => ({ category, value }));
  }

  public async save(fact: UserFact): Promise<void> {
    this.facts.set(fact.category, fact.value);
  }
}

export class JsonUserFactStore implements UserFactStore {
  public constructor(private readonly filePath: string) {}

  public async list(): Promise<UserFact[]> {
    let source: string;

    try {
      source = await readFile(this.filePath, "utf8");
    } catch (error: unknown) {
      if (isFileNotFoundError(error)) {
        return [];
      }

      throw error;
    }

    return UserFactsFileSchema.parse(JSON.parse(source)).facts;
  }

  public async save(fact: UserFact): Promise<void> {
    await withJsonFileLock(this.filePath, async () => {
      const factsByCategory = new Map(
        (await this.list()).map((storedFact) => [storedFact.category, storedFact.value]),
      );
      factsByCategory.set(fact.category, fact.value);

      const facts = [...factsByCategory].map(([category, value]) => ({ category, value }));
      await writeJsonFileAtomically(this.filePath, `${JSON.stringify({ facts }, null, 2)}\n`);
    });
  }
}

export async function executeSaveUserFactToolCall(
  call: ChatCompletionMessageFunctionToolCall,
  store: UserFactStore,
): Promise<ChatCompletionToolMessageParam> {
  if (call.function.name !== "save_user_fact") {
    return createToolError(call.id, "UNKNOWN_TOOL");
  }

  let rawArguments: unknown;

  try {
    rawArguments = JSON.parse(call.function.arguments);
  } catch {
    return createToolError(call.id, "INVALID_TOOL_ARGUMENTS");
  }

  const parsedArguments = SaveUserFactArgsSchema.safeParse(rawArguments);

  if (!parsedArguments.success) {
    return createToolError(call.id, "INVALID_TOOL_ARGUMENTS");
  }

  await store.save(parsedArguments.data);

  return {
    role: "tool",
    tool_call_id: call.id,
    content: JSON.stringify({
      status: "success",
      saved: parsedArguments.data,
    }),
  };
}

function createToolError(
  callId: string,
  code: "UNKNOWN_TOOL" | "INVALID_TOOL_ARGUMENTS",
): ChatCompletionToolMessageParam {
  return {
    role: "tool",
    tool_call_id: callId,
    content: JSON.stringify({
      status: "error",
      code,
      message:
        code === "UNKNOWN_TOOL"
          ? "Невідомий інструмент."
          : "Факт не відповідає правилам навчального сховища.",
    }),
  };
}

function isFileNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
