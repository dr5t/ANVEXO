import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { UserPreferences, ProviderId, McpServerConfig } from './types.js';

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'obsidian-slate',
  editorFont: 'JetBrains Mono, monospace',
  editorFontSize: 13,
  editorLineHeight: 1.6,
  editorTabSize: 2,
  editorLineNumbers: true,
  editorWordWrap: true,
  activeProvider: 'offline',
  activeModel: 'anvexo-heuristic-v1',
  providerKeys: {},
  mcpServers: [],
  plugins: [],
};

export interface AppConfig {
  defaultProvider: string;
  activeModel: string;
  preferences: {
    theme: string;
    fontSize: number;
    editorFont: string;
    editorFontSize: number;
    editorLineHeight: number;
    editorTabSize: number;
    editorLineNumbers: boolean;
    editorWordWrap: boolean;
    [key: string]: unknown;
  };
  providerKeys: Record<string, string>;
  mcpServers: McpServerConfig[];
  plugins: unknown[];
  [key: string]: unknown;
}

export class ConfigManager {
  private userConfigDir: string;
  private userConfigFile: string;

  constructor(customUserDir?: string) {
    this.userConfigDir = customUserDir || join(homedir(), '.anvexo');
    this.userConfigFile = join(this.userConfigDir, 'config.json');
  }

  getUserConfigDir(): string {
    return this.userConfigDir;
  }

  getUserConfigFile(): string {
    return this.userConfigFile;
  }

  ensureUserDir(): void {
    if (!existsSync(this.userConfigDir)) {
      mkdirSync(this.userConfigDir, { recursive: true });
    }
  }

  loadUserPreferences(): UserPreferences {
    this.ensureUserDir();
    if (!existsSync(this.userConfigFile)) {
      return { ...DEFAULT_USER_PREFERENCES };
    }
    try {
      const raw = readFileSync(this.userConfigFile, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_USER_PREFERENCES,
        ...parsed,
        activeProvider: parsed.defaultProvider || parsed.activeProvider || DEFAULT_USER_PREFERENCES.activeProvider,
        editorFontSize: parsed.preferences?.fontSize ?? parsed.editorFontSize ?? DEFAULT_USER_PREFERENCES.editorFontSize,
        theme: parsed.preferences?.theme ?? parsed.theme ?? DEFAULT_USER_PREFERENCES.theme,
        providerKeys: {
          ...DEFAULT_USER_PREFERENCES.providerKeys,
          ...(parsed.providerKeys || {}),
        },
        mcpServers: parsed.mcpServers || DEFAULT_USER_PREFERENCES.mcpServers,
        plugins: parsed.plugins || DEFAULT_USER_PREFERENCES.plugins,
      };
    } catch {
      return { ...DEFAULT_USER_PREFERENCES };
    }
  }

  saveUserPreferences(prefs: Partial<UserPreferences>): UserPreferences {
    this.ensureUserDir();
    const current = this.loadUserPreferences();
    const updated: UserPreferences = {
      ...current,
      ...prefs,
      providerKeys: {
        ...current.providerKeys,
        ...(prefs.providerKeys || {}),
      },
    };
    writeFileSync(this.userConfigFile, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  }

  getConfig(): AppConfig {
    const prefs = this.loadUserPreferences();
    return {
      defaultProvider: prefs.activeProvider,
      activeModel: prefs.activeModel,
      preferences: {
        theme: prefs.theme,
        fontSize: prefs.editorFontSize,
        editorFont: prefs.editorFont,
        editorFontSize: prefs.editorFontSize,
        editorLineHeight: prefs.editorLineHeight,
        editorTabSize: prefs.editorTabSize,
        editorLineNumbers: prefs.editorLineNumbers,
        editorWordWrap: prefs.editorWordWrap,
      },
      providerKeys: prefs.providerKeys,
      mcpServers: prefs.mcpServers,
      plugins: prefs.plugins,
    };
  }

  getPreferences(): AppConfig['preferences'] {
    return this.getConfig().preferences;
  }

  async set(key: string, value: unknown): Promise<void> {
    const prefs = this.loadUserPreferences();
    if (key === 'defaultProvider' && typeof value === 'string') {
      prefs.activeProvider = value as ProviderId;
    } else {
      (prefs as unknown as Record<string, unknown>)[key] = value;
    }
    this.saveUserPreferences(prefs);
  }

  get(key: string): unknown {
    const cfg = this.getConfig();
    if (key in cfg) {
      return cfg[key];
    }
    const prefs = this.loadUserPreferences() as unknown as Record<string, unknown>;
    return prefs[key];
  }

  async setPreference(key: string, value: unknown): Promise<void> {
    const prefs = this.loadUserPreferences();
    if (key === 'fontSize' && typeof value === 'number') {
      prefs.editorFontSize = value;
    } else if (key === 'theme' && typeof value === 'string') {
      prefs.theme = value;
    } else {
      (prefs as unknown as Record<string, unknown>)[key] = value;
    }
    this.saveUserPreferences(prefs);
  }

  getApiKey(provider: ProviderId): string | undefined {
    const envKeyMap: Record<ProviderId, string | undefined> = {
      anthropic: process.env.ANTHROPIC_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
      ollama: process.env.OLLAMA_API_KEY,
      offline: undefined,
    };

    const envVal = envKeyMap[provider];
    if (envVal && envVal.trim()) {
      return envVal.trim();
    }

    const prefs = this.loadUserPreferences();
    return prefs.providerKeys[provider];
  }

  setApiKey(provider: ProviderId, key: string): void {
    const prefs = this.loadUserPreferences();
    prefs.providerKeys[provider] = key;
    this.saveUserPreferences(prefs);
  }

  async setProviderKey(provider: string, key: string): Promise<void> {
    this.setApiKey(provider as ProviderId, key);
  }

  getProviderKey(provider: string): string | undefined {
    return this.getApiKey(provider as ProviderId);
  }

  async addMcpServer(server: Partial<McpServerConfig> & { name: string }): Promise<void> {
    const prefs = this.loadUserPreferences();
    const serverConfig: McpServerConfig = {
      id: server.id || server.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      name: server.name,
      transport: server.transport || 'stdio',
      command: server.command,
      args: server.args,
      url: server.url,
      env: server.env,
      headers: server.headers,
      enabled: server.enabled !== false,
    };
    prefs.mcpServers = prefs.mcpServers.filter(s => s.name !== server.name && s.id !== serverConfig.id);
    prefs.mcpServers.push(serverConfig);
    this.saveUserPreferences(prefs);
  }

  listMcpServers(): McpServerConfig[] {
    return this.loadUserPreferences().mcpServers;
  }

  getMcpServer(nameOrId: string): McpServerConfig | undefined {
    return this.listMcpServers().find(s => s.name === nameOrId || s.id === nameOrId);
  }

  async removeMcpServer(nameOrId: string): Promise<boolean> {
    const prefs = this.loadUserPreferences();
    const beforeCount = prefs.mcpServers.length;
    prefs.mcpServers = prefs.mcpServers.filter(s => s.name !== nameOrId && s.id !== nameOrId);
    if (prefs.mcpServers.length !== beforeCount) {
      this.saveUserPreferences(prefs);
      return true;
    }
    return false;
  }

  loadProjectConfig(repoPath: string): Record<string, unknown> {
    const projectConfigFile = join(repoPath, '.anvexo', 'config.json');
    if (!existsSync(projectConfigFile)) {
      return {};
    }
    try {
      const raw = readFileSync(projectConfigFile, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  saveProjectConfig(repoPath: string, config: Record<string, unknown>): void {
    const anvexoDir = join(repoPath, '.anvexo');
    if (!existsSync(anvexoDir)) {
      mkdirSync(anvexoDir, { recursive: true });
    }
    const projectConfigFile = join(anvexoDir, 'config.json');
    writeFileSync(projectConfigFile, JSON.stringify(config, null, 2), 'utf-8');
  }
}
