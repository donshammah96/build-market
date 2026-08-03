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
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "middleware.ts"],
    ignores: [
      "lib/infrastructure/env.ts",
      "instrumentation.ts",
      "next.config.ts",
      "**/__tests__/**/*.{ts,tsx}",
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.type='MemberExpression'][object.object.name='process'][object.property.name='env']",
          message:
            "Use the typed env module instead of direct process.env access. See lib/infrastructure/env.ts.",
        },
        {
          selector: "ImportDeclaration[source.value=/^@\\/app\\/.+\\/page$/]",
          message:
            "Do not import Next page modules. Move shared UI into components.",
        },
        {
          selector:
            "ExportNamedDeclaration[source.value=/^@\\/app\\/.+\\/page$/]",
          message:
            "Do not re-export from Next page modules. Re-export from component modules instead.",
        },
        {
          selector:
            "ExportAllDeclaration[source.value=/^@\\/app\\/.+\\/page$/]",
          message:
            "Do not export * from Next page modules. Re-export from component modules instead.",
        },
      ],
    },
  },
];

export default config;
