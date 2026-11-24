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
