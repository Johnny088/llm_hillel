import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { withJsonFileLock, writeJsonFileAtomically } from "./json-file.js";

const StoredAssistantMessageSchema = z.strictObject({
  content: z.string(),
  reasoning: z.string().optional(),
  reasoningDetails: z.array(z.unknown()).optional(),
});

const StoredConversationTurnSchema = z.strictObject({
  userMessage: z.string(),
  assistantMessage: StoredAssistantMessageSchema,
});

const ConversationHistoryFileSchema = z.strictObject({
  conversations: z.record(z.string(), z.array(StoredConversationTurnSchema)),
});

export type StoredAssistantMessage = z.infer<typeof StoredAssistantMessageSchema>;
export type StoredConversationTurn = z.infer<typeof StoredConversationTurnSchema>;

export interface ConversationHistoryStore {
  create(): Promise<string>;
  load(conversationId: string): Promise<StoredConversationTurn[]>;
  save(conversationId: string, turns: StoredConversationTurn[]): Promise<void>;
}

export class InMemoryConversationHistoryStore implements ConversationHistoryStore {
  private readonly conversations = new Map<string, StoredConversationTurn[]>();

  public constructor(private readonly createId: () => string = randomUUID) {}

  public async create(): Promise<string> {
    const conversationId = this.createId();
    this.conversations.set(conversationId, []);
    return conversationId;
  }

  public async load(conversationId: string): Promise<StoredConversationTurn[]> {
    return structuredClone(this.requireConversation(conversationId));
  }

  public async save(conversationId: string, turns: StoredConversationTurn[]): Promise<void> {
    this.requireConversation(conversationId);
    this.conversations.set(conversationId, structuredClone(turns));
  }

  private requireConversation(conversationId: string): StoredConversationTurn[] {
    const turns = this.conversations.get(conversationId);

    if (!turns) {
      throw new Error(`Conversation ${conversationId} не знайдено.`);
    }

    return turns;
  }
}

export class JsonConversationHistoryStore implements ConversationHistoryStore {
  public constructor(
    private readonly filePath: string,
    private readonly createId: () => string = randomUUID,
  ) {}

  public async create(): Promise<string> {
    return withJsonFileLock(this.filePath, async () => {
      const state = await this.readState();
      let conversationId = this.createId();

      while (state.conversations[conversationId] !== undefined) {
        conversationId = this.createId();
      }

      state.conversations[conversationId] = [];
      await this.writeState(state);
      return conversationId;
    });
  }

  public async load(conversationId: string): Promise<StoredConversationTurn[]> {
    const turns = (await this.readState()).conversations[conversationId];

    if (!turns) {
      throw new Error(`Conversation ${conversationId} не знайдено.`);
    }

    return structuredClone(turns);
  }

  public async save(conversationId: string, turns: StoredConversationTurn[]): Promise<void> {
    await withJsonFileLock(this.filePath, async () => {
      const state = await this.readState();

      if (state.conversations[conversationId] === undefined) {
        throw new Error(`Conversation ${conversationId} не знайдено.`);
      }

      state.conversations[conversationId] = structuredClone(turns);
      await this.writeState(state);
    });
  }

  private async readState(): Promise<z.infer<typeof ConversationHistoryFileSchema>> {
    let source: string;

    try {
      source = await readFile(this.filePath, "utf8");
    } catch (error: unknown) {
      if (isFileNotFoundError(error)) {
        return { conversations: {} };
      }

      throw error;
    }

    return ConversationHistoryFileSchema.parse(JSON.parse(source));
  }

  private async writeState(state: z.infer<typeof ConversationHistoryFileSchema>): Promise<void> {
    await writeJsonFileAtomically(this.filePath, `${JSON.stringify(state, null, 2)}\n`);
  }
}

function isFileNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
