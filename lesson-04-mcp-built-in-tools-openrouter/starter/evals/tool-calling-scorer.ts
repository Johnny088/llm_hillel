import type { ToolCallingObservation } from "./recorded-tool-results.js";
import type { EvalCase, ExpectedResponseMode, ToolCallExpectation } from "./tool-calling.eval.js";

export interface EvalScore {
  id: string;
  passed: boolean;
  reasons: string[];
}

export function classifyTextResponse(text: string): ExpectedResponseMode {
  const normalized = text.toLocaleLowerCase("uk-UA");
  const asksForCurrency =
    /[?？]|(?:у|в) яку валюту|(?:у|в) какую валюту|цільов\p{L}* валют|целев\p{L}* валют|уточн\p{L}*.*валют|вкаж\p{L}*.*валют|укаж\p{L}*.*валют/iu.test(
      normalized,
    );

  return asksForCurrency ? "clarification" : "direct";
}

export function scoreToolCallingCase(
  evalCase: EvalCase<ToolCallExpectation>,
  observation: ToolCallingObservation,
): EvalScore {
  const reasons: string[] = [];

  if (observation.observedMode !== evalCase.expectedMode) {
    reasons.push(`Очікувався mode=${evalCase.expectedMode}, отримано ${observation.observedMode}.`);
  }

  if (evalCase.expectedTool !== observation.observedTool) {
    reasons.push(
      `Очікувався tool=${evalCase.expectedTool ?? "none"}, отримано ${
        observation.observedTool ?? "none"
      }.`,
    );
  }

  const expectation = evalCase.expected;

  if (expectation?.args) {
    for (const [key, value] of Object.entries(expectation.args)) {
      const observed = observation.observedArgs?.[key];
      const matches =
        (key === "from" || key === "to") &&
        typeof value === "string" &&
        typeof observed === "string"
          ? observed.trim().toUpperCase() === value.trim().toUpperCase()
          : observed === value;

      if (!matches) {
        reasons.push(`Аргумент ${key} не збігається з очікуваним значенням.`);
      }
    }
  }

  if (
    expectation?.expectedStatus !== undefined &&
    observation.observedStatus !== expectation.expectedStatus
  ) {
    reasons.push(
      `Очікувався status=${expectation.expectedStatus}, отримано ${
        observation.observedStatus ?? "none"
      }.`,
    );
  }

  if (
    expectation?.expectedErrorCode !== undefined &&
    observation.observedErrorCode !== expectation.expectedErrorCode
  ) {
    reasons.push(
      `Очікувався errorCode=${expectation.expectedErrorCode}, отримано ${
        observation.observedErrorCode ?? "none"
      }.`,
    );
  }

  return {
    id: evalCase.id,
    passed: reasons.length === 0,
    reasons,
  };
}
