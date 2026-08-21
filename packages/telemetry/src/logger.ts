import { trace } from "@opentelemetry/api";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerConfig {
  /** Unique service name, e.g. "buildmarket-client", "buildmarket-workers". */
  service: string;
  /** e.g. "production", "staging". */
  env: string;
  /** Datadog ingestion API key. */
  apiKey?: string;
  /** Datadog site host, defaults to "us5.datadoghq.com". */
  siteHost?: string;
  /** Optional hostname override; defaults to a generic per-runtime value. */
  hostname?: string;
}

export interface Logger {
  debug: (message: string, extra?: Record<string, unknown>) => void;
  info: (message: string, extra?: Record<string, unknown>) => void;
  warn: (message: string, extra?: Record<string, unknown>) => void;
  error: (message: string, extra?: Record<string, unknown>) => void;
}

const REDACT_KEYS = new Set([
  "password",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "secret",
  "apikey",
  "creditcard",
  "cvv",
  "krapin",
  "nationalid",
  "clerkid",
  "tokenhash",
]);

function sanitize(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitize(item, depth + 1));
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACT_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitize(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function getActiveTraceContext(): { traceId?: string; spanId?: string } {
  try {
    const span = trace.getActiveSpan();
    const ctx = span?.spanContext();
    if (!ctx || ctx.traceId === "00000000000000000000000000000000") return {};
    return { traceId: ctx.traceId, spanId: ctx.spanId };
  } catch {
    return {};
  }
}

/**
 * Creates a logger that dual-writes: console output (visible in your
 * platform's own log viewer — Vercel Functions logs, Render logs, etc.)
 * and an async, fire-and-forget POST to Datadog's Logs HTTP intake API.
 */
export function createLogger(config: LoggerConfig): Logger {
  const siteHost = config.siteHost || "us5.datadoghq.com";
  const intakeUrl = `https://http-intake.logs.${siteHost}/api/v2/logs`;

  function ship(
    level: LogLevel,
    message: string,
    extra: Record<string, unknown> = {},
  ): void {
    const sanitizedExtra = sanitize(extra) as Record<string, unknown>;
    const traceCtx = getActiveTraceContext();

    console[level === "debug" ? "log" : level](message, sanitizedExtra);

    if (!config.apiKey) {
      return;
    }

    const payload = {
      ddsource: "nodejs",
      ddtags: `env:${config.env},service:${config.service}`,
      service: config.service,
      hostname: config.hostname ?? "unknown",
      message,
      level,
      ...(traceCtx.traceId ? { "dd.trace_id": traceCtx.traceId } : {}),
      ...(traceCtx.spanId ? { "dd.span_id": traceCtx.spanId } : {}),
      ...sanitizedExtra,
    };

    fetch(intakeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DD-API-KEY": config.apiKey,
      },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Swallow — logging must never throw into request/job handling.
    });
  }

  return {
    debug: (message, extra) => ship("debug", message, extra),
    info: (message, extra) => ship("info", message, extra),
    warn: (message, extra) => ship("warn", message, extra),
    error: (message, extra) => ship("error", message, extra),
  };
}
