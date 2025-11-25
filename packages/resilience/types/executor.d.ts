/**
 * High-level resilience orchestrator
 * Combines timeout, retry, circuit breaker, cache, and fallback patterns
 */
import { ResilienceOptions, OperationResult, OperationCriticality } from './types';
import { StructuredLogger } from './logger';
/**
 * Resilient operation executor
 */
export declare class ResilientExecutor {
    private readonly circuitBreakers;
    private readonly caches;
    private readonly metrics;
    private readonly logger;
    constructor(serviceName?: string);
    /**
     * Execute an operation with full resilience patterns
     */
    execute<T>(operation: () => Promise<T>, options?: ResilienceOptions): Promise<OperationResult<T>>;
    /**
     * Execute with criticality-based configuration
     */
    executeWithCriticality<T>(operation: () => Promise<T>, criticality: OperationCriticality, operationName?: string): Promise<OperationResult<T>>;
    /**
     * Get circuit breaker states for monitoring
     */
    getCircuitBreakerStates(): Map<string, import("./types").CircuitBreakerState>;
    /**
     * Get cache statistics for monitoring
     */
    getCacheStats(): Map<string, {
        size: number;
        maxSize: number;
        hitRate?: number;
    }>;
    /**
     * Get all metrics
     */
    getMetrics(): import("./metrics").Metric[];
    /**
     * Get histogram stats for an operation
     */
    getOperationStats(operationName: string): {
        summary: import("./metrics").SummaryData | undefined;
        histogram: import("./metrics").HistogramData | undefined;
    };
    /**
     * Reset all circuit breakers
     */
    resetCircuitBreakers(): void;
    /**
     * Clear all caches
     */
    clearCaches(): Promise<void>;
    /**
     * Get logger instance
     */
    getLogger(): StructuredLogger;
}
export declare function getGlobalExecutor(serviceName?: string): ResilientExecutor;
export declare function setGlobalExecutor(executor: ResilientExecutor): void;
//# sourceMappingURL=executor.d.ts.map