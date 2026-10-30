import { randomUUID } from 'node:crypto';
import type {
  AgentMode,
  AgentPlan,
  AgentSession,
  AgentStepPlan,
  ChatMessage,
  ModelProvider,
  ToolResult,
} from '../core/types.js';
import type { PermissionManager } from '../permissions/index.js';
import type { RuleManager } from '../rules/index.js';
import type { SkillManager } from '../skills/index.js';
import type { ToolRegistry } from '../tools/index.js';
import { SafeAutonomyEngine, type AutonomyMode } from '../autonomy/index.js';
import { DecisionMemoryManager } from '../memory/index.js';

export interface AgentRuntimeOptions {
  repoPath: string;
  provider: ModelProvider;
  permissions: PermissionManager;
  tools: ToolRegistry;
  ruleManager: RuleManager;
  skillManager?: SkillManager;
  autonomyEngine?: SafeAutonomyEngine;
  decisionMemory?: DecisionMemoryManager;
  mode?: AgentMode;
  autonomyMode?: AutonomyMode;
  maxIterations?: number;
}

export interface AgentStepEvent {
  type: 'thought' | 'tool_start' | 'tool_end' | 'plan_ready' | 'waiting_approval' | 'done' | 'error';
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  stepId?: string;
}

export class AgentRuntime {
  private repoPath: string;
  private provider: ModelProvider;
  private permissions: PermissionManager;
  private tools: ToolRegistry;
  private ruleManager: RuleManager;
  private skillManager?: SkillManager;
  private defaultMode: AgentMode;
  private maxIterations: number;
  private sessions: Map<string, AgentSession> = new Map();
  private autonomyEngine: SafeAutonomyEngine;
  private decisionMemory: DecisionMemoryManager;

  constructor(options: AgentRuntimeOptions) {
    this.repoPath = options.repoPath;
    this.provider = options.provider;
    this.permissions = options.permissions;
    this.tools = options.tools;
    this.ruleManager = options.ruleManager;
    this.skillManager = options.skillManager;
    this.defaultMode = options.mode || 'interactive';
    this.maxIterations = options.maxIterations || 15;
    this.autonomyEngine = options.autonomyEngine || new SafeAutonomyEngine(options.autonomyMode || 'assisted');
    this.decisionMemory = options.decisionMemory || new DecisionMemoryManager(options.repoPath);
  }

  getAutonomyEngine(): SafeAutonomyEngine {
    return this.autonomyEngine;
  }

  getDecisionMemory(): DecisionMemoryManager {
    return this.decisionMemory;
  }

  createSession(mode?: AgentMode): AgentSession {
    const session: AgentSession = {
      id: randomUUID(),
      repositoryPath: this.repoPath,
      mode: mode || this.defaultMode,
      messages: [],
      status: 'idle',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(id: string): AgentSession | undefined {
    return this.sessions.get(id);
  }

  listSessions(): AgentSession[] {
    return [...this.sessions.values()];
  }

  getSkillManager(): SkillManager | undefined {
    return this.skillManager;
  }

  private buildSystemPrompt(): string {
    const rulesPrompt = this.ruleManager.buildSystemPrompt();
    const toolList = this.tools
      .list()
      .map((t) => `- ${t.name}: ${t.description} (Risk: ${t.risk})`)
      .join('\n');

    const sections = [
      'You are ANVEXO, an autonomous AI coding agent and software engineering investigator.',
      'Your workspace is: ' + this.repoPath,
      'When given an objective, plan carefully, use real tools to verify hypotheses, and make evidence-based changes.',
      'Always inspect files and run tests before claiming a problem is solved.',
      'Never claim to have executed a command or modified a file without invoking the corresponding tool.',
      rulesPrompt,
      'Available tools:',
      toolList,
    ];

    if (this.skillManager) {
      const skills = this.skillManager.listAllSkills(this.repoPath);
      if (skills.length > 0) {
        sections.push('Available skills:\n' + skills.map((s) => `- ${s.id}: ${s.description}`).join('\n'));
      }
    }

    const memoryPrompt = this.decisionMemory.buildAgentContextPrompt();
    if (memoryPrompt) {
      sections.push(memoryPrompt);
    }

    return sections.join('\n\n');
  }

  async createPlan(objective: string, session: AgentSession): Promise<AgentPlan> {
    session.status = 'planning';
    const planPrompt = [
      'Create a structured, step-by-step execution plan for the following objective:',
      objective,
      'Format each step with a concise title, planned tool invocation if applicable, and whether it mutates code or files.',
    ].join('\n\n');

    const messages: ChatMessage[] = [
      { role: 'system', content: this.buildSystemPrompt() },
      { role: 'user', content: planPrompt },
    ];

    const response = await this.provider.complete({
      messages,
      tools: this.tools.list(),
      temperature: 0.1,
    });

    const lines = response.content.split('\n').filter((l) => l.trim().length > 0);
    const steps: AgentStepPlan[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(/^(\d+\.|\-|\*)\s+(.+)$/);
      if (match) {
        const title = match[2].trim();
        const isMutation = title.toLowerCase().includes('write') ||
          title.toLowerCase().includes('edit') ||
          title.toLowerCase().includes('delete') ||
          title.toLowerCase().includes('apply') ||
          title.toLowerCase().includes('install');
        steps.push({
          id: `step-${i + 1}`,
          title,
          requiresApproval: isMutation,
          status: 'pending',
        });
      }
    }

    if (steps.length === 0) {
      steps.push({
        id: 'step-1',
        title: objective,
        requiresApproval: false,
        status: 'pending',
      });
    }

    const plan: AgentPlan = {
      goal: objective,
      steps,
      createdAt: new Date(),
      status: 'draft',
    };

    session.plan = plan;
    session.status = 'idle';
    return plan;
  }

  async run(
    userInput: string,
    session: AgentSession,
    onEvent?: (event: AgentStepEvent) => void,
    signal?: AbortSignal,
  ): Promise<AgentSession> {
    session.status = 'running';

    session.messages.push({
      role: 'user',
      content: userInput,
    });

    let iterations = 0;
    let keepGoing = true;

    while (keepGoing && iterations < this.maxIterations) {
      if (signal?.aborted) {
        session.status = 'idle';
        onEvent?.({ type: 'done', content: 'Agent execution aborted by user' });
        break;
      }

      iterations++;

      const completionMessages: ChatMessage[] = [
        { role: 'system', content: this.buildSystemPrompt() },
        ...session.messages,
      ];

      const availableTools = this.tools.list();

      let response;
      try {
        response = await this.provider.complete({
          messages: completionMessages,
          tools: availableTools,
          temperature: 0.2,
          signal,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        session.status = 'failed';
        onEvent?.({ type: 'error', content: `Model completion failed: ${msg}` });
        session.messages.push({
          role: 'assistant',
          content: `Error: ${msg}`,
        });
        return session;
      }

      if (response.content) {
        onEvent?.({ type: 'thought', content: response.content });
      }

      const toolCalls = response.toolCalls || [];

      if (session.mode === 'plan' && iterations === 1) {
        session.messages.push({
          role: 'assistant',
          content: response.content,
        });
        await this.createPlan(userInput, session);
        onEvent?.({ type: 'plan_ready', content: 'Plan created. Waiting for user review.' });
        session.status = 'waiting_approval';
        return session;
      }

      if (toolCalls.length === 0) {
        session.messages.push({
          role: 'assistant',
          content: response.content,
        });
        keepGoing = false;
        break;
      }

      session.messages.push({
        role: 'assistant',
        content: response.content,
        toolCalls,
      });

      for (const call of toolCalls) {
        if (signal?.aborted) {
          break;
        }

        onEvent?.({
          type: 'tool_start',
          toolName: call.name,
          toolArgs: call.arguments,
        });

        const toolDef = this.tools.get(call.name);
        if (!toolDef) {
          const errText = `Tool not found: ${call.name}`;
          session.messages.push({
            role: 'tool',
            name: call.name,
            toolCallId: call.id,
            content: JSON.stringify({ error: errText }),
          });
          onEvent?.({
            type: 'tool_end',
            toolName: call.name,
            toolResult: { error: errText },
          });
          continue;
        }

        const resource = typeof call.arguments.path === 'string' ? (call.arguments.path as string) : '*';
        const command = typeof call.arguments.command === 'string' ? (call.arguments.command as string) : undefined;
        const isMutation = call.name.includes('write') || call.name.includes('delete') || call.name.includes('create');

        const autonomyCheck = this.autonomyEngine.validateAction({
          scope: toolDef.requiredPermission,
          resource,
          command,
          isMutation,
        });

        if (!autonomyCheck.allowed) {
          if (autonomyCheck.requiresApproval) {
            onEvent?.({
              type: 'waiting_approval',
              toolName: call.name,
              toolArgs: call.arguments,
              content: autonomyCheck.reason || `Tool ${call.name} requires approval under ${this.autonomyEngine.getMode()} mode`,
            });
            session.messages.push({
              role: 'tool',
              name: call.name,
              toolCallId: call.id,
              content: JSON.stringify({ error: autonomyCheck.reason || 'Action requires approval' }),
            });
            continue;
          } else {
            onEvent?.({
              type: 'error',
              toolName: call.name,
              content: `[BLOCKED BY SAFE AUTONOMY ENGINE] ${autonomyCheck.reason}`,
            });
            session.messages.push({
              role: 'tool',
              name: call.name,
              toolCallId: call.id,
              content: JSON.stringify({ error: `[AUTONOMY BLOCKED] ${autonomyCheck.reason}` }),
            });
            continue;
          }
        }

        if (session.mode === 'interactive' && (toolDef.risk === 'high' || toolDef.risk === 'medium')) {
          const allowed = await this.permissions.check({
            scope: toolDef.requiredPermission,
            resource,
            description: `Tool ${call.name} invocation`,
            risk: toolDef.risk,
          });
          if (!allowed) {
            onEvent?.({
              type: 'waiting_approval',
              toolName: call.name,
              toolArgs: call.arguments,
              content: `Tool ${call.name} requires approval for ${toolDef.requiredPermission}`,
            });
            session.messages.push({
              role: 'tool',
              name: call.name,
              toolCallId: call.id,
              content: JSON.stringify({ error: `Tool ${call.name} requires approval` }),
            });
            continue;
          }
        }

        const argsWithWorkspace = {
          ...call.arguments,
          path: typeof call.arguments.path === 'string' ? call.arguments.path : this.repoPath,
          rootPath: this.repoPath,
          autonomyMode: this.autonomyEngine.getMode(),
        };

        let result: ToolResult;
        try {
          result = await this.tools.execute(call.name, argsWithWorkspace);
        } catch (err: unknown) {
          result = {
            success: false,
            output: '',
            error: err instanceof Error ? err.message : String(err),
            duration: 0,
            metadata: {},
          };
        }

        this.autonomyEngine.recordToolExecution(toolDef.requiredPermission, isMutation);

        const resultContent = result.success
          ? result.output
          : `Error: ${result.error || 'Execution failed'}`;

        session.messages.push({
          role: 'tool',
          name: call.name,
          toolCallId: call.id,
          content: resultContent,
        });

        onEvent?.({
          type: 'tool_end',
          toolName: call.name,
          toolResult: result,
        });
      }
    }

    session.status = 'completed';
    onEvent?.({ type: 'done', content: 'Agent completed execution' });
    return session;
  }
}
