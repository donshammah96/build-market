export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" // bootstrap-only: Next.js instrumentation hook, envConfig not yet available
  ) {
    const { initOtel } = await import("./app/lib/infrastructure/otel");
    const { envConfig } = await import("./app/lib/infrastructure/env");
    initOtel(envConfig);

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
