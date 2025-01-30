# @bagaking/welog

一个 **轻量级** 但 **功能完整** 的 Tracing 系统，提供 context 模式的调用链上下文管理，tracing api 和高度集成的 logging 系统。

## ✨ 特性

- 🔄 **完整的上下文追踪**：基于 immutable `Context` 的上下文传递，支持显式 fork 子 context，也支持在生命 submodule 或扩展上下文参数时隐式 fork，在整个 context tree 中保持 traceId 一致。
- 📊 **精确的操作追踪**：基于 `Span` 的操作单元追踪，自动记录时间、错误等信息，支持父子 Span 关系等。
- 📝 **集成的日志系统**：基于 `Logger` 的日志记录，自动关联追踪信息，支持多级别日志，支持插件，支持自定义 log 输入（提供 web 的 console.log 默认插件） 。
- 🔧 **开发友好**：完整的 TypeScript 类型支持，零外部依赖，简单易用的 API。

## 📦 安装

```bash
# 使用 npm
npm install @bagaking/welog

# 使用 yarn
yarn add @bagaking/welog

# 使用 pnpm
pnpm add @bagaking/welog
```

## 🚀 快速开始

### 基础使用

```typescript
import { newContext } from '@bagaking/welog';

// 创建根 Context
const ctx = newContext({ module: 'app' });

// 开始一个操作
const span = ctx.startSpan('operation');

// 记录日志
ctx.getLogger().info('Processing...', { data: 'example' });

// 结束操作
span.end();
```

### 子 Context 和并发

```typescript
async function subOperation(ctx: Context) {
  // 创建子 Context
  const subCtx = ctx.forWithParams({ module: 'sub' });
  
  const span = subCtx.startSpan('sub-operation');
  try {
    // 执行操作...
    subCtx.getLogger().info('Sub operation running');
  } finally {
    span.end();
  }
}
```

## 🎯 高级示例

### 控制台日志与采样

```typescript
import { newContext, ConsoleMiddleware, SpanLogMiddleware } from '@bagaking/welog';

// 创建带采样的日志中间件
const ctx = newContext({
  module: 'app',
  logger: {
    middlewares: [
      // 10% 采样率记录到 Span
      new SpanLogMiddleware({ samplingRate: 0.1 }),
      // 控制台输出包含上下文和 Span 信息
      new ConsoleMiddleware({ 
        includeContext: true, 
        includeSpan: true,
        // 自定义字段选择器
        fieldSelector: (record) => ({
          module: record.context?.get().module,
          operation: record.span?.get().name,
          ...record.data
        })
      })
    ]
  }
});

// 使用示例
const span = ctx.startSpan('user-login');
ctx.getLogger().info('User login attempt', { userId: '123' });
// 输出示例:
// {
//   level: 'info',
//   message: '  User login attempt',  // 缩进反映调用深度
//   module: 'app',
//   operation: 'user-login',
//   userId: '123',
//   timestamp: 1621234567890,
//   traceId: 'trace-xxx',
//   spanId: 'span-xxx'
// }
```

### 美化终端输出 (Node.js)

```typescript
import { newContext, LoggerMiddleware, LogRecord } from '@bagaking/welog';
import chalk from 'chalk';

// 创建美化终端输出的中间件
class ChalkMiddleware implements LoggerMiddleware {
  handle(record: LogRecord, next: (record: LogRecord) => void): void {
    const indent = record.span ? '  '.repeat(record.span.get().depth) : '';
    const time = new Date(record.timestamp).toISOString();
    
    // 根据日志级别使用不同颜色
    const level = this.colorizeLevel(record.level);
    const message = `${indent}${record.message}`;
    
    // 美化输出
    console.log(
      `${chalk.gray(time)} ${level} ${chalk.white(message)}`,
      record.data ? chalk.gray(JSON.stringify(record.data)) : ''
    );
    
    next(record);
  }
  
  private colorizeLevel(level: string): string {
    switch (level) {
      case 'debug': return chalk.gray('DEBUG');
      case 'info': return chalk.blue('INFO ');
      case 'warn': return chalk.yellow('WARN ');
      case 'error': return chalk.red('ERROR');
      default: return level;
    }
  }
}

// 使用示例
const ctx = newContext({
  module: 'app',
  logger: {
    middlewares: [
      new SpanLogMiddleware(),
      new ChalkMiddleware()
    ]
  }
});
```

### 远程日志中间件

```typescript
import { newContext, LoggerMiddleware, LogRecord } from '@bagaking/welog';

// 创建远程日志中间件
class RemoteLogMiddleware implements LoggerMiddleware {
  constructor(private endpoint: string) {}
  
  async handle(record: LogRecord, next: (record: LogRecord) => void): Promise<void> {
    try {
      // 构建日志数据
      const logData = {
        level: record.level,
        message: record.message,
        timestamp: record.timestamp,
        data: record.data,
        context: record.context ? {
          traceId: record.context.get().traceId,
          module: record.context.get().module
        } : undefined,
        span: record.span ? {
          id: record.span.get().id,
          name: record.span.get().name,
          depth: record.span.get().depth
        } : undefined
      };
      
      // 异步发送到远程服务器
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData)
      });
    } catch (error) {
      console.error('Failed to send log to remote server:', error);
    }
    
    next(record);
  }
}

// 使用示例
const ctx = newContext({
  module: 'app',
  logger: {
    middlewares: [
      new SpanLogMiddleware(),
      new RemoteLogMiddleware('https://logs.example.com/collect')
    ]
  }
});
```

### Web 端 Trace 树可视化

```typescript
import { newContext, SpanNode } from '@bagaking/welog';

// 创建用于可视化的中间件
class TraceViewerMiddleware implements LoggerMiddleware {
  private container: HTMLElement;
  
  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
  }
  
  handle(record: LogRecord, next: (record: LogRecord) => void): void {
    // 更新视图
    if (record.context) {
      this.updateView(record.context);
    }
    next(record);
  }
  
  private updateView(context: Context): void {
    // 获取完整的调用树
    const tree = context.getGlobalSpanTree();
    // 渲染树结构
    this.container.innerHTML = this.renderTree(tree);
  }
  
  private renderTree(node: SpanNode): string {
    const span = node.span;
    const hasError = span.status === 'error';
    const duration = span.endTime ? (span.endTime - span.startTime) : 'pending';
    
    return `
      <div class="trace-node ${hasError ? 'error' : ''}">
        <div class="node-header">
          <span class="name">${span.name}</span>
          <span class="duration">${duration}ms</span>
        </div>
        ${span.logs.length > 0 ? `
          <div class="logs">
            ${span.logs.map(log => `
              <div class="log ${log.level}">
                ${log.message}
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${node.children.length > 0 ? `
          <div class="children">
            ${node.children.map(child => this.renderTree(child)).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }
}

// 使用示例
const ctx = newContext({
  module: 'app',
  logger: {
    middlewares: [
      new SpanLogMiddleware(),
      new TraceViewerMiddleware('trace-container')
    ]
  }
});

// CSS 样式示例
const style = `
.trace-node {
  margin: 8px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.trace-node .node-header {
  display: flex;
  justify-content: space-between;
  font-weight: bold;
}

.trace-node .logs {
  margin: 8px 0;
  padding: 8px;
  background: #f5f5f5;
}

.trace-node .children {
  margin-left: 20px;
}

.trace-node.error {
  border-color: #ff4d4f;
}

.log {
  padding: 4px;
  margin: 2px 0;
}

.log.error { color: #ff4d4f; }
.log.warn { color: #faad14; }
.log.info { color: #1890ff; }
.log.debug { color: #8c8c8c; }
`;
```

## 📚 文档

- [架构设计](./ARCH.md)
  - [核心概念](./ARCH.md#核心概念)
  - [技术实现](./ARCH.md#技术实现)
  - [最佳实践](./ARCH.md#最佳实践)
  - [扩展性设计](./ARCH.md#扩展性设计)
  - [性能考虑](./ARCH.md#性能考虑)

## 🛠️ API 参考

### Context API
- `newContext(options?)`: 创建新的根 Context
- `context.forWithParams(options?)`: 创建子 Context
- `context.startSpan(name, attributes?)`: 开始新的操作
- `context.endSpan()`: 结束当前操作
- `context.getLogger()`: 获取 Logger 实例

### Span API
- `span.setAttributes(attributes)`: 设置属性
- `span.recordError(error)`: 记录错误
- `span.end()`: 结束操作
- `span.log(record)`: 记录日志

### Logger API
- `logger.debug(message, data?)`: 记录调试日志
- `logger.info(message, data?)`: 记录信息日志
- `logger.warn(message, data?)`: 记录警告日志
- `logger.error(message, error?, data?)`: 记录错误日志

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件
 