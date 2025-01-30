import type { Context, ContextData } from '../types';

/**
 * 生成唯一ID
 * 使用时间戳+随机数的组合确保在浏览器环境的唯一性
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 生成完整模块路径
 */
export function getFullModulePath(
  parent: Context | undefined,
  module: string | undefined
): string {
  if (!module) {
    return parent?.get().module || '';
  }
  
  const parentModule = parent?.get().module || '';
  return parentModule ? `${parentModule}.${module}` : module;
}

/**
 * 创建初始 Context 数据
 */
export function createContextData(
  options: {
    parent?: Context;
    module?: string;
    params?: Record<string, any>;
  }
): Omit<ContextData, 'spans' | 'headSpan'> {
  const { parent, module, params = {}} = options;
  
  return {
    traceId: parent?.get().traceId ?? generateId(),
    parentId: parent?.get().id,
    id: generateId(),
    createdAt: Date.now(),
    module: getFullModulePath(parent, module),
    params
  };
} 