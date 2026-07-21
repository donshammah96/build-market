import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/test/integration/**/*.test.ts"],
    globalSetup: ["src/test/integration/global-setup.ts"],
    // JetStream ack-wait/redelivery tests deliberately wait real seconds
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // JetStream state (streams, consumers) lives in one shared server process;
    // running suites in parallel would race on stream/consumer names.
    fileParallelism: false,
  },
});
