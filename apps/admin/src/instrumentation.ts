export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") { // bootstrap-only: Next.js initialization check
    const { initOtel } = await import("./lib/infrastructure/otel");
    const { adminEnvConfig } = await import("./lib/infrastructure/env");
    initOtel(adminEnvConfig);
  }
}
