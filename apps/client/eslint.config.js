import { nextJsConfig } from "@build/eslint-config/next-js";

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
    rules: {
      "react/prop-types": "off",
      "turbo/no-undeclared-env-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
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
      ],
    },
  },
  {
    files: [
      "app/lib/api/api-middleware.ts",
      "app/lib/api/cors.ts",
      "app/lib/infrastructure/storage.ts",
      "app/lib/infrastructure/webhook-replay.ts",
      "app/jobs/**/*.ts",
      "app/workers/**/*.ts",
      "middleware.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.type='MemberExpression'][object.object.name='process'][object.property.name='env']",
          message:
            "Use the typed env module instead of direct process.env in guarded runtime files.",
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
      "middleware.ts",
    ],
    ignores: [
      "app/lib/api/cors.ts",
      "**/__tests__/**/*.{ts,tsx}",
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^Access-Control-Allow-/]",
          message: "Set CORS headers only through app/lib/api/cors.ts helpers.",
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
