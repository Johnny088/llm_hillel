import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatLesson15Failures,
  inspectLesson15OpenRouterCandidate,
  lesson15OpenRouter,
  rcArtifacts,
  repositoryRoot,
  withLesson15FoundationFixture,
} from "./lesson15-openrouter-contract.js";
import {
  verifyLesson14OpenRouterCompletion,
  type Lesson14CompletionSummary,
} from "./verify-lesson14-openrouter-completion.js";

export { rcArtifacts } from "./lesson15-openrouter-contract.js";

export interface Lesson15CompletionInspection {
  failures: string[];
  passed: boolean;
}

export async function inspectLesson15OpenRouterCompletion(
  candidateInput = `${lesson15OpenRouter}/solution`,
): Promise<Lesson15CompletionInspection> {
  const failures = await inspectLesson15OpenRouterCandidate(candidateInput, "solution");
  if (failures.length === 0) {
    for (const artifact of rcArtifacts) {
      const text = await readFile(resolve(repositoryRoot, candidateInput, artifact), "utf8");
      // Code examples do not count as document headings or prose.
      const prose = text.replace(/^(?:```|~~~)[\s\S]*?^(?:```|~~~)[^\r\n]*$/gmu, "");
      if (!/^#[ \t]+\S[^\r\n]*$/mu.test(prose))
        failures.push(`${artifact} must contain an H1 heading`);
      if ([...prose.matchAll(/^##[ \t]+\S[^\r\n]*$/gmu)].length < 2)
        failures.push(`${artifact} must contain at least two H2 headings`);
      if (prose.replace(/\s/gu, "").length < 200)
        failures.push(`${artifact} must contain at least 200 non-whitespace characters`);
      if (/\b(?:TODO|TBD|FILL[ _-]?ME)\b/iu.test(text))
        failures.push(`${artifact} contains an unfinished placeholder`);
    }
  }
  return { failures, passed: failures.length === 0 };
}

export async function verifyLesson15OpenRouterCompletion(
  candidateInput = `${lesson15OpenRouter}/solution`,
): Promise<Lesson14CompletionSummary> {
  const inspection = await inspectLesson15OpenRouterCompletion(candidateInput);
  if (!inspection.passed)
    throw new Error(formatLesson15Failures(candidateInput, inspection.failures));
  const summary = await withLesson15FoundationFixture(candidateInput, (fixture) =>
    verifyLesson14OpenRouterCompletion(fixture),
  );
  console.log(
    `PASS Lesson 15 completion: six release-candidate documents, unchanged 237-file Lesson 14 foundation; ` +
      `candidate=${summary.candidatePassed}, source-rebound=${summary.sourceReboundPassed}, ` +
      `serialized PostgreSQL integration=${summary.nativeIntegrationPassed}; zero todo/skipped.`,
  );
  return summary;
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  try {
    await verifyLesson15OpenRouterCompletion(process.argv[2]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Lesson 15 completion failed.");
    process.exitCode = 1;
  }
}
