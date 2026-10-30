import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ToolRegistry } from '../../src/tools/registry.js';
import { createRunCommandTool, createTestRunTool, registerBuiltinTools } from '../../src/tools/builtin.js';
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
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'anvexo-non-git-'));
    try {
      const result = await registry.execute('git_status', { path: tempDirectory });
      expect(result.success).toBe(true);
      expect(result.output).toContain('Not a Git repository');
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it('file_search returns results for known pattern', async () => {
    pm.grant(PermissionScope.FILE_READ, '*', PermissionDecision.ALWAYS_ALLOW);
    const result = await registry.execute('file_search', {
      path: process.cwd(),
      pattern: 'anvexo',
    });
    expect(result.success).toBe(true);
    expect(result.output.toLowerCase()).toContain('anvexo');
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
      command: `"${process.execPath}" -e "process.stdout.write('hello')"`,
    });
    expect(result.success).toBe(true);
    expect(result.output).toContain('hello');
  });

  it('does not execute shell operators through command tools', async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'anvexo-command-boundary-'));
    const markerPath = path.join(temporaryDirectory, 'marker');
    const markerCommand = `"${process.execPath}" -e "require('node:fs').writeFileSync(process.argv[1], 'executed')" "${markerPath}"`;
    const command = `"${process.execPath}" -e "process.exit(0)"`;
    const operatorCommands = [
      `${command} && ${markerCommand}`,
      `${command} | ${markerCommand}`,
      `${command} > "${markerPath}"`,
      `${command} ; ${markerCommand}`,
    ];

    try {
      for (const operatorCommand of operatorCommands) {
        const result = await createRunCommandTool().execute({ path: temporaryDirectory, command: operatorCommand });
        expect(result.success).toBe(false);
        expect(fs.existsSync(markerPath)).toBe(false);
      }

      const testResult = await createTestRunTool().execute({
        path: temporaryDirectory,
        command: `${command} && ${markerCommand}`,
      });
      expect(testResult.success).toBe(false);
      expect(fs.existsSync(markerPath)).toBe(false);
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it('enforces Observe mode again at the command tool boundary', async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'anvexo-observe-boundary-'));
    const markerPath = path.join(temporaryDirectory, 'marker');
    const command = `"${process.execPath}" -e "require('node:fs').writeFileSync(process.argv[1], 'executed')" "${markerPath}"`;

    try {
      const result = await createRunCommandTool().execute({
        path: temporaryDirectory,
        command,
        autonomyMode: 'observe',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Observe mode');
      expect(fs.existsSync(markerPath)).toBe(false);
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it('file_search safely treats shell metacharacters and backticks as literal text', async () => {
    pm.grant(PermissionScope.FILE_READ, '*', PermissionDecision.ALWAYS_ALLOW);
    const result = await registry.execute('file_search', {
      path: process.cwd(),
      pattern: '`echo INJECTED_TEST`',
    });
    expect(result.success).toBe(true);
    expect(result.output.toLowerCase()).toContain(path.join('tests', 'unit', 'tools.test.ts').toLowerCase());
  });

  it('file_search does not follow directory symlinks outside the search root', async () => {
    pm.grant(PermissionScope.FILE_READ, '*', PermissionDecision.ALWAYS_ALLOW);
    const rootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'anvexo-search-root-'));
    const outsideDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'anvexo-search-outside-'));
    const linkPath = path.join(rootDirectory, 'external');
    fs.writeFileSync(path.join(outsideDirectory, 'secret.ts'), 'unique-external-marker');

    try {
      fs.symlinkSync(outsideDirectory, linkPath, 'junction');
      const result = await registry.execute('file_search', {
        path: rootDirectory,
        pattern: 'unique-external-marker',
      });
      expect(result.success).toBe(true);
      expect(result.output).not.toContain('unique-external-marker');
    } finally {
      fs.rmSync(rootDirectory, { recursive: true, force: true });
      fs.rmSync(outsideDirectory, { recursive: true, force: true });
    }
  });
});
