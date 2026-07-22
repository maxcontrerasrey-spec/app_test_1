import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage",
      include: [
        "src/modules/incentives/lib/**/*.ts",
        "src/modules/incentives/services/incentivesApiMappers.ts",
        "src/modules/operaciones/lib/service-entry.ts",
        "src/modules/operaciones/lib/transformers.ts",
        "src/modules/recruitment/lib/**/*.ts",
        "src/shared/lib/supabaseRpc.ts",
        "src/shared/lib/queryKeys.ts"
      ],
      exclude: [
        "src/modules/**/types.ts",
        "src/modules/recruitment/lib/bukEmployeeTemplate.ts"
      ],
      all: true
    }
  }
});
