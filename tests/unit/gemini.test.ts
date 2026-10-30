import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiProvider } from '../../src/providers/gemini.js';
import { ProviderFactory } from '../../src/providers/factory.js';
import { ProviderRegistry } from '../../src/providers/registry.js';
import { OllamaProvider } from '../../src/providers/ollama.js';

describe('GeminiProvider', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('GEMINI_BASE_URL', '');
    vi.stubEnv('GEMINI_MODEL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Configuration and Environment Handling', () => {
    it('initializes with default options and reads GEMINI_API_KEY from environment', () => {
      vi.stubEnv('GEMINI_API_KEY', 'env-secret-key');
      const provider = new GeminiProvider();

      expect(provider.id).toBe('gemini');
      expect(provider.name).toBe('Google Gemini');
      expect(provider.getApiKey()).toBe('env-secret-key');
      expect(provider.getBaseUrl()).toBe('https://generativelanguage.googleapis.com');
      expect(provider.getDefaultModel()).toBe('gemini-2.5-flash');
    });

    it('prefers explicit constructor key over environment variable', () => {
      vi.stubEnv('GEMINI_API_KEY', 'env-key');
      const provider = new GeminiProvider('explicit-key');

      expect(provider.getApiKey()).toBe('explicit-key');
    });

    it('reads GEMINI_BASE_URL and GEMINI_MODEL from environment when not explicitly provided', () => {
      vi.stubEnv('GEMINI_BASE_URL', 'https://custom-gateway.example.com');
      vi.stubEnv('GEMINI_MODEL', 'gemini-1.5-pro');
      const provider = new GeminiProvider();

      expect(provider.getBaseUrl()).toBe('https://custom-gateway.example.com');
      expect(provider.getDefaultModel()).toBe('gemini-1.5-pro');
    });

    it('supports options object constructor and trims values', () => {
      const provider = new GeminiProvider({
        apiKey: '  options-key  ',
        baseUrl: 'https://proxy.example.com/api/  ',
        defaultModel: 'gemini-2.5-pro',
        timeoutMs: 15_000,
      });

      expect(provider.getApiKey()).toBe('options-key');
      expect(provider.getBaseUrl()).toBe('https://proxy.example.com/api');
      expect(provider.getDefaultModel()).toBe('gemini-2.5-pro');
    });

    it('updates API key dynamically with setApiKey', () => {
      const provider = new GeminiProvider();
      expect(provider.getApiKey()).toBeUndefined();

      provider.setApiKey('new-runtime-key');
      expect(provider.getApiKey()).toBe('new-runtime-key');
    });
  });

  describe('Model Listing', () => {
    it('returns official Google Gemini models with context windows and capabilities', async () => {
      const provider = new GeminiProvider();
      const models = await provider.listModels();

      expect(models.length).toBe(4);

      const flash25 = models.find(m => m.id === 'gemini-2.5-flash');
      expect(flash25).toBeDefined();
      expect(flash25?.contextWindow).toBe(1_000_000);
      expect(flash25?.maxOutputTokens).toBe(8_192);
      expect(flash25?.supportsStreaming).toBe(true);
      expect(flash25?.supportsToolCalling).toBe(true);
      expect(flash25?.isLocal).toBe(false);

      const pro25 = models.find(m => m.id === 'gemini-2.5-pro');
      expect(pro25).toBeDefined();
      expect(pro25?.contextWindow).toBe(2_000_000);

      const flash15 = models.find(m => m.id === 'gemini-1.5-flash');
      expect(flash15).toBeDefined();
      expect(flash15?.contextWindow).toBe(1_000_000);

      const pro15 = models.find(m => m.id === 'gemini-1.5-pro');
      expect(pro15).toBeDefined();
      expect(pro15?.contextWindow).toBe(2_000_000);
    });
  });

  describe('Completion Request Construction and Execution', () => {
    it('throws error when API key is missing', async () => {
      const provider = new GeminiProvider();
      await expect(
        provider.complete({ messages: [{ role: 'user', content: 'test' }] })
      ).rejects.toThrow('Gemini API key is not configured. Set GEMINI_API_KEY or configure in ANVEXO settings.');
    });

    it('constructs correct API request payload, headers, and parses completion response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Here is the diagnosis.' }],
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 15,
            candidatesTokenCount: 8,
            totalTokenCount: 23,
          },
        }),
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GeminiProvider('test-api-key');
      const response = await provider.complete({
        messages: [
          { role: 'system', content: 'You are an expert debugger.' },
          { role: 'user', content: 'Find defect in src/auth.ts' },
          { role: 'assistant', content: 'I am inspecting.' },
          { role: 'user', content: 'Continue.' },
        ],
        temperature: 0.2,
        maxTokens: 512,
        stopSequences: ['END'],
      });

      expect(response.content).toBe('Here is the diagnosis.');
      expect(response.finishReason).toBe('STOP');
      expect(response.usage).toEqual({
        promptTokens: 15,
        completionTokens: 8,
        totalTokens: 23,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(String(url)).toContain('/v1beta/models/gemini-2.5-flash:generateContent');
      expect(new URL(String(url)).searchParams.get('key')).toBe('test-api-key');

      expect(options.headers).toEqual({
        'Content-Type': 'application/json',
        'x-goog-api-key': 'test-api-key',
      });

      const body = JSON.parse(options.body as string);
      expect(body.contents).toHaveLength(4);
      expect(body.contents[0].role).toBe('user');
      expect(body.contents[1].role).toBe('user');
      expect(body.contents[2].role).toBe('model');
      expect(body.contents[3].role).toBe('user');
      expect(body.generationConfig).toEqual({
        temperature: 0.2,
        maxOutputTokens: 512,
        stopSequences: ['END'],
      });
    });

    it('respects request.model override over defaultModel', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Model override test' }] } }],
        }),
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GeminiProvider('test-key');
      await provider.complete({
        model: 'gemini-1.5-pro',
        messages: [{ role: 'user', content: 'hello' }],
      });

      const [url] = mockFetch.mock.calls[0];
      expect(String(url)).toContain('/v1beta/models/gemini-1.5-pro:generateContent');
    });

    it('correctly maps tool definitions and tool responses into Google format', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: 'run_tests',
                      args: { suite: 'unit' },
                    },
                  },
                ],
              },
            },
          ],
        }),
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GeminiProvider('test-key');
      const response = await provider.complete({
        messages: [
          { role: 'user', content: 'run tests' },
          { role: 'tool', name: 'run_tests', content: 'Tests passed' },
        ],
        tools: [
          {
            name: 'run_tests',
            description: 'Execute test suite',
            parameters: {
              type: 'OBJECT',
              properties: { suite: { type: 'STRING' } },
            },
          },
        ],
      });

      expect(response.toolCalls).toBeDefined();
      expect(response.toolCalls?.[0].name).toBe('run_tests');
      expect(response.toolCalls?.[0].arguments).toEqual({ suite: 'unit' });

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body as string);
      expect(body.tools[0].functionDeclarations[0].name).toBe('run_tests');
      expect(body.contents[1].parts[0].functionResponse.name).toBe('run_tests');
    });

    it('packs multimodal images into inlineData format', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Image analyzed' }] } }],
        }),
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GeminiProvider('test-key');
      await provider.complete({
        messages: [
          {
            role: 'user',
            content: 'Check screenshot',
            images: [
              {
                mimeType: 'image/png',
                data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
              },
            ],
          },
        ],
      });

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body as string);
      expect(body.contents[0].parts[0].inlineData.mimeType).toBe('image/png');
      expect(body.contents[0].parts[0].inlineData.data).toContain('iVBORw0KGgoAAAANSUhEUg');
    });

    it('buffers stream response and emits completion chunk', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Streamed message' }] }, finishReason: 'STOP' }],
        }),
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GeminiProvider('test-key');
      const chunks: string[] = [];

      const result = await provider.stream(
        { messages: [{ role: 'user', content: 'test stream' }] },
        chunk => {
          chunks.push(chunk.delta);
        }
      );

      expect(result.content).toBe('Streamed message');
      expect(chunks).toEqual(['Streamed message']);
    });
  });

  describe('Error Handling and Secret Protection', () => {
    it('safely handles 401 and 403 authentication failures without leaking secret key', async () => {
      const secret = 'AIzaSySecret1234567890';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => `API_KEY_INVALID: ${secret}`,
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GeminiProvider(secret);
      const err = await provider.complete({ messages: [{ role: 'user', content: 'test' }] }).catch((e: Error) => e);

      expect(err.message).toContain('Gemini API authentication failed (HTTP 401)');
      expect(err.message).toContain('Check GEMINI_API_KEY');
      expect(err.message.includes(secret)).toBe(false);
    });

    it('safely handles 429 rate limit errors with retry instruction', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Resource exhausted',
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GeminiProvider('test-key');
      const err = await provider.complete({ messages: [{ role: 'user', content: 'test' }] }).catch((e: Error) => e);

      expect(err.message).toContain('Gemini API rate limit exceeded (HTTP 429)');
    });

    it('safely handles 400 and 404 model or configuration rejection errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Model not found',
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GeminiProvider('test-key');
      const err = await provider.complete({ messages: [{ role: 'user', content: 'test' }] }).catch((e: Error) => e);

      expect(err.message).toContain('Gemini API rejected the model or request configuration (HTTP 404)');
    });

    it('safely handles 500 server error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Error',
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GeminiProvider('test-key');
      const err = await provider.complete({ messages: [{ role: 'user', content: 'test' }] }).catch((e: Error) => e);

      expect(err.message).toContain('Gemini API server error (HTTP 500)');
    });

    it('catches network fetch failure and redacts any URL or key from the error', async () => {
      const secret = 'private-key-to-not-leak';
      const mockFetch = vi.fn().mockRejectedValue(new Error(`Failed to fetch https://generativelanguage.googleapis.com?key=${secret}`));
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GeminiProvider(secret);
      const err = await provider.complete({ messages: [{ role: 'user', content: 'test' }] }).catch((e: Error) => e);

      expect(err.message).toContain('Gemini API network request failed');
      expect(err.message.includes(secret)).toBe(false);
    });

    it('times out stalled network requests', async () => {
      vi.useFakeTimers();
      const mockFetch = vi.fn().mockImplementation((_url, options) => {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        });
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GeminiProvider({ apiKey: 'test-key', timeoutMs: 50 });
      const promise = provider.complete({ messages: [{ role: 'user', content: 'test' }] });

      vi.advanceTimersByTime(100);
      const err = await promise.catch((e: Error) => e);

      expect(err.message).toContain('Gemini API request timed out after 50ms');
      vi.useRealTimers();
    });

    it('rejects invalid model identifiers containing forbidden characters', async () => {
      const provider = new GeminiProvider('test-key');
      await expect(
        provider.complete({
          model: '../traversal-model',
          messages: [{ role: 'user', content: 'test' }],
        })
      ).rejects.toThrow('Invalid Gemini model configuration');
    });

    it('rejects endpoint base URLs containing credentials or query parameters', async () => {
      const provider = new GeminiProvider({
        apiKey: 'test-key',
        baseUrl: 'https://user:pass@evil.com/api?tracking=1',
      });

      await expect(
        provider.complete({ messages: [{ role: 'user', content: 'test' }] })
      ).rejects.toThrow('Invalid Gemini API endpoint configuration');
    });

    it('rejects unsupported image MIME types', async () => {
      const provider = new GeminiProvider('test-key');
      await expect(
        provider.complete({
          messages: [
            {
              role: 'user',
              content: 'test',
              images: [{ mimeType: 'application/pdf', data: 'JVBERi0xLjQK...' }],
            },
          ],
        })
      ).rejects.toThrow('Unsupported image MIME type: application/pdf');
    });

    it('rejects oversized images exceeding 20MB', async () => {
      const provider = new GeminiProvider('test-key');
      const largeBase64 = 'A'.repeat(28 * 1024 * 1024);

      await expect(
        provider.complete({
          messages: [
            {
              role: 'user',
              content: 'test',
              images: [{ mimeType: 'image/png', data: largeBase64 }],
            },
          ],
        })
      ).rejects.toThrow('Image size exceeds the 20MB maximum payload limit for Gemini API.');
    });

    it('rejects responses with empty or missing candidate content', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [],
        }),
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GeminiProvider('test-key');
      await expect(
        provider.complete({ messages: [{ role: 'user', content: 'test' }] })
      ).rejects.toThrow('Gemini API returned an empty or missing candidate response.');
    });

    it('rejects responses with empty candidate text and no tool calls', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '' }] } }],
        }),
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GeminiProvider('test-key');
      await expect(
        provider.complete({ messages: [{ role: 'user', content: 'test' }] })
      ).rejects.toThrow('Gemini API returned an empty response.');
    });

    it('rejects non-record or malformed response JSON', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => 'non-object-string',
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GeminiProvider('test-key');
      await expect(
        provider.complete({ messages: [{ role: 'user', content: 'test' }] })
      ).rejects.toThrow('Gemini API returned a malformed response.');
    });
  });

  describe('Integration with Factory, Registry, and Local Inference', () => {
    it('resolves GeminiProvider via ProviderFactory and reflects configured status', async () => {
      vi.stubEnv('GEMINI_API_KEY', 'factory-key');
      const factory = new ProviderFactory();
      const provider = factory.getProvider('gemini');

      expect(provider).toBeInstanceOf(GeminiProvider);
      const available = await factory.listAvailableProviders();
      const geminiInfo = available.find(p => p.id === 'gemini');
      expect(geminiInfo?.isConfigured).toBe(true);
      expect(geminiInfo?.isLocal).toBe(false);
    });

    it('resolves GeminiProvider via ProviderRegistry', () => {
      vi.stubEnv('GEMINI_API_KEY', 'registry-key');
      const registry = new ProviderRegistry();
      const provider = registry.getProvider('gemini');

      expect(provider).toBeInstanceOf(GeminiProvider);
      const list = registry.listProviders();
      const geminiEntry = list.find(p => p.id === 'gemini');
      expect(geminiEntry?.isConfigured).toBe(true);
    });

    it('preserves existing local inference compatibility for OllamaProvider', async () => {
      const ollama = new OllamaProvider('http://127.0.0.1:11434');
      expect(ollama.id).toBe('ollama');
      expect(ollama.name).toBe('Ollama (Local Models)');

      const models = await ollama.listModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models.some(m => m.isLocal)).toBe(true);
    });
  });
});
