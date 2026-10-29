import type { ToolDefinition, ToolResult } from '../core/index.js';
import { ToolExecutionError, logger } from '../core/index.js';
import type { PermissionManager } from '../permissions/index.js';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor(private permissions: PermissionManager) {}

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    logger.debug('tools', `Registered tool: ${tool.name}`);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolExecutionError(name, 'Tool not found');
    }

    await this.permissions.require({
      scope: tool.requiredPermission,
      resource: typeof args.path === 'string' ? args.path : '*',
      description: `Execute tool: ${tool.name}`,
      risk: tool.risk,
    });

    const start = Date.now();
    try {
      const result = await tool.execute(args);
      const duration = Date.now() - start;
      logger.info('tools', `${name} completed in ${duration}ms (success=${result.success})`);
      return { ...result, duration };
    } catch (err) {
      const duration = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      logger.error('tools', `${name} failed after ${duration}ms: ${message}`);
      return {
        success: false,
        output: '',
        error: message,
        duration,
        metadata: {},
      };
    }
  }
}
