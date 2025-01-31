import { describe, expect, it } from 'vitest';
import { createLogger } from './logger';
import { LogLevel, type LogRecord, type LoggerMiddleware } from '../types';

class CaptureMiddleware implements LoggerMiddleware {
  readonly records: LogRecord[] = [];

  handle(record: LogRecord, next: (record: LogRecord) => void): void {
    this.records.push(record);
    next(record);
  }
}

describe('LoggerImpl', () => {
  it('filters records by semantic log level priority', () => {
    const capture = new CaptureMiddleware();
    const logger = createLogger({
      minLevel: LogLevel.WARN,
      middlewares: [capture]
    });

    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error', new Error('boom'));

    expect(capture.records.map((record) => record.level)).toEqual([
      LogLevel.WARN,
      LogLevel.ERROR
    ]);
  });
});
