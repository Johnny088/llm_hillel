import type { McpEvalCase } from "./mcp-tools.eval.js";
import type { McpToolObservation } from "./recorded-results.js";
import { ExtractionSchema, type Extraction } from "../src/schemas/extraction.js";
import type { ExtractionEvalExpected } from "./extraction.eval.js";

export interface EvalScore {
  passed: boolean;
  reasons: string[];
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("uk-UA");
}

function normalizedArray(values: readonly string[]): string[] {
  return [...new Set(values.map(normalize))].sort();
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  const normalizedLeft = normalizedArray(left);
  const normalizedRight = normalizedArray(right);

  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
}

function entitiesOccurInInput(values: readonly string[], input: string): boolean {
  const normalizedInput = normalize(input);
  return values.every((value) => normalizedInput.includes(normalize(value)));
}

export function scoreExtraction(
  input: string,
  actual: Extraction,
  expected: ExtractionEvalExpected,
): EvalScore {
  const reasons: string[] = [];
  const schemaResult = ExtractionSchema.safeParse(actual);

  if (!schemaResult.success) {
    return { passed: false, reasons: ["schema_mismatch"] };
  }

  for (const key of ["names", "dates", "locations"] as const) {
    if (!arraysEqual(actual[key], expected.extraction[key])) {
      reasons.push(`${key}_mismatch`);
    }

    if (!entitiesOccurInInput(actual[key], input)) {
      reasons.push(`${key}_not_in_input`);
    }
  }

  const normalizedSummary = normalize(actual.summary);

  if (!normalizedSummary) {
    reasons.push("summary_empty");
  }

  if (actual.summary.length > expected.summaryMaxCharacters) {
    reasons.push("summary_too_long");
  }

  for (const fact of expected.summaryMustInclude) {
    if (!normalizedSummary.includes(normalize(fact))) {
      reasons.push(`summary_missing:${fact}`);
    }
  }

  return { passed: reasons.length === 0, reasons };
}

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
