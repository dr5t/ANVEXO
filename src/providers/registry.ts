import { ConfigManager } from '../core/config.js';
import type { ModelProvider, ProviderId, ModelInfo } from './types.js';
import { OfflineHeuristicProvider } from './offline.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { GeminiProvider } from './gemini.js';
import { OllamaProvider } from './ollama.js';

export class ProviderRegistry {
  private providers: Map<ProviderId, ModelProvider> = new Map();
  private configManager: ConfigManager;

  constructor(configManager?: ConfigManager) {
    this.configManager = configManager || new ConfigManager();
    this.initProviders();
  }

  private initProviders(): void {
    const offline = new OfflineHeuristicProvider();
    const anthropicKey = this.configManager.getApiKey('anthropic');
    const openaiKey = this.configManager.getApiKey('openai');
    const geminiKey = this.configManager.getApiKey('gemini');

    const anthropic = new AnthropicProvider(anthropicKey);
    const openai = new OpenAIProvider(openaiKey);
    const gemini = new GeminiProvider(geminiKey);
    const ollama = new OllamaProvider();

    this.providers.set('offline', offline);
    this.providers.set('anthropic', anthropic);
    this.providers.set('openai', openai);
    this.providers.set('gemini', gemini);
    this.providers.set('ollama', ollama);
  }

  getProvider(id: ProviderId): ModelProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Unknown model provider: ${id}. Available providers: ${[...this.providers.keys()].join(', ')}`);
    }
    return provider;
  }

  getActiveProvider(): ModelProvider {
    const prefs = this.configManager.loadUserPreferences();
    const id = prefs.activeProvider || 'offline';
    return this.getProvider(id);
  }

  setActiveProvider(id: ProviderId, model?: string): void {
    this.getProvider(id); // validates existence
    const prefs = this.configManager.loadUserPreferences();
    prefs.activeProvider = id;
    if (model) {
      prefs.activeModel = model;
    }
    this.configManager.saveUserPreferences(prefs);
  }

  async listAllModels(): Promise<ModelInfo[]> {
    const results: ModelInfo[] = [];
    for (const provider of this.providers.values()) {
      try {
        const models = await provider.listModels();
        results.push(...models);
      } catch {
        // Skip providers that fail to list models (e.g. offline ollama)
      }
    }
    return results;
  }

  listProviders(): Array<{ id: ProviderId; name: string; isConfigured: boolean }> {
    const prefs = this.configManager.loadUserPreferences();
    return [
      { id: 'offline', name: 'ANVEXO Heuristic Engine', isConfigured: true },
      { id: 'anthropic', name: 'Anthropic Claude', isConfigured: Boolean(this.configManager.getApiKey('anthropic')) },
      { id: 'openai', name: 'OpenAI GPT', isConfigured: Boolean(this.configManager.getApiKey('openai')) },
      { id: 'gemini', name: 'Google Gemini', isConfigured: Boolean(this.configManager.getApiKey('gemini')) },
      { id: 'ollama', name: 'Ollama (Local Models)', isConfigured: true },
    ];
  }
}

let defaultRegistryInstance: ProviderRegistry | null = null;

export function getDefaultProviderRegistry(): ProviderRegistry {
  if (!defaultRegistryInstance) {
    defaultRegistryInstance = new ProviderRegistry();
  }
  return defaultRegistryInstance;
}
