import { nextJsConfig } from "@build/eslint-config/next-js";

/** @type {import("eslint").Linter.Config} */
const config = [
  { ignores: [".next/**", "dist/**", "node_modules/**", "coverage/**"] },
  ...nextJsConfig,
  {
    rules: {
      "turbo/no-undeclared-env-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];

export default config;
