/**
 * Next.js Instrumentation Hook for apps/verification-ops
 * =======================================================
 * Runs once at application startup on the Node.js runtime to validate
 * environment configuration fail-fast per ADR-004.
 */

export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" // bootstrap-only: Next.js instrumentation hook, validateEnv not yet available
  ) {
    const { validateEnv, envConfig } = await import("./lib/infrastructure/env");
    validateEnv();
    const { initTracing } = await import("@build/telemetry");
    initTracing({
      serviceName: "buildmarket-verification-ops",
      isProd: envConfig.nodeEnv === "production",
    });
  }
}
