import type { Extraction } from "../src/schemas/extraction.js";

export interface MemoryObservation {
  id: string;
  mode: "session" | "conversation";
  usedClientManagedHistory: boolean;
  createdDurableConversation: boolean;
  windowingEnabled: boolean;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

export const recordedMemoryResults: MemoryObservation[] = [
  {
    id: "session-first-turn",
    mode: "session",
    usedClientManagedHistory: false,
    createdDurableConversation: false,
    windowingEnabled: true,
    latencyMs: 210,
    inputTokens: 28,
    outputTokens: 14,
  },
  {
    id: "session-follow-up",
    mode: "session",
    usedClientManagedHistory: true,
    createdDurableConversation: false,
    windowingEnabled: true,
    latencyMs: 245,
    inputTokens: 54,
    outputTokens: 12,
  },
  {
    id: "session-after-reset",
    mode: "session",
    usedClientManagedHistory: false,
    createdDurableConversation: false,
    windowingEnabled: true,
    latencyMs: 205,
    inputTokens: 24,
    outputTokens: 13,
  },
  {
    id: "conversation-create",
    mode: "conversation",
    usedClientManagedHistory: false,
    createdDurableConversation: true,
    windowingEnabled: true,
    latencyMs: 260,
    inputTokens: 30,
    outputTokens: 15,
  },
  {
    id: "conversation-resume",
    mode: "conversation",
    usedClientManagedHistory: true,
    createdDurableConversation: false,
    windowingEnabled: true,
    latencyMs: 235,
    inputTokens: 58,
    outputTokens: 12,
  },
];

export interface LongTermMemoryObservation {
  id: string;
  usedClientManagedHistory: boolean;
  resetShortTermState: boolean;
  invokedSaveUserFactTool: boolean;
  persistedUserFact: boolean;
  refusedSensitiveData: boolean;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

export const recordedLongTermMemoryResults: LongTermMemoryObservation[] = [
  {
    id: "in-session-recall",
    usedClientManagedHistory: true,
    resetShortTermState: false,
    invokedSaveUserFactTool: false,
    persistedUserFact: false,
    refusedSensitiveData: false,
    latencyMs: 240,
    inputTokens: 52,
    outputTokens: 11,
  },
  {
    id: "session-reset",
    usedClientManagedHistory: false,
    resetShortTermState: true,
    invokedSaveUserFactTool: false,
    persistedUserFact: false,
    refusedSensitiveData: false,
    latencyMs: 215,
    inputTokens: 27,
    outputTokens: 12,
  },
  {
    id: "long-term-persistence",
    usedClientManagedHistory: false,
    resetShortTermState: true,
    invokedSaveUserFactTool: true,
    persistedUserFact: true,
    refusedSensitiveData: false,
    latencyMs: 310,
    inputTokens: 76,
    outputTokens: 18,
  },
  {
    id: "no-false-tool-invocation",
    usedClientManagedHistory: false,
    resetShortTermState: false,
    invokedSaveUserFactTool: false,
    persistedUserFact: false,
    refusedSensitiveData: false,
    latencyMs: 225,
    inputTokens: 34,
    outputTokens: 20,
  },
  {
    id: "sensitive-data-refusal",
    usedClientManagedHistory: false,
    resetShortTermState: false,
    invokedSaveUserFactTool: true,
    persistedUserFact: false,
    refusedSensitiveData: true,
    latencyMs: 275,
    inputTokens: 48,
    outputTokens: 16,
  },
];

export const recordedResults: Readonly<Record<string, Extraction>> = {
  "people-date-location-uk": {
    names: ["Олена Коваль"],
    dates: ["14 липня"],
    locations: ["Львова"],
    summary: "Олена Коваль 14 липня приїхала до Львова на конференцію з веброзробки.",
  },
  "no-dates": {
    names: ["Андрій Мельник"],
    dates: [],
    locations: ["Києві"],
    summary: "Андрій Мельник проводить у Києві воркшоп.",
  },
  "no-names": {
    names: [],
    dates: ["3 вересня"],
    locations: ["Одесі"],
    summary: "Зустріч в Одесі відбудеться 3 вересня.",
  },
  "no-structured-entities": {
    names: [],
    dates: [],
    locations: [],
    summary: "Документ пояснює загальні правила командної роботи.",
  },
  multilingual: {
    names: ["Марія Савчук"],
    dates: ["5 May"],
    locations: ["Berlin"],
    summary: "Марія Савчук presented the demo in Berlin on 5 May.",
  },
};

export interface McpToolObservation {
  id: string;
  observedMode: "tool";
  observedTool: "read_text_file" | "web_search";
  refused: boolean;
  latencyMs: number;
}

export const recordedMcpToolResults: McpToolObservation[] = [
  {
    id: "mcp-read-course-notes",
    observedMode: "tool",
    observedTool: "read_text_file",
    refused: false,
    latencyMs: 180,
  },
  {
    id: "mcp-read-local-policy",
    observedMode: "tool",
    observedTool: "read_text_file",
    refused: false,
    latencyMs: 165,
  },
  {
    id: "web-current-mcp-release",
    observedMode: "tool",
    observedTool: "web_search",
    refused: false,
    latencyMs: 640,
  },
  {
    id: "web-current-openai-news",
    observedMode: "tool",
    observedTool: "web_search",
    refused: false,
    latencyMs: 710,
  },
  {
    id: "mcp-deny-outside-sandbox",
    observedMode: "tool",
    observedTool: "read_text_file",
    refused: true,
    latencyMs: 125,
  },
];
