/**
 * Fallback mechanisms for graceful degradation
 */
import { Logger } from './logger';
export interface FallbackOptions<T> {
    fallbackValue?: T;
    fallbackFn?: () => Promise<T>;
    onFallback?: (error: Error) => void;
    logger?: Logger;
}
/**
 * Execute an operation with fallback support
 */
export declare function withFallback<T>(operation: () => Promise<T>, options: FallbackOptions<T>): Promise<{
    value: T;
    usedFallback: boolean;
}>;
/**
 * Create a fallback wrapper
 */
export declare function createFallbackWrapper<T>(options: FallbackOptions<T>): (operation: () => Promise<T>) => Promise<T>;
/**
 * Graceful degradation - combine multiple fallback strategies
 */
export declare function withGracefulDegradation<T>(operations: Array<() => Promise<T>>, logger?: Logger): Promise<{
    value: T;
    strategyIndex: number;
} | {
    error: Error;
}>;
//# sourceMappingURL=fallback.d.ts.map