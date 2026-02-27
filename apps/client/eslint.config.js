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
];

export default config;
