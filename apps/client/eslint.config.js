import { nextJsConfig } from "@build/eslint-config/next-js";
import importPlugin from "eslint-plugin-import";

/** @type {import("eslint").Linter.Config} */
const config = [
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "cypress/**",
    ],
  },
  ...nextJsConfig,
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      "react/prop-types": "off",
      "turbo/no-undeclared-env-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "import/no-cycle": ["error", { maxDepth: 3 }],
    },
  },
  {
    files: [
      "app/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "hooks/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
      "middleware.ts",
    ],
    ignores: [
      "app/lib/infrastructure/env.ts",
      "**/__tests__/**/*.{ts,tsx}",
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "cypress/**/*",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value=/^@\\/app\\/.+\\/page$/]",
          message:
            "Do not import Next page modules. Move shared UI into app/**/_components or components/**.",
        },
        {
          selector:
            "ImportDeclaration[source.value=/^\\.{1,2}(?:\\/[^/]+)*\\/page$/]",
          message:
            "Do not import relative page modules. Move shared UI into app/**/_components or components/**.",
        },
        {
          selector:
            "ExportNamedDeclaration[source.value=/^@\\/app\\/.+\\/page$/]",
          message:
            "Do not re-export from Next page modules. Re-export from component modules instead.",
        },
        {
          selector:
            "ExportNamedDeclaration[source.value=/^\\.{1,2}(?:\\/[^/]+)*\\/page$/]",
          message:
            "Do not re-export from relative page modules. Re-export from component modules instead.",
        },
        {
          selector:
            "ExportAllDeclaration[source.value=/^@\\/app\\/.+\\/page$/]",
          message:
            "Do not export * from Next page modules. Re-export from component modules instead.",
        },
        {
          selector:
            "ExportAllDeclaration[source.value=/^\\.{1,2}(?:\\/[^/]+)*\\/page$/]",
          message:
            "Do not export * from relative page modules. Re-export from component modules instead.",
        },
        {
          selector:
            "Property[key.type='Identifier'][key.name='exempt'][value.type='Literal'][value.value=true]",
          message:
            "Do not use boolean CSRF exemption flags. Use a typed CsrfExemption object.",
        },
        {
          selector:
            "Property[key.type='Identifier'][key.name='exempt'][value.type='Literal'][value.value=false]",
          message:
            "Do not use boolean CSRF exemption flags. Use a typed CsrfExemption object.",
        },
        {
          selector:
            "MemberExpression[object.type='MemberExpression'][object.object.name='process'][object.property.name='env']",
          message:
            "Use the typed env module instead of direct process.env access. See app/lib/infrastructure/env.ts.",
        },
        {
          selector: "Literal[value=/^Access-Control-Allow-/]",
          message: "Set CORS headers only through app/lib/api/cors.ts helpers.",
        },
      ],
    },
  },
  {
    files: ["app/lib/api/cors.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.type='MemberExpression'][object.object.name='process'][object.property.name='env']",
          message:
            "Use the typed env module instead of direct process.env access. See app/lib/infrastructure/env.ts.",
        },
      ],
    },
  },
  {
    files: ["app/api/**/*.{ts,tsx}", "app/actions/**/*.{ts,tsx}"],
    ignores: ["app/api/health/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["@build/db"],
        },
      ],
    },
  },
  {
    files: [
      "app/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "hooks/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
    ],
    ignores: [
      "app/jobs/**",
      "**/__tests__/**",
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/*.worker", "**/workers/**"],
              message:
                "Background workers and consumer loops must not reside in or be imported by apps/client. All workers are decoupled into the standalone apps/workers daemon.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["app/lib/domains/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/app/lib/api/api-response",
              importNames: ["HttpStatus"],
              message:
                "Domain services must not import HttpStatus. Map domain errors to HTTP in adapters.",
            },
            {
              name: "next/server",
              importNames: ["NextResponse"],
              message:
                "Domain services must not import NextResponse. Adapter layers own HTTP responses.",
            },
            {
              name: "@/app/lib/api/resilient-api",
              importNames: ["getClientLogger"],
              message:
                "Domain services must not import getClientLogger. Logging belongs in adapters.",
            },
          ],
        },
      ],
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
