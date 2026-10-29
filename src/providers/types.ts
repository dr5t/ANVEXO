import type {
  ProviderId,
  ModelInfo,
  ModelConfig,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  ModelProvider,
  ChatMessage,
  ToolCallPayload,
} from '../core/types.js';

export type {
  ProviderId,
  ModelInfo,
  ModelConfig,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  ModelProvider,
  ChatMessage,
  ToolCallPayload,
};

export interface ProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}
