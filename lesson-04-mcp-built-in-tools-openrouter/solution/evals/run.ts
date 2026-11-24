import { mcpToolEvalCases } from "./mcp-tools.eval.js";
import { recordedMcpToolResults } from "./recorded-results.js";
import { scoreMcpToolCase } from "./scorer.js";
import { runExtractionEvaluation } from "./run-extraction.js";
import { runLiveDemo } from "../src/demo.js";

type EvaluationMode = "mcp" | "extraction" | "all";

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

  if (modeArguments.length > 1) {
    return undefined;
  }

  const mode = modeArguments[0]?.slice("--mode=".length) ?? "mcp";

  return mode === "mcp" || mode === "extraction" || mode === "all" ? mode : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = parseMode(args);
  const live = args.includes("--live");

  if (!mode || (live && mode === "all")) {
    console.error(
      "Usage: run.ts [--mode=mcp|extraction|all] [--live only with extraction or without --mode]",
    );
    process.exitCode = 2;
    return;
  }

  if (live && !args.some((argument) => argument.startsWith("--mode="))) {
    await runLiveDemo();
    return;
  }

  if (mode === "extraction") {
    await runExtractionEvaluation(live);
    return;
  }

  if (mode === "mcp") {
    if (live) {
      console.error("Use run.ts --live for the existing live MCP demo.");
      process.exitCode = 2;
      return;
    }

    await runRecordedMcpEvaluation();
    return;
  }

  await runExtractionEvaluation(false);
  await runRecordedMcpEvaluation();
}

void main();
