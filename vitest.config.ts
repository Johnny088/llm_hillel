import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/dist/**", "**/.tmp/**"],
    environment: "node",
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      exclude: [
        "**/tests/**",
        "**/evals/**",
        "**/checkpoints/**",
        "**/dist/**",
        "**/node_modules/**",
      ],
    },
  },
});
