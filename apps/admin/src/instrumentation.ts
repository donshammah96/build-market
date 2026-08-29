export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" // bootstrap-only: Next.js instrumentation hook, adminEnvConfig not yet available
  ) {
    const { initTracing } = await import("@build/telemetry");
    const { adminEnvConfig } = await import("./lib/infrastructure/env");
    initTracing({
      serviceName: adminEnvConfig.OTEL_SERVICE_NAME || "buildmarket-admin",
      isProd: adminEnvConfig.NODE_ENV === "production",
    });
  }
}
