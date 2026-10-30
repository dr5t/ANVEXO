import type { EvidenceRecord, VerificationStatus } from '../core/types.js';

export type ClaimVerificationState =
  | 'verified'
  | 'partially_verified'
  | 'unverified'
  | 'failed'
  | 'incomplete';

export type VerificationCheckType =
  | 'static_analysis'
  | 'dynamic_execution'
  | 'test_run'
  | 'git_inspection'
  | 'artifact_inspection'
  | 'file_check';

export interface VerificationCheck {
  id: string;
  name: string;
  type: VerificationCheckType;
  description: string;
  attempted: boolean;
  completed: boolean;
  passed: boolean;
  timestamp: Date;
  durationMs?: number;
  evidenceId?: string;
  error?: string;
  isExecution: boolean; // Explicitly distinguishes actual code execution from static analysis
  commandExecuted?: string;
  exitCode?: number;
}

export interface ProofClaim {
  id: string;
  statement: string;
  category: 'root_cause' | 'code_modification' | 'test_addition' | 'test_execution' | 'regression_check' | 'security_fix' | 'general';
  status: ClaimVerificationState;
  checks: VerificationCheck[];
  supportingEvidenceIds: string[];
  refutingEvidenceIds: string[];
  revisionHash: string;
  timestamp: Date;
  unresolvedUncertainties: string[];
  rationale: string;
}

export interface ProofReport {
  id: string;
  workflowId?: string;
  repositoryPath: string;
  revisionHash: string;
  createdAt: Date;
  overallStatus: ClaimVerificationState;
  claims: ProofClaim[];
  checksAttemptedCount: number;
  checksCompletedCount: number;
  checksPassedCount: number;
  checksFailedCount: number;
  dynamicExecutionsCount: number;
  staticAnalysesCount: number;
  insufficientEvidenceClaims: string[];
  failedChecks: VerificationCheck[];
  suggestedNextSteps: string[];
  summary: string;
}
