import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export interface ParityPair {
  lessonNum: number;
  openaiDir: string;
  openrouterDir: string;
}

export const PAIRS: ParityPair[] = [
  { lessonNum: 1, openaiDir: "lesson-01-intro", openrouterDir: "lesson-01-intro-openrouter" },
  { lessonNum: 2, openaiDir: "lesson-02-llm-api", openrouterDir: "lesson-02-llm-api-openrouter" },
  {
    lessonNum: 3,
    openaiDir: "lesson-03-function-calling",
    openrouterDir: "lesson-03-function-calling-openrouter",
  },
  {
    lessonNum: 4,
    openaiDir: "lesson-04-mcp-built-in-tools",
    openrouterDir: "lesson-04-mcp-built-in-tools-openrouter",
  },
  {
    lessonNum: 5,
    openaiDir: "lesson-05-memory",
    openrouterDir: "lesson-05-memory-openrouter",
  },
  {
    lessonNum: 6,
    openaiDir: "lesson-06-rag",
    openrouterDir: "lesson-06-rag-openrouter",
  },
  {
    lessonNum: 7,
    openaiDir: "lesson-07-agent-loop",
    openrouterDir: "lesson-07-agent-loop-openrouter",
  },
  {
    lessonNum: 8,
    openaiDir: "lesson-08-multi-agent-workflow",
    openrouterDir: "lesson-08-multi-agent-workflow-openrouter",
  },
  {
    lessonNum: 9,
    openaiDir: "lesson-09-openai-agents-sdk",
    openrouterDir: "lesson-09-openai-agents-sdk-openrouter",
  },
  {
    lessonNum: 10,
    openaiDir: "lesson-10-langgraph",
    openrouterDir: "lesson-10-langgraph-openrouter",
  },
  {
    lessonNum: 11,
    openaiDir: "lesson-11-evals-observability",
    openrouterDir: "lesson-11-evals-observability-openrouter",
  },
  {
    lessonNum: 12,
    openaiDir: "lesson-12-security",
    openrouterDir: "lesson-12-security-openrouter",
  },
  {
    lessonNum: 13,
    openaiDir: "lesson-13-databases",
    openrouterDir: "lesson-13-databases-openrouter",
  },
  {
    lessonNum: 14,
    openaiDir: "lesson-14-react-sse",
    openrouterDir: "lesson-14-react-sse-openrouter",
  },
  {
    lessonNum: 15,
    openaiDir: "lesson-15-final-project-workshop",
    openrouterDir: "lesson-15-final-project-workshop-openrouter",
  },
];

export interface CheckpointDirectoryEntry {
  name: string;
  isFile: boolean;
}

export function inspectCheckpointDirectoryMismatch(
  lessonNum: number,
  openaiHasCheckpoints: boolean,
  openrouterHasCheckpoints: boolean,
  openrouterEntries: readonly CheckpointDirectoryEntry[],
): { errors: string[]; warnings: string[] } {
  const numStr = String(lessonNum).padStart(2, "0");

  if (lessonNum === 1 && openaiHasCheckpoints && !openrouterHasCheckpoints) {
    return {
      errors: [],
      warnings: [
        `[Parity Notice] Lesson ${numStr}: OpenAI-only checkpoints layer is allowed as documented.`,
      ],
    };
  }

  if (lessonNum >= 11 && lessonNum <= 15 && !openaiHasCheckpoints && openrouterHasCheckpoints) {
    const hasOnlyReadme =
      openrouterEntries.length === 1 &&
      openrouterEntries[0]?.name === "README.md" &&
      openrouterEntries[0].isFile;

    if (hasOnlyReadme) {
      return {
        errors: [],
        warnings: [
          `[Parity Notice] Lesson ${numStr}: OpenRouter checkpoints/ contains only an instructional README; there are no runtime snapshots to compare.`,
        ],
      };
    }

    const unexpectedEntries = openrouterEntries.map((entry) => entry.name);
    if (unexpectedEntries.length > 0) {
      return {
        errors: [
          `Lesson ${numStr}: OpenRouter checkpoints/ has unexpected entries: ${unexpectedEntries.join(", ")}.`,
        ],
        warnings: [],
      };
    }
  }

  return {
    errors: [
      `Checkpoint directory mismatch for lesson ${numStr}: OpenAI=${openaiHasCheckpoints}, OpenRouter=${openrouterHasCheckpoints}`,
    ],
    warnings: [],
  };
}

export async function verifyProviderParity(): Promise<{
  success: boolean;
  errors: string[];
  warnings: string[];
  summaries: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const summaries: string[] = [];

  console.log("==================================================");
  console.log(" ⚖️  ПЕРЕВІРКА PROVIDER PARITY (OpenAI vs OpenRouter)");
  console.log("==================================================");

  for (const pair of PAIRS) {
    const errorsBeforePair = errors.length;
    const numStr = String(pair.lessonNum).padStart(2, "0");
    const openaiPath = join(repositoryRoot, pair.openaiDir);
    const openrouterPath = join(repositoryRoot, pair.openrouterDir);

    if (!existsSync(openaiPath)) {
      errors.push(`Відсутня директорія OpenAI: ${pair.openaiDir}`);
      continue;
    }
    if (!existsSync(openrouterPath)) {
      errors.push(`Відсутня директорія OpenRouter: ${pair.openrouterDir}`);
      continue;
    }

    // 1. Root lesson files presence
    for (const file of ["homework.md", "README.md"]) {
      const oFile = join(openaiPath, file);
      const orFile = join(openrouterPath, file);

      if (!existsSync(oFile)) {
        errors.push(`${pair.openaiDir} не містить ${file}`);
      }
      if (!existsSync(orFile)) {
        errors.push(`${pair.openrouterDir} не містить ${file}`);
      }

      // Content parity diagnostic (Read-only)
      if (existsSync(oFile) && existsSync(orFile)) {
        const c1 = await readFile(oFile, "utf8");
        const c2 = await readFile(orFile, "utf8");
        if (c1 !== c2) {
          warnings.push(
            `[Content Parity] Lesson ${numStr}: ${file} відрізняється між провайдерами (OpenAI: ${c1.length} chars, OpenRouter: ${c2.length} chars). Manual course-content review required.`,
          );
        }
      }
    }

    // 2. Starter / Solution presence and subdirectories
    for (const state of ["starter", "solution"]) {
      const oState = join(openaiPath, state);
      const orState = join(openrouterPath, state);

      if (!existsSync(oState)) errors.push(`${pair.openaiDir} не містить ${state}/`);
      if (!existsSync(orState)) errors.push(`${pair.openrouterDir} не містить ${state}/`);

      // Subdirectories: src, tests
      for (const sub of ["src", "tests"]) {
        const oSub = join(oState, sub);
        const orSub = join(orState, sub);
        if (!existsSync(oSub)) errors.push(`${pair.openaiDir}/${state} не містить ${sub}/`);
        if (!existsSync(orSub)) errors.push(`${pair.openrouterDir}/${state} не містить ${sub}/`);
      }

      // Evals check
      const oHasEvals = existsSync(join(oState, "evals"));
      const orHasEvals = existsSync(join(orState, "evals"));
      if (oHasEvals !== orHasEvals) {
        errors.push(
          `Розбіжність у наявності evals/ для lesson ${numStr}: OpenAI=${oHasEvals}, OpenRouter=${orHasEvals}`,
        );
      }
    }

    // 3. Checkpoints check
    const oCheckpoints = join(openaiPath, "checkpoints");
    const orCheckpoints = join(openrouterPath, "checkpoints");
    const oHasCp = existsSync(oCheckpoints);
    const orHasCp = existsSync(orCheckpoints);

    if (oHasCp !== orHasCp) {
      const openrouterEntries = orHasCp
        ? await readdir(orCheckpoints, { withFileTypes: true })
        : [];
      const checkpointResult = inspectCheckpointDirectoryMismatch(
        pair.lessonNum,
        oHasCp,
        orHasCp,
        openrouterEntries.map((entry) => ({ name: entry.name, isFile: entry.isFile() })),
      );
      errors.push(...checkpointResult.errors);
      warnings.push(...checkpointResult.warnings);
    } else if (oHasCp && orHasCp) {
      const oEntries = await readdir(oCheckpoints, { withFileTypes: true });
      const orEntries = await readdir(orCheckpoints, { withFileTypes: true });

      const oDirs = oEntries
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => e.name)
        .sort();
      const orDirs = orEntries
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => e.name)
        .sort();

      if (oDirs.length !== orDirs.length) {
        errors.push(
          `Розбіжність у кількості checkpoint-директорій для lesson ${numStr}: OpenAI (${oDirs.length}: ${oDirs.join(", ")}) vs OpenRouter (${orDirs.length}: ${orDirs.join(", ")})`,
        );
      }

      const oFiles = oEntries
        .filter((e) => e.isFile() && !e.name.startsWith("."))
        .map((e) => e.name)
        .sort();
      const orFiles = orEntries
        .filter((e) => e.isFile() && !e.name.startsWith("."))
        .map((e) => e.name)
        .sort();

      if (JSON.stringify(oFiles) !== JSON.stringify(orFiles)) {
        warnings.push(
          `[Structural Parity] Lesson ${numStr}/checkpoints: розбіжність файлів: OpenAI [${oFiles.join(", ")}] vs OpenRouter [${orFiles.join(", ")}]. Manual course-content review required.`,
        );
      }
    }

    if (errors.length === errorsBeforePair) {
      const summary = `PASS Lesson ${numStr}: ${pair.openaiDir} <-> ${pair.openrouterDir} структурно узгоджені`;
      summaries.push(summary);
      console.log(` ✔️ ${summary}`);
    } else {
      console.error(
        `❌ FAIL Lesson ${numStr}: ${pair.openaiDir} <-> ${pair.openrouterDir} має структурні розбіжності.`,
      );
    }
  }

  console.log("==================================================");
  if (warnings.length > 0) {
    console.log("⚠️  Попередження та діагностика Provider Parity (READ-ONLY REPORT):");
    for (const w of warnings) console.log(`   - ${w}`);
  }

  if (errors.length > 0) {
    console.error("❌ Знайдено критичні структурні розбіжності Provider Parity:");
    for (const e of errors) console.error(`   - ${e}`);
    return { success: false, errors, warnings, summaries };
  }

  console.log("✔️ Усі спільні OpenAI та OpenRouter варіанти мають повну структурну відповідність.");
  return { success: true, errors, warnings, summaries };
}

async function main() {
  const result = await verifyProviderParity();
  if (!result.success) {
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Помилка перевірки parity:", err);
    process.exit(1);
  });
}
