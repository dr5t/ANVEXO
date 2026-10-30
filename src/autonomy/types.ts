import type { PermissionScope, PermissionDecision, PermissionRequest } from '../core/types.js';

export type AutonomyMode = 'observe' | 'suggest' | 'assisted' | 'controlled_autonomous';

export interface SecurityBudget {
  maxDurationSeconds: number;
  maxToolInvocations: number;
  maxFileModifications: number;
  maxCommandExecutions: number;
  allowedDirectories?: string[];
  deniedDirectories?: string[];
  allowedCommands?: string[];
}

export interface SecurityViolation {
  id: string;
  timestamp: Date;
  mode: AutonomyMode;
  scope: PermissionScope;
  resource: string;
  reason: string;
  blocked: boolean;
  attemptedAction: string;
}

export interface AutonomyPolicy {
  mode: AutonomyMode;
  budget: SecurityBudget;
  protectedPaths: string[];
  dangerousCommands: string[];
  requireApprovalForMutations: boolean;
  requireApprovalForCommands: boolean;
}

export interface AutonomyExecutionState {
  mode: AutonomyMode;
  startedAt: Date;
  toolInvocationsCount: number;
  fileModificationsCount: number;
  commandExecutionsCount: number;
  violations: SecurityViolation[];
  isBudgetExceeded: boolean;
  exceededReason?: string;
}
