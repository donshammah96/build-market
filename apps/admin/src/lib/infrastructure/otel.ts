import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { AdminEnvConfig } from "./env";

let sdk: NodeSDK | null = null;

export function initOtel(env: AdminEnvConfig) {
  if (typeof window !== "undefined") return;
  if (sdk) return;

  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://127.0.0.1:4317";
  const serviceName = env.OTEL_SERVICE_NAME || "build-market-local-api";

  const resourceAttributes: Record<string, string> = {
    "service.name": serviceName,
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

  const exporter = new OTLPTraceExporter({
    url: endpoint,
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes(resourceAttributes),
    traceExporter: exporter,
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
