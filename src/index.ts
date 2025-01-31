/**
 * @bagaking/welog
 * 一个小型进程内 tracing/logging kernel
 */

// Core Types
export type {
  // Context
  Context,
  ContextData,
  ContextOptions,
  SpanNode,

  // Span
  Span,
  SpanData,
  SpanOptions,

  // Logger
  Logger,
  LoggerConfig,
  LoggerMiddleware,
  LoggerMiddlewareConfig,
  LogRecord
} from './types/index.js';

// Enums
export {
  SpanStatus,
  LogLevel
} from './types/index.js';

// Core APIs
export * from './context/context.js';
export { createLogger } from './logger/index.js';

// Middlewares
export {
  SpanLogMiddleware,
  ConsoleMiddleware
} from './logger/middlewares.js';
