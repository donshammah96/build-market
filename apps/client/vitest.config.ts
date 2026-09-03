import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: ["./__tests__/setup.ts"],
    environment: "node", // Default to node for API tests
    include: [
      "__tests__/**/*.{test,spec}.{js,ts,tsx}",
      "app/**/*.{test,spec}.{js,ts,tsx}",
    ],
    exclude: [
      ...configDefaults.exclude,
      ".next/**",
      ".turbo/**",
      ".wrangler/**",
      "tmp/**",
      "cypress/**",
    ],
    pool: "threads",
    maxWorkers: 4,
    testTimeout: 20000, // 20 seconds for parallel monorepo test runs with dynamic module imports
    hookTimeout: 20000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "__tests__/",
        "**/*.config.{js,ts}",
        "**/types/",
        "**/*.d.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: [
      { find: "@/app", replacement: path.resolve(__dirname, "./app") },
      {
        find: "@/components",
        replacement: path.resolve(__dirname, "./components"),
      },
      // Short-form aliases matching tsconfig.json paths — must come before the catch-all @
      {
        find: /^@\/domains\/(.+)$/,
        replacement: path.resolve(__dirname, "./app/lib/domains") + "/$1",
      },
      {
        find: /^@\/api\/(.+)$/,
        replacement: path.resolve(__dirname, "./app/lib/api") + "/$1",
      },
      {
        find: /^@\/infra\/(.+)$/,
        replacement:
          path.resolve(__dirname, "./app/lib/infrastructure") + "/$1",
      },
      {
        find: /^@\/security\/(.+)$/,
        replacement: path.resolve(__dirname, "./app/lib/security") + "/$1",
      },
      {
        find: /^@\/config\/(.+)$/,
        replacement: path.resolve(__dirname, "./app/lib/config") + "/$1",
      },
      {
        find: /^@\/validation\/(.+)$/,
        replacement: path.resolve(__dirname, "./app/lib/validation") + "/$1",
      },
      {
        find: /^@\/facades\/(.+)$/,
        replacement: path.resolve(__dirname, "./lib/facades") + "/$1",
      },
      {
        find: /^@\/ui\/(.+)$/,
        replacement: path.resolve(__dirname, "./components") + "/$1",
      },
      {
        find: "@/routes",
        replacement: path.resolve(__dirname, "./lib/routes/index"),
      },
      // Explicit package paths must precede the general @ prefix alias
      {
        find: "@build/lead-qualification",
        replacement: path.resolve(
          __dirname,
          "../../packages/lead-qualification/src/index.ts",
        ),
      },
      {
        find: "@build/resilience",
        replacement: path.resolve(
          __dirname,
          "../../packages/resilience/src/index.ts",
        ),
      },
      // Catch-all must be last
      { find: "@", replacement: path.resolve(__dirname, "./") },
    ],
  },
});
