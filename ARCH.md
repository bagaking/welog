# Architecture Notes

This file records the current implementation shape and older design direction.
It is not a public API contract and not a roadmap. The supported package
contract is the README API section plus the TypeScript declarations shipped from
`dist/types`.

## 核心概念

### Context
- 作为核心容器，管理 Span 树和生命周期
- 内部维护当前 head span；外部读取通过接口返回受控数据
- 支持 fork 子 Context，用于并发场景
- 维护 traceId 在整个调用链中的一致性
- 通过 rootSpanDepth 控制 Span 深度

### Span
- 轻量级操作单元，记录具体操作
- 与 Context 紧密集成
- 维护父子关系，形成调用树
- 通过 depth 属性反映调用深度
- 支持属性、错误和日志记录

### Logger
- 提供灵活的日志记录功能
- 中间件机制支持可扩展性
- 与 Context 和 Span 自然集成
- 支持采样和字段选择
- 多级别日志支持

## 设计演进

### 初始设计
- Context 作为独立模块
- Span 作为独立模块
- Logger 作为独立模块

### 重构优化
1. 将 Span 移入 Context 模块，因为两者紧密关联
2. 统一类型定义到 types/index.d.ts
3. 简化 API 设计，如 newContext 替代 createRootContext

### Depth 处理演进
1. 最初作为 Context 的属性
2. 改为 Span 的属性，更符合语义
3. 最终设计：
   - Span.depth 表示在调用链中的深度
   - Context.rootSpanDepth 用于新 span 的深度计算
   - fork 时自动递增深度

## 实现特点

### 数据访问边界
- Context 通过方法管理 head span 和子 Context
- Span 数据的修改通过方法调用
- 公开读取结果会复制或冻结关键数据，避免调用方直接改内部状态

### 树形结构
- Context 树：通过 parent-child 关系
- Span 树：通过 parent-child 关系
- 支持局部树和全局树的获取

### 日志集成
- 自动关联 Context 和 Span
- SpanLogMiddleware 支持进程内随机采样
- 灵活的字段选择和格式化

## 技术实现

### Context 实现
- 使用 TypeScript 类实现，提供完整类型支持
- 内部维护 ContextData、children 集合和 Logger 实例
- 提供 fork、span 管理和树构建等核心功能
- 使用哨兵 Span 简化树结构管理

### Span 实现
- 轻量级数据结构，记录操作信息
- 支持属性设置、错误记录和日志记录
- 通过 depth 属性支持层级显示
- 与 Context 紧密集成，自动维护父子关系

### Logger 实现
- 基于中间件链的设计
- 支持多种日志级别（DEBUG、INFO、WARN、ERROR）
- 提供灵活的配置选项
- 自动关联 Context 和 Span 信息

### 中间件实现
1. SpanLogMiddleware
   - 支持日志采样
   - 自动记录日志到关联的 Span
2. ConsoleMiddleware
   - 灵活的字段选择
   - 支持 Context 和 Span 信息展示
   - 基于深度的日志缩进
   - 错误信息处理

## 最佳实践

### Context 使用
1. 在服务入口创建根 Context
2. 调用子函数时使用 fork
3. 保持 traceId 在调用链中的一致性
4. 合理使用 module 和 params 参数

### Span 使用
1. 使用有意义的操作名称
2. 及时结束 Span
3. 记录关键属性和错误信息
4. 注意控制 Span 的粒度

### 日志使用
1. 选择合适的日志级别
2. 配置合适的中间件
3. 使用采样控制日志量
4. 合理设置字段选择器

## 扩展性设计

### 中间件扩展
- 支持自定义中间件
- 灵活的中间件配置
- 链式处理机制
- 采样和过滤支持

### 序列化边界
- Context 和 Span 的公开数据结构可以被应用层读取并自行序列化
- 当前包不提供跨进程传递协议
- 当前包不提供持久化存储
- 当前包不提供分布式追踪协议或 OpenTelemetry bridge

### 监控集成边界
- 当前包提供 in-process context、span 和 middleware hooks
- 性能指标、调用链分析、错误统计和第三方监控集成需要由应用中间件实现
- README 的 Production Boundaries 是当前生产使用边界

## 性能考虑

### 内存优化
- 轻量级数据结构
- 调用方应及时结束 Span，避免长生命周期上下文积累过多数据
- 合理使用采样
- 避免冗余数据

### 并发处理
- fork 可表达子工作分支并复用 traceId
- 当前实现不提供跨线程同步原语
- 调用方仍需控制 Context 的生命周期和共享边界

### 日志性能
- 中间件接口是同步调用
- 当前包不提供异步日志 worker
- 当前包不提供批量写入或缓冲区管理
- 采样仅由 SpanLogMiddleware 在进程内执行

## Historical Design Ideas

The following ideas appeared in earlier architecture drafts. They are not
implemented in the current package and do not commit the project to a delivery
timeline.

### 功能方向
1. 分布式追踪 bridge 候选
2. 更多内置中间件
3. 性能分析工具
4. 可视化支持

### 性能方向
1. 内存池优化
2. 日志聚合
3. 索引优化
4. 压缩算法

### 生态方向
1. OpenTelemetry bridge 候选
2. 云平台集成
3. 监控系统集成
4. 日志分析工具
