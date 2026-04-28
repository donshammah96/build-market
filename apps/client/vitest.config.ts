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
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@/app": path.resolve(__dirname, "./app"),
      "@/components": path.resolve(__dirname, "./components"),
      "@build/resilience": path.resolve(
        __dirname,
        "../../packages/resilience/src/index.ts",
      ),
    },
  },
});
