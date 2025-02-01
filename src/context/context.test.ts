import { describe, expect, it } from 'vitest';
import { newContext } from './context.js';
import { SpanStatus } from '../types/index.js';

const silentLogger = {
  middlewares: []
};

describe('ContextImpl spans', () => {
  it('nests spans under the current head and restores parents in LIFO order', () => {
    const ctx = newContext({ logger: silentLogger });
    const sentinel = ctx.get().headSpan;

    const outer = ctx.startSpan('outer');
    const inner = ctx.startSpan('inner');

    expect(ctx.get().headSpan).toBe(inner);
    expect(outer.get().parentId).toBe(sentinel.get().id);
    expect(inner.get().parentId).toBe(outer.get().id);

    expect(ctx.endSpan()).toBe(inner);
    expect(inner.get().status).toBe(SpanStatus.SUCCESS);
    expect(ctx.get().headSpan).toBe(outer);

    expect(ctx.endSpan()).toBe(outer);
    expect(outer.get().status).toBe(SpanStatus.SUCCESS);
    expect(ctx.get().headSpan).toBe(sentinel);
  });

  it('keeps a manually ended span as the context head until context.endSpan unwinds it', () => {
    const ctx = newContext({ logger: silentLogger });
    const sentinel = ctx.get().headSpan;
    const span = ctx.startSpan('manual-end');

    span.end();

    expect(span.get().status).toBe(SpanStatus.SUCCESS);
    expect(ctx.get().headSpan).toBe(span);

    expect(ctx.endSpan()).toBe(span);
    expect(ctx.get().headSpan).toBe(sentinel);
  });

  it('keeps parent and forked child heads independent while sharing trace lineage', () => {
    const parent = newContext({
      module: 'orders',
      params: { requestId: 'req_1' },
      logger: silentLogger
    });
    const parentSpan = parent.startSpan('create-order');
    const child = parent.fork({
      module: 'payments',
      params: { provider: 'stripe' },
      logger: silentLogger
    });
    const childSentinel = child.get().headSpan;
    const childSpan = child.startSpan('charge-card');

    expect(child.get().traceId).toBe(parent.get().traceId);
    expect(child.get().parentId).toBe(parent.get().id);
    expect(child.params).toEqual({ requestId: 'req_1', provider: 'stripe' });
    expect(child.get().module).toBe('orders.payments');
    expect(parent.get().headSpan).toBe(parentSpan);
    expect(child.get().headSpan).toBe(childSpan);
    expect(childSpan.get().parentId).toBe(childSentinel.get().id);

    child.endSpan();

    expect(child.get().headSpan).toBe(childSentinel);
    expect(parent.get().headSpan).toBe(parentSpan);
  });

  it('builds a global span tree across forked contexts from the root context', () => {
    const parent = newContext({
      module: 'orders',
      logger: silentLogger
    });
    const parentSpan = parent.startSpan('create-order');
    const child = parent.fork({
      module: 'payments',
      logger: silentLogger
    });
    const childSentinel = child.get().headSpan;
    const childSpan = child.startSpan('charge-card');

    expect(() => child.getGlobalSpanTree()).toThrow(
      'getGlobalSpanTree should be called on root context'
    );

    const tree = parent.getGlobalSpanTree();
    const parentNode = tree.children[0];
    const childSentinelNode = parentNode?.children[0];
    const childNode = childSentinelNode?.children[0];

    expect(tree.contextId).toBe(parent.get().id);
    expect(tree.span.attributes).toMatchObject({ isSentinel: true });
    expect(parentNode?.contextId).toBe(parent.get().id);
    expect(parentNode?.span.id).toBe(parentSpan.get().id);
    expect(parentNode?.span.name).toBe('create-order');
    expect(childSentinelNode?.contextId).toBe(child.get().id);
    expect(childSentinelNode?.span.id).toBe(childSentinel.get().id);
    expect(childSentinelNode?.span.attributes).toMatchObject({ isSentinel: true });
    expect(childNode?.contextId).toBe(child.get().id);
    expect(childNode?.span.id).toBe(childSpan.get().id);
    expect(childNode?.span.name).toBe('charge-card');
  });
});
