import type {
  ModelProvider,
  ModelInfo,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  ProviderId,
  ToolCallPayload,
} from './types.js';

export class OllamaProvider implements ModelProvider {
  readonly id: ProviderId = 'ollama';
  readonly name: string = 'Ollama (Local Models)';
  private baseUrl: string;

  constructor(baseUrl: string = 'http://127.0.0.1:11434') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { method: 'GET' });
      if (!res.ok) {
        return this.fallbackModels();
      }
      const data = await res.json() as { models?: Array<{ name: string; size?: number }> };
      if (!data.models || data.models.length === 0) {
        return this.fallbackModels();
      }
      return data.models.map(m => ({
        id: m.name,
        name: `${m.name} (Local)`,
        provider: 'ollama',
        contextWindow: 32_000,
        maxOutputTokens: 4_096,
        supportsStreaming: true,
        supportsToolCalling: true,
        isLocal: true,
      }));
    } catch {
      return this.fallbackModels();
    }
  }

  private fallbackModels(): ModelInfo[] {
    return [
      {
        id: 'llama3:latest',
        name: 'Llama 3 (Local)',
        provider: 'ollama',
        contextWindow: 8_192,
        maxOutputTokens: 4_096,
        supportsStreaming: true,
        supportsToolCalling: true,
        isLocal: true,
      },
      {
        id: 'qwen2.5-coder:latest',
        name: 'Qwen 2.5 Coder (Local)',
        provider: 'ollama',
        contextWindow: 32_000,
        maxOutputTokens: 8_192,
        supportsStreaming: true,
        supportsToolCalling: true,
        isLocal: true,
      },
      {
        id: 'deepseek-coder:latest',
        name: 'DeepSeek Coder (Local)',
        provider: 'ollama',
        contextWindow: 16_000,
        maxOutputTokens: 4_096,
        supportsStreaming: true,
        supportsToolCalling: true,
        isLocal: true,
      },
    ];
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const messages = request.messages.map(m => ({
      role: m.role === 'tool' ? 'user' : m.role,
      content: m.content,
    }));

    const tools = (request.tools || []).map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            command: { type: 'string' },
            content: { type: 'string' },
            pattern: { type: 'string' },
          },
        },
      },
    }));

    const body: Record<string, unknown> = {
      model: 'qwen2.5-coder:latest',
      messages,
      stream: false,
    };
    if (tools.length > 0) body.tools = tools;

    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: request.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Ollama request failed (${res.status}): ${err}`);
      }

      const data = await res.json() as {
        message?: {
          content?: string;
          tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>;
        };
        prompt_eval_count?: number;
        eval_count?: number;
      };

      const toolCalls: ToolCallPayload[] = (data.message?.tool_calls || []).map((tc, idx) => ({
        id: `call_${Date.now()}_${idx}`,
        name: tc.function.name,
        arguments: tc.function.arguments || {},
      }));

      return {
        content: data.message?.content || '',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: 'stop',
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to connect to Ollama at ${this.baseUrl}: ${msg}. Ensure ollama serve is running locally.`);
    }
  }

  async stream(request: CompletionRequest, onChunk: (chunk: CompletionChunk) => void): Promise<CompletionResponse> {
    const full = await this.complete(request);
    onChunk({ delta: full.content, isComplete: true });
    return full;
  }
}
