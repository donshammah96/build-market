import { config as baseConfig } from "@build/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "*.log"],
  },
  ...baseConfig,
  {
    files: ["src/**/*.{ts,js}"],
    ignores: ["src/env.ts", "**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='process'][property.name='env']",
          message:
            "Direct process.env reads are prohibited outside src/env.ts. Use validateWorkerEnv() / validated environment properties.",
        },
      ],
    },
  },
];
