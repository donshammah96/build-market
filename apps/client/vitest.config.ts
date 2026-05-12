import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: ["./__tests__/setup.ts"],
    environment: "node", // Default to node for API tests
    include: ["**/__tests__/**/*.{test,spec}.{js,ts,tsx}"],
    testTimeout: 10000, // 10 seconds for tests with eventual consistency scenarios
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
      // Catch-all must be last
      { find: "@", replacement: path.resolve(__dirname, "./") },
      {
        find: "@build/resilience",
        replacement: path.resolve(
          __dirname,
          "../../packages/resilience/src/index.ts",
        ),
      },
    ],
  },
});
