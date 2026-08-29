import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import type { WorkerEnv } from "./env.js";

let sdk: NodeSDK | null = null;

export function initOtel(env: WorkerEnv): void {
  if (sdk) return;

  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    return;
  }

  const serviceName = env.OTEL_SERVICE_NAME || "build-market-workers";
  const environment =
    env.DD_ENV || (env.NODE_ENV === "production" ? "production" : "staging");

  const resourceAttributes: Record<string, string> = {
    "service.name": serviceName,
    "deployment.environment": environment,
  };

  if (env.OTEL_RESOURCE_ATTRIBUTES) {
    const parts = env.OTEL_RESOURCE_ATTRIBUTES.split(",");
    for (const part of parts) {
      const [key, val] = part.split("=");
      if (key && val) {
        resourceAttributes[key.trim()] = val.trim();
      }
    }
  }

  if (env.OTEL_EXPORTER_OTLP_HEADERS) {
    process.env.OTEL_EXPORTER_OTLP_HEADERS = env.OTEL_EXPORTER_OTLP_HEADERS;
  } else if (env.DD_API_KEY) {
    process.env.OTEL_EXPORTER_OTLP_HEADERS = `dd-api-key=${env.DD_API_KEY}`;
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
    instrumentations: [new PrismaInstrumentation()],
  });

  try {
    sdk.start();
    console.log(
      "[OTel] OpenTelemetry initialized successfully for workers daemon.",
    );
  } catch (error) {
    console.error(
      "[OTel] Error initializing OpenTelemetry in workers daemon:",
      error,
    );
  }
}

export async function shutdownOtel(): Promise<void> {
  if (!sdk) return;

  try {
    await sdk.shutdown();
    console.log("[OTel] OpenTelemetry terminated.");
  } catch (error) {
    console.error("[OTel] Error terminating OpenTelemetry:", error);
  } finally {
    sdk = null;
  }
}
