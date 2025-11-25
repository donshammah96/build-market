/**
 * Structured logging with correlation IDs and contextual information
 */
import { LogContext, LogLevel } from './types';
import type { Logger } from './types';
export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    context?: LogContext;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}
export type { Logger } from './types';
/**
 * Structured logger implementation
 */
export declare class StructuredLogger implements Logger {
    private readonly serviceName;
    private readonly defaultContext;
    constructor(serviceName: string, defaultContext?: LogContext);
    debug(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, error?: Error, context?: LogContext): void;
    fatal(message: string, error?: Error, context?: LogContext): void;
    /**
     * Internal log method
     */
    private log;
    /**
     * Check if we should use JSON logging
     */
    private shouldLogJson;
    /**
     * Format log entry for human-readable output
     */
    private logFormatted;
    /**
     * Get ANSI color code for log level
     */
    private getLevelColor;
    /**
     * Create a child logger with additional context
     */
    child(context: LogContext): StructuredLogger;
}
/**
 * Correlation ID utilities
 */
export declare class CorrelationIdManager {
    private static storage;
    /**
     * Generate a new correlation ID
     */
    static generate(): string;
    /**
     * Set correlation ID for current context
     */
    static set(correlationId: string): void;
    /**
     * Get correlation ID for current context
     */
    static get(): string | undefined;
    /**
     * Clear correlation ID for current context
     */
    static clear(): void;
    /**
     * Get a unique context identifier
     * In production, use AsyncLocalStorage or similar
     */
    private static getContextId;
}
/**
 * Create a logger with correlation ID support
 */
export declare function createLogger(serviceName: string): Logger;
export declare function getGlobalLogger(): Logger;
export declare function setGlobalLogger(logger: Logger): void;
//# sourceMappingURL=logger.d.ts.map