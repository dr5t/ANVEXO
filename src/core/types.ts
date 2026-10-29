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
  GIT_READ = 'git:read',
  GIT_WRITE = 'git:write',
  COMMAND_EXECUTE = 'command:execute',
  TEST_RUN = 'test:run',
  NETWORK = 'network',
  BROWSER = 'browser',
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
