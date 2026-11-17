import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import { OpenRouterDocumentAi } from "../src/services/openrouter-document-ai.js";

const REGISTERED_MAIN_MODEL = "~deepseek/deepseek-v4-flash-latest";

const documentWithoutEntities = "Документ повідомляє про зміну умов без імен, дат і назв місць.";

const extractionWithoutEntities = {
  names: [],
  dates: [],
  locations: [],
  summary: "Документ повідомляє про зміну умов.",
};

function createAdapter(): {
  adapter: OpenRouterDocumentAi;
  create: ReturnType<typeof vi.fn>;
} {
  const create = vi.fn().mockResolvedValue({
    model: "resolved-main",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: JSON.stringify(extractionWithoutEntities) },
        finish_reason: "stop",
      },
    ],
  });

  const client = { chat: { completions: { create } } } as unknown as OpenAI;

  return {
    adapter: new OpenRouterDocumentAi(client, {
      fastModel: "test-fast",
      mainModel: REGISTERED_MAIN_MODEL,
      reasoningEffort: "low",
      maxOutputTokens: 800,
    }),
    create,
  };
}

describe("OpenRouterDocumentAi.extract (offline)", () => {
  it("returns empty entity arrays and a non-empty summary for a document without entities", async () => {
    const { adapter, create } = createAdapter();

    const result = await adapter.extract(documentWithoutEntities);

    expect(result.data.names).toEqual([]);
    expect(result.data.dates).toEqual([]);
    expect(result.data.locations).toEqual([]);
    expect(result.data.summary.length).toBeGreaterThan(0);
    expect(result.model).toBe("resolved-main");
    expect(create).toHaveBeenCalledOnce();
  });
});
