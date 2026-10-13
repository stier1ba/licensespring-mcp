/**
 * Structured logger.
 *
 * MCP servers that use the stdio transport speak JSON-RPC over stdout, so
 * every log line MUST go to stderr. Writing anything else to stdout corrupts
 * the protocol stream and breaks the client connection.
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export type LogSink = (line: string) => void;

const defaultSink: LogSink = (line) => {
  process.stderr.write(`${line}\n`);
};

export function parseLogLevel(value: string | undefined, nodeEnv: string | undefined): LogLevel {
  switch (value?.toUpperCase()) {
    case 'ERROR': return LogLevel.ERROR;
    case 'WARN': return LogLevel.WARN;
    case 'INFO': return LogLevel.INFO;
    case 'DEBUG': return LogLevel.DEBUG;
    default: return nodeEnv === 'production' ? LogLevel.INFO : LogLevel.WARN;
  }
}

export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { error: String(error) };
}

export class Logger {
  readonly level: LogLevel;

  constructor(
    private readonly serviceName: string,
    options: { level?: LogLevel; sink?: LogSink } = {},
  ) {
    this.level = options.level ?? parseLogLevel(process.env.LOG_LEVEL, process.env.NODE_ENV);
    this.sink = options.sink ?? defaultSink;
  }

  private readonly sink: LogSink;

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: unknown): void {
    if (level > this.level) return;
    this.sink(JSON.stringify({
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      level: LogLevel[level],
      message,
      ...(context ? { context } : {}),
      ...(error !== undefined ? { error: serializeError(error) } : {}),
    }));
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

export function createLogger(serviceName: string): Logger {
  return new Logger(serviceName);
}
