import type { McpEvalCase } from "./mcp-tools.eval.js";
import type { McpToolObservation } from "./recorded-results.js";

export interface McpEvalScore {
  id: string;
  passed: boolean;
  reasons: string[];
}

export function scoreMcpToolCase(
  evalCase: McpEvalCase,
  observation: McpToolObservation,
): McpEvalScore {
  const reasons: string[] = [];

  if (observation.observedMode !== evalCase.expectedMode) {
    reasons.push(`Очікувався mode=${evalCase.expectedMode}, отримано ${observation.observedMode}.`);
  }

  if (observation.observedTool !== evalCase.expectedTool) {
    reasons.push(
      `Очікувався tool=${evalCase.expectedTool ?? "none"}, отримано ${observation.observedTool}.`,
    );
  }

  if (
    evalCase.expected?.shouldRefuse !== undefined &&
    observation.refused !== evalCase.expected.shouldRefuse
  ) {
    reasons.push(
      `Очікувався refused=${evalCase.expected.shouldRefuse}, отримано ${observation.refused}.`,
    );
  }

  return {
    id: evalCase.id,
    passed: reasons.length === 0,
    reasons,
  };
}
