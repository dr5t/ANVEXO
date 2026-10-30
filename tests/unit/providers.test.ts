import { describe, it, expect } from 'vitest';
import {
  OfflineHeuristicProvider,
  AnthropicProvider,
  OpenAIProvider,
  GeminiProvider,
  OllamaProvider,
  ProviderRegistry,
  ProviderFactory,
} from '../../src/providers/index.js';

describe('Model Providers', () => {
  it('OfflineHeuristicProvider lists offline models', async () => {
    const provider = new OfflineHeuristicProvider();
    const models = await provider.listModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].id).toBe('anvexo-heuristic-v1');
    expect(models[0].isLocal).toBe(true);
    expect(models[0].provider).toBe('offline');
  });

  it('OfflineHeuristicProvider generates deterministic completion for prompts', async () => {
    const provider = new OfflineHeuristicProvider();
    const res = await provider.complete({
      messages: [{ role: 'user', content: 'Investigate failing authentication tests' }],
    });
    expect(res.content).toContain('ANVESHAN');
    expect(res.finishReason).toBe('stop');
    expect(res.usage?.totalTokens).toBeGreaterThan(0);
  });

  it('OfflineHeuristicProvider emits tool calls when tools are available and prompted', async () => {
    const provider = new OfflineHeuristicProvider();
    const res = await provider.complete({
      messages: [{ role: 'user', content: 'Check git status' }],
      tools: [
        {
          name: 'git_status',
          description: 'Git status',
          requiredPermission: 'git:read' as any,
          risk: 'low',
          execute: async () => ({ success: true, output: '', duration: 0, metadata: {} }),
        },
      ],
    });
    expect(res.toolCalls).toBeDefined();
    expect(res.toolCalls?.[0].name).toBe('git_status');
  });

  it('AnthropicProvider lists models and requires API key on completion', async () => {
    const provider = new AnthropicProvider();
    const models = await provider.listModels();
    expect(models.some(m => m.id.includes('claude-3-5-sonnet'))).toBe(true);

    await expect(
      provider.complete({ messages: [{ role: 'user', content: 'hello' }] })
    ).rejects.toThrow('Anthropic API key is not configured');
  });

  it('OpenAIProvider lists models and requires API key on completion', async () => {
    const provider = new OpenAIProvider();
    const models = await provider.listModels();
    expect(models.some(m => m.id === 'gpt-4o')).toBe(true);

    await expect(
      provider.complete({ messages: [{ role: 'user', content: 'hello' }] })
    ).rejects.toThrow('OpenAI API key is not configured');
  });

  it('GeminiProvider lists models and requires API key on completion', async () => {
    const provider = new GeminiProvider({ apiKey: '' });
    const models = await provider.listModels();
    expect(models.some(m => m.id.includes('gemini-2.5-flash'))).toBe(true);

    await expect(
      provider.complete({ messages: [{ role: 'user', content: 'hello' }] })
    ).rejects.toThrow('Gemini API key is not configured');
  });

  it('OllamaProvider lists fallback models when local server is offline', async () => {
    const provider = new OllamaProvider('http://127.0.0.1:54321');
    const models = await provider.listModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models.some(m => m.id.includes('llama3'))).toBe(true);
  });

  it('ProviderRegistry initializes with default providers and gets active', () => {
    const registry = new ProviderRegistry();
    const providers = registry.listProviders();
    expect(providers.map(p => p.id)).toContain('offline');
    expect(providers.map(p => p.id)).toContain('anthropic');
    expect(providers.map(p => p.id)).toContain('openai');

    const active = registry.getActiveProvider();
    expect(active.id).toBe('offline');
  });

  it('ProviderFactory lists available providers', async () => {
    const factory = new ProviderFactory();
    const available = await factory.listAvailableProviders();
    expect(available.some(p => p.id === 'offline')).toBe(true);
  });
});
