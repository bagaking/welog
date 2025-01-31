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
  it.each([
    [LogLevel.DEBUG, [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]],
    [LogLevel.INFO, [LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]],
    [LogLevel.WARN, [LogLevel.WARN, LogLevel.ERROR]],
    [LogLevel.ERROR, [LogLevel.ERROR]]
  ])('filters records at minLevel %s by semantic log level priority', (minLevel, expectedLevels) => {
    const capture = new CaptureMiddleware();
    const logger = createLogger({
      minLevel,
      middlewares: [capture]
    });

    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error', new Error('boom'));

    expect(capture.records.map((record) => record.level)).toEqual(expectedLevels);
  });
});
