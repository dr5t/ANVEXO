export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

export interface AnvexoConfig {
  logLevel: LogLevel;
  maxFileReadBytes: number;
  maxGitLogEntries: number;
  maxSearchResults: number;
  defaultPermissions: Record<string, PermissionDecision>;
}

export const DEFAULT_CONFIG: AnvexoConfig = {
  logLevel: LogLevel.INFO,
  maxFileReadBytes: 1_048_576,
  maxGitLogEntries: 50,
  maxSearchResults: 100,
  defaultPermissions: {},
};

export enum PermissionDecision {
  ALLOW_ONCE = 'allow_once',
  ALWAYS_ALLOW = 'always_allow',
  ASK = 'ask',
  DENY = 'deny',
}

export enum PermissionScope {
  FILE_READ = 'file:read',
  FILE_WRITE = 'file:write',
  FILE_DELETE = 'file:delete',
  GIT_READ = 'git:read',
  GIT_WRITE = 'git:write',
  COMMAND_EXECUTE = 'command:execute',
  TEST_RUN = 'test:run',
  NETWORK = 'network',
  BROWSER = 'browser',
  PLUGIN_INSTALL = 'plugin:install',
  PLUGIN_EXECUTE = 'plugin:execute',
  MCP_CONNECT = 'mcp:connect',
}

export interface PermissionRequest {
  scope: PermissionScope;
  resource: string;
  description: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
}

export interface PermissionGrant {
  scope: PermissionScope;
  resource: string;
  decision: PermissionDecision;
  grantedAt: Date;
  expiresAt?: Date;
}

export interface EvidenceRecord {
  id: string;
  type: EvidenceType;
  source: string;
  content: string;
  timestamp: Date;
  toolName: string;
  verificationStatus: VerificationStatus;
  linkedHypothesisIds: string[];
  metadata: Record<string, unknown>;
}

export enum EvidenceType {
  FILE_CONTENT = 'file_content',
  SEARCH_RESULT = 'search_result',
  GIT_LOG = 'git_log',
  GIT_DIFF = 'git_diff',
  GIT_STATUS = 'git_status',
  COMMAND_OUTPUT = 'command_output',
  TEST_RESULT = 'test_result',
  PROJECT_METADATA = 'project_metadata',
  ERROR = 'error',
}

export enum VerificationStatus {
  OBSERVED = 'observed',
  INFERRED = 'inferred',
  HYPOTHESIZED = 'hypothesized',
  VERIFIED = 'verified',
  CONTRADICTED = 'contradicted',
  UNVERIFIED = 'unverified',
}

export interface Hypothesis {
  id: string;
  statement: string;
  status: 'active' | 'supported' | 'contradicted' | 'inconclusive';
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvestigationPlan {
  objective: string;
  steps: InvestigationStep[];
  createdAt: Date;
}

export interface InvestigationStep {
  id: string;
  description: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  requiredPermission: PermissionScope;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  evidenceIds: string[];
  error?: string;
}

export interface ProjectMetadata {
  rootPath: string;
  name: string;
  languages: string[];
  frameworks: string[];
  packageManager?: string;
  testRunner?: string;
  hasGit: boolean;
  configFiles: string[];
  entryPoints: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  requiredPermission: PermissionScope;
  risk: 'low' | 'medium' | 'high' | 'critical';
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  metadata: Record<string, unknown>;
}

export interface InvestigationReport {
  id: string;
  objective: string;
  repositoryPath: string;
  projectMetadata: ProjectMetadata;
  plan: InvestigationPlan;
  evidence: EvidenceRecord[];
  hypotheses: Hypothesis[];
  findings: Finding[];
  limitations: string[];
  unverifiedClaims: string[];
  startedAt: Date;
  completedAt: Date;
}

export interface Finding {
  claim: string;
  evidenceIds: string[];
  verificationStatus: VerificationStatus;
  confidence: number;
  details: string;
}

export class AnvexoError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = true,
  ) {
    super(message);
    this.name = 'AnvexoError';
  }
}

export class PermissionDeniedError extends AnvexoError {
  constructor(scope: PermissionScope, resource: string) {
    super(
      `Permission denied: ${scope} on ${resource}`,
      'PERMISSION_DENIED',
      true,
    );
    this.name = 'PermissionDeniedError';
  }
}

export class ToolExecutionError extends AnvexoError {
  constructor(toolName: string, reason: string) {
    super(
      `Tool '${toolName}' failed: ${reason}`,
      'TOOL_EXECUTION_FAILED',
      true,
    );
    this.name = 'ToolExecutionError';
  }
}

export enum MemoryMode {
  ZERO_PERSISTENT = 'mode_a_zero_persistent',
  LOCAL_CONTEXT = 'mode_b_local_context',
  PERSISTENT_INTELLIGENCE = 'mode_c_persistent_intelligence',
  USER_CLOUD = 'mode_d_user_cloud',
}

export interface HistoricalInvestigationRecord {
  id: string;
  objective: string;
  timestamp: Date;
  commitHash: string;
  findingsCount: number;
  success: boolean;
}

export interface KnownBugRecord {
  id: string;
  title: string;
  rootCause: string;
  affectedFiles: string[];
  discoveredAt: Date;
  resolved: boolean;
}

export interface ContradictionRecord {
  id: string;
  claim: string;
  previousEvidence: string;
  conflictingEvidence: string;
  detectedAt: Date;
}

export interface ProjectContext {
  repoRoot: string;
  lastCommitHash: string;
  lastAnalyzedAt: Date;
  mode: MemoryMode;
  dependencies: Record<string, string>;
  dependencyGraph: Record<string, string[]>;
  historicalInvestigations: HistoricalInvestigationRecord[];
  knownBugs: KnownBugRecord[];
  contradictions: ContradictionRecord[];
}

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'offline';

export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderId;
  contextWindow: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  isLocal: boolean;
}

export interface ModelConfig {
  provider: ProviderId;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCallPayload {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCallPayload[];
}

export interface CompletionRequest {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface CompletionResponse {
  content: string;
  toolCalls?: ToolCallPayload[];
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface CompletionChunk {
  delta: string;
  toolCallDelta?: Partial<ToolCallPayload>;
  isComplete: boolean;
}

export interface ModelProvider {
  readonly id: ProviderId;
  readonly name: string;
  listModels(): Promise<ModelInfo[]>;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  stream(request: CompletionRequest, onChunk: (chunk: CompletionChunk) => void): Promise<CompletionResponse>;
}

export type AgentMode = 'plan' | 'interactive' | 'autonomous';

export interface AgentStepPlan {
  id: string;
  title: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  requiresApproval: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

export interface AgentPlan {
  goal: string;
  steps: AgentStepPlan[];
  createdAt: Date;
  status: 'draft' | 'executing' | 'completed' | 'cancelled';
}

export interface AgentSession {
  id: string;
  repositoryPath: string;
  mode: AgentMode;
  messages: ChatMessage[];
  plan?: AgentPlan;
  status: 'idle' | 'planning' | 'waiting_approval' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export type SkillScope = 'built-in' | 'project' | 'user';

export interface SkillArgument {
  name: string;
  description: string;
  required: boolean;
  default?: string;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  instructions: string;
  scope: SkillScope;
  source?: string;
  location?: string;
  version?: string;
  path?: string;
  arguments?: SkillArgument[];
  allowedTools?: string[];
  suggestedPrompts?: string[];
}

export type RuleScope = 'system' | 'user' | 'project';

export interface RuleDefinition {
  id: string;
  title: string;
  scope: RuleScope;
  content: string;
  path?: string;
  priority: number;
  enabled: boolean;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  entryPoint: string;
  author?: string;
  permissions: PermissionScope[];
  tools?: string[];
  commands?: string[];
  enabled: boolean;
  installedAt: Date;
}

export type McpTransportType = 'stdio' | 'http';

export interface McpServerConfig {
  id: string;
  name: string;
  transport: McpTransportType;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  enabled: boolean;
}

export interface McpToolSchema {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface UserPreferences {
  theme: string;
  editorFont: string;
  editorFontSize: number;
  editorLineHeight: number;
  editorTabSize: number;
  editorLineNumbers: boolean;
  editorWordWrap: boolean;
  activeProvider: ProviderId;
  activeModel: string;
  providerKeys: Record<string, string>;
  mcpServers: McpServerConfig[];
  plugins: PluginManifest[];
}
