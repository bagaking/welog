# @bagaking/welog

`@bagaking/welog` is a small tracing/logging kernel for TypeScript ESM projects.
It gives one request or job a `Context`, records work units as `Span`s, and lets
`Logger` middleware decide where each log record goes.

It is not a log backend. It does not ship a remote transport, exporter,
OpenTelemetry bridge, persistence layer, dashboard, or batching worker. Those
belong in application middleware built on top of the public types.

## Mental Model

`Context` is the trace container. Create it at an entry point, pass it through
your call graph, and `fork()` it when a child branch needs its own module name or
params. A fork keeps the same `traceId`, records parent/child context structure,
and raises the root span depth for nested output.

`Span` is an operation inside a context. `startSpan()` makes the new span the
context head. `endSpan(error?)` closes the current head, records an error when
provided, and restores the previous head. `span.end()` only marks that span done;
it does not move the context head back.

`Logger` creates records and runs middleware. A context logger carries the
context. A logger only carries a span when it is created with one, or when a
middleware receives a record that already has `record.span`. This matters for
`SpanLogMiddleware`: it writes logs into `record.span.logs`, so `ctx.logger`
alone does not imply "current span logging."

## Install

```bash
npm install @bagaking/welog
```

```bash
pnpm add @bagaking/welog
```

```bash
yarn add @bagaking/welog
```

## Quick Start

Import from the root package. The package is ESM-only.

```ts
import { ConsoleMiddleware, newContext } from '@bagaking/welog';

const ctx = newContext({
  module: 'orders',
  params: { requestId: 'req_123' },
  logger: {
    middlewares: [
      new ConsoleMiddleware({
        includeContext: true,
        fieldSelector: (record) => record.data ?? {}
      })
    ]
  }
});

ctx.startSpan('create-order', { userId: 'u_1' });

let spanError: Error | undefined;

try {
  ctx.logger.info('order accepted', { orderId: 'ord_1' });
} catch (error) {
  spanError = error instanceof Error ? error : new Error(String(error));
  throw error;
} finally {
  ctx.endSpan(spanError);
}
```

Fork contexts for child work. The child keeps the same trace and receives merged
params.

```ts
import type { Context } from '@bagaking/welog';

async function chargeCard(ctx: Context) {
  const paymentCtx = ctx.fork({
    module: 'payments',
    params: { provider: 'stripe' }
  });

  paymentCtx.startSpan('charge-card');

  let spanError: Error | undefined;

  try {
    paymentCtx.logger.info('charge requested');
  } catch (error) {
    spanError = error instanceof Error ? error : new Error(String(error));
    throw error;
  } finally {
    paymentCtx.endSpan(spanError);
  }
}
```

Create a span-bound logger when logs must be stored on a span.

```ts
import {
  SpanLogMiddleware,
  createLogger,
  newContext
} from '@bagaking/welog';

const ctx = newContext({ module: 'worker', logger: { middlewares: [] } });
const span = ctx.startSpan('index-document');
const spanLogger = createLogger(
  { middlewares: [new SpanLogMiddleware()] },
  ctx,
  span
);

spanLogger.info('document indexed', { documentId: 'doc_1' });
ctx.endSpan();

console.log(span.get().logs.length); // 1
```

## API Contract

The public runtime entrypoint is `@bagaking/welog`. The only secondary export is
`@bagaking/welog/package.json` for package metadata.

The package contract in `package.json` is:

- ESM package: `"type": "module"`
- runtime file: `dist/index.js`
- type declarations: `dist/types/index.d.ts`
- exported subpaths: `.` and `./package.json`
- published files: `dist`, `README.md`, `ARCH.md`, `LICENSE`

Public root exports:

- Context APIs: `newContext`
- Current Context implementation class: `ContextImpl`
- Logger APIs: `createLogger`
- Middleware classes: `ConsoleMiddleware`, `SpanLogMiddleware`
- Enums: `LogLevel`, `SpanStatus`
- Types: `Context`, `ContextData`, `ContextOptions`, `Span`, `SpanData`,
  `SpanOptions`, `SpanNode`, `Logger`, `LoggerConfig`, `LoggerMiddleware`,
  `LoggerMiddlewareConfig`, `LogRecord`

`ContextImpl` is exported by the current root barrel and is the class returned by
`newContext()`. Treat it as an implementation export, not a stable extension
contract. Application code should depend on `newContext()` and the `Context`
interface unless it intentionally accepts constructor and subclassing churn.

### Context

- `newContext(options?)` creates a root context.
- `context.fork(options?)` creates a child context with the same `traceId`,
  merged `params`, a parent pointer, and a deeper root span depth.
- `context.startSpan(name, attributes?)` creates a child span under the current
  head and makes it the new head.
- `context.endSpan(error?)` closes the current head span. It throws if the head
  is the sentinel span.
- `context.getLocalSpanTree()` returns this context's span tree.
- `context.getGlobalSpanTree()` returns the full tree and must be called on the
  root context.
- `context.params` returns a frozen copy of params.
- `context.logger` returns the logger configured for the context.

### Span

- `span.get()` returns frozen span data with copied attributes and logs.
- `span.setAttributes(attributes)` merges attributes while the span is open.
- `span.recordError(error)` sets `status` to `error` while the span is open.
- `span.end()` sets `endTime` and marks an active span as `success`.
- `span.log(record)` appends a copied log record while the span is open.

Finished spans cannot be modified, except repeated `span.end()` calls are
idempotent.

### Logger

- `logger.log(level, message, data?)`
- `logger.debug(message, data?)`
- `logger.info(message, data?)`
- `logger.warn(message, data?)`
- `logger.error(message, error?, data?)`

`LoggerConfig.minLevel` filters records by semantic level priority:
`debug < info < warn < error`.

Middleware is synchronous by interface:

```ts
import type { LoggerMiddleware, LogRecord } from '@bagaking/welog';

class CaptureMiddleware implements LoggerMiddleware {
  readonly records: LogRecord[] = [];

  handle(record: LogRecord, next: (record: LogRecord) => void): void {
    this.records.push(record);
    next(record);
  }
}
```

`ConsoleMiddleware` writes to `console.debug/info/warn/error`. It can add context
fields, span fields, and selected data fields to the output object.

`SpanLogMiddleware` samples with `Math.random()` and writes to `record.span` when
a span is present. It is not deterministic unless `samplingRate` is `1`.

## Production Boundaries

Use this package for in-process trace structure and middleware hooks. Keep these
boundaries explicit in production code:

- Provide your own middleware for remote delivery, redaction, buffering,
  retries, and failure handling.
- Do not put secrets or large payloads in `params`, span attributes, or log data
  unless your middleware filters them.
- Treat `ConsoleMiddleware` as direct console output, not a structured transport
  guarantee.
- Treat sampling as process-local random sampling, not fleet-wide deterministic
  sampling.
- Call `endSpan(error?)` in `finally` or equivalent cleanup paths so the context
  head is restored.

## Development

Install with the lockfile:

```bash
pnpm install --frozen-lockfile
```

Run the local checks:

```bash
npm run verify
git diff --check
git diff --cached --check
```

`npm run verify` matches CI. It type-checks, lints, runs the test suite, and
executes the package smoke test.

`npm run pack:dry-run` rebuilds the package and prints the files that would be
published to npm. It does not install or execute the packed package.

`npm run pack:smoke` builds the package, creates the real npm tarball, installs
that tarball into a temporary project, and runs a root import with a minimal
`Context` and `Logger` flow. Run it before publishing or changing package
exports, `files`, build output, or public entrypoints.

## Release

Before publishing, run the full development check set and `npm run pack:smoke`.
The smoke test is the release boundary check: it proves the packed tarball can be
installed and imported from a clean temporary project.

Patch, minor, and major helpers are available:

```bash
npm run publish:patch
npm run publish:minor
npm run publish:major
```

Each helper runs `npm version ...` followed by `npm publish --access public`.
The `prepublishOnly` lifecycle runs `npm run pack:smoke` immediately before the
publish step, so direct `npm publish` and the helper scripts both execute the
release boundary check before uploading a package. Run the full development
check set before invoking a helper because the version bump happens before the
publish lifecycle starts.

## Architecture Notes

See [ARCH.md](./ARCH.md) for implementation notes on context trees, span trees,
logger middleware, and historical design notes. `ARCH.md` is not a roadmap; the
API contract and production boundaries in this README remain authoritative.

## License

MIT License. See [LICENSE](LICENSE).
