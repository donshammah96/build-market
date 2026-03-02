/**
 * Type-safe configuration for resilience patterns
 * Centralizes all environment variable access with proper types and defaults
 */

import {
  RetryConfig,
  CircuitBreakerConfig,
  CacheConfig,
  TimeoutConfig,
  LogLevel,
} from "./types";

// ============================================
// Environment Parsing Utilities
// ============================================

/**
 * Parse integer from environment with fallback
 */
function parseIntEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Parse float from environment with fallback
 */
function parseFloatEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Parse boolean from environment
 */
function parseBoolEnv(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

/**
 * Parse log level from environment
 */
function parseLogLevel(value: string | undefined): LogLevel {
  const levels: Record<string, LogLevel> = {
    debug: LogLevel.DEBUG,
    info: LogLevel.INFO,
    warn: LogLevel.WARN,
    error: LogLevel.ERROR,
    fatal: LogLevel.FATAL,
  };
  return levels[value?.toLowerCase() || ""] || LogLevel.INFO;
}

// ============================================
// Configuration Interfaces
// ============================================

export interface ResilienceEnvConfig {
  // Environment
  environment: string;
  isDev: boolean;
  isProd: boolean;
  isTest: boolean;

  // Logging
  logging: {
    level: LogLevel;
    format: "json" | "pretty";
    enabled: boolean;
    includeTimestamp: boolean;
    includeContext: boolean;
  };

  // Timeouts (in milliseconds)
  timeouts: TimeoutConfig;

  // Retry configuration
  retry: RetryConfig;

  // Circuit breaker configuration
  circuitBreaker: CircuitBreakerConfig;

  // Cache configuration
  cache: CacheConfig & {
    enabled: boolean;
    redisEnabled: boolean;
    redisNamespace: string;
  };

  // Metrics configuration
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

/**
 * Build type-safe configuration from environment variables
 */
export function getResilienceConfig(): ResilienceEnvConfig {
  const environment = process.env.NODE_ENV || "development";
  const isDev = environment === "development";
  const isProd = environment === "production";
  const isTest = environment === "test";

  return {
    // Environment
    environment,
    isDev,
    isProd,
    isTest,

    // Logging
    logging: {
      level: parseLogLevel(process.env.LOG_LEVEL),
      format: process.env.LOG_FORMAT === "json" || isProd ? "json" : "pretty",
      enabled: parseBoolEnv(process.env.LOG_ENABLED, true),
      includeTimestamp: parseBoolEnv(process.env.LOG_INCLUDE_TIMESTAMP, true),
      includeContext: parseBoolEnv(process.env.LOG_INCLUDE_CONTEXT, true),
    },

    // Timeouts
    timeouts: {
      critical: parseIntEnv(process.env.TIMEOUT_CRITICAL_MS, 5000),
      normal: parseIntEnv(process.env.TIMEOUT_NORMAL_MS, 15000),
      background: parseIntEnv(process.env.TIMEOUT_BACKGROUND_MS, 60000),
    },

    // Retry
    retry: {
      maxAttempts: parseIntEnv(process.env.RETRY_MAX_ATTEMPTS, isProd ? 5 : 3),
      initialDelayMs: parseIntEnv(process.env.RETRY_INITIAL_DELAY_MS, 100),
      maxDelayMs: parseIntEnv(process.env.RETRY_MAX_DELAY_MS, 10000),
      backoffMultiplier: parseFloatEnv(
        process.env.RETRY_BACKOFF_MULTIPLIER,
        2.0,
      ),
      jitterFactor: parseFloatEnv(process.env.RETRY_JITTER_FACTOR, 0.1),
      retryableErrors: process.env.RETRY_RETRYABLE_ERRORS?.split(",") || [
        "ECONNREFUSED",
        "ETIMEDOUT",
        "ENOTFOUND",
        "NetworkError",
        "TimeoutError",
      ],
    },

    // Circuit Breaker
    circuitBreaker: {
      failureThreshold: parseIntEnv(
        process.env.CIRCUIT_FAILURE_THRESHOLD,
        isProd ? 10 : 5,
      ),
      successThreshold: parseIntEnv(process.env.CIRCUIT_SUCCESS_THRESHOLD, 2),
      timeout: parseIntEnv(
        process.env.CIRCUIT_TIMEOUT_MS,
        isProd ? 60000 : 30000,
      ),
      monitoringPeriod: parseIntEnv(
        process.env.CIRCUIT_MONITORING_PERIOD_MS,
        10000,
      ),
    },

    // Cache
    cache: {
      ttl: parseIntEnv(process.env.CACHE_TTL_MS, 300000), // 5 minutes
      maxSize: parseIntEnv(process.env.CACHE_MAX_SIZE, 1000),
      staleWhileRevalidate: parseIntEnv(
        process.env.CACHE_STALE_WHILE_REVALIDATE_MS,
        60000,
      ),
      enabled: parseBoolEnv(process.env.CACHE_ENABLED, true),
      redisEnabled: parseBoolEnv(process.env.CACHE_REDIS_ENABLED, false),
      redisNamespace: process.env.CACHE_REDIS_NAMESPACE || "resilience",
      redis: {
        enabled: parseBoolEnv(process.env.CACHE_REDIS_ENABLED, false),
        namespace: process.env.CACHE_REDIS_NAMESPACE || "resilience",
        ttlSeconds: parseIntEnv(process.env.CACHE_REDIS_TTL_SECONDS, 300),
      },
    },

    // Metrics
    metrics: {
      enabled: parseBoolEnv(process.env.METRICS_ENABLED, true),
      prefix: process.env.METRICS_PREFIX || "resilience",
      flushIntervalMs: parseIntEnv(
        process.env.METRICS_FLUSH_INTERVAL_MS,
        10000,
      ),
      histogramBuckets: process.env.METRICS_HISTOGRAM_BUCKETS?.split(",").map(
        Number,
      ) || [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    },
  };
}

// ============================================
// Cached Configuration Singleton
// ============================================

let cachedConfig: ResilienceEnvConfig | null = null;

/**
 * Get cached configuration (creates on first call)
 */
export function getConfig(): ResilienceEnvConfig {
  if (!cachedConfig) {
    cachedConfig = getResilienceConfig();
  }
  return cachedConfig;
}

/**
 * Reset cached configuration (useful for testing)
 */
export function resetConfig(): void {
  cachedConfig = null;
}

/**
 * Override configuration (useful for testing)
 */
export function setConfig(config: Partial<ResilienceEnvConfig>): void {
  cachedConfig = { ...getResilienceConfig(), ...config };
}

// ============================================
// Default Configurations (using env config)
// ============================================

/**
 * Get environment-aware default timeout configuration
 */
export function getDefaultTimeouts(): TimeoutConfig {
  return getConfig().timeouts;
}

/**
 * Get environment-aware default retry configuration
 */
export function getDefaultRetryConfig(): RetryConfig {
  return getConfig().retry;
}

/**
 * Get environment-aware default circuit breaker configuration
 */
export function getDefaultCircuitBreakerConfig(): CircuitBreakerConfig {
  return getConfig().circuitBreaker;
}

/**
 * Get environment-aware default cache configuration
 */
export function getDefaultCacheConfig(): CacheConfig {
  return getConfig().cache;
}
