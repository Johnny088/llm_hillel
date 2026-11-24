import type { Extraction } from "../src/schemas/extraction.js";

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
