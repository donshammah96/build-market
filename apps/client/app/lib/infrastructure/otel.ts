import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import type { ClientEnvConfig } from "./env";

let sdk: NodeSDK | null = null;

export function initOtel(env: ClientEnvConfig) {
  if (typeof window !== "undefined") return;
  if (sdk) return;

  const endpoint = env.otel.endpoint;
  if (!endpoint) {
    return;
  }
  const serviceName = env.otel.serviceName || "build-market-client-dev";

  const resourceAttributes: Record<string, string> = {
    "service.name": serviceName,
  };

  if (env.otel.resourceAttributes) {
    const parts = env.otel.resourceAttributes.split(",");
    for (const part of parts) {
      const [key, val] = part.split("=");
      if (key && val) {
        resourceAttributes[key.trim()] = val.trim();
      }
    }
  }

  const traceExporter = new OTLPTraceExporter({
    url: endpoint,
  });

  const metricExporter = new OTLPMetricExporter({
    url: endpoint,
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter as any,
    exportIntervalMillis: 60000,
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes(resourceAttributes),
    traceExporter,
    metricReader: metricReader as any,
    instrumentations: [new PrismaInstrumentation(), new HttpInstrumentation()],
  });

  try {
    sdk.start();
    console.log("[OTel] OpenTelemetry initialized successfully."); // bootstrap-only: telemetry setup
  } catch (error) {
    console.error("[OTel] Error initializing OpenTelemetry:", error); // bootstrap-only: telemetry setup
  }

  process.on("SIGTERM", () => {
    if (sdk) {
      sdk
        .shutdown()
        .then(() => console.log("[OTel] OpenTelemetry terminated.")) // bootstrap-only: telemetry shutdown
        .catch(
          (error) =>
            console.error("[OTel] Error terminating OpenTelemetry:", error), // bootstrap-only: telemetry shutdown
        )
        .finally(() => process.exit(0));
    }
  });
}
