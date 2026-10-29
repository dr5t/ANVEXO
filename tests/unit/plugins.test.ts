import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { PluginManager } from '../../src/plugins/index.js';

describe('Plugin System', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anvexo-plugins-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('validates compliant plugin manifests', () => {
    const pm = new PluginManager(tempDir);
    const validManifest = {
      id: 'my-plugin',
      name: 'My Plugin',
      version: '1.0.0',
      description: 'Useful extension',
      main: 'index.js',
      capabilities: ['git:read'],
    };
    const errors = pm.validateManifest(validManifest);
    expect(errors.length).toBe(0);
  });

  it('rejects invalid manifests missing required fields or having invalid capabilities', () => {
    const pm = new PluginManager(tempDir);
    const invalidManifest = {
      name: 'Missing Id',
      capabilities: ['invalid:capability'],
    };
    const errors = pm.validateManifest(invalidManifest);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('id'))).toBe(true);
    expect(errors.some((e) => e.includes('capability'))).toBe(true);
  });

  it('installs valid plugin from directory and lists it', async () => {
    const pluginSource = path.join(tempDir, 'source-plugin');
    fs.mkdirSync(pluginSource, { recursive: true });
    fs.writeFileSync(
      path.join(pluginSource, 'anvexo-plugin.json'),
      JSON.stringify({
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.2.0',
        description: 'Test plugin description',
        main: 'index.js',
        capabilities: ['file:read'],
      }),
      'utf-8',
    );

    const pm = new PluginManager(tempDir);
    const installRes = await pm.install(pluginSource);
    expect(installRes.success).toBe(true);

    const plugins = await pm.listPlugins();
    expect(plugins.some((p) => p.manifest.id === 'test-plugin')).toBe(true);

    const toggleRes = await pm.togglePlugin('test-plugin', false);
    expect(toggleRes).toBe(true);
    expect(pm.getPlugin('test-plugin')?.enabled).toBe(false);

    const uninstallRes = await pm.uninstall('test-plugin');
    expect(uninstallRes).toBe(true);
    expect(pm.getPlugin('test-plugin')).toBeUndefined();
  });
});
