import type {
  ModelProvider,
  ModelInfo,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  ProviderId,
  ToolCallPayload,
} from './types.js';

export class GeminiProvider implements ModelProvider {
  readonly id: ProviderId = 'gemini';
  readonly name: string = 'Google Gemini';
  private apiKey?: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl: string = 'https://generativelanguage.googleapis.com') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
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

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not configured. Set GEMINI_API_KEY or configure in ANVEXO settings.');
    }

    const modelName = 'gemini-2.5-flash';
    const contents = request.messages.map(m => {
      let role = 'user';
      if (m.role === 'assistant') role = 'model';
      else if (m.role === 'system') role = 'user';

      const parts: Array<Record<string, unknown>> = [];
      if (m.content) {
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
      if (m.role === 'tool') {
        parts.push({
          functionResponse: {
            name: m.name || 'tool',
            response: { content: m.content },
          },
        });
      }
      return { role, parts };
    });

    const tools = request.tools && request.tools.length > 0 ? [
      {
        functionDeclarations: request.tools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: {
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
    if (tools) body.tools = tools;

    const url = `${this.baseUrl}/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const data = await res.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }>;
        };
        finishReason?: string;
      }>;
      usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number };
    };

    const candidate = data.candidates?.[0];
    let textContent = '';
    const toolCalls: ToolCallPayload[] = [];

    for (const part of candidate?.content?.parts || []) {
      if (part.text) {
        textContent += part.text;
      }
      if (part.functionCall) {
        toolCalls.push({
          id: `call_${Date.now()}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args || {},
        });
      }
    }

    return {
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: candidate?.finishReason || 'stop',
      usage: data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount,
        completionTokens: data.usageMetadata.candidatesTokenCount,
        totalTokens: data.usageMetadata.totalTokenCount,
      } : undefined,
    };
  }

  async stream(request: CompletionRequest, onChunk: (chunk: CompletionChunk) => void): Promise<CompletionResponse> {
    const full = await this.complete(request);
    onChunk({ delta: full.content, isComplete: true });
    return full;
  }
}
