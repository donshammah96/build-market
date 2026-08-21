import { registerOTel } from "@vercel/otel";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import type { Instrumentation } from "@opentelemetry/instrumentation";

export interface InitTracingOptions {
  /** Unique service name, e.g. "buildmarket-client", "buildmarket-admin". */
  serviceName: string;
  /** True in production, false for preview/staging deploys. */
  isProd: boolean;
  /**
   * Additional OpenTelemetry instrumentations beyond the default set
   * (fetch is included automatically by @vercel/otel; Prisma is included
   * below by default since every app in this monorepo uses Prisma).
   */
  extraInstrumentations?: Instrumentation[];
  /** Extra resource attributes to attach to every span. */
  attributes?: Record<string, string>;
}

let initialized = false;

/**
 * Initializes OpenTelemetry tracing for a Next.js app on Vercel, exporting
 * directly to Datadog's OTLP intake endpoint (agentless — no Vercel Drain,
 * no Datadog Agent).
 *
 * Requires these env vars to be set on the Vercel project:
 *   OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://otlp-intake.<DD_SITE>/v1/traces
 *   OTEL_EXPORTER_OTLP_HEADERS=dd-api-key=<DD_API_KEY>
 *
 * Call this once from instrumentation.ts, inside the NEXT_RUNTIME === "nodejs"
 * branch. Do not call from browser code — @vercel/otel is server-only.
 */
export function initTracing(options: InitTracingOptions): void {
  if (typeof window !== "undefined") return;
  if (initialized) return;
  initialized = true;

  registerOTel({
    serviceName: options.serviceName,
    instrumentations: [
      new PrismaInstrumentation(),
      ...(options.extraInstrumentations ?? []),
    ],
    attributes: {
      "deployment.environment": options.isProd ? "production" : "staging",
      ...options.attributes,
    },
  });
}
