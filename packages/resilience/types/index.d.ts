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
export * from './types';
export { TimeoutError, DEFAULT_TIMEOUTS, withTimeout, getTimeout, withCriticalityTimeout, } from './timeout';
export { RetryError, DEFAULT_RETRY_CONFIG, withRetry, createRetryWrapper, } from './retry';
export { CircuitBreakerOpenError, DEFAULT_CIRCUIT_BREAKER_CONFIG, CircuitBreaker, CircuitBreakerRegistry, } from './circuit-breaker';
export { DEFAULT_CACHE_CONFIG, ResilientCache, CacheRegistry, } from './cache';
export { withFallback, createFallbackWrapper, withGracefulDegradation, } from './fallback';
export { MetricsCollector, getGlobalMetricsCollector, setGlobalMetricsCollector, } from './metrics';
export { StructuredLogger, CorrelationIdManager, createLogger, getGlobalLogger, setGlobalLogger, } from './logger';
export { ResilientExecutor, getGlobalExecutor, setGlobalExecutor, } from './executor';
//# sourceMappingURL=index.d.ts.map