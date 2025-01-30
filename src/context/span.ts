import { generateId } from './utils';
import type { SpanData, SpanOptions, Span, Context } from '../types';
import type { LogRecord } from '../types';
import { SpanStatus } from '../types';

export interface CreateSpanOptions extends SpanOptions {
  depth: number;
}

/**
 * 创建 Span 数据
 */
export function createSpanData(options: CreateSpanOptions): SpanData {
  const { traceId, parent, name, attributes = {}, depth } = options;

  return {
    id: generateId(),
    traceId,
    parentId: parent?.get().id,
    name,
    startTime: Date.now(),
    status: SpanStatus.ACTIVE,
    attributes: { ...attributes },
    logs: [],
    depth
  };
}

/**
 * Span 的具体实现
 */
export class SpanImpl implements Span {
  private _data: SpanData;

  constructor(options: CreateSpanOptions) {
    this._data = createSpanData(options);
  }

  get(): Readonly<SpanData> {
    return Object.freeze({
      ...this._data,
      attributes: { ...this._data.attributes },
      logs: [...this._data.logs]  // 创建日志数组的副本
    });
  }

  setAttributes(attributes: Record<string, unknown>): Span {
    if (this._data.endTime) {
      throw new Error('Cannot modify a finished span');
    }
    this._data.attributes = { ...this._data.attributes, ...attributes };
    return this;
  }

  recordError(error: Error): Span {
    if (this._data.endTime) {
      throw new Error('Cannot modify a finished span');
    }
    this._data.error = error;
    this._data.status = SpanStatus.ERROR;
    return this;
  }

  end(): Span {
    if (this._data.endTime) {
      return this;
    }
    this._data.endTime = Date.now();
    if (this._data.status === SpanStatus.ACTIVE) {
      this._data.status = SpanStatus.SUCCESS;
    }
    return this;
  }

  log(record: LogRecord): Span {
    if (this._data.endTime) {
      throw new Error('Cannot modify a finished span');
    }
    this._data.logs.push({ ...record });  // 存储日志记录的副本
    return this;
  }
}

/**
 * 创建新的 Span
 */
export function createSpan(options: CreateSpanOptions): Span {
  return new SpanImpl(options);
} 