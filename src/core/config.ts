import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { UserPreferences, ProviderId } from './types.js';

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
        providerKeys: {
          ...DEFAULT_USER_PREFERENCES.providerKeys,
          ...(parsed.providerKeys || {}),
        },
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
