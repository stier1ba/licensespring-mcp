/**
 * Structured logger for the MCP servers.
 *
 * MCP servers using the stdio transport reserve stdout for JSON-RPC messages,
 * so every log line is written to stderr. Writing to stdout would corrupt the
 * protocol stream and disconnect the client.
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export type LogWriter = (line: string) => void;

const LEVEL_SYMBOLS: Record<LogLevel, string> = {
  [LogLevel.ERROR]: '❌',
  [LogLevel.WARN]: '⚠️',
  [LogLevel.INFO]: 'ℹ️',
  [LogLevel.DEBUG]: '🔍',
};

export function parseLogLevel(value: string | undefined, nodeEnv: string | undefined): LogLevel {
  switch (value?.toUpperCase()) {
    case 'ERROR': return LogLevel.ERROR;
    case 'WARN': return LogLevel.WARN;
    case 'INFO': return LogLevel.INFO;
    case 'DEBUG': return LogLevel.DEBUG;
    default: return nodeEnv === 'production' ? LogLevel.WARN : LogLevel.INFO;
  }
}

export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { error: String(error) };
}

export class Logger {
  constructor(
    private readonly serviceName: string,
    private readonly level: LogLevel = parseLogLevel(process.env.LOG_LEVEL, process.env.NODE_ENV),
    private readonly json: boolean = process.env.NODE_ENV === 'production',
    private readonly write: LogWriter = (line) => process.stderr.write(`${line}\n`),
  ) {}

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: unknown): void {
    if (level > this.level) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      service: this.serviceName,
      message,
      ...(context ? { context } : {}),
      ...(error !== undefined ? { error: serializeError(error) } : {}),
    };

    if (this.json) {
      this.write(JSON.stringify(entry));
      return;
    }

    let line = `${LEVEL_SYMBOLS[level]} [${entry.timestamp}] ${this.serviceName}: ${message}`;
    if (context) line += ` ${JSON.stringify(context)}`;
    if (error !== undefined) line += ` ${JSON.stringify(entry.error)}`;
    this.write(line);
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }
}

export const licenseApiLogger = new Logger('license-api');
export const managementApiLogger = new Logger('management-api');

export default Logger;
