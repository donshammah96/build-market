/**
 * Structured logging with correlation IDs and contextual information
 */

import { LogContext, LogLevel } from "./types";
import type { Logger } from "./types";
import { getConfig } from "./config";
import { AsyncLocalStorage } from "node:async_hooks";

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

// Re-export Logger type for convenience
export type { Logger } from "./types";

/**
 * Structured logger implementation
 */
export class StructuredLogger implements Logger {
  private readonly serviceName: string;
  private readonly defaultContext: LogContext;

  constructor(serviceName: string, defaultContext: LogContext = {}) {
    this.serviceName = serviceName;
    this.defaultContext = { ...defaultContext, serviceName };
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, undefined, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, undefined, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, undefined, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, error, context);
  }

  fatal(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.FATAL, message, error, context);
  }

  /**
   * Check if log level should be output based on config
   */
  private shouldLog(level: LogLevel): boolean {
    const config = getConfig();
    if (!config.logging.enabled) return false;

    const levelOrder: Record<LogLevel, number> = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3,
      [LogLevel.FATAL]: 4,
    };

    return levelOrder[level] >= levelOrder[config.logging.level];
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    message: string,
    error?: Error,
    context?: LogContext,
  ): void {
    if (!this.shouldLog(level)) return;

    const config = getConfig();

    // FIX: Dynamically fetch the current correlation ID at the moment of logging
    const currentCorrelationId = CorrelationIdManager.get();
    const dynamicContext = config.logging.includeContext
      ? {
          ...this.defaultContext,
          ...(currentCorrelationId
            ? { correlationId: currentCorrelationId }
            : {}),
          ...context,
        }
      : undefined;

    const entry: LogEntry = {
      level,
      message,
      timestamp: config.logging.includeTimestamp
        ? new Date().toISOString()
        : "",
      context: dynamicContext,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Format and output based on configuration
    if (config.logging.format === "json") {
      console.log(JSON.stringify(entry));
    } else {
      this.logFormatted(entry);
    }
  }

  /**
   * Format log entry for human-readable output
   */
  private logFormatted(entry: LogEntry): void {
    const { level, message, timestamp, context, error } = entry;

    const levelColor = this.getLevelColor(level);
    const reset = "\x1b[0m";

    let output = `${levelColor}[${level.toUpperCase()}]${reset} ${timestamp} - ${message}`;

    if (context && Object.keys(context).length > 0) {
      output += `\n  Context: ${JSON.stringify(context, null, 2)}`;
    }

    if (error) {
      output += `\n  Error: ${error.name}: ${error.message}`;
      if (error.stack) {
        output += `\n${error.stack}`;
      }
    }

    // Route to appropriate console method
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(output);
        break;
      case LogLevel.INFO:
        console.info(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(output);
        break;
    }
  }

  /**
   * Get ANSI color code for log level
   */
  private getLevelColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return "\x1b[36m"; // Cyan
      case LogLevel.INFO:
        return "\x1b[32m"; // Green
      case LogLevel.WARN:
        return "\x1b[33m"; // Yellow
      case LogLevel.ERROR:
        return "\x1b[31m"; // Red
      case LogLevel.FATAL:
        return "\x1b[35m"; // Magenta
      default:
        return "\x1b[0m"; // Reset
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): StructuredLogger {
    return new StructuredLogger(this.serviceName, {
      ...this.defaultContext,
      ...context,
    });
  }
}

/**
 * Correlation ID utilities
 * FIX: Replaced Map with true Node.js AsyncLocalStorage for thread-safety
 */
const asyncLocalStorage = new AsyncLocalStorage<string>();

export class CorrelationIdManager {
  /**
   * Generate a new correlation ID
   */
  static generate(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Execute a function within an isolated correlation context.
   * THIS IS THE PREFERRED METHOD FOR NEXT.JS API ROUTES AND MIDDLEWARE.
   */
  static run<T>(correlationId: string, callback: () => T): T {
    return asyncLocalStorage.run(correlationId, callback);
  }

  /**
   * Set correlation ID for current context via enterWith.
   * Use this for flat contexts (like isolated BullMQ worker threads)
   * where a wrapper function (.run) is difficult to implement.
   */
  static set(correlationId: string): void {
    asyncLocalStorage.enterWith(correlationId);
  }

  /**
   * Get correlation ID for current context.
   * Returns undefined when no correlation ID is set — including when clear()
   * has been called, which stores "" as a sentinel. Callers never see the
   * empty-string sentinel; they only ever receive a real ID or undefined.
   */
  static get(): string | undefined {
    const value = asyncLocalStorage.getStore();
    return value === "" ? undefined : value;
  }

  /**
   * Clear correlation ID for the current async context.
   *
   * AsyncLocalStorage requires a value of the declared type (string here).
   * We use an empty string as the "cleared" sentinel; callers that read the
   * store should treat both undefined and "" as "no correlation ID set".
   */
  static clear(): void {
    asyncLocalStorage.enterWith("");
  }
}

/**
 * Create a logger.
 * FIX: Removed eager CorrelationId fetching. The class now handles it dynamically.
 */
export function createLogger(serviceName: string): Logger {
  return new StructuredLogger(serviceName);
}

/**
 * Global logger instance
 */
let globalLogger: Logger | undefined;

export function getGlobalLogger(): Logger {
  if (!globalLogger) {
    globalLogger = createLogger("build-market");
  }
  return globalLogger;
}

export function setGlobalLogger(logger: Logger): void {
  globalLogger = logger;
}
