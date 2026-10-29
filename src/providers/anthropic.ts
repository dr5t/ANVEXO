import type {
  ModelProvider,
  ModelInfo,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  ProviderId,
  ToolCallPayload,
} from './types.js';

export class AnthropicProvider implements ModelProvider {
  readonly id: ProviderId = 'anthropic';
  readonly name: string = 'Anthropic Claude';
  private apiKey?: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl: string = 'https://api.anthropic.com') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'claude-3-7-sonnet-20250219',
        name: 'Claude 3.7 Sonnet',
        provider: 'anthropic',
        contextWindow: 200_000,
        maxOutputTokens: 8_192,
        supportsStreaming: true,
        supportsToolCalling: true,
        isLocal: false,
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        contextWindow: 200_000,
        maxOutputTokens: 8_192,
        supportsStreaming: true,
        supportsToolCalling: true,
        isLocal: false,
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        provider: 'anthropic',
        contextWindow: 200_000,
        maxOutputTokens: 8_192,
        supportsStreaming: true,
        supportsToolCalling: true,
        isLocal: false,
      },
    ];
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key is not configured. Set ANTHROPIC_API_KEY or configure in ANVEXO settings.');
    }

    const systemMessages = request.messages.filter(m => m.role === 'system');
    const systemPrompt = systemMessages.map(m => m.content).join('\n\n');

    const conversationMessages = request.messages
      .filter(m => m.role !== 'system')
      .map(m => {
        if (m.role === 'tool') {
          return {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: m.toolCallId || 'call_0',
                content: m.content,
              },
            ],
          };
        }
        if (m.toolCalls && m.toolCalls.length > 0) {
          return {
            role: 'assistant',
            content: [
              ...(m.content ? [{ type: 'text', text: m.content }] : []),
              ...m.toolCalls.map(tc => ({
                type: 'tool_use',
                id: tc.id,
                name: tc.name,
                input: tc.arguments,
              })),
            ],
          };
        }
        return {
          role: m.role,
          content: m.content,
        };
      });

    const tools = (request.tools || []).map(t => ({
      name: t.name,
      description: t.description,
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Target file or directory path' },
          command: { type: 'string', description: 'Command to execute' },
          content: { type: 'string', description: 'Content to write' },
          pattern: { type: 'string', description: 'Search pattern' },
        },
      },
    }));

    const payload: Record<string, unknown> = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: request.maxTokens || 4096,
      messages: conversationMessages,
    };

    if (systemPrompt) payload.system = systemPrompt;
    if (tools.length > 0) payload.tools = tools;
    if (request.temperature !== undefined) payload.temperature = request.temperature;

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: request.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${errText}`);
    }

    const data = await res.json() as {
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
      stop_reason?: string;
      usage?: { input_tokens: number; output_tokens: number };
    };

    let textContent = '';
    const toolCalls: ToolCallPayload[] = [];

    for (const block of data.content || []) {
      if (block.type === 'text' && block.text) {
        textContent += block.text;
      } else if (block.type === 'tool_use' && block.id && block.name) {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input || {},
        });
      }
    }

    return {
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: data.stop_reason || 'stop',
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      } : undefined,
    };
  }

  async stream(request: CompletionRequest, onChunk: (chunk: CompletionChunk) => void): Promise<CompletionResponse> {
    const full = await this.complete(request);
    onChunk({ delta: full.content, isComplete: true });
    return full;
  }
}
