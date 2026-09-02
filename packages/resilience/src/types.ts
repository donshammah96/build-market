/**
 * Core types for resilience patterns
 */

export type OperationCriticality = "critical" | "normal" | "background";

export type ResilienceOutcome =
  | "success"
  | "cache_hit"
  | "fallback"
  | "timeout"
  | "circuit_open"
  | "error";

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
  // ADR-005 / ADR-006: userId is Class B PII and is prohibited from log payloads.
  // Log actorRole (an enum with no identity) instead. Any call site that was
  // passing userId will now produce a compile error, making violations visible
  // at build time rather than leaking silently at runtime.
  userId?: never;
  clerkId?: never;
  userEmail?: never;
  email?: never;
  phone?: never;
  nationalId?: never;
  operationName?: string;
  serviceName?: string;
  // traceId / spanId are injected automatically by the logger's OTel mixin
  // when an active span exists — do not set these manually from call sites.
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
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

export interface ResilienceOptions<T = unknown> {
  timeout?: number | OperationCriticality;
  retry?: Partial<RetryConfig> | boolean;
  circuitBreaker?: Partial<CircuitBreakerConfig> | boolean;
  cache?: Partial<CacheConfig> | boolean;
  fallback?: () => Promise<T>;
  metrics?: boolean;
  operationName?: string;
  cacheKey?: string;
}

export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  outcome: ResilienceOutcome;
  fromCache?: boolean;
  fromFallback?: boolean;
  attempts: number;
  duration: number;
}
