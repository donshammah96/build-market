/**
 * Fallback mechanisms for graceful degradation
 */

import { Logger } from "./logger.js";

export interface FallbackOptions<T> {
  fallbackValue?: T;
  fallbackFn?: () => Promise<T>;
  onFallback?: (error: Error) => void;
  logger?: Logger;
}

/**
 * Execute an operation with fallback support
 */
export async function withFallback<T>(
  operation: () => Promise<T>,
  options: FallbackOptions<T>,
): Promise<{ value: T; usedFallback: boolean }> {
  try {
    const value = await operation();
    return { value, usedFallback: false };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    options.logger?.warn("Operation failed, using fallback", {
      error: err.message,
    });

    options.onFallback?.(err);

    // Try fallback function first
    if (options.fallbackFn) {
      try {
        const value = await options.fallbackFn();
        return { value, usedFallback: true };
      } catch (fallbackError) {
        options.logger?.error(
          "Fallback function also failed",
          fallbackError as Error,
        );

        // Fall back to static value if function fails
        if (options.fallbackValue !== undefined) {
          return { value: options.fallbackValue, usedFallback: true };
        }
        throw fallbackError;
      }
    }

    // Use static fallback value
    if (options.fallbackValue !== undefined) {
      return { value: options.fallbackValue, usedFallback: true };
    }

    // No fallback available
    throw err;
  }
}

/**
 * Create a fallback wrapper
 */
export function createFallbackWrapper<T>(options: FallbackOptions<T>) {
  return async (operation: () => Promise<T>): Promise<T> => {
    const { value } = await withFallback(operation, options);
    return value;
  };
}

/**
 * Graceful degradation - combine multiple fallback strategies
 */
export async function withGracefulDegradation<T>(
  operations: Array<() => Promise<T>>,
  logger?: Logger,
): Promise<{ value: T; strategyIndex: number } | { error: Error }> {
  for (let i = 0; i < operations.length; i++) {
    try {
      const operation = operations[i];
      if (!operation) continue;
      const value = await operation();

      if (i > 0 && logger) {
        logger.info(
          `Succeeded with fallback strategy ${i + 1}/${operations.length}`,
        );
      }

      return { value, strategyIndex: i };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (i === operations.length - 1) {
        logger?.error(`All ${operations.length} strategies failed`, err);
        return { error: err };
      }

      logger?.warn(`Strategy ${i + 1} failed, trying next fallback`, {
        error: err.message,
        strategyIndex: i,
      });
    }
  }

  return { error: new Error("No operations provided") };
}
