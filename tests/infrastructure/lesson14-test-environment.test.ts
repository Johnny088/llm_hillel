import { describe, expect, it } from "vitest";
import { createLesson14TestEnvironment } from "../../scripts/verify-lesson14-openrouter-test-environment.js";

describe("Lesson 14 offline completion database environment", () => {
  it("retains the default local database and synthetic role credentials", () => {
    const safe = createLesson14TestEnvironment({});
    expect(safe.LESSON13_OPENROUTER_ADMIN_DATABASE_URL).toBe(
      "postgresql://course_admin:course_admin_password@127.0.0.1:5434/ai_agents_openrouter",
    );
    expect(safe.LESSON13_OPENROUTER_AGENT_DATABASE_URL).toBe(
      "postgresql://catalog_agent_runtime:catalog_agent_runtime_password@127.0.0.1:5434/ai_agents_openrouter",
    );
    expect(safe.LESSON14_OPENROUTER_DATABASE_URL).toBe(
      "postgresql://chat_app:chat_app_password@127.0.0.1:5434/ai_agents_openrouter",
    );
    expect(safe.NODE_ENV).toBe("test");
  });

  it("uses the isolated port consistently through nested gate environments", () => {
    const safe = createLesson14TestEnvironment({ COURSE_TEST_DATABASE_PORT: "55432" });
    for (const key of [
      "LESSON13_OPENROUTER_ADMIN_DATABASE_URL",
      "LESSON13_OPENROUTER_READ_DATABASE_URL",
      "LESSON13_OPENROUTER_WRITE_DATABASE_URL",
      "LESSON13_OPENROUTER_AGENT_DATABASE_URL",
      "LESSON14_OPENROUTER_DATABASE_URL",
    ])
      expect(safe[key]).toContain("@127.0.0.1:55432/ai_agents_openrouter");
    expect(createLesson14TestEnvironment(safe)).toEqual(safe);
  });

  it.each(["", "0", "65536", "-1", "5434.5", " 5434", "5434/other"])(
    "rejects invalid test port %j before launching children",
    (port) => {
      expect(() => createLesson14TestEnvironment({ COURSE_TEST_DATABASE_PORT: port })).toThrow(
        "COURSE_TEST_DATABASE_PORT must be an integer between 1 and 65535.",
      );
    },
  );

  it("removes inherited provider credentials and database targets without mutating the parent", () => {
    const original = {
      OPENAI_API_KEY: "fixture-key",
      OPENROUTER_API_KEY: "fixture-key",
      OTHER_TOKEN: "fixture-token",
      DATABASE_URL: "postgresql://fixture.invalid/production",
      LESSON13_OPENROUTER_ADMIN_DATABASE_URL: "postgresql://fixture.invalid/production",
      LESSON13_OPENROUTER_AGENT_DATABASE_URL: "postgresql://fixture.invalid:5434/production",
      PGHOST: "fixture.invalid",
      PATH: "fixture-path",
    };
    const snapshot = { ...original };
    const safe = createLesson14TestEnvironment(original);
    expect(original).toEqual(snapshot);
    expect(safe.OPENAI_API_KEY).toBeUndefined();
    expect(safe.OPENROUTER_API_KEY).toBeUndefined();
    expect(safe.OTHER_TOKEN).toBeUndefined();
    expect(safe.DATABASE_URL).toBeUndefined();
    expect(safe.PGHOST).toBeUndefined();
    expect(safe.LESSON13_OPENROUTER_ADMIN_DATABASE_URL).not.toContain("fixture.invalid");
    expect(safe.LESSON13_OPENROUTER_AGENT_DATABASE_URL).toBe(
      "postgresql://catalog_agent_runtime:catalog_agent_runtime_password@127.0.0.1:5434/ai_agents_openrouter",
    );
    expect(safe.PATH).toBe("fixture-path");
  });
});
