import type { EvidenceRecord, Finding, VerificationStatus } from '../core/types.js';

export interface GitHubRepoIdentifier {
  owner: string;
  repo: string;
  host: string;
  originalUrl: string;
  isMock: boolean;
}

export interface GitHubLicense {
  key?: string;
  name: string;
  spdxId?: string;
  url?: string;
}

export interface GitHubRelease {
  id: string;
  tagName: string;
  name: string;
  publishedAt: string;
  htmlUrl: string;
  isPrerelease: boolean;
  body?: string;
}

export interface GitHubBranch {
  name: string;
  protected?: boolean;
  latestCommitSha?: string;
}

export interface GitHubMetadata {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  homepage: string | null;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  firstCommitDate?: string;
  defaultBranch: string;
  starsCount: number;
  forksCount: number;
  openIssuesCount: number;
  watchersCount: number;
  primaryLanguage: string | null;
  languageDistribution: Record<string, number>;
  license: GitHubLicense | null;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  sizeKb: number;
  branches: GitHubBranch[];
  tags: string[];
  releases: GitHubRelease[];
  readmePreview?: string;
  hasIssues: boolean;
  hasWiki: boolean;
  hasPages: boolean;
}

export interface CommitAuthorInfo {
  name: string;
  email: string;
  date: string;
  githubUsername?: string;
  avatarUrl?: string;
}

export interface CommitRecord {
  sha: string;
  shortSha: string;
  message: string;
  firstLine: string;
  author: CommitAuthorInfo;
  committer: CommitAuthorInfo;
  parentShas: string[];
  isMerge: boolean;
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
  changedFiles?: string[];
}

export interface TimelineMilestone {
  date: string;
  title: string;
  description: string;
  type: 'initial_commit' | 'release' | 'major_merge' | 'architecture_shift' | 'dependency_update' | 'recent_activity';
  commitSha?: string;
  referenceUrl?: string;
}

export interface ContributorProfile {
  id: string;
  displayName: string;
  email?: string;
  githubUsername?: string;
  avatarUrl?: string;
  profileUrl?: string;
  commitCount: number;
  firstCommitDate: string;
  lastCommitDate: string;
  additionsCount: number;
  deletionsCount: number;
  filesModifiedCount: number;
  topFiles: string[];
  technicalAreas: string[];
  collaborationRoles: Array<'author' | 'committer' | 'merger'>;
  significantCommits: Array<{ sha: string; message: string; date: string }>;
  attributionNote: string;
}

export interface DependencyManifest {
  type: 'npm' | 'pip' | 'cargo' | 'maven' | 'gradle' | 'go' | 'composer' | 'unknown';
  file: string;
  directDependenciesCount: number;
  devDependenciesCount: number;
  hasLockfile: boolean;
  lockfile?: string;
  packages: Array<{
    name: string;
    version: string;
    isDev?: boolean;
    outdated?: boolean;
    vulnerabilityWarning?: string;
  }>;
}

export interface SecurityFinding {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'secret_leak' | 'command_injection' | 'path_traversal' | 'vulnerable_dependency' | 'insecure_config' | 'anti_pattern';
  file?: string;
  line?: number;
  description: string;
  recommendation: string;
  confidence: number;
  status: 'confirmed' | 'potential' | 'informational' | 'not_verified';
  redactedEvidence?: string;
}

export interface TestExecutionSummary {
  attempted: boolean;
  executed: boolean;
  runner?: string;
  command?: string;
  exitCode?: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  totalCount: number;
  failedTestDetails: Array<{ name: string; file?: string; error?: string }>;
  durationMs?: number;
  timedOut?: boolean;
  interrupted?: boolean;
  status: 'all_passed' | 'has_failures' | 'not_executed' | 'inconclusive' | 'timed_out';
  notes: string;
}

export type OverallProjectHealth =
  | 'Healthy within the scope checked'
  | 'Needs attention'
  | 'Significant issues detected'
  | 'Incomplete investigation';

export interface FinalConclusion {
  overallStatus: OverallProjectHealth;
  readinessVerdict: string;
  summaryAnswer: string;
  answers: {
    whatProjectDoes: string;
    howStructured: string;
    developmentHistoryVisible: string;
    contributorsAndComponents: string;
    whatIsWorking: string;
    whatIsFailing: string;
    verifiedIssues: string[];
    needsFurtherInvestigation: string[];
    isReadyForIntendedUse: string;
    whatToFixFirst: string[];
  };
  prioritizedRemediationPlan: Array<{
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    action: string;
    targetComponent?: string;
    rationale: string;
  }>;
}

export interface GitHubInvestigationReport {
  id: string;
  repository: GitHubRepoIdentifier;
  metadata: GitHubMetadata;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  isMock: boolean;
  stagesCompleted: string[];
  stagesFailed: string[];
  stagesSkipped: string[];
  executiveSummary: string;
  developmentTimeline: TimelineMilestone[];
  commitsAnalyzedCount: number;
  commitsSample: CommitRecord[];
  contributors: ContributorProfile[];
  architectureOverview: {
    summary: string;
    primaryStack: string;
    entryPoints: string[];
    directories: Array<{ path: string; purpose: string }>;
    externalIntegrations: string[];
    configurationFiles: string[];
  };
  majorFeatures: string[];
  codeQualityFindings: Finding[];
  securityFindings: SecurityFinding[];
  dependencyManifests: DependencyManifest[];
  testExecution: TestExecutionSummary;
  maintenanceIndicators: {
    commitFrequency: 'high' | 'moderate' | 'low' | 'dormant';
    openIssueRatio: string;
    hasContinuousIntegration: boolean;
    hasDocumentation: boolean;
    hasLicense: boolean;
    busFactorRisk: 'low' | 'medium' | 'high';
  };
  missingDocumentationOrConfig: string[];
  limitations: string[];
  finalConclusion: FinalConclusion;
  evidence: EvidenceRecord[];
}

export type InvestigationStageId =
  | 'validate_url'
  | 'fetch_metadata'
  | 'inspect_structure'
  | 'fetch_commit_history'
  | 'analyze_contributors'
  | 'inspect_milestones_and_diffs'
  | 'inspect_dependencies'
  | 'run_security_scan'
  | 'evaluate_tests'
  | 'collect_evidence'
  | 'deduplicate_findings'
  | 'synthesize_architecture'
  | 'generate_conclusion'
  | 'finalize_report';

export interface InvestigationProgressEvent {
  jobId: string;
  stage: InvestigationStageId;
  stageIndex: number;
  totalStages: number;
  percentage: number;
  message: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  timestamp: string;
}

export interface StoredInvestigationSummary {
  id: string;
  owner: string;
  repo: string;
  url: string;
  isMock: boolean;
  status: 'completed' | 'failed' | 'cancelled' | 'running';
  overallStatus?: OverallProjectHealth;
  startedAt: string;
  completedAt?: string;
  starsCount?: number;
  primaryLanguage?: string | null;
  findingsCount?: number;
  contributorsCount?: number;
}

export interface GitHubJob {
  id: string;
  url: string;
  owner: string;
  repo: string;
  isMock: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStage: InvestigationStageId;
  stageIndex: number;
  totalStages: number;
  percentage: number;
  events: InvestigationProgressEvent[];
  report: GitHubInvestigationReport | null;
  error?: string;
  startedAt: string;
  completedAt?: string;
  abortController: AbortController;
  token?: string;
}

export interface GitHubJobSummary {
  id: string;
  url: string;
  owner: string;
  repo: string;
  isMock: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStage: InvestigationStageId;
  stageIndex: number;
  totalStages: number;
  percentage: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
  hasReport: boolean;
  overallStatus?: OverallProjectHealth;
}
