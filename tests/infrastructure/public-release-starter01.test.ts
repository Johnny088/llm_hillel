import { describe, expect, it } from "vitest";
import { transformCohortSnapshotPackageJson } from "../../scripts/publish-public.mjs";

const starter01Command = "node scripts/run-tsx-entrypoint.mjs dev/src/index.ts";
const packageJsonText = `${JSON.stringify(
  {
    name: "course",
    private: true,
    scripts: {
      dev: "tsx dev/src/server.ts",
      "dev:current": "node scripts/run-tsx-entrypoint.mjs dev/src/server.ts",
      build: "tsc --noEmit",
    },
    dependencies: { vitest: "^3.0.0" },
  },
  null,
  2,
)}\n`;

describe("cohort starter 01 package snapshot", () => {
  it("routes both dev scripts to the starter entrypoint and preserves other package data", () => {
    const result = transformCohortSnapshotPackageJson(
      packageJsonText,
      { devMode: "cohort", devLesson: 1 },
      1,
    );

    expect(JSON.parse(result)).toEqual({
      ...JSON.parse(packageJsonText),
      scripts: {
        ...JSON.parse(packageJsonText).scripts,
        dev: starter01Command,
        "dev:current": starter01Command,
      },
    });
  });

  it("uses releasedThrough when cohort devLesson is absent", () => {
    const result = transformCohortSnapshotPackageJson(packageJsonText, { devMode: "cohort" }, 1);

    expect(JSON.parse(result).scripts).toMatchObject({
      dev: starter01Command,
      "dev:current": starter01Command,
    });
  });

  it("leaves lesson 12 cohort and live dev package snapshots byte-identical", () => {
    expect(
      transformCohortSnapshotPackageJson(packageJsonText, { devMode: "cohort", devLesson: 12 }, 12),
    ).toBe(packageJsonText);
    expect(
      transformCohortSnapshotPackageJson(packageJsonText, { devMode: "live", devLesson: 1 }, 12),
    ).toBe(packageJsonText);
  });
});
