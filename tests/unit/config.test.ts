import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ConfigManager } from '../../src/core/config.js';

describe('ConfigManager', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anvexo-config-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('loads default configuration when no file exists', () => {
    const cm = new ConfigManager(tempDir);
    const config = cm.getConfig();
    expect(config.defaultProvider).toBe('offline');
    expect(config.preferences.theme).toBe('obsidian-slate');
    expect(config.preferences.fontSize).toBe(13);
  });

  it('sets and gets configuration values', async () => {
    const cm = new ConfigManager(tempDir);
    await cm.set('defaultProvider', 'anthropic');
    expect(cm.get('defaultProvider')).toBe('anthropic');

    await cm.setPreference('fontSize', 14);
    expect(cm.getPreferences().fontSize).toBe(14);
  });

  it('stores and retrieves provider API keys', async () => {
    const cm = new ConfigManager(tempDir);
    await cm.setProviderKey('openai', 'sk-test-key-12345');
    expect(cm.getProviderKey('openai')).toBe('sk-test-key-12345');
  });

  it('manages MCP server configurations', async () => {
    const cm = new ConfigManager(tempDir);
    await cm.addMcpServer({
      name: 'test-server',
      transport: 'stdio',
      command: 'node',
      args: ['server.js'],
      enabled: true,
    });

    const servers = cm.listMcpServers();
    expect(servers.length).toBe(1);
    expect(servers[0].name).toBe('test-server');
    expect(cm.getMcpServer('test-server')?.transport).toBe('stdio');

    await cm.removeMcpServer('test-server');
    expect(cm.listMcpServers().length).toBe(0);
  });
});
