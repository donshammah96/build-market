/**
 * Resilience utilities for distributed systems
 *
 * Provides comprehensive resilience patterns:
 * - Timeouts: Criticality-based timeout strategies
 * - Retries: Intelligent retry with exponential backoff and jitter
 * - Circuit Breakers: Protect struggling services from cascading failures
 * - Caching: Multi-layer aggressive caching with stale-while-revalidate
 * - Fallbacks: Graceful degradation when services fail
 * - Metrics: Comprehensive observability for all operations
 * - Logging: Structured logging with correlation IDs
 */

// Core types
export * from "./types.js";

// Timeout utilities
export {
  TimeoutError,
  DEFAULT_TIMEOUTS,
  withTimeout,
  getTimeout,
  withCriticalityTimeout,
} from "./timeout.js";

// Retry utilities
export {
  RetryError,
  DEFAULT_RETRY_CONFIG,
  withRetry,
  createRetryWrapper,
} from "./retry.js";

// Circuit breaker
export {
  CircuitBreakerOpenError,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  CircuitBreaker,
  CircuitBreakerRegistry,
} from "./circuit-breaker.js";

// Caching
export {
  DEFAULT_CACHE_CONFIG,
  ResilientCache,
  CacheRegistry,
} from "./cache.js";

// Fallback mechanisms
export {
  withFallback,
  createFallbackWrapper,
  withGracefulDegradation,
} from "./fallback.js";

// Metrics and observability
export {
  MetricsCollector,
  getGlobalMetricsCollector,
  setGlobalMetricsCollector,
} from "./metrics.js";

export type { Metric, MetricType } from "./metrics.js";

// Logging
export {
  StructuredLogger,
  CorrelationIdManager,
  createLogger,
  getGlobalLogger,
  setGlobalLogger,
  flushResilienceLogs,
  closeResilienceLogs,
} from "./logger.js";

export {
  DatadogBatchSink,
  DATADOG_DEFAULT_MAX_QUEUE_RECORDS,
  DATADOG_DEFAULT_MAX_BATCH_RECORDS,
  DATADOG_DEFAULT_MAX_BATCH_BYTES,
  DATADOG_DEFAULT_MAX_RETRIES,
  DATADOG_DEFAULT_RETRY_BASE_DELAY_MS,
  type DatadogBatchSinkOptions,
} from "./datadog-transport.js";
export {
  createDatadogPinoTarget,
  type DatadogPinoTarget,
} from "./datadog-pino-target.js";

// Configuration
export {
  getConfig,
  getResilienceConfig,
  resetConfig,
  setConfig,
  getDefaultTimeouts,
  getDefaultRetryConfig,
  getDefaultCircuitBreakerConfig,
  getDefaultCacheConfig,
} from "./config.js";

export type { ResilienceEnvConfig } from "./config.js";

// High-level executor
export {
  ResilientExecutor,
  getGlobalExecutor,
  setGlobalExecutor,
} from "./executor.js";
