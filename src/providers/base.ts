import {
  ChatMessage,
  CompletionChunk,
  CompletionRequest,
  CompletionResponse,
  ModelInfo,
  ModelProvider,
  ProviderId,
  ToolDefinition,
} from '../core/types.js';

export abstract class AbstractModelProvider implements ModelProvider {
  abstract readonly id: ProviderId;
  abstract readonly name: string;

  abstract listModels(): Promise<ModelInfo[]>;
  abstract complete(request: CompletionRequest): Promise<CompletionResponse>;

  async stream(
    request: CompletionRequest,
    onChunk: (chunk: CompletionChunk) => void,
  ): Promise<CompletionResponse> {
    const res = await this.complete(request);
    onChunk({
      delta: res.content,
      toolCallDelta: res.toolCalls && res.toolCalls.length > 0 ? res.toolCalls[0] : undefined,
      isComplete: true,
    });
    return res;
  }

  protected serializeToolsForPrompt(tools?: ToolDefinition[]): string {
    if (!tools || tools.length === 0) {
      return '';
    }
    const defs = tools.map((t) => ({
      name: t.name,
      description: t.description,
      permission: t.requiredPermission,
    }));
    return `\n\nAvailable tools:\n${JSON.stringify(defs, null, 2)}`;
  }

  protected formatMessagesPlain(messages: ChatMessage[]): string {
    return messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');
  }
}
