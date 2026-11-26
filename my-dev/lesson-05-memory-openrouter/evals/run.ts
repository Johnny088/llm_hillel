import { longTermMemoryEvalCases, memoryEvalCases } from "./memory.eval.js";
import { mcpToolEvalCases } from "./mcp-tools.eval.js";

import {
  recordedLongTermMemoryResults,
  recordedMemoryResults,
  recordedMcpToolResults,
} from "./recorded-results.js";
import { scoreLongTermMemoryCase, scoreMemoryCase, scoreMcpToolCase } from "./scorer.js";

import { runExtractionEvaluation } from "./run-extraction.js";
import { runLiveDemo } from "../src/demo.js";

type EvaluationMode = "memory" | "mcp" | "extraction" | "all";

export function runMemoryEvaluation(): void {
  const observationsById = new Map(
    recordedMemoryResults.map((observation) => [observation.id, observation]),
  );
  const memoryScores = memoryEvalCases.map((evalCase) => {
    const observation = observationsById.get(evalCase.id);
    return observation
      ? scoreMemoryCase(evalCase, observation)
      : { id: evalCase.id, passed: false, reasons: ["Відсутнє записане спостереження."] };
  });
  const longTermObservationsById = new Map(
    recordedLongTermMemoryResults.map((observation) => [observation.id, observation]),
  );
  const longTermScores = longTermMemoryEvalCases.map((evalCase) => {
    const observation = longTermObservationsById.get(evalCase.id);
    return observation
      ? scoreLongTermMemoryCase(evalCase, observation)
      : { id: evalCase.id, passed: false, reasons: ["Відсутнє записане спостереження."] };
  });
  const scores = [...memoryScores, ...longTermScores];

  for (const score of scores) {
    const details = score.reasons.length === 0 ? "" : ` — ${score.reasons.join(" ")}`;
    console.log(`${score.passed ? "PASS" : "FAIL"} ${score.id}${details}`);
  }

  const passed = scores.filter((score) => score.passed).length;
  const observations = [...recordedMemoryResults, ...recordedLongTermMemoryResults];
  const totalLatencyMs = observations.reduce((sum, observation) => sum + observation.latencyMs, 0);
  const inputTokens = observations.reduce((sum, observation) => sum + observation.inputTokens, 0);
  const outputTokens = observations.reduce((sum, observation) => sum + observation.outputTokens, 0);

  console.log(`Result: ${passed}/${scores.length}`);
  console.log(`Success rate: ${Math.round((passed / scores.length) * 100)}%`);
  console.log(`Average latency: ${Math.round(totalLatencyMs / observations.length)}ms`);
  console.log(`Recorded tokens: input=${inputTokens}, output=${outputTokens}`);
  console.log("Estimated API cost: not calculated for deterministic offline replay.");

  if (passed !== scores.length) process.exitCode = 1;
}

export async function runRecordedMcpEvaluation(): Promise<void> {
  const observationsById = new Map(
    recordedMcpToolResults.map((observation) => [observation.id, observation]),
  );
  const scores = mcpToolEvalCases.map((evalCase) => {
    const observation = observationsById.get(evalCase.id);

    if (!observation) {
      return {
        id: evalCase.id,
        passed: false,
        reasons: ["Відсутнє записане спостереження."],
      };
    }

    return scoreMcpToolCase(evalCase, observation);
  });

  for (const score of scores) {
    const details = score.reasons.length === 0 ? "" : ` – ${score.reasons.join(" ")}`;
    console.log(`${score.passed ? "PASS" : "FAIL"} ${score.id}${details}`);
  }

  const passed = scores.filter((score) => score.passed).length;
  const averageLatencyMs =
    recordedMcpToolResults.reduce((sum, observation) => sum + observation.latencyMs, 0) /
    recordedMcpToolResults.length;

  console.log(`Result: ${passed}/${scores.length}`);
  console.log(`Average latency: ${Math.round(averageLatencyMs)}ms`);

  if (passed !== scores.length) {
    process.exitCode = 1;
  }
}

function parseMode(arguments_: readonly string[]): EvaluationMode | undefined {
  const modeArguments = arguments_.filter((argument) => argument.startsWith("--mode="));
  if (modeArguments.length > 1) return undefined;
  const mode = modeArguments[0]?.slice("--mode=".length) ?? "memory";
  return mode === "memory" || mode === "mcp" || mode === "extraction" || mode === "all"
    ? mode
    : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = parseMode(args);
  const live = args.includes("--live");

  const explicitMode = args.some((argument) => argument.startsWith("--mode="));
  if (!mode || (live && explicitMode && (mode === "all" || mode === "memory" || mode === "mcp"))) {
    console.error(
      "Usage: run.ts [--mode=memory|mcp|extraction|all] [--live only with extraction or without --mode]",
    );
    process.exitCode = 2;
    return;
  }

  if (live && !explicitMode) {
    await runLiveDemo();
    return;
  }
  if (mode === "memory") {
    runMemoryEvaluation();
    return;
  }

  if (mode === "extraction") {
    await runExtractionEvaluation(live);
    return;
  }

  if (mode === "mcp") {
    await runRecordedMcpEvaluation();
    return;
  }

  await runExtractionEvaluation(false);
  await runRecordedMcpEvaluation();
}

void main();
