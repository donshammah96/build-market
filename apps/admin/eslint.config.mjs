import { nextJsConfig } from "@build/eslint-config/next-js";

/** @type {import("eslint").Linter.Config} */
const config = [
  { ignores: [".next/**", "dist/**", "node_modules/**", "coverage/**"] },
  ...nextJsConfig,
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "src/lib/infrastructure/env.ts",
      "next.config.ts",
      "instrumentation.ts",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='process'][property.name='env']",
          message:
            "Read admin environment variables through src/lib/infrastructure/env.ts, or add a documented bootstrap-only exception.",
        },
      ],
    },
  },
  {
    files: ["src/actions/admin/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@build/db",
              importNames: ["prisma"],
              message:
                "Admin actions are adapters; use a service/repository boundary instead of importing Prisma directly.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/api/*",
                "@/lib/jobs/*",
                "@/lib/queues/*",
                "@/lib/workers/*",
                "@/lib/infrastructure/mailer",
                "@/lib/infrastructure/sms",
              ],
              message:
                "Client-facing admin UI must not import server-only infrastructure modules.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "turbo/no-undeclared-env-vars": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];

export default config;
