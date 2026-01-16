/**
 * Core types for resilience patterns
 */

export type OperationCriticality = "critical" | "normal" | "background";

export interface TimeoutConfig {
  critical: number;
  normal: number;
  background: number;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
  retryableErrors?: string[];
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  monitoringPeriod: number;
}

export interface CacheConfig {
  ttl: number;
  maxSize: number;
  staleWhileRevalidate?: number;
  redis?: {
    namespace?: string; // Defaults to cache name
    ttlSeconds?: number; // defaults to ttl (converted from ms to seconds)
    enabled?: boolean; // default false
  };
}

export interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: number;
}

export interface LogContext {
  correlationId?: string;
  userId?: string;
  operationName?: string;
  serviceName?: string;
  [key: string]: any;
}

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  FATAL = "fatal",
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  fatal(message: string, error?: Error, context?: LogContext): void;
}

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
}

export interface ResilienceOptions {
  timeout?: number | OperationCriticality;
  retry?: Partial<RetryConfig> | boolean;
  circuitBreaker?: Partial<CircuitBreakerConfig> | boolean;
  cache?: Partial<CacheConfig> | boolean;
  fallback?: () => Promise<any>;
  metrics?: boolean;
  operationName?: string;
}

export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  fromCache?: boolean;
  fromFallback?: boolean;
  attempts?: number;
  duration?: number;
}
