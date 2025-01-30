import type { LoggerMiddleware, LoggerMiddlewareConfig, LogRecord } from '../types';
import { LogLevel } from '../types';

/**
 * Span 日志中间件
 */
export class SpanLogMiddleware implements LoggerMiddleware {
  constructor(private config: LoggerMiddlewareConfig = {}) {
    this.config.samplingRate = config.samplingRate ?? 1;
  }

  handle(record: LogRecord, next: (record: LogRecord) => void): void {
    // 采样检查
    if (Math.random() > (this.config.samplingRate ?? 1)) {
      return;
    }

    // 如果有关联的 span，记录日志
    if (record.span) {
      record.span.log(record);
    }

    next(record);
  }
}

/**
 * 控制台日志中间件
 */
export class ConsoleMiddleware implements LoggerMiddleware {
  constructor(private config: LoggerMiddlewareConfig = {}) {}

  handle(record: LogRecord, next: (record: LogRecord) => void): void {
    const output: Record<string, unknown> = {
      level: record.level,
      message: record.message,
      timestamp: record.timestamp
    };

    // 添加自定义字段
    if (this.config.fieldSelector) {
      Object.assign(output, this.config.fieldSelector(record));
    }

    // 添加 Context 信息
    if (this.config.includeContext && record.context) {
      const contextData = record.context.get();
      output.traceId = contextData.traceId;
      output.contextId = contextData.id;
      output.module = contextData.module;
    }

    // 添加 Span 信息
    if (this.config.includeSpan && record.span) {
      const spanData = record.span.get();
      output.spanId = spanData.id;
      output.spanName = spanData.name;
      
      // 使用 span 的 depth 进行缩进
      output.message = '  '.repeat(spanData.depth) + output.message;
    }

    // 添加错误信息
    if (record.error) {
      output.error = record.error;
    }

    // 根据日志级别使用不同的控制台方法
    switch (record.level) {
      case LogLevel.DEBUG:
        console.debug(record.message, output);
        break;
      case LogLevel.INFO:
        console.info(record.message, output);
        break;
      case LogLevel.WARN:
        console.warn(record.message, output);
        break;
      case LogLevel.ERROR:
        console.error(record.message, output);
        break;
    }

    next(record);
  }
} 