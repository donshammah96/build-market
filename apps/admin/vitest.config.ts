import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@/_core",
        replacement: path.resolve(__dirname, "src/actions/admin/_core"),
      },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
  test: {
    globals: true,
    include: [
      "__tests__/**/*.test.{ts,tsx}",
      "src/**/*.test.{ts,tsx}",
      "src/**/__tests__/**/*.test.{ts,tsx}",
    ],
  },
});
