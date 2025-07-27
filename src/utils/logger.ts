/**
 * Structured logging utility with support for different log levels
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogEntry {
  level: string;
  timestamp: string;
  message: string;
  context?: Record<string, unknown>;
}

class Logger {
  private minLogLevel: LogLevel;
  private isProduction: boolean;

  constructor() {
    // Get log level from environment variable or default to INFO in production
    const envLogLevel = process.env.LOG_LEVEL?.toUpperCase();
    this.isProduction = process.env.NODE_ENV === 'production';
    
    switch (envLogLevel) {
      case 'DEBUG':
        this.minLogLevel = LogLevel.DEBUG;
        break;
      case 'INFO':
        this.minLogLevel = LogLevel.INFO;
        break;
      case 'WARN':
        this.minLogLevel = LogLevel.WARN;
        break;
      case 'ERROR':
        this.minLogLevel = LogLevel.ERROR;
        break;
      default:
        // Default to INFO in production, DEBUG in development
        this.minLogLevel = this.isProduction ? LogLevel.INFO : LogLevel.DEBUG;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLogLevel;
  }

  private formatLogEntry(level: string, message: string, context?: Record<string, unknown>): LogEntry {
    return {
      level,
      timestamp: new Date().toISOString(),
      message,
      ...(context && { context: this.sanitizeContext(context) })
    };
  }

  /**
   * Sanitize context to remove sensitive information
   */
  private sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...context };
    
    // Remove or mask sensitive fields
    const sensitiveFields = ['accessToken', 'password', 'token', 'authorization', 'secret', 'key'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        if (typeof sanitized[field] === 'string') {
          const value = sanitized[field] as string;
          // Show only first 4 and last 4 characters for tokens
          sanitized[field] = value.length > 8 
            ? `${value.slice(0, 4)}...${value.slice(-4)}`
            : '***';
        } else {
          sanitized[field] = '***';
        }
      }
    }
    
    return sanitized;
  }

  private log(level: LogLevel, levelName: string, message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry = this.formatLogEntry(levelName, message, context);
    
    // In production, use JSON format for structured logging
    if (this.isProduction) {
      console.log(JSON.stringify(logEntry));
    } else {
      // In development, use more readable format
      const contextStr = context ? ` ${JSON.stringify(this.sanitizeContext(context))}` : '';
      console.log(`[${logEntry.timestamp}] ${levelName}: ${message}${contextStr}`);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, 'INFO', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, 'WARN', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    const errorContext = {
      ...context,
      ...(error && {
        errorName: error.name,
        errorMessage: error.message,
        ...(this.isProduction ? {} : { stack: error.stack })
      })
    };
    
    this.log(LogLevel.ERROR, 'ERROR', message, errorContext);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, context);
  }
}

class ChildLogger {
  constructor(
    private parent: Logger,
    private baseContext: Record<string, unknown>
  ) {}

  private mergeContext(context?: Record<string, unknown>): Record<string, unknown> {
    return { ...this.baseContext, ...context };
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.parent.error(message, error, this.mergeContext(context));
  }
}

// Export singleton instance
export const logger = new Logger();