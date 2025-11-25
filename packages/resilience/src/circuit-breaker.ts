/**
 * Circuit Breaker pattern to protect struggling services from cascading failures
 */

import { CircuitBreakerConfig, CircuitState, CircuitBreakerState } from './types';
import { Logger } from './logger';

export class CircuitBreakerOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly nextAttemptTime: number
  ) {
    super(`Circuit breaker '${circuitName}' is open. Next attempt at ${new Date(nextAttemptTime).toISOString()}`);
    this.name = 'CircuitBreakerOpenError';
  }
}

// Default circuit breaker configuration
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,        // Open after 5 failures
  successThreshold: 2,        // Close after 2 successes in half-open
  timeout: 60000,            // 60s before attempting half-open
  monitoringPeriod: 10000,   // 10s window for failure counting
};

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = {
    state: 'closed',
    failureCount: 0,
    successCount: 0,
  };
  
  private failures: number[] = []; // Timestamps of failures
  private readonly config: CircuitBreakerConfig;
  private readonly logger?: Logger;

  constructor(
    private readonly name: string,
    config: Partial<CircuitBreakerConfig> = {},
    logger?: Logger
  ) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this.logger = logger;
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state.state === 'open') {
      const now = Date.now();
      
      // Check if timeout has elapsed
      if (this.state.nextAttemptTime && now >= this.state.nextAttemptTime) {
        this.transitionToHalfOpen();
      } else {
        throw new CircuitBreakerOpenError(this.name, this.state.nextAttemptTime!);
      }
    }

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record a successful operation
   */
  private recordSuccess(): void {
    if (this.state.state === 'half-open') {
      this.state.successCount++;
      
      if (this.state.successCount >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    } else if (this.state.state === 'closed') {
      // Clear old failures on success
      this.clearOldFailures();
    }
  }

  /**
   * Record a failed operation
   */
  private recordFailure(): void {
    const now = Date.now();
    this.failures.push(now);
    this.clearOldFailures();
    
    if (this.state.state === 'half-open') {
      // Any failure in half-open state reopens the circuit
      this.transitionToOpen();
    } else if (this.state.state === 'closed') {
      this.state.failureCount = this.failures.length;
      
      if (this.state.failureCount >= this.config.failureThreshold) {
        this.transitionToOpen();
      }
    }
  }

  /**
   * Clear failures outside the monitoring period
   */
  private clearOldFailures(): void {
    const now = Date.now();
    const cutoff = now - this.config.monitoringPeriod;
    this.failures = this.failures.filter((timestamp) => timestamp > cutoff);
  }

  /**
   * Transition to open state
   */
  private transitionToOpen(): void {
    const now = Date.now();
    this.state = {
      state: 'open',
      failureCount: this.failures.length,
      successCount: 0,
      lastFailureTime: now,
      nextAttemptTime: now + this.config.timeout,
    };

    this.logger?.warn(
      `Circuit breaker '${this.name}' opened after ${this.state.failureCount} failures`,
      {
        circuitName: this.name,
        failureCount: this.state.failureCount,
        nextAttemptTime: this.state.nextAttemptTime ? new Date(this.state.nextAttemptTime).toISOString() : undefined,
      }
    );
  }

  /**
   * Transition to half-open state
   */
  private transitionToHalfOpen(): void {
    this.state = {
      state: 'half-open',
      failureCount: 0,
      successCount: 0,
    };

    this.logger?.info(`Circuit breaker '${this.name}' transitioned to half-open`, {
      circuitName: this.name,
    });
  }

  /**
   * Transition to closed state
   */
  private transitionToClosed(): void {
    this.state = {
      state: 'closed',
      failureCount: 0,
      successCount: 0,
    };
    this.failures = [];

    this.logger?.info(`Circuit breaker '${this.name}' closed after successful recovery`, {
      circuitName: this.name,
    });
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = {
      state: 'closed',
      failureCount: 0,
      successCount: 0,
    };
    this.failures = [];
    
    this.logger?.info(`Circuit breaker '${this.name}' manually reset`, {
      circuitName: this.name,
    });
  }
}

/**
 * Circuit Breaker Registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();
  private readonly defaultConfig: CircuitBreakerConfig;
  private readonly logger?: Logger;

  constructor(
    defaultConfig: Partial<CircuitBreakerConfig> = {},
    logger?: Logger
  ) {
    this.defaultConfig = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...defaultConfig };
    this.logger = logger;
  }

  /**
   * Get or create a circuit breaker
   */
  getBreaker(
    name: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const breakerConfig = { ...this.defaultConfig, ...config };
      this.breakers.set(name, new CircuitBreaker(name, breakerConfig, this.logger));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Execute operation with circuit breaker
   */
  async execute<T>(
    name: string,
    operation: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const breaker = this.getBreaker(name, config);
    return breaker.execute(operation);
  }

  /**
   * Get all circuit breaker states
   */
  getAllStates(): Map<string, CircuitBreakerState> {
    const states = new Map<string, CircuitBreakerState>();
    this.breakers.forEach((breaker, name) => {
      states.set(name, breaker.getState());
    });
    return states;
  }

  /**
   * Reset a specific circuit breaker
   */
  reset(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach((breaker) => breaker.reset());
  }
}
