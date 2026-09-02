/**
 * High-level resilience orchestrator
 * Combines timeout, retry, circuit breaker, cache, and fallback patterns
 */

import {
  ResilienceOptions,
  OperationResult,
  OperationCriticality,
  ResilienceOutcome,
} from "./types.js";
import { TimeoutError, withTimeout, DEFAULT_TIMEOUTS } from "./timeout.js";
import { withRetry } from "./retry.js";
import {
  CircuitBreakerRegistry,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  CircuitBreakerOpenError,
} from "./circuit-breaker.js";
import {
  CacheRegistry,
  DEFAULT_CACHE_CONFIG,
  ResilientCache,
} from "./cache.js";
import { withFallback } from "./fallback.js";
import { MetricsCollector } from "./metrics.js";
import { StructuredLogger } from "./logger.js";

/**
 * Resilient operation executor
 */
export class ResilientExecutor {
  private readonly circuitBreakers: CircuitBreakerRegistry;
  private readonly caches: CacheRegistry;
  private readonly metrics: MetricsCollector;
  private readonly logger: StructuredLogger;

  constructor(serviceName: string = "resilient-service") {
    this.logger = new StructuredLogger(serviceName);
    this.circuitBreakers = new CircuitBreakerRegistry(
      DEFAULT_CIRCUIT_BREAKER_CONFIG,
      this.logger,
    );
    this.caches = new CacheRegistry(DEFAULT_CACHE_CONFIG, this.logger);
    this.metrics = new MetricsCollector(this.logger);
  }

  /**
   * Execute an operation with full resilience patterns
   */
  async execute<T>(
    operation: () => Promise<T>,
    options: ResilienceOptions<T> = {},
  ): Promise<OperationResult<T>> {
    const startTime = Date.now();
    const operationName = options.operationName || "unnamed-operation";
    let attempts = 0;
    let fromCache = false;
    let fromFallback = false;
    let outcome: ResilienceOutcome = "success";
    let cache: ResilientCache<T> | undefined;
    let cacheKey: string | undefined;

    try {
      // Check cache first if enabled
      if (options.cache) {
        const cacheConfig =
          typeof options.cache === "object" ? options.cache : {};
        if (!options.cacheKey?.trim()) {
          throw new Error(
            `Cache-enabled operation '${operationName}' requires an explicit cacheKey`,
          );
        }
        cacheKey = options.cacheKey;
        cache = this.caches.getCache<T>(operationName, cacheConfig);
      }

      // Build the operation pipeline
      let resilientOperation = operation;

      // 1. Apply timeout
      if (options.timeout !== undefined) {
        const timeoutMs =
          typeof options.timeout === "string"
            ? DEFAULT_TIMEOUTS[options.timeout as OperationCriticality]
            : options.timeout;

        resilientOperation = async () =>
          withTimeout(operation, timeoutMs, operationName);
      }

      // 2. Apply circuit breaker
      if (options.circuitBreaker) {
        const cbConfig =
          typeof options.circuitBreaker === "object"
            ? options.circuitBreaker
            : {};

        const originalOp = resilientOperation;
        resilientOperation = async () =>
          this.circuitBreakers.execute(operationName, originalOp, cbConfig);
      }

      // 3. Apply retry logic
      if (options.retry) {
        const retryConfig =
          typeof options.retry === "object" ? options.retry : {};
        const originalOp = resilientOperation;

        resilientOperation = async () => {
          const result = await withRetry(
            originalOp,
            retryConfig,
            operationName,
            this.logger,
          );
          attempts = result.attempts;
          return result.result;
        };
      }

      // 4. Execute with fallback if provided
      let result: T;
      const compute = async () => resilientOperation();

      try {
        if (cache && cacheKey) {
          const cachedResult = await cache.getOrCompute(
            cacheKey,
            compute,
            typeof options.cache === "object" ? options.cache.ttl : undefined,
          );
          result = cachedResult.value;
          fromCache = cachedResult.fromCache;
          if (fromCache) {
            outcome = "cache_hit";
            this.metrics.incrementCounter(`${operationName}.cache.hit`);
          } else {
            this.metrics.incrementCounter(`${operationName}.cache.miss`);
          }
        } else {
          result = await compute();
        }
      } catch (error) {
        if (!options.fallback) throw error;
        const originalError =
          error instanceof Error ? error : new Error(String(error));
        const fallbackResult = await withFallback<T>(
          async () => {
            throw originalError;
          },
          {
            fallbackFn: options.fallback,
            logger: this.logger,
          },
        );
        result = fallbackResult.value;
        fromFallback = fallbackResult.usedFallback;
        outcome = "fallback";
      }

      const duration = Date.now() - startTime;

      // Record metrics
      if (options.metrics !== false) {
        this.metrics.incrementCounter(`${operationName}.success`);
        this.metrics.recordHistogram(`${operationName}.duration`, duration);
        if (fromFallback) {
          this.metrics.incrementCounter(`${operationName}.fallback`);
        }
      }

      return {
        success: true,
        data: result,
        fromCache,
        fromFallback,
        outcome,
        attempts: fromCache ? 0 : attempts || 1,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));
      outcome =
        err instanceof TimeoutError
          ? "timeout"
          : err instanceof CircuitBreakerOpenError
            ? "circuit_open"
            : "error";

      // Record failure metrics
      if (options.metrics !== false) {
        this.metrics.incrementCounter(`${operationName}.error`);
        this.metrics.recordHistogram(`${operationName}.duration`, duration);
      }

      this.logger.error(`Operation failed: ${operationName}`, err, {
        operationName,
        outcome,
        attempts: outcome === "circuit_open" ? 0 : attempts || 1,
        duration,
      });

      return {
        success: false,
        error: err,
        outcome,
        attempts: outcome === "circuit_open" ? 0 : attempts || 1,
        duration,
      };
    }
  }

  /**
   * Execute with criticality-based configuration
   */
  async executeWithCriticality<T>(
    operation: () => Promise<T>,
    criticality: OperationCriticality,
    operationName?: string,
  ): Promise<OperationResult<T>> {
    const options: ResilienceOptions<T> = {
      timeout: criticality,
      operationName,
    };

    // Configure based on criticality
    switch (criticality) {
      case "critical":
        // Critical operations: no retry, fast fail, no cache
        options.retry = false;
        options.cache = false;
        options.circuitBreaker = {
          failureThreshold: 3,
          timeout: 30000, // 30s
        };
        break;

      case "normal":
        // Normal operations: retry, cache, standard circuit breaker
        options.retry = { maxAttempts: 3 };
        options.cache = { ttl: 60000, staleWhileRevalidate: 30000 };
        options.circuitBreaker = true;
        break;

      case "background":
        // Background operations: aggressive retry, long cache, lenient circuit breaker
        options.retry = { maxAttempts: 5, maxDelayMs: 30000 };
        options.cache = { ttl: 300000, staleWhileRevalidate: 60000 }; // 5min cache
        options.circuitBreaker = {
          failureThreshold: 10,
          timeout: 120000, // 2min
        };
        break;
    }

    return this.execute(operation, options);
  }

  /**
   * Get circuit breaker states for monitoring
   */
  getCircuitBreakerStates() {
    return this.circuitBreakers.getAllStates();
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return this.caches.getAllStats();
  }

  /**
   * Get all metrics
   */
  getMetrics() {
    return this.metrics.getMetrics();
  }

  /**
   * Get histogram stats for an operation
   */
  getOperationStats(operationName: string) {
    return {
      summary: this.metrics.getSummaryStats(`${operationName}.duration`),
      histogram: this.metrics.getHistogramStats(`${operationName}.duration`),
    };
  }

  /**
   * Reset all circuit breakers
   */
  resetCircuitBreakers(): void {
    this.circuitBreakers.resetAll();
  }

  /**
   * Clear all caches
   */
  async clearCaches(): Promise<void> {
    await this.caches.clearAll();
  }

  /**
   * Get logger instance
   */
  getLogger(): StructuredLogger {
    return this.logger;
  }
}

/**
 * Create a global resilient executor instance
 */
let globalExecutor: ResilientExecutor | undefined;

export function getGlobalExecutor(serviceName?: string): ResilientExecutor {
  if (!globalExecutor) {
    globalExecutor = new ResilientExecutor(serviceName);
  }
  return globalExecutor;
}

export function setGlobalExecutor(executor: ResilientExecutor): void {
  globalExecutor = executor;
}
