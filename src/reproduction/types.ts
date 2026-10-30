import type { EvidenceRecord } from '../core/types.js';
import type { ProofReport } from '../proof/types.js';

export type ReproductionStatus =
  | 'reproduced_failure'   // The failure was actively observed and confirmed
  | 'cannot_reproduce'     // Execution succeeded or symptom could not be reproduced
  | 'reproduction_failed'  // Execution error during reproduction attempt
  | 'verified_fixed'       // Initial reproduction failed, post-fix reproduction passed
  | 'fix_unverified';      // Post-fix test did not pass or was not run

export interface ExecutionArtifact {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timestamp: Date;
}

export interface BugReproductionSession {
  id: string;
  bugDescription: string;
  errorMessage?: string;
  stackTrace?: string;
  targetFiles: string[];
  reproductionCommand?: string;
  reproductionTestFile?: string;
  status: ReproductionStatus;
  initialExecution?: ExecutionArtifact;
  postFixExecution?: ExecutionArtifact;
  regressionTestExecution?: ExecutionArtifact;
  isReproduced: boolean;
  isFixed: boolean;
  evidence: EvidenceRecord[];
  proofReport?: ProofReport;
  startedAt: Date;
  completedAt?: Date;
  summary: string;
  unverifiedClaims: string[];
}

export interface BugReproductionOptions {
  repoRoot?: string;
  bugDescription: string;
  errorMessage?: string;
  stackTrace?: string;
  command?: string; // alias for reproductionCommand
  reproductionCommand?: string;
  reproductionTestPath?: string;
  autoFix?: boolean;
  timeoutMs?: number;
}
