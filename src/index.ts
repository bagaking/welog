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
} from './types';

// Enums
export {
  SpanStatus,
  LogLevel
} from './types';

// Core APIs
export { newContext } from './context/context';
export { createLogger } from './logger';

// Middlewares
export {
  SpanLogMiddleware,
  ConsoleMiddleware
} from './logger/middlewares'; 