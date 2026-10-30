import type {
  ModelProvider,
  ModelInfo,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  ProviderId,
  ToolCallPayload,
} from './types.js';

export interface GeminiProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class GeminiProvider implements ModelProvider {
  readonly id: ProviderId = 'gemini';
  readonly name: string = 'Google Gemini';
  private apiKey?: string;
  private baseUrl: string;
  private defaultModel: string;
  private timeoutMs: number;

  constructor(apiKeyOrOptions?: string | GeminiProviderOptions, baseUrl?: string) {
    const envKey = process.env.GEMINI_API_KEY?.trim() || undefined;
    const envBaseUrl = process.env.GEMINI_BASE_URL?.trim() || undefined;
    const envModel = process.env.GEMINI_MODEL?.trim() || undefined;

    if (typeof apiKeyOrOptions === 'object' && apiKeyOrOptions !== null) {
      const key = apiKeyOrOptions.apiKey !== undefined ? apiKeyOrOptions.apiKey.trim() : envKey;
      this.apiKey = key || undefined;
      this.baseUrl = (apiKeyOrOptions.baseUrl?.trim() || envBaseUrl || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
      this.defaultModel = apiKeyOrOptions.defaultModel?.trim() || envModel || 'gemini-3.8-flash';
      this.timeoutMs = apiKeyOrOptions.timeoutMs ?? 30_000;
    } else {
      const key = apiKeyOrOptions !== undefined ? apiKeyOrOptions.trim() : envKey;
      this.apiKey = key || undefined;
      this.baseUrl = (baseUrl?.trim() || envBaseUrl || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
      this.defaultModel = envModel || 'gemini-3.8-flash';
      this.timeoutMs = 30_000;
    }
  }

  setApiKey(key: string): void {
    const trimmed = key.trim();
    this.apiKey = trimmed || undefined;
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'gemini-3.8-flash',
        name: 'Gemini 3.8 Flash',
        provider: 'gemini',
        contextWindow: 1_000_000,
        maxOutputTokens: 65_536,
        supportsStreaming: true,
        supportsToolCalling: true,
        isLocal: false,
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'gemini',
        contextWindow: 1_000_000,
        maxOutputTokens: 8_192,
        supportsStreaming: true,
        supportsToolCalling: true,
        isLocal: false,
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: 'gemini',
        contextWindow: 2_000_000,
        maxOutputTokens: 8_192,
        supportsStreaming: true,
        supportsToolCalling: true,
        isLocal: false,
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        provider: 'gemini',
        contextWindow: 1_000_000,
        maxOutputTokens: 8_192,
        supportsStreaming: true,
        supportsToolCalling: true,
        isLocal: false,
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'gemini',
        contextWindow: 2_000_000,
        maxOutputTokens: 8_192,
        supportsStreaming: true,
        supportsToolCalling: true,
        isLocal: false,
      },
    ];
  }

  private validateImage(img: { data: string; mimeType: string }): void {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    if (!allowedMimes.includes(img.mimeType)) {
      throw new Error(`Unsupported image MIME type: ${img.mimeType}. Supported formats: ${allowedMimes.join(', ')}`);
    }
    const base64Data = img.data.replace(/^data:image\/[a-z]+;base64,/, '');
    const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
    if (sizeInBytes > 20 * 1024 * 1024) {
      throw new Error('Image size exceeds the 20MB maximum payload limit for Gemini API.');
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not configured. Set GEMINI_API_KEY or configure in ANVEXO settings.');
    }

    const modelName = request.model?.trim() || this.defaultModel;
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(modelName)) {
      throw new Error('Invalid Gemini model configuration. Set GEMINI_MODEL to a valid model identifier.');
    }

    let endpoint: URL;
    try {
      endpoint = new URL(this.baseUrl);
    } catch {
      throw new Error('Invalid Gemini API endpoint configuration. Base URL must be a valid HTTP(S) URL.');
    }
    if (!['http:', 'https:'].includes(endpoint.protocol)
      || endpoint.username
      || endpoint.password
      || endpoint.search
      || endpoint.hash) {
      throw new Error('Invalid Gemini API endpoint configuration. Use an HTTP(S) URL without credentials, query, or fragment.');
    }

    const contents = request.messages.map(m => {
      let role = 'user';
      if (m.role === 'assistant') role = 'model';
      else if (m.role === 'system') role = 'user';

      const parts: Array<Record<string, unknown>> = [];

      if (m.images && m.images.length > 0) {
        for (const img of m.images) {
          this.validateImage(img);
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.data.replace(/^data:image\/[a-z]+;base64,/, ''),
            },
          });
        }
      }

      if (m.role === 'tool') {
        parts.push({
          functionResponse: {
            name: m.name || 'tool',
            response: { content: m.content },
          },
        });
      } else if (m.content) {
        parts.push({ text: m.content });
      }

      if (m.toolCalls) {
        for (const tc of m.toolCalls) {
          parts.push({
            functionCall: {
              name: tc.name,
              args: tc.arguments,
            },
          });
        }
      }

      return { role, parts };
    });

    const tools = request.tools && request.tools.length > 0 ? [
      {
        functionDeclarations: request.tools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: (t as unknown as { parameters?: Record<string, unknown> }).parameters || {
            type: 'OBJECT',
            properties: {
              path: { type: 'STRING' },
              command: { type: 'STRING' },
              content: { type: 'STRING' },
              pattern: { type: 'STRING' },
            },
          },
        })),
      },
    ] : undefined;

    const body: Record<string, unknown> = {
      contents,
    };

    const generationConfig: Record<string, unknown> = {};
    if (request.temperature !== undefined) {
      generationConfig.temperature = request.temperature;
    }
    if (request.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = request.maxTokens;
    }
    const stopSequences = request.stopSequences;
    if (stopSequences && stopSequences.length > 0) {
      generationConfig.stopSequences = stopSequences;
    }
    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig;
    }

    if (tools) {
      body.tools = tools;
    }

    const url = `${this.baseUrl}/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    const abortRequest = () => controller.abort();
    if (request.signal) {
      if (request.signal.aborted) {
        controller.abort();
      } else {
        request.signal.addEventListener('abort', abortRequest, { once: true });
      }
    }

    try {
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch {
        if (timedOut) {
          throw new Error(`Gemini API request timed out after ${this.timeoutMs}ms.`);
        }
        if (request.signal?.aborted) {
          throw new Error('Gemini API request was aborted.');
        }
        throw new Error('Gemini API network request failed. Check connectivity and GEMINI_BASE_URL.');
      }

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error(`Gemini API authentication failed (HTTP ${res.status}). Check GEMINI_API_KEY and model access.`);
        }
        if (res.status === 429) {
          throw new Error('Gemini API rate limit exceeded (HTTP 429). Please retry after a brief backoff.');
        }
        if (res.status === 400 || res.status === 404) {
          throw new Error(`Gemini API rejected the model or request configuration (HTTP ${res.status}). Check GEMINI_MODEL and request settings.`);
        }
        if (res.status >= 500) {
          throw new Error(`Gemini API server error (HTTP ${res.status}). Please try again later.`);
        }
        throw new Error(`Gemini API request failed (HTTP ${res.status}).`);
      }

      let data: unknown;
      try {
        data = await res.json();
      } catch {
        if (timedOut) {
          throw new Error(`Gemini API request timed out after ${this.timeoutMs}ms.`);
        }
        if (request.signal?.aborted) {
          throw new Error('Gemini API request was aborted.');
        }
        throw new Error('Gemini API returned an invalid response payload.');
      }

      if (!isRecord(data)) {
        throw new Error('Gemini API returned a malformed response.');
      }

      const candidate = Array.isArray(data.candidates) && isRecord(data.candidates[0])
        ? data.candidates[0]
        : undefined;

      if (!candidate) {
        throw new Error('Gemini API returned an empty or missing candidate response.');
      }

      let textContent = '';
      const toolCalls: ToolCallPayload[] = [];

      if (isRecord(candidate.content) && Array.isArray(candidate.content.parts)) {
        for (const part of candidate.content.parts) {
          if (!isRecord(part)) {
            continue;
          }
          if (typeof part.text === 'string') {
            textContent += part.text;
          }
          if (isRecord(part.functionCall) && typeof part.functionCall.name === 'string') {
            const args = part.functionCall.args;
            if (!isRecord(args)) {
              throw new Error('Gemini API returned a malformed response.');
            }
            toolCalls.push({
              id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              name: part.functionCall.name,
              arguments: args,
            });
          }
        }
      }

      if (!textContent.trim() && toolCalls.length === 0) {
        throw new Error('Gemini API returned an empty response.');
      }

      let usage: CompletionResponse['usage'];
      if (isRecord(data.usageMetadata)) {
        const u = data.usageMetadata;
        if (typeof u.promptTokenCount === 'number'
          && typeof u.candidatesTokenCount === 'number'
          && typeof u.totalTokenCount === 'number') {
          usage = {
            promptTokens: u.promptTokenCount,
            completionTokens: u.candidatesTokenCount,
            totalTokens: u.totalTokenCount,
          };
        }
      }

      return {
        content: textContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: typeof candidate.finishReason === 'string' ? candidate.finishReason : 'stop',
        usage,
      };
    } finally {
      clearTimeout(timeout);
      request.signal?.removeEventListener('abort', abortRequest);
    }
  }

  async stream(request: CompletionRequest, onChunk: (chunk: CompletionChunk) => void): Promise<CompletionResponse> {
    const full = await this.complete(request);
    onChunk({ delta: full.content, isComplete: true });
    return full;
  }
}
