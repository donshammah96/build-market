/**
 * Intelligent retry logic with exponential backoff and jitter
 */

import { RetryConfig } from "./types.js";
import { Logger } from "./logger.js";
import { getDefaultRetryConfig } from "./config.js";

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error,
  ) {
    super(message);
    this.name = "RetryError";
  }
}

/**
 * Default retry configuration
 * @deprecated Use getDefaultRetryConfig() for environment-aware defaults
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterFactor: 0.1, // 10% jitter
  retryableErrors: [
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
    "NetworkError",
    "TimeoutError",
  ],
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay =
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter to prevent thundering herd
  const jitter = cappedDelay * config.jitterFactor * (Math.random() - 0.5) * 2;
  return Math.floor(cappedDelay + jitter);
}

/**
 * Check if an error is retryable
 */
function isRetryable(error: Error, config: RetryConfig): boolean {
  if (!config.retryableErrors || config.retryableErrors.length === 0) {
    return true; // Retry all errors if no specific errors defined
  }

  return config.retryableErrors.some(
    (retryableError) =>
      error.name.includes(retryableError) ||
      error.message.includes(retryableError) ||
      (error as any).code === retryableError,
  );
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an operation with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  operationName: string = "operation",
  logger?: Logger,
): Promise<{ result: T; attempts: number }> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < retryConfig.maxAttempts; attempt++) {
    try {
      const result = await operation();

      if (attempt > 0 && logger) {
        logger.info(
          `Operation '${operationName}' succeeded after ${attempt + 1} attempts`,
        );
      }

      return { result, attempts: attempt + 1 };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const isLastAttempt = attempt === retryConfig.maxAttempts - 1;
      const shouldRetry = isRetryable(lastError, retryConfig);

      if (isLastAttempt || !shouldRetry) {
        if (logger) {
          logger.warn(
            `Operation '${operationName}' failed after ${attempt + 1} attempts`,
            {
              operationName,
              attempts: attempt + 1,
              error: lastError.message,
              retryable: shouldRetry,
            },
          );
        }
        throw new RetryError(
          `Operation '${operationName}' failed after ${attempt + 1} attempts: ${lastError.message}`,
          attempt + 1,
          lastError,
        );
      }

      const delayMs = calculateDelay(attempt, retryConfig);

      if (logger) {
        logger.debug(
          `Retrying operation '${operationName}' after ${delayMs}ms (attempt ${attempt + 1}/${retryConfig.maxAttempts})`,
          {
            operationName,
            attempt: attempt + 1,
            maxAttempts: retryConfig.maxAttempts,
            delayMs,
            error: lastError.message,
          },
        );
      }

      await sleep(delayMs);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new RetryError(
    `Operation '${operationName}' failed after ${retryConfig.maxAttempts} attempts`,
    retryConfig.maxAttempts,
    lastError!,
  );
}

/**
 * Create a retry wrapper function
 */
export function createRetryWrapper(
  config: Partial<RetryConfig> = {},
  logger?: Logger,
) {
  return async function retryWrapper<T>(
    operation: () => Promise<T>,
    operationName?: string,
  ): Promise<T> {
    const { result } = await withRetry(
      operation,
      config,
      operationName,
      logger,
    );
    return result;
  };
}
