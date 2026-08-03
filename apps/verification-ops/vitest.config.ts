import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    // TSCONFIG ALIGNMENT: tsconfig.json maps "@/*" -> "./*" and "@/lib/*" -> "./lib/*".
    // Vitest uses "@" -> "./" which resolves both "@/lib/..." -> "./lib/..."
    // and generic "@/*" paths cleanly across tsc, Next, and Vitest.
    alias: [{ find: "@", replacement: path.resolve(__dirname, "./") }],
  },
  test: {
    globals: true,
    setupFiles: ["./__tests__/setup.ts"],
    environment: "node", // Node runtime default for server auth, Prisma queries, and env validation
    include: [
      "__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
      "app/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
    ],
    testTimeout: 10000, // 10s threshold for async database & auth context tests
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "__tests__/",
        "**/*.config.{js,ts}",
        "**/types/",
        "**/*.d.ts",
        ".next/",
        // FIX: these are App Router framework-required/declarative files —
        // better suited to integration/e2e or visual testing than unit
        // coverage. Leaving them in the denominator either drags the global
        // percentage down for files that don't benefit much from unit
        // tests, or invites low-value tests written purely to hit a number.
        "middleware.ts",
        "instrumentation.ts",
        "app/layout.tsx",
        "app/loading.tsx",
        "app/not-found.tsx",
        "app/error.tsx",
        "app/global-error.tsx",
      ],
      thresholds: {
        // NOTE: confirm this is achievable before relying on it as a CI
        // gate — as of this review, auth.test.ts is the only test file in
        // the app, and 80% across every remaining file (page.tsx, env.ts,
        // etc.) is very unlikely to be met yet. Either ratchet this up
        // incrementally as coverage grows, or confirm it isn't wired into
        // a blocking CI check until it's realistic.
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
