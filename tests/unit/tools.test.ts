import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../../src/tools/registry.js';
import { registerBuiltinTools } from '../../src/tools/builtin.js';
import { PermissionManager } from '../../src/permissions/manager.js';
import { PermissionScope, PermissionDecision, PermissionDeniedError } from '../../src/core/types.js';

describe('ToolRegistry', () => {
  let pm: PermissionManager;
  let registry: ToolRegistry;

  beforeEach(() => {
    pm = new PermissionManager();
    registry = new ToolRegistry(pm);
    registerBuiltinTools(registry);
  });

  it('registers all built-in tools', () => {
    const tools = registry.list();
    const names = tools.map(t => t.name);
    expect(names).toContain('file_read');
    expect(names).toContain('file_list');
    expect(names).toContain('file_search');
    expect(names).toContain('git_status');
    expect(names).toContain('git_log');
    expect(names).toContain('git_diff');
    expect(names).toContain('run_command');
    expect(tools.length).toBe(7);
  });

  it('throws on unknown tool', async () => {
    pm.grant(PermissionScope.FILE_READ, '*', PermissionDecision.ALWAYS_ALLOW);
    await expect(registry.execute('nonexistent_tool', {})).rejects.toThrow('Tool not found');
  });

  it('denies execution without permission', async () => {
    await expect(
      registry.execute('file_read', { path: '/tmp/test' })
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('file_read returns error for missing file', async () => {
    pm.grant(PermissionScope.FILE_READ, '*', PermissionDecision.ALWAYS_ALLOW);
    const result = await registry.execute('file_read', { path: '/nonexistent/file/path/xyz' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('file_list works on real directory', async () => {
    pm.grant(PermissionScope.FILE_READ, '*', PermissionDecision.ALWAYS_ALLOW);
    const result = await registry.execute('file_list', { path: process.cwd(), maxDepth: 1 });
    expect(result.success).toBe(true);
    expect(result.output.length).toBeGreaterThan(0);
  });

  it('git_status handles non-git directory gracefully', async () => {
    pm.grant(PermissionScope.GIT_READ, '*', PermissionDecision.ALWAYS_ALLOW);
    const result = await registry.execute('git_status', { path: '/tmp' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('Not a Git repository');
  });

  it('file_search returns results for known pattern', async () => {
    pm.grant(PermissionScope.FILE_READ, '*', PermissionDecision.ALWAYS_ALLOW);
    const result = await registry.execute('file_search', {
      path: process.cwd(),
      pattern: 'anvexo',
    });
    expect(result.success).toBe(true);
  });

  it('run_command fails without permission', async () => {
    await expect(
      registry.execute('run_command', { path: process.cwd(), command: 'echo hello' })
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('run_command succeeds with permission', async () => {
    pm.grant(PermissionScope.COMMAND_EXECUTE, '*', PermissionDecision.ALWAYS_ALLOW);
    const result = await registry.execute('run_command', {
      path: process.cwd(),
      command: 'echo hello',
    });
    expect(result.success).toBe(true);
    expect(result.output).toContain('hello');
  });

  it('file_search safely treats shell metacharacters and backticks as literal text', async () => {
    pm.grant(PermissionScope.FILE_READ, '*', PermissionDecision.ALWAYS_ALLOW);
    const result = await registry.execute('file_search', {
      path: process.cwd(),
      pattern: '`echo INJECTED_TEST`',
    });
    expect(result.success).toBe(true);
  });
});
