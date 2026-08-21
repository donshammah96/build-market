import tracer from "dd-trace";
import type { WorkerEnv } from "./env.js";

let tracerInitialized = false;

export interface TracerOptions {
  service?: string;
  env?: string;
  version?: string;
  logInjection?: boolean;
  runtimeMetrics?: boolean;
  hostname?: string;
  site?: string;
}

/**
 * Initializes Datadog APM tracing for the background workers daemon from validated environment config.
 */
export function initTracer(env?: Partial<WorkerEnv>): typeof tracer {
  if (tracerInitialized) {
    return tracer;
  }

  const isEnabled = env?.DD_TRACE_ENABLED ?? true;
  if (!isEnabled) {
    return tracer;
  }

  const service =
    env?.DD_SERVICE || env?.OTEL_SERVICE_NAME || "buildmarket-workers";
  const environment =
    env?.DD_ENV || (env?.NODE_ENV === "production" ? "production" : "staging");
  const version = env?.DD_VERSION;
  const hostname = env?.DD_AGENT_HOST;
  const site = env?.DD_SITE || env?.DD_SITE_HOST;

  try {
    tracer.init({
      service,
      env: environment,
      version,
      logInjection: true,
      runtimeMetrics: true,
      ...(site ? { site } : {}),
      ...(hostname ? { hostname } : {}),
    });
    tracerInitialized = true;
  } catch (error) {
    console.error("[Datadog] Error initializing Datadog tracer:", error);
  }

  return tracer;
}

export { tracer };
export default tracer;
