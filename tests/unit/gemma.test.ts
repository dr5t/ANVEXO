import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GemmaProvider } from '../../src/providers/gemma.js';
import { ProviderRegistry, ProviderFactory } from '../../src/providers/index.js';
import { EvidenceType, VerificationStatus } from '../../src/core/types.js';

describe('GemmaProvider', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('GEMMA_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', '');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  describe('Configuration and Routing', () => {
    it('initializes with default options when no parameters are provided', () => {
      const provider = new GemmaProvider({ apiKey: '' });
      expect(provider.id).toBe('gemma');
      expect(provider.name).toContain('Gemma');
      expect(provider.getRoute()).toBe('local');
      expect(provider.getBaseUrl()).toBe('http://127.0.0.1:11434');
    });

    it('defaults to gemini-api route when apiKey is provided', () => {
      const provider = new GemmaProvider({ apiKey: 'test-api-key' });
      expect(provider.getRoute()).toBe('gemini-api');
      expect(provider.getBaseUrl()).toBe('https://generativelanguage.googleapis.com');
    });

    it('switches route and updates default base URL', () => {
      const provider = new GemmaProvider({ apiKey: 'test-key' });
      provider.setRoute('local');
      expect(provider.getRoute()).toBe('local');
      expect(provider.getBaseUrl()).toBe('http://127.0.0.1:11434');

      provider.setRoute('gemini-api', 'https://custom-proxy.example.com');
      expect(provider.getRoute()).toBe('gemini-api');
      expect(provider.getBaseUrl()).toBe('https://custom-proxy.example.com');
    });

    it('updates API key dynamically', () => {
      const provider = new GemmaProvider();
      provider.setApiKey('updated-secret-key');
      expect(provider.getRoute()).toBe('local');
    });
  });

  describe('Model Listing', () => {
    it('returns known Gemma models for gemini-api route with 256K context for Gemma 4', async () => {
      const provider = new GemmaProvider({ apiKey: 'dummy-key', route: 'gemini-api' });
      const models = await provider.listModels();

      expect(models.length).toBe(4);
      const gemma4Dense = models.find(m => m.id === 'gemma-4-31b-it');
      expect(gemma4Dense).toBeDefined();
      expect(gemma4Dense?.contextWindow).toBe(262144);
      expect(gemma4Dense?.supportsToolCalling).toBe(true);
      expect(gemma4Dense?.isLocal).toBe(false);

      const gemma4Moe = models.find(m => m.id === 'gemma-4-26b-a4b-it');
      expect(gemma4Moe).toBeDefined();
      expect(gemma4Moe?.contextWindow).toBe(262144);

      const gemma2 = models.find(m => m.id === 'gemma-2-27b-it');
      expect(gemma2?.contextWindow).toBe(8192);
    });

    it('queries local daemon tags endpoint and filters gemma models', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            { name: 'llama3:latest' },
            { name: 'gemma4:31b' },
            { name: 'mistral:latest' },
            { name: 'gemma2:9b' },
          ],
        }),
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GemmaProvider({ route: 'local' });
      const models = await provider.listModels();

      expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:11434/api/tags', { method: 'GET' });
      expect(models).toHaveLength(2);
      expect(models[0].id).toBe('gemma4:31b');
      expect(models[0].isLocal).toBe(true);
      expect(models[1].id).toBe('gemma2:9b');
    });

    it('falls back to default local models when local daemon is unreachable', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GemmaProvider({ route: 'local' });
      const models = await provider.listModels();

      expect(models).toHaveLength(2);
      expect(models.some(m => m.id === 'gemma4:latest')).toBe(true);
      expect(models.some(m => m.id === 'gemma2:9b')).toBe(true);
    });
  });

  describe('Completion via Gemini API Endpoint', () => {
    it('throws when apiKey is missing for gemini-api route', async () => {
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      const provider = new GemmaProvider({ route: 'gemini-api', apiKey: '' });
      await expect(
        provider.complete({ messages: [{ role: 'user', content: 'hello' }] })
      ).rejects.toThrow(/Gemma API key is not configured/);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('constructs correct payload and parses text response and token usage', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: { parts: [{ text: 'Gemma 4 analysis response' }] },
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

      const provider = new GemmaProvider({ apiKey: 'test-secret-key', route: 'gemini-api' });
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'Inspect issue' }],
        temperature: 0.1,
      });

      expect(response.content).toBe('Gemma 4 analysis response');
      expect(response.finishReason).toBe('STOP');
      expect(response.usage?.totalTokens).toBe(23);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent');
      expect(new URL(String(url)).searchParams.has('key')).toBe(true);

      const parsedBody = JSON.parse(options.body as string);
      expect(parsedBody.contents[0].parts[0].text).toBe('Inspect issue');
      expect(parsedBody.generationConfig.temperature).toBe(0.1);
    });

    it('extracts tool calls from functionCall response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: 'file_read',
                      args: { path: 'src/index.ts' },
                    },
                  },
                ],
              },
            },
          ],
        }),
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GemmaProvider({ apiKey: 'key', route: 'gemini-api' });
      const res = await provider.complete({
        messages: [{ role: 'user', content: 'read file' }],
      });

      expect(res.toolCalls).toBeDefined();
      expect(res.toolCalls?.[0].name).toBe('file_read');
      expect(res.toolCalls?.[0].arguments).toEqual({ path: 'src/index.ts' });
    });

    it('does not expose API response details for authentication failures', async () => {
      const secretKey = 'super-secret-key-12345';
      const backendDetails = `Permission denied for key ${secretKey}`;
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => backendDetails,
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GemmaProvider({ apiKey: secretKey, route: 'gemini-api' });
      const error = await provider.complete({ messages: [{ role: 'user', content: 'test' }] }).catch((reason: Error) => reason);
      expect(error.message).toMatch(/Gemma API authentication failed/);
      expect(error.message.includes(secretKey)).toBe(false);
      expect(error.message.includes(backendDetails)).toBe(false);
    });

    it('returns a safe network error when fetch throws an exception', async () => {
      const secretKey = 'secret-network-key-99999';
      const mockFetch = vi.fn().mockRejectedValue(new Error(`Fetch failed for URL with key ${secretKey}`));
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GemmaProvider({ apiKey: secretKey, route: 'gemini-api' });
      const error = await provider.complete({ messages: [{ role: 'user', content: 'test' }] }).catch((reason: Error) => reason);
      expect(error.message).toMatch(/Gemma API network request failed/);
      expect(error.message.includes(secretKey)).toBe(false);
    });

    it('reports invalid model configuration without making a request', async () => {
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      const provider = new GemmaProvider({
        apiKey: 'test-key',
        route: 'gemini-api',
        defaultModel: 'models/gemma-4?key=hidden',
      });

      await expect(
        provider.complete({ messages: [{ role: 'user', content: 'test' }] })
      ).rejects.toThrow(/Invalid Gemma model configuration/);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('rejects API endpoints containing credentials without exposing them', async () => {
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      const provider = new GemmaProvider({
        apiKey: 'test-key',
        route: 'gemini-api',
        baseUrl: 'https://user:password@example.com',
      });

      const error = await provider.complete({ messages: [{ role: 'user', content: 'test' }] }).catch((reason: Error) => reason);
      expect(error.message).toMatch(/Invalid Gemma API endpoint configuration/);
      expect(error.message.includes('user:password')).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('reports rejected models without exposing response details', async () => {
      const privateDetails = 'Unknown model; internal credential: backend-secret';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => privateDetails,
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      const provider = new GemmaProvider({ apiKey: 'test-key', route: 'gemini-api' });

      const error = await provider.complete({ messages: [{ role: 'user', content: 'test' }] }).catch((reason: Error) => reason);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toMatch(/rejected the model or request configuration/);
      expect(error.message.includes(privateDetails)).toBe(false);
    });

    it('times out a stalled API request without leaking request details', async () => {
      const mockFetch = vi.fn().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      }));
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      const provider = new GemmaProvider({ apiKey: 'test-key', route: 'gemini-api', timeoutMs: 5 });

      await expect(
        provider.complete({ messages: [{ role: 'user', content: 'test' }] })
      ).rejects.toThrow(/timed out after 5ms/);
    });

    it('times out while reading a stalled API response body', async () => {
      const mockFetch = vi.fn().mockImplementation((_url, options) => Promise.resolve({
        ok: true,
        json: () => new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        }),
      }));
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      const provider = new GemmaProvider({ apiKey: 'test-key', route: 'gemini-api', timeoutMs: 5 });

      await expect(
        provider.complete({ messages: [{ role: 'user', content: 'test' }] })
      ).rejects.toThrow(/timed out after 5ms/);
    });

    it('rejects invalid JSON and malformed or empty API responses', async () => {
      const provider = new GemmaProvider({ apiKey: 'test-key', route: 'gemini-api' });
      const invalidJsonFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => { throw new SyntaxError('sensitive response content'); },
      });
      globalThis.fetch = invalidJsonFetch as unknown as typeof fetch;
      await expect(
        provider.complete({ messages: [{ role: 'user', content: 'test' }] })
      ).rejects.toThrow('Gemma API returned malformed JSON.');

      const malformedFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ candidates: [] }),
      });
      globalThis.fetch = malformedFetch as unknown as typeof fetch;
      await expect(
        provider.complete({ messages: [{ role: 'user', content: 'test' }] })
      ).rejects.toThrow('Gemma API returned a malformed response.');

      const emptyFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [] } }] }),
      });
      globalThis.fetch = emptyFetch as unknown as typeof fetch;
      await expect(
        provider.complete({ messages: [{ role: 'user', content: 'test' }] })
      ).rejects.toThrow('Gemma API returned an empty response.');
    });
  });

  describe('Completion via Local Inference Endpoint', () => {
    it('formats prompt, options and handles local Ollama completion', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'Local Gemma response',
          eval_count: 12,
          prompt_eval_count: 8,
        }),
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GemmaProvider({ route: 'local' });
      const res = await provider.complete({
        messages: [{ role: 'user', content: 'run locally' }],
      });

      expect(res.content).toBe('Local Gemma response');
      expect(res.usage?.totalTokens).toBe(20);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://127.0.0.1:11434/api/generate');
      const body = JSON.parse(options.body as string);
      expect(body.model).toBe('gemma4:latest');
      expect(body.prompt).toContain('[USER]: run locally');
    });

    it('forwards multimodal images to local Ollama body when present', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: 'Image analyzed' }),
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GemmaProvider({ route: 'local' });
      await provider.complete({
        messages: [
          {
            role: 'user',
            content: 'check screenshot',
            images: [
              {
                mimeType: 'image/png',
                data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
              },
            ],
          },
        ],
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.images).toHaveLength(1);
      expect(body.images[0]).not.toContain('data:image');
    });

    it('throws informative error when local daemon returns non-OK status', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'model gemma4:latest not found',
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GemmaProvider({ route: 'local' });
      await expect(
        provider.complete({ messages: [{ role: 'user', content: 'test' }] })
      ).rejects.toThrow(/Local Gemma error \(404\)/);
    });

    it('throws connection failure message when daemon is offline', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GemmaProvider({ route: 'local' });
      await expect(
        provider.complete({ messages: [{ role: 'user', content: 'test' }] })
      ).rejects.toThrow(/Failed to reach local Gemma inference daemon/);
    });
  });

  describe('Stream Support', () => {
    it('buffers complete response and emits a completion chunk', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: 'streamed content' }),
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GemmaProvider({ route: 'local' });
      const chunks: string[] = [];
      const res = await provider.stream(
        { messages: [{ role: 'user', content: 'stream' }] },
        chunk => {
          chunks.push(chunk.delta);
          expect(chunk.isComplete).toBe(true);
        }
      );

      expect(res.content).toBe('streamed content');
      expect(chunks).toEqual(['streamed content']);
    });
  });

  describe('Image and Multimodal Validation', () => {
    it('rejects unsupported image MIME types', async () => {
      const provider = new GemmaProvider({ apiKey: 'k', route: 'gemini-api' });
      await expect(
        provider.complete({
          messages: [
            {
              role: 'user',
              content: 'pic',
              images: [{ mimeType: 'application/pdf', data: 'JVBERi0xLjQ...' }],
            },
          ],
        })
      ).rejects.toThrow(/Unsupported image MIME type/);
    });

    it('rejects image payloads exceeding 5MB', async () => {
      const provider = new GemmaProvider({ apiKey: 'k', route: 'gemini-api' });
      const oversizedPayload = 'A'.repeat(7 * 1024 * 1024);
      await expect(
        provider.complete({
          messages: [
            {
              role: 'user',
              content: 'huge',
              images: [{ mimeType: 'image/png', data: oversizedPayload }],
            },
          ],
        })
      ).rejects.toThrow(/Screenshot exceeds maximum allowed size of 5MB/);
    });
  });

  describe('investigateIssue Diagnostic Reasoning', () => {
    it('parses structured JSON embedded inside markdown code blocks', async () => {
      const mockResponse = 'Here is the diagnosis:\n```json\n{\n  "summary": "Buffer overflow in token parser",\n  "suspectedRootCause": "Off-by-one index calculation in parseTokens()",\n  "codeEvidence": [{"file": "src/parser.ts", "snippet": "for (let i = 0; i <= len; i++)"}],\n  "proposedFix": "Change <= to < in loop boundary",\n  "suggestedRegressionTests": ["npx vitest run tests/parser.test.ts"],\n  "confidence": 0.95,\n  "uncertainties": ["Needs dynamic run"]\n}\n```\nHope this helps!';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: { parts: [{ text: mockResponse }] },
            },
          ],
        }),
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GemmaProvider({ apiKey: 'key', route: 'gemini-api' });
      const result = await provider.investigateIssue({
        objective: 'Fix parser crash',
        repoPath: '/workspace',
        terminalLog: 'TypeError: Index out of range',
        gitDiff: '+ for (let i = 0; i <= len; i++)',
      });

      expect(result.summary).toBe('Buffer overflow in token parser');
      expect(result.suspectedRootCause).toContain('Off-by-one');
      expect(result.codeEvidence).toHaveLength(1);
      expect(result.proposedFix).toContain('Change <= to <');
      expect(result.confidence).toBe(0.95);
      expect(result.evidenceRecords).toHaveLength(1);
      expect(result.evidenceRecords[0].type).toBe(EvidenceType.FILE_CONTENT);
      expect(result.evidenceRecords[0].verificationStatus).toBe(VerificationStatus.UNVERIFIED);
      expect(result.evidenceRecords[0].metadata?.model).toBe('gemma-4-31b-it');
    });

    it('falls back safely to default properties when model returns malformed JSON', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: { parts: [{ text: 'Plain text diagnostic with no json block' }] },
            },
          ],
        }),
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GemmaProvider({ apiKey: 'key', route: 'gemini-api' });
      const result = await provider.investigateIssue({
        objective: 'General error check',
        repoPath: '/workspace',
      });

      expect(result.summary).toContain('Plain text diagnostic');
      expect(result.codeEvidence).toEqual([]);
      expect(result.confidence).toBe(0.8);
      expect(result.suggestedRegressionTests).toEqual(['npm test']);
      expect(result.evidenceRecords[0].verificationStatus).toBe(VerificationStatus.UNVERIFIED);
    });

    it('keeps model-generated visual observations unverified when a screenshot is supplied', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: 'Red button visual glitch',
                      suspectedRootCause: 'CSS overflow hidden',
                      visualEvidence: 'Red button is clipped by parent container',
                      proposedFix: 'Remove overflow: hidden',
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const provider = new GemmaProvider({ apiKey: 'key', route: 'gemini-api' });
      const result = await provider.investigateIssue({
        objective: 'Fix visual bug',
        repoPath: '/workspace',
        screenshot: {
          mimeType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          label: 'UI Error',
        },
      });

      expect(result.visualEvidence).toBe('Red button is clipped by parent container');
      expect(result.evidenceRecords).toHaveLength(2);
      const visualRecord = result.evidenceRecords.find(e => e.toolName === 'gemma_vision_parser');
      expect(visualRecord).toBeDefined();
      expect(visualRecord?.verificationStatus).toBe(VerificationStatus.UNVERIFIED);
      expect(visualRecord?.metadata?.mimeType).toBe('image/png');
    });
  });

  describe('Registry and Factory Resolution', () => {
    it('resolves gemma provider via ProviderRegistry', () => {
      const registry = new ProviderRegistry();
      const provider = registry.getProvider('gemma');
      expect(provider).toBeInstanceOf(GemmaProvider);
      expect(provider.id).toBe('gemma');
    });

    it('resolves gemma provider via ProviderFactory', async () => {
      const factory = new ProviderFactory();
      const provider = factory.getProvider('gemma');
      expect(provider).toBeInstanceOf(GemmaProvider);
      expect(provider.id).toBe('gemma');
    });
  });
});
