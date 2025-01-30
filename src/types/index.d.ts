// Context Types
export interface ContextData {
  /** 追踪ID */
  traceId: string;
  /** 父级 Context ID */
  parentId?: string;
  /** Context ID */
  id: string;
  /** 创建时间 */
  createdAt: number;
  /** 模块路径 */
  module?: string;
  /** 自定义参数 */
  params: Record<string, any>;
  /** Span Map */
  spans: Map<string, Span>;
  /** 当前活跃的 Span */
  headSpan: Span;
}

export interface ContextOptions {
  /** 父级 Context */
  parent?: Context<P>;
  /** 模块名称 */
  module?: string;
  /** 参数 */
  params?: Record<string, any>;
  /** Context 的根 Span 深度 */
  rootSpanDepth?: number;
}

export interface Context {
  /** 获取 Context 数据 */
  get(): Readonly<ContextData<P>>;
  
  /** 
   * 创建新的 Context
   * 建议：在调用子函数时使用 fork 以支持并发追踪
   * @param options - 配置选项，可包含 module 和 params
   */
  forWithParams(options?: Partial<Omit<ContextOptions<P>, 'parent'>>): Context<P>;

  /**
   * 开始新的 Span，自动将当前 head 作为父级
   * @param name - Span 名称
   * @param attributes - 初始属性
   */
  startSpan(name: string, attributes?: Record<string, unknown>): Span;

  /**
   * 结束当前 head span
   * @param error - 可选的错误对象
   * @returns 结束的 span
   */
  endSpan(error?: Error): Span;

  /**
   * 获取当前 Context 的 Span 树
   * @returns 当前 Context 的 Span 树结构
   */
  getLocalSpanTree(): SpanNode;

  /**
   * 获取包含所有子 Context 的完整 Span 树
   * @returns 完整的 Span 树结构
   */
  getGlobalSpanTree(): SpanNode;

  /**
   * 获取 Logger 实例
   */
  getLogger(): Logger;
}

// Span Types
export enum SpanStatus {
  ACTIVE = 'active',
  SUCCESS = 'success',
  ERROR = 'error'
}

export interface SpanData {
  /** Span ID */
  id: string;
  /** 追踪ID (来自 Context) */
  traceId: string;
  /** 父 Span ID */
  parentId?: string;
  /** 操作名称 */
  name: string;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime?: number;
  /** 状态 */
  status: SpanStatus;
  /** 错误信息 */
  error?: Error;
  /** 自定义属性 */
  attributes: Record<string, unknown>;
  /** 日志记录 */
  logs: LogRecord[];
  /** Span 在调用链中的深度 */
  depth: number;
}

export interface SpanOptions {
  /** 关联的 Context */
  context: Context<any>;
  /** 父 Span */
  parent?: Span;
  /** 操作名称 */
  name: string;
  /** 初始属性 */
  attributes?: Record<string, unknown>;
}

export interface Span {
  /** 获取 Span 数据 */
  get(): Readonly<SpanData>;

  /** 设置属性 */
  setAttributes(attributes: Record<string, unknown>): Span;

  /** 记录错误 */
  recordError(error: Error): Span;

  /** 结束 Span */
  end(): Span;

  /** 记录日志 */
  log(record: LogRecord): Span;
}

export interface SpanNode {
  span: SpanData;
  children: SpanNode[];
  /** 所属的 Context ID */
  contextId: string;
}

// Logger Types
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface LogRecord {
  /** 日志级别 */
  level: LogLevel;
  /** 日志消息 */
  message: string;
  /** 日志时间 */
  timestamp: number;
  /** 额外数据 */
  data?: Record<string, unknown>;
  /** 错误对象 */
  error?: Error;
  /** 关联的 Context */
  context?: Context;
  /** 关联的 Span */
  span?: Span;
}

export interface LoggerMiddlewareConfig {
  /** 采样率 (0-1) */
  samplingRate?: number;
  /** 是否输出 Context 字段 */
  includeContext?: boolean;
  /** 是否输出 Span 字段 */
  includeSpan?: boolean;
  /** 自定义字段选择器 */
  fieldSelector?: (record: LogRecord) => Record<string, unknown>;
}

export interface LoggerMiddleware {
  /** 处理日志记录 */
  handle(record: LogRecord, next: (record: LogRecord) => void): void;
}

export interface LoggerConfig {
  /** 中间件列表 */
  middlewares?: LoggerMiddleware[];
  /** 最小日志级别 */
  minLevel?: LogLevel;
}

export interface Logger {
  /** 记录日志 */
  log(level: LogLevel, message: string, data?: Record<string, unknown>): void;
  /** Debug 级别日志 */
  debug(message: string, data?: Record<string, unknown>): void;
  /** Info 级别日志 */
  info(message: string, data?: Record<string, unknown>): void;
  /** Warn 级别日志 */
  warn(message: string, data?: Record<string, unknown>): void;
  /** Error 级别日志 */
  error(message: string, error?: Error, data?: Record<string, unknown>): void;
} 