import type {
  ModelProvider,
  ModelInfo,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  ProviderId,
  ToolCallPayload,
} from './types.js';

export class OfflineHeuristicProvider implements ModelProvider {
  readonly id: ProviderId = 'offline';
  readonly name: string = 'ANVEXO Offline Heuristic Engine';

  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'anvexo-heuristic-v1',
        name: 'ANVEXO Heuristic v1 (Deterministic Offline)',
        provider: 'offline',
        contextWindow: 32_000,
        maxOutputTokens: 4_096,
        supportsStreaming: true,
        supportsToolCalling: true,
        isLocal: true,
      },
    ];
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const userMessages = request.messages.filter(m => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';
    const lastToolMessage = request.messages.filter(m => m.role === 'tool').pop();

    // Check if the user is asking to perform a task and we have tools available
    const availableTools = request.tools || [];
    const lowerPrompt = lastUserMessage.toLowerCase();

    // If we just received a tool result, synthesize an explanation of what happened
    if (lastToolMessage) {
      const summary = `Tool execution completed. The returned output has been incorporated into the investigation context:\n\n${lastToolMessage.content.slice(0, 1500)}${lastToolMessage.content.length > 1500 ? '\n... [truncated]' : ''}\n\nEvidence verified. Ready for next step or user confirmation.`;
      return {
        content: summary,
        finishReason: 'stop',
        usage: { promptTokens: 120, completionTokens: 60, totalTokens: 180 },
      };
    }

    // If tools are provided and the request indicates an inspection or action
    const toolCalls: ToolCallPayload[] = [];

    if (availableTools.length > 0) {
      if ((lowerPrompt.includes('status') || lowerPrompt.includes('git')) && availableTools.some(t => t.name === 'git_status')) {
        toolCalls.push({
          id: `call_${Date.now()}_1`,
          name: 'git_status',
          arguments: { path: '.' },
        });
      } else if ((lowerPrompt.includes('diff') || lowerPrompt.includes('change')) && availableTools.some(t => t.name === 'git_diff')) {
        toolCalls.push({
          id: `call_${Date.now()}_2`,
          name: 'git_diff',
          arguments: { path: '.' },
        });
      } else if ((lowerPrompt.includes('test') || lowerPrompt.includes('run test')) && availableTools.some(t => t.name === 'run_command')) {
        toolCalls.push({
          id: `call_${Date.now()}_3`,
          name: 'run_command',
          arguments: { path: '.', command: 'npm test' },
        });
      } else if ((lowerPrompt.includes('list') || lowerPrompt.includes('files') || lowerPrompt.includes('explore')) && availableTools.some(t => t.name === 'file_list')) {
        toolCalls.push({
          id: `call_${Date.now()}_4`,
          name: 'file_list',
          arguments: { path: '.', maxDepth: 2 },
        });
      }
    }

    if (toolCalls.length > 0) {
      return {
        content: `I will inspect the workspace using tool: ${toolCalls[0].name}.`,
        toolCalls,
        finishReason: 'tool_calls',
        usage: { promptTokens: 150, completionTokens: 40, totalTokens: 190 },
      };
    }

    // Default heuristic response
    let responseText = '';
    if (lowerPrompt.includes('investigate') || lowerPrompt.includes('bug') || lowerPrompt.includes('root cause')) {
      responseText = `## ANVESHAN Heuristic Analysis\n\n**Objective**: ${lastUserMessage}\n\n### Formulated Hypotheses:\n1. **Hypothesis 1**: Defect originated from recent unstaged changes or configuration mismatch.\n2. **Hypothesis 2**: Dependency or path resolution divergence across runtime environments.\n\n### Recommended Investigation Steps:\n- Run \`git status\` and \`git diff\` to inspect uncommitted changes.\n- Check recent test output via \`npm test\`.\n- Search for affected symbol definitions using \`file_search\`.\n\nExecute these steps directly or run with \`anvexo investigate .\` for a complete automated DAG.`;
    } else if (lowerPrompt.includes('plan') || lowerPrompt.includes('step')) {
      responseText = `### Structured Execution Plan\n\n1. **Workspace Topography**: Catalog package manifests, build tools, and test runner configurations.\n2. **Evidence Collection**: Scan recent commits and unstaged modifications.\n3. **Targeted Inspection**: Inspect source files referenced in the objective.\n4. **Verification**: Run affected tests within sandbox constraints.\n5. **Synthesis**: Correlate findings with historical knowledge in ECHO memory.`;
    } else {
      responseText = `ANVEXO Offline Heuristic Engine active. Received: "${lastUserMessage.trim()}".\n\nI can execute diagnostic tools, investigate codebase issues, review diffs, and inspect tests offline without external API dependencies. Use slash commands like \`/status\`, \`/diff\`, \`/test\`, or \`/help\` to inspect the workspace.`;
    }

    return {
      content: responseText,
      finishReason: 'stop',
      usage: {
        promptTokens: Math.max(10, Math.floor(lastUserMessage.length / 4)),
        completionTokens: Math.max(20, Math.floor(responseText.length / 4)),
        totalTokens: Math.max(30, Math.floor((lastUserMessage.length + responseText.length) / 4)),
      },
    };
  }

  async stream(request: CompletionRequest, onChunk: (chunk: CompletionChunk) => void): Promise<CompletionResponse> {
    const res = await this.complete(request);
    const words = res.content.split(' ');
    for (let i = 0; i < words.length; i++) {
      const delta = (i === 0 ? '' : ' ') + words[i];
      onChunk({
        delta,
        isComplete: i === words.length - 1,
      });
    }
    return res;
  }
}
