/**
 * Structured logging with correlation IDs and contextual information
 */

import { LogContext, LogLevel } from "./types";
import type { Logger } from "./types";
import { getConfig } from "./config";

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
    const entry: LogEntry = {
      level,
      message,
      timestamp: config.logging.includeTimestamp
        ? new Date().toISOString()
        : "",
      context: config.logging.includeContext
        ? { ...this.defaultContext, ...context }
        : undefined,
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
   * Check if we should use JSON logging
   * @deprecated Use config.logging.format instead
   */
  private shouldLogJson(): boolean {
    return getConfig().logging.format === "json";
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
 */
export class CorrelationIdManager {
  private static storage = new Map<string, string>();

  /**
   * Generate a new correlation ID
   */
  static generate(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set correlation ID for current context
   */
  static set(correlationId: string): void {
    // In Node.js, we'd typically use AsyncLocalStorage
    // For simplicity, we're using a Map (not thread-safe in true async contexts)
    const contextId = this.getContextId();
    this.storage.set(contextId, correlationId);
  }

  /**
   * Get correlation ID for current context
   */
  static get(): string | undefined {
    const contextId = this.getContextId();
    return this.storage.get(contextId);
  }

  /**
   * Clear correlation ID for current context
   */
  static clear(): void {
    const contextId = this.getContextId();
    this.storage.delete(contextId);
  }

  /**
   * Get a unique context identifier
   * In production, use AsyncLocalStorage or similar
   */
  private static getContextId(): string {
    return "global"; // Simplified for demo
  }
}

/**
 * Create a logger with correlation ID support
 */
export function createLogger(serviceName: string): Logger {
  return new StructuredLogger(serviceName, {
    correlationId: CorrelationIdManager.get(),
  });
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
