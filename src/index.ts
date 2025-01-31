/**
 * @bagaking/welog
 * 一个轻量级但功能完整的 Tracing 系统
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
