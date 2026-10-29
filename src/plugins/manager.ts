import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { AnvexoError, PermissionScope, PluginManifest } from '../core/types.js';

export class PluginManager {
  private userPluginsDir: string;

  constructor(customUserDir?: string) {
    this.userPluginsDir = customUserDir || join(homedir(), '.anvexo', 'plugins');
  }

  ensureUserDir(): void {
    if (!existsSync(this.userPluginsDir)) {
      mkdirSync(this.userPluginsDir, { recursive: true });
    }
  }

  validateManifest(raw: unknown): PluginManifest {
    if (!raw || typeof raw !== 'object') {
      throw new AnvexoError('Plugin manifest must be a JSON object', 'INVALID_PLUGIN_MANIFEST', false);
    }
    const obj = raw as Record<string, unknown>;

    if (!obj.id || typeof obj.id !== 'string') {
      throw new AnvexoError('Plugin manifest missing required string field: id', 'INVALID_PLUGIN_MANIFEST', false);
    }
    if (!obj.name || typeof obj.name !== 'string') {
      throw new AnvexoError('Plugin manifest missing required string field: name', 'INVALID_PLUGIN_MANIFEST', false);
    }
    if (!obj.version || typeof obj.version !== 'string') {
      throw new AnvexoError('Plugin manifest missing required string field: version', 'INVALID_PLUGIN_MANIFEST', false);
    }

    const permissions: PermissionScope[] = [];
    if (Array.isArray(obj.permissions)) {
      for (const p of obj.permissions) {
        if (typeof p === 'string') {
          permissions.push(p as PermissionScope);
        }
      }
    }

    const tools: string[] = [];
    if (Array.isArray(obj.tools)) {
      for (const t of obj.tools) {
        if (typeof t === 'string') {
          tools.push(t);
        }
      }
    }

    const commands: string[] = [];
    if (Array.isArray(obj.commands)) {
      for (const c of obj.commands) {
        if (typeof c === 'string') {
          commands.push(c);
        }
      }
    }

    return {
      id: obj.id,
      name: obj.name,
      version: obj.version,
      description: typeof obj.description === 'string' ? obj.description : '',
      entryPoint: typeof obj.entryPoint === 'string' ? obj.entryPoint : 'index.js',
      author: typeof obj.author === 'string' ? obj.author : undefined,
      permissions,
      tools,
      commands,
      enabled: obj.enabled !== false,
      installedAt: obj.installedAt ? new Date(obj.installedAt as string) : new Date(),
    };
  }

  listProjectPlugins(repoPath: string): PluginManifest[] {
    const list: PluginManifest[] = [];
    const pluginsDir = join(repoPath, '.anvexo', 'plugins');
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
            list.push(this.validateManifest(raw));
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
            list.push(this.validateManifest(raw));
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
    if (repoPath) {
      for (const p of this.listProjectPlugins(repoPath)) {
        map.set(p.id, p);
      }
    }
    return Array.from(map.values());
  }

  installPlugin(manifest: PluginManifest, destination: 'user' | 'project', repoPath?: string): void {
    const targetBase = destination === 'project' && repoPath
      ? join(repoPath, '.anvexo', 'plugins')
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

  uninstallPlugin(id: string, destination: 'user' | 'project', repoPath?: string): boolean {
    const targetBase = destination === 'project' && repoPath
      ? join(repoPath, '.anvexo', 'plugins')
      : this.userPluginsDir;

    const pluginDir = join(targetBase, id);
    if (existsSync(pluginDir)) {
      rmSync(pluginDir, { recursive: true, force: true });
      return true;
    }
    return false;
  }

  togglePlugin(id: string, enabled: boolean, destination: 'user' | 'project', repoPath?: string): boolean {
    const targetBase = destination === 'project' && repoPath
      ? join(repoPath, '.anvexo', 'plugins')
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
