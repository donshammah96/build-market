import { nextJsConfig } from "@build/eslint-config/next-js";

/** @type {import("eslint").Linter.Config} */
const config = [
  ...nextJsConfig,
  {
    rules: {
      "react/prop-types": "off",
      "turbo/no-undeclared-env-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["app/lib/auth/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["@/app/actions/*"],
        },
      ],
    },
  },
  {
    files: ["lib/services/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["@/app/actions/*", "@/app/api/*", "@/app/api/**"],
        },
      ],
    },
  },
  {
    files: ["lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["@/app/lib/services/*", "@/app/lib/repositories/*"],
        },
      ],
    },
  },
  {
    files: [
      "lib/services/*-operations.service.ts",
      "lib/repositories/*.repository.ts",
      "lib/config/*.ts",
      "lib/validation/*.ts",
      "lib/utils/validators.ts",
    ],
    rules: {
      // Boundary bridge modules intentionally re-export server internals.
      "no-restricted-imports": "off",
    },
  },
  {
    files: ["components/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            "@build/db",
            "@build/auth-server",
            "@build/messaging-server",
            "@build/mail-server",
            "@build/queue-server",
          ],
          patterns: ["@/app/lib/services/*"],
        },
      ],
    },
  },
  {
    files: ["lib/**/*.{ts,tsx}"],
    ignores: [
      "lib/services/*-operations.service.ts",
      "lib/repositories/*.repository.ts",
      "lib/config/*.ts",
      "lib/validation/*.ts",
      "lib/utils/validators.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            "@build/auth-server",
            "@build/messaging-server",
            "@build/mail-server",
            "@build/queue-server",
          ],
        },
      ],
    },
  },
  {
    files: ["app/api/messaging/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          paths: ["@build/db", "@/lib/services/messaging"],
        },
      ],
    },
  },
];

export default config;
