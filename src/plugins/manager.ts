import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { AnvexoError, PermissionScope, PluginManifest } from '../core/types.js';

export class PluginManager {
  private repoPath?: string;
  private userPluginsDir: string;

  constructor(repoPathOrUserDir?: string) {
    if (repoPathOrUserDir && !repoPathOrUserDir.includes('.anvexo')) {
      this.repoPath = repoPathOrUserDir;
      this.userPluginsDir = join(homedir(), '.anvexo', 'plugins');
    } else {
      this.userPluginsDir = repoPathOrUserDir || join(homedir(), '.anvexo', 'plugins');
    }
  }

  ensureUserDir(): void {
    if (!existsSync(this.userPluginsDir)) {
      mkdirSync(this.userPluginsDir, { recursive: true });
    }
  }

  validateManifest(raw: unknown): string[] {
    const errors: string[] = [];
    if (!raw || typeof raw !== 'object') {
      errors.push('Manifest must be a JSON object');
      return errors;
    }
    const obj = raw as Record<string, unknown>;
    if (!obj.id || typeof obj.id !== 'string') {
      errors.push('Missing required string field: id');
    }
    if (!obj.name || typeof obj.name !== 'string') {
      errors.push('Missing required string field: name');
    }
    if (!obj.version || typeof obj.version !== 'string') {
      errors.push('Missing required string field: version');
    }
    const allowedCapabilities = [
      'file:read',
      'file:write',
      'file:delete',
      'command:execute',
      'git:read',
      'git:write',
      'test:run',
      'network',
      'plugin:install',
      'plugin:execute',
      'mcp:connect',
    ];
    if (Array.isArray(obj.capabilities)) {
      for (const cap of obj.capabilities) {
        if (!allowedCapabilities.includes(String(cap))) {
          errors.push(`Invalid capability requested: ${String(cap)}`);
        }
      }
    }
    return errors;
  }

  parseManifest(raw: unknown): PluginManifest {
    const errors = this.validateManifest(raw);
    if (errors.length > 0) {
      throw new AnvexoError(`Invalid plugin manifest: ${errors.join(', ')}`, 'INVALID_PLUGIN_MANIFEST', false);
    }
    const obj = raw as Record<string, unknown>;
    const permissions: PermissionScope[] = [];
    if (Array.isArray(obj.capabilities)) {
      for (const c of obj.capabilities) {
        permissions.push(c as PermissionScope);
      }
    } else if (Array.isArray(obj.permissions)) {
      for (const p of obj.permissions) {
        permissions.push(p as PermissionScope);
      }
    }

    return {
      id: String(obj.id),
      name: String(obj.name),
      version: String(obj.version),
      description: typeof obj.description === 'string' ? obj.description : '',
      entryPoint: typeof obj.entryPoint === 'string' ? obj.entryPoint : (typeof obj.main === 'string' ? obj.main : 'index.js'),
      author: typeof obj.author === 'string' ? obj.author : undefined,
      permissions,
      tools: Array.isArray(obj.tools) ? (obj.tools as string[]) : [],
      commands: Array.isArray(obj.commands) ? (obj.commands as string[]) : [],
      enabled: obj.enabled !== false,
      installedAt: obj.installedAt ? new Date(obj.installedAt as string) : new Date(),
    };
  }

  listProjectPlugins(repoPath?: string): PluginManifest[] {
    const targetRepo = repoPath || this.repoPath;
    const list: PluginManifest[] = [];
    if (!targetRepo) {
      return list;
    }
    const pluginsDir = join(targetRepo, '.anvexo', 'plugins');
    if (!existsSync(pluginsDir)) {
      return list;
    }
    const entries = readdirSync(pluginsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestFile = join(pluginsDir, entry.name, 'anvexo-plugin.json');
        if (existsSync(manifestFile)) {
          try {
            const raw = JSON.parse(readFileSync(manifestFile, 'utf-8'));
            list.push(this.parseManifest(raw));
          } catch {
            continue;
          }
        }
      }
    }
    return list;
  }

  listUserPlugins(): PluginManifest[] {
    const list: PluginManifest[] = [];
    if (!existsSync(this.userPluginsDir)) {
      return list;
    }
    const entries = readdirSync(this.userPluginsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestFile = join(this.userPluginsDir, entry.name, 'anvexo-plugin.json');
        if (existsSync(manifestFile)) {
          try {
            const raw = JSON.parse(readFileSync(manifestFile, 'utf-8'));
            list.push(this.parseManifest(raw));
          } catch {
            continue;
          }
        }
      }
    }
    return list;
  }

  listAllPlugins(repoPath?: string): PluginManifest[] {
    const map = new Map<string, PluginManifest>();
    for (const p of this.listUserPlugins()) {
      map.set(p.id, p);
    }
    const targetRepo = repoPath || this.repoPath;
    if (targetRepo) {
      for (const p of this.listProjectPlugins(targetRepo)) {
        map.set(p.id, p);
      }
    }
    return Array.from(map.values());
  }

  async listPlugins(repoPath?: string): Promise<Array<{ manifest: PluginManifest; enabled: boolean }>> {
    const all = this.listAllPlugins(repoPath);
    return all.map((m) => ({ manifest: m, enabled: m.enabled }));
  }

  getPlugin(id: string, repoPath?: string): { manifest: PluginManifest; enabled: boolean } | undefined {
    const all = this.listAllPlugins(repoPath);
    const found = all.find((p) => p.id === id);
    if (!found) return undefined;
    return { manifest: found, enabled: found.enabled };
  }

  installPlugin(manifest: PluginManifest, destination: 'user' | 'project' = 'project', repoPath?: string): void {
    const targetRepo = repoPath || this.repoPath;
    const targetBase = destination === 'project' && targetRepo
      ? join(targetRepo, '.anvexo', 'plugins')
      : this.userPluginsDir;

    if (!existsSync(targetBase)) {
      mkdirSync(targetBase, { recursive: true });
    }

    const pluginDir = join(targetBase, manifest.id);
    if (!existsSync(pluginDir)) {
      mkdirSync(pluginDir, { recursive: true });
    }

    const manifestFile = join(pluginDir, 'anvexo-plugin.json');
    writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  async install(pluginDir: string): Promise<{ success: boolean; plugin?: { manifest: PluginManifest }; error?: string }> {
    try {
      const manifestPath = join(pluginDir, 'anvexo-plugin.json');
      if (!existsSync(manifestPath)) {
        return { success: false, error: 'anvexo-plugin.json not found in directory' };
      }
      const raw = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      const manifest = this.parseManifest(raw);
      this.installPlugin(manifest, this.repoPath ? 'project' : 'user', this.repoPath);
      return { success: true, plugin: { manifest } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  uninstallPlugin(id: string, destination: 'user' | 'project' = 'project', repoPath?: string): boolean {
    const targetRepo = repoPath || this.repoPath;
    const targetBase = destination === 'project' && targetRepo
      ? join(targetRepo, '.anvexo', 'plugins')
      : this.userPluginsDir;

    const pluginDir = join(targetBase, id);
    if (existsSync(pluginDir)) {
      rmSync(pluginDir, { recursive: true, force: true });
      return true;
    }
    return false;
  }

  async uninstall(id: string): Promise<boolean> {
    const uninstalledProject = this.uninstallPlugin(id, 'project', this.repoPath);
    const uninstalledUser = this.uninstallPlugin(id, 'user');
    return uninstalledProject || uninstalledUser;
  }

  async togglePlugin(id: string, enabled: boolean, destination: 'user' | 'project' = 'project', repoPath?: string): Promise<boolean> {
    const targetRepo = repoPath || this.repoPath;
    const targetBase = destination === 'project' && targetRepo
      ? join(targetRepo, '.anvexo', 'plugins')
      : this.userPluginsDir;

    const manifestFile = join(targetBase, id, 'anvexo-plugin.json');
    if (!existsSync(manifestFile)) {
      return false;
    }
    try {
      const raw = JSON.parse(readFileSync(manifestFile, 'utf-8'));
      raw.enabled = enabled;
      writeFileSync(manifestFile, JSON.stringify(raw, null, 2), 'utf-8');
      return true;
    } catch {
      return false;
    }
  }
}
