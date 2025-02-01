import type { Context, ContextData, ContextOptions, Logger, Span, SpanNode } from '../types/index.js';
import { createContextData } from './utils.js';
import { createSpan } from './span.js';
import { createLogger } from '../logger/logger.js';
import { ConsoleMiddleware } from '../logger/middlewares.js';
import { SpanLogMiddleware } from '../logger/middlewares.js';


/**
 * Context 的具体实现
 */
export class ContextImpl implements Context {
  private readonly _data: ContextData;
  private readonly _children: Set<ContextImpl>;
  private readonly _logger: Logger;
  private readonly _rootSpanDepth: number;
  private readonly _parentSpanId?: string;

  constructor(options: ContextOptions = {}) {
    this._rootSpanDepth = options.rootSpanDepth ?? 0;
    this._parentSpanId = options.parent?.get().headSpan.get().id;
    const baseData = createContextData(options);
    const spans = new Map<string, Span>();

    // 创建哨兵 span，使用 rootSpanDepth
    const sentinel = createSpan({
      traceId: baseData.traceId,
      name: options.module ? `${options.module}-sentinel` : 'root-sentinel',
      attributes: { isSentinel: true },
      depth: this._rootSpanDepth
    });

    spans.set(sentinel.get().id, sentinel);

    this._data = {
      ...baseData,
      spans,
      headSpan: sentinel
    };

    this._children = new Set();

    // 如果有父 Context，将自己添加到父 Context 的子列表中
    if (options.parent instanceof ContextImpl) {
      options.parent._children.add(this);
    }

    this._logger = createLogger(options.logger || {
      middlewares: [
        new SpanLogMiddleware({ samplingRate: 1 }),
        new ConsoleMiddleware({
          includeContext: true,
          includeSpan: true,
          fieldSelector: (record) => ({
            module: record.context?.get().module,
            operation: record.span?.get().name,
            ...record.data
          })
        })
      ]
    }, this);
  }

  get(): Readonly<ContextData> {
    return Object.freeze({
      ...this._data,
      spans: new Map(this._data.spans)
    });
  }

  get params(): Record<string, any> {
    return Object.freeze({
      ...this._data.params
    });
  }

  fork(options: Partial<Omit<ContextOptions, 'parent'>> = {}): this {
    const optionsWithoutParams = {
      ...options,
      params: undefined
    };

    return new (this.constructor as new (...args: any[]) => this)({
      parent: this,
      rootSpanDepth: this._rootSpanDepth + 1,  // 增加根深度
      ...optionsWithoutParams,
      params: {
        ...this._data.params,
        ...options.params
      }
    });
  }


  startSpan(name: string, attributes: Record<string, unknown> = {}): Span {
    const span = createSpan({
      traceId: this._data.traceId,
      parent: this._data.headSpan,
      name,
      attributes,
      depth: this._rootSpanDepth + 1  // 在根深度基础上加1
    });

    this._data.spans.set(span.get().id, span);
    this._data.headSpan = span;
    return span;
  }

  endSpan(error?: Error): Span {
    const currentHead = this._data.headSpan;
    const parentId = currentHead.get().parentId;

    if (!parentId) {
      throw new Error('Cannot end sentinel span');
    }

    const parentSpan = this._data.spans.get(parentId);
    if (!parentSpan) {
      throw new Error('Parent span not found');
    }

    if (error) {
      currentHead.recordError(error);
    }

    currentHead.end();
    this._data.headSpan = parentSpan;
    return currentHead;
  }

  getLocalSpanTree(): SpanNode {
    const spans = Array.from(this._data.spans.values());
    const rootSpans = spans.filter(span => !span.get().parentId);

    if (rootSpans.length !== 1) {
      throw new Error('Invalid span tree state');
    }

    return this._buildSpanTree(rootSpans[0], this._data.id);
  }

  getGlobalSpanTree(): SpanNode {
    // 如果有父 Context，让父 Context 构建完整树
    if (this._data.parentId) {
      throw new Error('getGlobalSpanTree should be called on root context');
    }

    return this._buildGlobalSpanTree(this);
  }

  private _buildSpanTree(span: Span, contextId: string): SpanNode {
    const spanData = span.get();
    const children = Array.from(this._data.spans.values())
      .filter(s => s.get().parentId === spanData.id)
      .map(s => this._buildSpanTree(s, contextId));

    return {
      span: spanData,
      children,
      contextId
    };
  }

  private _buildGlobalSpanTree(context: Context): SpanNode {
    const localTree = context.getLocalSpanTree();

    if (context instanceof ContextImpl) {
      // 递归构建每个子 Context 的树
      Array.from(context._children).forEach(child => {
        const childTree = this._buildGlobalSpanTree(child);
        this._attachChildTree(localTree, child._parentSpanId, childTree);
      });
    }

    return localTree;
  }

  private _attachChildTree(parentTree: SpanNode, parentSpanId: string | undefined, childTree: SpanNode): boolean {
    if (parentTree.span.id === parentSpanId) {
      parentTree.children.push(childTree);
      return true;
    }

    return parentTree.children.some(child =>
      this._attachChildTree(child, parentSpanId, childTree)
    );
  }

  get logger(): Logger {
    return this._logger;
  }
}

/**
 * 创建根 Context
 */
export function newContext(options?: Partial<Omit<ContextOptions, 'parent'>>): Context {
  return new ContextImpl(options);
}
