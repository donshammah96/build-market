import { initTracing } from "@build/telemetry";
import type { AdminEnvConfig } from "./env-schema";

export function initOtel(env: AdminEnvConfig): void {
  initTracing({
    serviceName: env.OTEL_SERVICE_NAME || env.DD_SERVICE || "buildmarket-admin",
    isProd: env.NODE_ENV === "production",
  });
}
