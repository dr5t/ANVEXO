import { ConfigManager } from '../core/config.js';
import { ModelInfo, ModelProvider, ProviderId } from '../core/types.js';
import { AnthropicProvider } from './anthropic.js';
import { GeminiProvider } from './gemini.js';
import { OfflineModelProvider } from './offline.js';
import { OllamaProvider } from './ollama.js';
import { OpenAIProvider } from './openai.js';

export class ProviderFactory {
  private configManager: ConfigManager;
  private providers: Map<ProviderId, ModelProvider> = new Map();

  constructor(configManager?: ConfigManager) {
    this.configManager = configManager || new ConfigManager();
    this.initProviders();
  }

  private initProviders(): void {
    const anthropicKey = this.configManager.getApiKey('anthropic');
    const openaiKey = this.configManager.getApiKey('openai');
    const geminiKey = this.configManager.getApiKey('gemini');

    this.providers.set('offline', new OfflineModelProvider());
    this.providers.set('anthropic', new AnthropicProvider(anthropicKey));
    this.providers.set('openai', new OpenAIProvider(openaiKey));
    this.providers.set('gemini', new GeminiProvider(geminiKey));
    this.providers.set('ollama', new OllamaProvider());
  }

  getProvider(id: ProviderId): ModelProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      return this.providers.get('offline')!;
    }
    return provider;
  }

  getActiveProvider(): ModelProvider {
    const prefs = this.configManager.loadUserPreferences();
    return this.getProvider(prefs.activeProvider);
  }

  async listAvailableProviders(): Promise<Array<{
    id: ProviderId;
    name: string;
    isConfigured: boolean;
    isLocal: boolean;
  }>> {
    return [
      {
        id: 'offline',
        name: 'ANVEXO Heuristic Local Engine',
        isConfigured: true,
        isLocal: true,
      },
      {
        id: 'anthropic',
        name: 'Anthropic Claude',
        isConfigured: Boolean(this.configManager.getApiKey('anthropic')),
        isLocal: false,
      },
      {
        id: 'openai',
        name: 'OpenAI GPT',
        isConfigured: Boolean(this.configManager.getApiKey('openai')),
        isLocal: false,
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        isConfigured: Boolean(this.configManager.getApiKey('gemini')),
        isLocal: false,
      },
      {
        id: 'ollama',
        name: 'Ollama Local Daemon',
        isConfigured: true,
        isLocal: true,
      },
    ];
  }

  async listAllModels(): Promise<ModelInfo[]> {
    const result: ModelInfo[] = [];
    for (const provider of this.providers.values()) {
      try {
        const models = await provider.listModels();
        result.push(...models);
      } catch {
        continue;
      }
    }
    return result;
  }
}
