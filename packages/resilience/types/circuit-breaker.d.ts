/**
 * Circuit Breaker pattern to protect struggling services from cascading failures
 */
import { CircuitBreakerConfig, CircuitBreakerState } from "./types";
import { Logger } from "./logger";
export declare class CircuitBreakerOpenError extends Error {
  readonly circuitName: string;
  readonly nextAttemptTime: number;
  constructor(circuitName: string, nextAttemptTime: number);
}
export declare const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig;
/**
 * Circuit Breaker implementation
 */
export declare class CircuitBreaker {
  private readonly name;
  private state;
  private failures;
  private readonly config;
  private readonly logger?;
  constructor(
    name: string,
    config?: Partial<CircuitBreakerConfig>,
    logger?: Logger,
  );
  /**
   * Execute an operation with circuit breaker protection
   */
  execute<T>(operation: () => Promise<T>): Promise<T>;
  /**
   * Record a successful operation
   */
  private recordSuccess;
  /**
   * Record a failed operation
   */
  private recordFailure;
  /**
   * Clear failures outside the monitoring period
   */
  private clearOldFailures;
  /**
   * Transition to open state
   */
  private transitionToOpen;
  /**
   * Transition to half-open state
   */
  private transitionToHalfOpen;
  /**
   * Transition to closed state
   */
  private transitionToClosed;
  /**
   * Get current state
   */
  getState(): CircuitBreakerState;
  /**
   * Manually reset the circuit breaker
   */
  reset(): void;
}
/**
 * Circuit Breaker Registry for managing multiple circuit breakers
 */
export declare class CircuitBreakerRegistry {
  private breakers;
  private readonly defaultConfig;
  private readonly logger?;
  constructor(defaultConfig?: Partial<CircuitBreakerConfig>, logger?: Logger);
  /**
   * Get or create a circuit breaker
   */
  getBreaker(
    name: string,
    config?: Partial<CircuitBreakerConfig>,
  ): CircuitBreaker;
  /**
   * Execute operation with circuit breaker
   */
  execute<T>(
    name: string,
    operation: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>,
  ): Promise<T>;
  /**
   * Get all circuit breaker states
   */
  getAllStates(): Map<string, CircuitBreakerState>;
  /**
   * Reset a specific circuit breaker
   */
  reset(name: string): void;
  /**
   * Reset all circuit breakers
   */
  resetAll(): void;
}
//# sourceMappingURL=circuit-breaker.d.ts.map
