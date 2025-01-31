import type { Logger, LoggerConfig, LogRecord, LoggerMiddleware, Context, Span } from '../types';
import { LogLevel } from '../types'; 

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 10,
  [LogLevel.INFO]: 20,
  [LogLevel.WARN]: 30,
  [LogLevel.ERROR]: 40
};

export class LoggerImpl implements Logger {
  private readonly middlewares: LoggerMiddleware[];
  private readonly minLevel: LogLevel;
  private readonly context?: Context;
  private readonly span?: Span;

  constructor(
    config: LoggerConfig = {},
    context?: Context,
    span?: Span
  ) {
    this.middlewares = config.middlewares ?? [];
    this.minLevel = config.minLevel ?? LogLevel.DEBUG;
    this.context = context;
    this.span = span;
  }

  private createRecord(
    level: LogLevel,
    message: string,
    error?: Error,
    data?: Record<string, unknown>
  ): LogRecord {
    return {
      level,
      message,
      timestamp: Date.now(),
      data,
      error,
      context: this.context,
      span: this.span
    };
  }

  private processRecord(record: LogRecord): void {
    let index = 0;
    
    const next = (record: LogRecord) => {
      if (index < this.middlewares.length) {
        this.middlewares[index++].handle(record, next);
      }
    };

    next(record);
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;
    this.processRecord(this.createRecord(level, message, undefined, data));
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    this.processRecord(this.createRecord(LogLevel.ERROR, message, error, data));
  }
}

/**
 * 创建新的 Logger
 */
export function createLogger(
  config?: LoggerConfig,
  context?: Context,
  span?: Span
): Logger {
  return new LoggerImpl(config, context, span);
}
