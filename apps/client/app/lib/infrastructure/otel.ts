// app/lib/infrastructure/otel.ts
import { initTracing } from "@build/telemetry";
import type { ClientEnvConfig } from "./env";

export function initOtel(env: ClientEnvConfig): void {
  initTracing({
    serviceName: env.otel.serviceName || "build-market-client",
    isProd: env.isProd,
  });
}
