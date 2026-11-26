import type { LongTermMemoryEvalCase, MemoryEvalCase } from "./memory.eval.js";
import type { LongTermMemoryObservation, MemoryObservation } from "./recorded-results.js";
import type { Extraction } from "../src/schemas/extraction.js";
import { ExtractionSchema } from "../src/schemas/extraction.js";
import type { ExtractionEvalExpected } from "./extraction.eval.js";

import type { McpEvalCase } from "./mcp-tools.eval.js";
import type { McpToolObservation } from "./recorded-results.js";

export interface MemoryEvalScore {
  id: string;
  passed: boolean;
  reasons: string[];
}

export function scoreMemoryCase(
  evalCase: MemoryEvalCase,
  observation: MemoryObservation,
): MemoryEvalScore {
  const reasons: string[] = [];

  compare(reasons, "mode", observation.mode, evalCase.expected.mode);
  compare(
    reasons,
    "usesClientManagedHistory",
    observation.usedClientManagedHistory,
    evalCase.expected.usesClientManagedHistory,
  );
  compare(
    reasons,
    "createsDurableConversation",
    observation.createdDurableConversation,
    evalCase.expected.createsDurableConversation,
  );
  compare(
    reasons,
    "windowingEnabled",
    observation.windowingEnabled,
    evalCase.expected.windowingEnabled,
  );

  return { id: evalCase.id, passed: reasons.length === 0, reasons };
}

export function scoreLongTermMemoryCase(
  evalCase: LongTermMemoryEvalCase,
  observation: LongTermMemoryObservation,
): MemoryEvalScore {
  const reasons: string[] = [];

  compare(
    reasons,
    "usesClientManagedHistory",
    observation.usedClientManagedHistory,
    evalCase.expected.usesClientManagedHistory,
  );
  compare(
    reasons,
    "resetsShortTermState",
    observation.resetShortTermState,
    evalCase.expected.resetsShortTermState,
  );
  compare(
    reasons,
    "invokesSaveUserFactTool",
    observation.invokedSaveUserFactTool,
    evalCase.expected.invokesSaveUserFactTool,
  );
  compare(
    reasons,
    "persistsUserFact",
    observation.persistedUserFact,
    evalCase.expected.persistsUserFact,
  );
  compare(
    reasons,
    "refusesSensitiveData",
    observation.refusedSensitiveData,
    evalCase.expected.refusesSensitiveData,
  );

  return { id: evalCase.id, passed: reasons.length === 0, reasons };
}

function compare(
  reasons: string[],
  label: string,
  actual: string | boolean,
  expected: string | boolean,
): void {
  if (actual !== expected) {
    reasons.push(`Очікувався ${label}=${expected}, отримано ${actual}.`);
  }
}

export interface EvalScore {
  passed: boolean;
  reasons: string[];
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("uk-UA");
}

function exactArray(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  const exactLeft = exactArray(left);
  const exactRight = exactArray(right);

  return (
    exactLeft.length === exactRight.length &&
    exactLeft.every((value, index) => value === exactRight[index])
  );
}

function entitiesOccurInInput(values: readonly string[], input: string): boolean {
  return values.every((value) => input.includes(value));
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
