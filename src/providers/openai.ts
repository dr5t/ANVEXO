import type {
  ModelProvider,
  ModelInfo,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  ProviderId,
  ToolCallPayload,
} from './types.js';

export class OpenAIProvider implements ModelProvider {
  readonly id: ProviderId = 'openai';
  readonly name: string = 'OpenAI';
  private apiKey?: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl: string = 'https://api.openai.com') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        contextWindow: 128_000,
        maxOutputTokens: 16_384,
        supportsStreaming: true,
        supportsToolCalling: true,
        isLocal: false,
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        contextWindow: 128_000,
        maxOutputTokens: 16_384,
        supportsStreaming: true,
        supportsToolCalling: true,
        isLocal: false,
      },
      {
        id: 'o3-mini',
        name: 'o3-mini',
        provider: 'openai',
        contextWindow: 200_000,
        maxOutputTokens: 100_000,
        supportsStreaming: true,
        supportsToolCalling: true,
        isLocal: false,
      },
    ];
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured. Set OPENAI_API_KEY or configure in ANVEXO settings.');
    }

    const messages = request.messages.map(m => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: m.toolCallId || 'call_0',
          content: m.content,
        };
      }
      if (m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }
      return {
        role: m.role,
        content: m.content,
      };
    });

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

    const payload: Record<string, unknown> = {
      model: 'gpt-4o',
      messages,
    };

    if (tools.length > 0) payload.tools = tools;
    if (request.temperature !== undefined) payload.temperature = request.temperature;
    if (request.maxTokens !== undefined) payload.max_tokens = request.maxTokens;

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: request.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errText}`);
    }

    const data = await res.json() as {
      choices: Array<{
        message: {
          content?: string;
          tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
        };
        finish_reason?: string;
      }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const choice = data.choices?.[0];
    const textContent = choice?.message?.content || '';
    const toolCalls: ToolCallPayload[] = [];

    if (choice?.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments || '{}');
        } catch {
          parsedArgs = {};
        }
        toolCalls.push({
          id: tc.id,
          name: tc.function.name,
          arguments: parsedArgs,
        });
      }
    }

    return {
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: choice?.finish_reason || 'stop',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }

  async stream(request: CompletionRequest, onChunk: (chunk: CompletionChunk) => void): Promise<CompletionResponse> {
    const full = await this.complete(request);
    onChunk({ delta: full.content, isComplete: true });
    return full;
  }
}
