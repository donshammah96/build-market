/**
 * Next.js Instrumentation Hook for apps/verification-ops
 * =======================================================
 * Runs once at application startup on the Node.js runtime to validate
 * environment configuration fail-fast per ADR-004.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./lib/infrastructure/env");
    validateEnv();
  }
}
