/**
 * Simple structured logging utility for production use
 * Can be easily replaced with winston, pino, or other logging libraries
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LogContext {
  timestamp: string;
  level: string;
  message: string;
  context?: Record<string, unknown>;
  error?: unknown;
}

class Logger {
  private logLevel: LogLevel;
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.logLevel = this.getLogLevelFromEnv();
  }

  private getLogLevelFromEnv(): LogLevel {
    const level = process.env.LOG_LEVEL?.toUpperCase();
    switch (level) {
      case 'ERROR': return LogLevel.ERROR;
      case 'WARN': return LogLevel.WARN;
      case 'INFO': return LogLevel.INFO;
      case 'DEBUG': return LogLevel.DEBUG;
      default: return process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: unknown) {
    if (level > this.logLevel) return;

    const logEntry: LogContext = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      ...(context ? { context } : {}),
      ...(error ? { error: this.serializeError(error) } : {})
    };

    // In production, output as JSON for structured logging
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify({ service: this.serviceName, ...logEntry }));
    } else {
      // In development, use readable format
      const levelSymbol = this.getLevelSymbol(level);
      console.log(`${levelSymbol} [${logEntry.timestamp}] ${this.serviceName}: ${message}`);
      if (context) console.log('  Context:', context);
      if (error) console.log('  Error:', error);
    }
  }

  private getLevelSymbol(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR: return '❌';
      case LogLevel.WARN: return '⚠️';
      case LogLevel.INFO: return '✅';
      case LogLevel.DEBUG: return '🔍';
      default: return '📝';
    }
  }

  private serializeError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    return { error: String(error) };
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    this.log(LogLevel.ERROR, message, context, error);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.DEBUG, message, context);
  }

  // Log API requests
  logRequest(method: string, url: string, statusCode?: number, duration?: number) {
    const context = {
      method,
      url,
      ...(statusCode && { statusCode }),
      ...(duration && { duration: `${duration}ms` })
    };
    
    if (statusCode && statusCode >= 400) {
      this.warn('API request failed', context);
    } else {
      this.info('API request', context);
    }
  }

  // Log MCP tool calls
  logToolCall(toolName: string, params: unknown, result?: unknown, error?: unknown) {
    const context = {
      tool: toolName,
      params,
      ...(result ? { result } : {})
    };

    if (error) {
      this.error(`Tool call failed: ${toolName}`, error, context);
    } else {
      this.debug(`Tool call: ${toolName}`, context);
    }
  }
}

// Export singleton instances for each server
export const licenseApiLogger = new Logger('license-api');
export const managementApiLogger = new Logger('management-api');

// Export Logger class for custom instances
export default Logger;