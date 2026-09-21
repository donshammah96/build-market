/**
 * Structured logging with correlation IDs, OpenTelemetry trace correlation,
 * and field-level redaction.
 *
 * FIX (staff audit, 2026-07): This module used to hand-roll structured
 * logging on top of console.log/console.error. That duplicated work you've
 * already done elsewhere with Pino, and it was missing things a hand-rolled
 * logger almost always misses at scale: redaction, safe circular-reference
 * handling, backpressure-aware I/O, and trace correlation. This version
 * keeps the exact same public API (Logger, StructuredLogger, createLogger,
 * CorrelationIdManager) so nothing calling this module needs to change —
 * only the internals are different.
 */

import pino, { type Logger as PinoLogger } from "pino";
import { LogContext } from "./types.js";
import type { Logger } from "./types.js";
import { getConfig } from "./config.js";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  createDatadogPinoTarget,
  type DatadogPinoTarget,
} from "./datadog-pino-target.js";

// Re-export Logger type for convenience
export type { Logger } from "./types.js";

// ============================================
// OpenTelemetry trace correlation (optional)
// ============================================
// Treated as an optional peer dependency: if @opentelemetry/api isn't
// installed, or there's no active span, logs simply omit traceId/spanId
// instead of throwing. This is what lets you click from a log line straight
// into the matching trace in Grafana Tempo / Datadog APM / Honeycomb.
let otelApi: typeof import("@opentelemetry/api") | undefined;
try {
  otelApi = await import("@opentelemetry/api");
} catch {
  otelApi = undefined;
}

function getActiveTraceContext(): { traceId?: string; spanId?: string } {
  if (!otelApi) return {};
  const span = otelApi.trace.getActiveSpan();
  const ctx = span?.spanContext();
  if (!ctx || ctx.traceId === "00000000000000000000000000000000") return {};
  return { traceId: ctx.traceId, spanId: ctx.spanId };
}

// ============================================
// Correlation ID propagation (AsyncLocalStorage)
// ============================================
// FIX: previously typed AsyncLocalStorage<string> and used an empty-string
// sentinel to represent "cleared", because the store had to hold a string.
// Typing the store as `string | undefined` removes the sentinel hack
// entirely — clear() now really clears it.
const asyncLocalStorage = new AsyncLocalStorage<string | undefined>();

export class CorrelationIdManager {
  static generate(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Execute a function within an isolated correlation context.
   * Preferred for Next.js API routes and middleware — each request gets its
   * own scope, so there's no risk of one request's ID leaking into another's
   * concurrent logs.
   */
  static run<T>(correlationId: string, callback: () => T): T {
    return asyncLocalStorage.run(correlationId, callback);
  }

  /**
   * Set correlation ID for the current context via enterWith.
   * Use for flat contexts (e.g. isolated BullMQ worker callbacks) where a
   * wrapping .run() call is awkward. Remember to call clear() when the job
   * finishes if the worker reuses the same async context for the next job.
   */
  static set(correlationId: string): void {
    asyncLocalStorage.enterWith(correlationId);
  }

  static get(): string | undefined {
    return asyncLocalStorage.getStore();
  }

  static clear(): void {
    asyncLocalStorage.enterWith(undefined);
  }
}

// ============================================
// Redaction
// ============================================
// FIX: nothing previously stopped a call site from doing
// logger.info("user updated", { email, phone, password }) and having it hit
// stdout in plaintext. Pino's `redact` masks these paths before the log line
// is ever serialized, regardless of what a call site passes in. Extend this
// list — don't rely on call-site discipline for secrets.
const REDACT_PATHS = [
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "secret",
  "apiKey",
  "creditCard",
  "cvv",
  "kraPin",
  "mpesaRecords",
  "tokenHash",
  "*.password",
  "*.token",
  "*.accessToken",
  "*.refreshToken",
  "*.authorization",
  "*.secret",
  "*.apiKey",
  "*.creditCard",
  "*.cvv",
  "*.kraPin",
  "*.mpesaRecords",
  "*.tokenHash",
  "nationalId",
  "clerkId",
  "email",
  "phone",
  "*.nationalId",
  "*.clerkId",
  "*.email",
  "*.phone",
];

const DEEP_REDACT_KEYS = new Set(
  [
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
    "mpesarecords",
    "tokenhash",
    "nationalid",
    "clerkid",
    "email",
    "phone",
  ].map((key) => key.toLowerCase()),
);

function deepRedact(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) {
    const output = value.map((item) => deepRedact(item, depth + 1, seen));
    seen.delete(value);
    return output;
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (DEEP_REDACT_KEYS.has(key.toLowerCase())) {
      output[key] = "[REDACTED]";
    } else {
      output[key] = deepRedact(item, depth + 1, seen);
    }
  }
  seen.delete(value);
  return output;
}

// ============================================
// Base Pino instance
// ============================================
let testDestination: { write: (msg: string) => void } | undefined;
let activeDatadogTarget: DatadogPinoTarget | undefined;

export function setTestDestination(
  destination: { write: (msg: string) => void } | undefined,
): void {
  testDestination = destination;
  reinitializeLogger();
}

function buildPinoInstance(): PinoLogger {
  const config = getConfig();

  const options: pino.LoggerOptions = {
    level: config.logging.enabled ? config.logging.level : "silent",
    base: { service: "build-market" },
    timestamp: config.logging.includeTimestamp
      ? pino.stdTimeFunctions.isoTime
      : false,
    redact: {
      paths: REDACT_PATHS,
      censor: "[REDACTED]",
    },
    formatters: {
      log: (object) => deepRedact(object) as Record<string, unknown>,
    },
    // Runs once per log call; injects correlation + trace context without
    // every call site having to remember to do it.
    mixin() {
      if (!config.logging.includeContext) return {};
      const correlationId = CorrelationIdManager.get();
      return {
        ...(correlationId ? { correlationId } : {}),
        ...getActiveTraceContext(),
      };
    },
  };

  // If a test destination is registered, write directly to it synchronously.
  if (testDestination) {
    return pino(options, testDestination);
  }

  if (config.logging.datadog.enabled) {
    activeDatadogTarget = createDatadogPinoTarget({
      enabled: true,
      apiKey: config.logging.datadog.apiKey,
      site: config.logging.datadog.site,
      service: config.logging.datadog.service,
      environment: config.logging.datadog.environment,
      version: config.logging.datadog.version,
    });

    const stdout =
      config.logging.format === "pretty"
        ? pino.transport({
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss.l",
              ignore: "pid,hostname,service",
            },
          })
        : pino.destination(1);

    return pino(
      options,
      pino.multistream([{ stream: stdout }, { stream: activeDatadogTarget }]),
    );
  }

  // Pretty output for local dev only. In prod we emit newline-delimited
  // JSON straight to stdout — no transform, no extra process — which is
  // both faster and what every log aggregator (Vercel, CloudWatch, an
  // OTel Collector) expects to ingest.
  if (config.logging.format === "pretty") {
    try {
      return pino({
        ...options,
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname,service",
          },
        },
      });
    } catch (err) {
      // Graceful fallback to standard JSON if pino-pretty is not installed or fails
      console.warn(
        "Resilience Logger: Failed to initialize pretty transport, falling back to standard JSON.",
        err,
      );
    }
  }

  return pino(options);
}

let basePinoLogger: PinoLogger = buildPinoInstance();
let basePinoLoggerVersion = 0;

/**
 * Rebuild the underlying Pino instance from the current config.
 * Call this after config.resetConfig()/setConfig() in tests, or any time
 * logging.* env vars change at runtime (e.g. a hot-reloaded dev server).
 */
export function reinitializeLogger(): void {
  const previousTarget = activeDatadogTarget;
  activeDatadogTarget = undefined;
  if (previousTarget) {
    void previousTarget.sink.close().then(() => previousTarget.end());
  }
  basePinoLogger = buildPinoInstance();
  basePinoLoggerVersion++;
}

export async function flushResilienceLogs(): Promise<void> {
  await activeDatadogTarget?.sink.flush();
}

export async function closeResilienceLogs(): Promise<void> {
  const target = activeDatadogTarget;
  activeDatadogTarget = undefined;
  if (!target) return;

  await target.sink.close();
  await new Promise<void>((resolve) => target.end(() => resolve()));
}

// ============================================
// StructuredLogger — thin adapter over Pino
// ============================================
// Keeps the existing Logger interface stable so call sites across the
// monorepo (HTTP handlers, BullMQ processors, NATS consumers) don't change.
export class StructuredLogger implements Logger {
  private readonly serviceName: string;
  private readonly boundContext?: LogContext;
  private cachedPinoInstance?: PinoLogger;
  private cachedVersion: number = -1;

  constructor(serviceName: string, boundContext?: LogContext) {
    this.serviceName = serviceName;
    this.boundContext = boundContext;
  }

  private get pinoInstance(): PinoLogger {
    if (
      !this.cachedPinoInstance ||
      this.cachedVersion !== basePinoLoggerVersion
    ) {
      const base = basePinoLogger.child({ serviceName: this.serviceName });
      this.cachedPinoInstance = this.boundContext
        ? base.child(this.boundContext)
        : base;
      this.cachedVersion = basePinoLoggerVersion;
    }
    return this.cachedPinoInstance;
  }

  debug(message: string, context?: LogContext): void {
    if (context) {
      this.pinoInstance.debug(context, message);
    } else {
      this.pinoInstance.debug(message);
    }
  }

  info(message: string, context?: LogContext): void {
    if (context) {
      this.pinoInstance.info(context, message);
    } else {
      this.pinoInstance.info(message);
    }
  }

  warn(message: string, context?: LogContext): void {
    if (context) {
      this.pinoInstance.warn(context, message);
    } else {
      this.pinoInstance.warn(message);
    }
  }

  error(message: string, error?: Error, context?: LogContext): void {
    // `err` is Pino's conventional key for its built-in error serializer,
    // which unwraps name/message/stack AND the `cause` chain (Node's
    // Error.cause) — the hand-rolled version only ever logged the top-level
    // error and silently dropped any wrapped cause.
    this.pinoInstance.error({ err: error, ...context }, message);
  }

  fatal(message: string, error?: Error, context?: LogContext): void {
    this.pinoInstance.fatal({ err: error, ...context }, message);
  }

  /**
   * Create a child logger with additional bound context. Every log call on
   * the child automatically carries this context, no need to repeat it.
   */
  child(context: LogContext): StructuredLogger {
    return new StructuredLogger(this.serviceName, {
      ...this.boundContext,
      ...context,
    });
  }
}

export function createLogger(serviceName: string): Logger {
  return new StructuredLogger(serviceName);
}

let globalLogger: Logger | undefined;

export function getGlobalLogger(): Logger {
  if (!globalLogger) {
    globalLogger = createLogger("build-market");
  }
  return globalLogger;
}

export function setGlobalLogger(logger: Logger): void {
  globalLogger = logger;
}
