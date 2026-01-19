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
export type * from './types';

// Timeout utilities
export {
  TimeoutError,
  DEFAULT_TIMEOUTS,
  withTimeout,
  getTimeout,
  withCriticalityTimeout,
} from './timeout';

// Retry utilities
export {
  RetryError,
  DEFAULT_RETRY_CONFIG,
  withRetry,
  createRetryWrapper,
} from './retry';

// Circuit breaker
export {
  CircuitBreakerOpenError,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  CircuitBreaker,
  CircuitBreakerRegistry,
} from './circuit-breaker';

// Caching
export {
  DEFAULT_CACHE_CONFIG,
  ResilientCache,
  CacheRegistry,
} from './cache';

// Fallback mechanisms
export {
  withFallback,
  createFallbackWrapper,
  withGracefulDegradation,
} from './fallback';

// Metrics and observability
export {
  MetricsCollector,
  getGlobalMetricsCollector,
  setGlobalMetricsCollector,
} from './metrics';

export type {
  Metric,
  MetricType,
} from './metrics';

// Logging
export {
  StructuredLogger,
  CorrelationIdManager,
  createLogger,
  getGlobalLogger,
  setGlobalLogger,
} from './logger';

// High-level executor
export {
  ResilientExecutor,
  getGlobalExecutor,
  setGlobalExecutor,
} from './executor';
