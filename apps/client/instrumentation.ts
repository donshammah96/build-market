export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" // bootstrap-only: Next.js instrumentation hook, envConfig not yet available
  ) {
    const { initTracing } = await import("@build/telemetry");
    const { envConfig } = await import("./app/lib/infrastructure/env");
    initTracing({
      serviceName: envConfig.otel.serviceName || "buildmarket-client",
      isProd: envConfig.isProd,
    });

    const { initializeProductionVirusScanner } =
      await import("./app/lib/domains/uploads/virus-scanner");
    initializeProductionVirusScanner({
      storage: {
        cloudmersiveApiKey: envConfig.storage.cloudmersiveApiKey,
        cloudmersiveBaseUrl: envConfig.storage.cloudmersiveBaseUrl,
      },
      isProd: envConfig.isProd,
      features: {
        allowMockScanner: envConfig.features.allowMockScanner,
      },
    });
  }
}
