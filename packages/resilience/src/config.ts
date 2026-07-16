/**
 * Type-safe configuration for resilience patterns
 * Centralizes all environment variable access with proper types and defaults
 *
 * FIX (staff audit, 2026-07): Replaced hand-rolled parseIntEnv/parseFloatEnv
 * with a zod schema. Previously, a malformed env var (e.g. RETRY_MAX_ATTEMPTS="five")
 * silently fell back to the default with no signal — a misconfigured prod
 * deployment could run for weeks with the wrong retry/timeout values and no
 * one would know. Now: invalid values throw at boot with a clear message
 * naming the offending variable. Fail fast, don't fail silently.
 */

import { z } from "zod";
import {
  RetryConfig,
  CircuitBreakerConfig,
  CacheConfig,
  TimeoutConfig,
  LogLevel,
} from "./types.js";

// ============================================
// Environment Schema
// ============================================

const boolString = z.enum(["true", "false", "1", "0"]);
const toBool = (
  v: z.infer<typeof boolString> | undefined,
  fallback: boolean,
) => (v === undefined ? fallback : v === "true" || v === "1");

// z.coerce.number() runs Number(value) then validates it isn't NaN — so
// "abc" now fails validation instead of silently becoming the fallback.
const numberString = () => z.coerce.number().finite();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "fatal"]).optional(),
  LOG_FORMAT: z.enum(["json", "pretty"]).optional(),
  LOG_ENABLED: boolString.optional(),
  LOG_INCLUDE_TIMESTAMP: boolString.optional(),
  LOG_INCLUDE_CONTEXT: boolString.optional(),

  TIMEOUT_CRITICAL_MS: numberString().optional(),
  TIMEOUT_NORMAL_MS: numberString().optional(),
  TIMEOUT_BACKGROUND_MS: numberString().optional(),

  RETRY_MAX_ATTEMPTS: numberString().optional(),
  RETRY_INITIAL_DELAY_MS: numberString().optional(),
  RETRY_MAX_DELAY_MS: numberString().optional(),
  RETRY_BACKOFF_MULTIPLIER: numberString().optional(),
  RETRY_JITTER_FACTOR: numberString().optional(),
  RETRY_RETRYABLE_ERRORS: z.string().optional(),

  CIRCUIT_FAILURE_THRESHOLD: numberString().optional(),
  CIRCUIT_SUCCESS_THRESHOLD: numberString().optional(),
  CIRCUIT_TIMEOUT_MS: numberString().optional(),
  CIRCUIT_MONITORING_PERIOD_MS: numberString().optional(),

  CACHE_TTL_MS: numberString().optional(),
  CACHE_MAX_SIZE: numberString().optional(),
  CACHE_STALE_WHILE_REVALIDATE_MS: numberString().optional(),
  CACHE_ENABLED: boolString.optional(),
  REDIS_ENABLED: boolString.optional(),
  REDIS_NAMESPACE: z.string().optional(),
  REDIS_TTL_SECONDS: numberString().optional(),

  METRICS_ENABLED: boolString.optional(),
  METRICS_PREFIX: z.string().optional(),
  METRICS_FLUSH_INTERVAL_MS: numberString().optional(),
  METRICS_HISTOGRAM_BUCKETS: z.string().optional(),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    // Thrown synchronously at import time -> process won't boot with bad config.
    throw new Error(
      `Invalid environment configuration for resilience module:\n${issues}`,
    );
  }
  return result.data;
}

// ============================================
// Configuration Interfaces
// ============================================

export interface ResilienceEnvConfig {
  environment: string;
  isDev: boolean;
  isProd: boolean;
  isTest: boolean;

  logging: {
    level: LogLevel;
    format: "json" | "pretty";
    enabled: boolean;
    includeTimestamp: boolean;
    includeContext: boolean;
  };

  timeouts: TimeoutConfig;
  retry: RetryConfig;
  circuitBreaker: CircuitBreakerConfig;

  // NOTE: `redis` is now the single source of truth (see FIX below).
  // The flat `redisEnabled`/`redisNamespace` fields are kept only so existing
  // call sites reading `config.cache.redisEnabled` don't break; they are
  // derived from `redis`, never parsed independently.
  cache: CacheConfig & {
    enabled: boolean;
    redisEnabled: boolean;
    redisNamespace: string;
  };

  metrics: {
    enabled: boolean;
    prefix: string;
    flushIntervalMs: number;
    histogramBuckets: number[];
  };
}

// ============================================
// Configuration Builder
// ============================================

const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
  fatal: LogLevel.FATAL,
};

/**
 * Build type-safe configuration from environment variables
 */
export function getResilienceConfig(): ResilienceEnvConfig {
  const env = parseEnv();

  const environment = env.NODE_ENV;
  const isDev = environment === "development";
  const isProd = environment === "production";
  const isTest = environment === "test";

  // FIX: histogramBuckets previously used `.map(Number)` with no NaN check —
  // a malformed value like "10,50,oops,500" would silently inject NaN into
  // the bucket list and corrupt every histogram metric downstream.
  let histogramBuckets = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
  if (env.METRICS_HISTOGRAM_BUCKETS) {
    const parsed = env.METRICS_HISTOGRAM_BUCKETS.split(",").map(Number);
    if (parsed.some((n) => Number.isNaN(n))) {
      throw new Error(
        `Invalid METRICS_HISTOGRAM_BUCKETS: "${env.METRICS_HISTOGRAM_BUCKETS}" contains a non-numeric value`,
      );
    }
    histogramBuckets = parsed;
  }

  // FIX (de-duplication): redis config used to be parsed twice — once as
  // flat cache.redisEnabled/redisNamespace, once as cache.redis.{enabled,
  // namespace} — reading two different env vars for supposedly the same
  // setting could silently drift. Parse once, derive the rest.
  const redis = {
    enabled: toBool(env.REDIS_ENABLED, false),
    namespace: env.REDIS_NAMESPACE || "resilience",
    ttlSeconds: env.REDIS_TTL_SECONDS ?? 300,
  };

  return {
    environment,
    isDev,
    isProd,
    isTest,

    logging: {
      level: LOG_LEVEL_MAP[env.LOG_LEVEL ?? "info"] ?? LogLevel.INFO,
      format:
        env.LOG_FORMAT === "json" || (!env.LOG_FORMAT && isProd)
          ? "json"
          : "pretty",
      enabled: toBool(env.LOG_ENABLED, true),
      includeTimestamp: toBool(env.LOG_INCLUDE_TIMESTAMP, true),
      includeContext: toBool(env.LOG_INCLUDE_CONTEXT, true),
    },

    timeouts: {
      critical: env.TIMEOUT_CRITICAL_MS ?? 5000,
      normal: env.TIMEOUT_NORMAL_MS ?? 15000,
      background: env.TIMEOUT_BACKGROUND_MS ?? 60000,
    },

    retry: {
      maxAttempts: env.RETRY_MAX_ATTEMPTS ?? (isProd ? 5 : 3),
      initialDelayMs: env.RETRY_INITIAL_DELAY_MS ?? 100,
      maxDelayMs: env.RETRY_MAX_DELAY_MS ?? 10000,
      backoffMultiplier: env.RETRY_BACKOFF_MULTIPLIER ?? 2.0,
      jitterFactor: env.RETRY_JITTER_FACTOR ?? 0.1,
      retryableErrors: env.RETRY_RETRYABLE_ERRORS?.split(",") || [
        "ECONNREFUSED",
        "ETIMEDOUT",
        "ENOTFOUND",
        "NetworkError",
        "TimeoutError",
      ],
    },

    circuitBreaker: {
      failureThreshold: env.CIRCUIT_FAILURE_THRESHOLD ?? (isProd ? 10 : 5),
      successThreshold: env.CIRCUIT_SUCCESS_THRESHOLD ?? 2,
      timeout: env.CIRCUIT_TIMEOUT_MS ?? (isProd ? 60000 : 30000),
      monitoringPeriod: env.CIRCUIT_MONITORING_PERIOD_MS ?? 10000,
    },

    cache: {
      ttl: env.CACHE_TTL_MS ?? 300000,
      maxSize: env.CACHE_MAX_SIZE ?? 1000,
      staleWhileRevalidate: env.CACHE_STALE_WHILE_REVALIDATE_MS ?? 60000,
      enabled: toBool(env.CACHE_ENABLED, true),
      redisEnabled: redis.enabled,
      redisNamespace: redis.namespace,
      redis,
    },

    metrics: {
      enabled: toBool(env.METRICS_ENABLED, true),
      prefix: env.METRICS_PREFIX || "resilience",
      flushIntervalMs: env.METRICS_FLUSH_INTERVAL_MS ?? 10000,
      histogramBuckets,
    },
  };
}

// ============================================
// Cached Configuration Singleton
// ============================================

let cachedConfig: ResilienceEnvConfig | null = null;

export function getConfig(): ResilienceEnvConfig {
  if (!cachedConfig) {
    cachedConfig = getResilienceConfig();
  }
  return cachedConfig;
}

export function resetConfig(): void {
  cachedConfig = null;
}

export function setConfig(config: Partial<ResilienceEnvConfig>): void {
  cachedConfig = { ...getResilienceConfig(), ...config };
}

// ============================================
// Default Configurations (using env config)
// ============================================

export function getDefaultTimeouts(): TimeoutConfig {
  return getConfig().timeouts;
}

export function getDefaultRetryConfig(): RetryConfig {
  return getConfig().retry;
}

export function getDefaultCircuitBreakerConfig(): CircuitBreakerConfig {
  return getConfig().circuitBreaker;
}

export function getDefaultCacheConfig(): CacheConfig {
  return getConfig().cache;
}
