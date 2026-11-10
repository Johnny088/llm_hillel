import { describe, expect, it } from "vitest";
import { getLessonCheckCommand } from "../../scripts/dev-manager.js";

describe("dev-manager validation scope", () => {
  it("validates only the current OpenRouter solution", () => {
    const command = getLessonCheckCommand("lesson-01-intro-openrouter", "solution");

    expect(command).toBe(
      "yarn test:lesson01:openrouter:solution && yarn build:lesson01:openrouter",
    );
    expect(command).not.toContain("audit:structure");
    expect(command).not.toContain("check:lesson");
  });

  it("validates only the current dev starter", () => {
    const command = getLessonCheckCommand("lesson-02-llm-api-openrouter", "starter");

    expect(command).toBe(
      "yarn typecheck:dev && yarn lint:dev && yarn format:check:dev && yarn vitest run --dir dev/tests",
    );
    expect(command).not.toContain("audit:structure");
    expect(command).not.toContain("lesson-03");
  });
});
