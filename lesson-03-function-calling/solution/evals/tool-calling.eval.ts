export type ExpectedResponseMode = "tool" | "clarification" | "direct";

export interface EvalCase<TExpected = unknown> {
  id: string;
  input: string;
  expectedMode: ExpectedResponseMode;
  expectedTool?: string;
  expected?: TExpected;
  tags?: string[];
}

export interface ToolCallExpectation {
  args?: Record<string, unknown>;
  expectedStatus?: "success" | "error";
  expectedErrorCode?: string;
}

export const toolCallingEvalCases: Array<EvalCase<ToolCallExpectation>> = [
  {
    id: "currency-happy-path",
    input: "Конвертуй 250 USD у UAH",
    expectedMode: "tool",
    expectedTool: "convert_currency",
    expected: {
      args: { amount: 250, from: "USD", to: "UAH" },
      expectedStatus: "success",
    },
    tags: ["happy-path"],
  },
  {
    id: "currency-normalization",
    input: "100 eur to uah",
    expectedMode: "tool",
    expectedTool: "convert_currency",
    expected: {
      args: { amount: 100, from: "EUR", to: "UAH" },
      expectedStatus: "success",
    },
    tags: ["normalization"],
  },
  {
    id: "currency-clarification",
    input: "Переведи 500 євро",
    expectedMode: "clarification",
    tags: ["missing-argument"],
  },
  {
    id: "currency-unsupported-pair",
    input: "Конвертуй 1000 JPY у KZT",
    expectedMode: "tool",
    expectedTool: "convert_currency",
    expected: {
      args: { amount: 1_000, from: "JPY", to: "KZT" },
      expectedStatus: "error",
      expectedErrorCode: "UNSUPPORTED_CURRENCY_PAIR",
    },
    tags: ["controlled-error"],
  },
  {
    id: "currency-no-tool-needed",
    input: "Яка столиця Франції?",
    expectedMode: "direct",
    tags: ["routing"],
  },
];
