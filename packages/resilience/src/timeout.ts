/**
 * Timeout utilities with configurable strategies based on operation criticality
 */

import { OperationCriticality, TimeoutConfig } from "./types.js";
import { getDefaultTimeouts } from "./config.js";

export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number,
  ) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Default timeout configurations based on criticality
 * @deprecated Use getDefaultTimeouts() for environment-aware defaults
 */
export const DEFAULT_TIMEOUTS: TimeoutConfig = {
  critical: 3000, // 3s for critical operations (auth, payments)
  normal: 10000, // 10s for normal operations (API calls)
  background: 30000, // 30s for background operations (analytics, logs)
};

/**
 * Execute an operation with a timeout
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string = "operation",
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new TimeoutError(
          `Operation '${operationName}' timed out after ${timeoutMs}ms`,
          timeoutMs,
        ),
      );
    }, timeoutMs);

    operation()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Get timeout duration based on criticality
 * Uses environment-aware configuration
 */
export function getTimeout(
  criticality: OperationCriticality,
  customTimeouts?: Partial<TimeoutConfig>,
): number {
  const timeouts = { ...getDefaultTimeouts(), ...customTimeouts };
  return timeouts[criticality];
}

/**
 * Execute an operation with criticality-based timeout
 */
export async function withCriticalityTimeout<T>(
  operation: () => Promise<T>,
  criticality: OperationCriticality,
  operationName?: string,
  customTimeouts?: Partial<TimeoutConfig>,
): Promise<T> {
  const timeoutMs = getTimeout(criticality, customTimeouts);
  return withTimeout(operation, timeoutMs, operationName);
}
