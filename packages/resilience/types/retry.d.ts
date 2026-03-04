/**
 * Intelligent retry logic with exponential backoff and jitter
 */
import { RetryConfig } from "./types";
import { Logger } from "./logger";
export declare class RetryError extends Error {
  readonly attempts: number;
  readonly lastError: Error;
  constructor(message: string, attempts: number, lastError: Error);
}
export declare const DEFAULT_RETRY_CONFIG: RetryConfig;
/**
 * Execute an operation with retry logic
 */
export declare function withRetry<T>(
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>,
  operationName?: string,
  logger?: Logger,
): Promise<{
  result: T;
  attempts: number;
}>;
/**
 * Create a retry wrapper function
 */
export declare function createRetryWrapper(
  config?: Partial<RetryConfig>,
  logger?: Logger,
): <T>(operation: () => Promise<T>, operationName?: string) => Promise<T>;
//# sourceMappingURL=retry.d.ts.map
