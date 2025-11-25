/**
 * Timeout utilities with configurable strategies based on operation criticality
 */
import { OperationCriticality, TimeoutConfig } from './types';
export declare class TimeoutError extends Error {
    readonly timeoutMs: number;
    constructor(message: string, timeoutMs: number);
}
export declare const DEFAULT_TIMEOUTS: TimeoutConfig;
/**
 * Execute an operation with a timeout
 */
export declare function withTimeout<T>(operation: () => Promise<T>, timeoutMs: number, operationName?: string): Promise<T>;
/**
 * Get timeout duration based on criticality
 */
export declare function getTimeout(criticality: OperationCriticality, customTimeouts?: Partial<TimeoutConfig>): number;
/**
 * Execute an operation with criticality-based timeout
 */
export declare function withCriticalityTimeout<T>(operation: () => Promise<T>, criticality: OperationCriticality, operationName?: string, customTimeouts?: Partial<TimeoutConfig>): Promise<T>;
//# sourceMappingURL=timeout.d.ts.map