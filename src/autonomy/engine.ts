import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PermissionScope, logger } from '../core/index.js';
import type {
  AutonomyExecutionState,
  AutonomyMode,
  AutonomyPolicy,
  SecurityBudget,
  SecurityViolation,
} from './types.js';

export const DEFAULT_PROTECTED_PATHS = [
  '.git',
  '.git/**',
  '.env',
  '.env.*',
  '.env.local',
  '.ssh',
  '*.pem',
  '*.key',
  'id_rsa',
  'id_ed25519',
  '/etc/**',
  '/root/**',
  '/var/**',
];

export const DANGEROUS_COMMAND_PATTERNS = [
  /\brm\s+-(?:r|f|rf|fr)\s+(?:\/|\~|\.\.|\*)/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bsudo\b/i,
  /\bchmod\s+(?:-R\s+)?777\b/i,
  /\bcurl\s+.*\|\s*(?:bash|sh)\b/i,
  /\bwget\s+.*\|\s*(?:bash|sh)\b/i,
  /:(){ :\|:& };:/,
];

export class SafeAutonomyEngine {
  private mode: AutonomyMode;
  private policy: AutonomyPolicy;
  private state: AutonomyExecutionState;

  constructor(mode: AutonomyMode = 'assisted', customBudget?: Partial<SecurityBudget>) {
    this.mode = mode;
    this.policy = this.createDefaultPolicy(mode, customBudget);
    this.state = {
      mode,
      startedAt: new Date(),
      toolInvocationsCount: 0,
      fileModificationsCount: 0,
      commandExecutionsCount: 0,
      violations: [],
      isBudgetExceeded: false,
    };
  }

  getMode(): AutonomyMode {
    return this.mode;
  }

  setMode(mode: AutonomyMode, customBudget?: Partial<SecurityBudget>): void {
    this.mode = mode;
    this.policy = this.createDefaultPolicy(mode, customBudget);
    this.state.mode = mode;
    logger.info('autonomy', `Safe Autonomy Engine mode switched to: [${mode.toUpperCase()}]`);
  }

  getPolicy(): AutonomyPolicy {
    return { ...this.policy };
  }

  getState(): AutonomyExecutionState {
    this.checkTimeBudget();
    return { ...this.state, violations: [...this.state.violations] };
  }

  resetBudget(): void {
    this.state.startedAt = new Date();
    this.state.toolInvocationsCount = 0;
    this.state.fileModificationsCount = 0;
    this.state.commandExecutionsCount = 0;
    this.state.isBudgetExceeded = false;
    this.state.exceededReason = undefined;
  }

  /**
   * Primary runtime enforcement check.
   * Evaluates an attempted action against autonomy mode, protected resources,
   * dangerous commands, and budget constraints.
   */
  validateAction(params: {
    scope: PermissionScope;
    resource: string;
    command?: string;
    isMutation?: boolean;
  }): { allowed: boolean; requiresApproval: boolean; reason?: string } {
    this.checkTimeBudget();

    // 1. Check budget exhaustion
    if (this.state.isBudgetExceeded) {
      this.recordViolation(params.scope, params.resource, `Execution halted: ${this.state.exceededReason}`, 'budget_exceeded');
      return { allowed: false, requiresApproval: false, reason: this.state.exceededReason };
    }

    // 2. Check protected paths
    if (this.isProtectedPath(params.resource)) {
      const reason = `Access to protected resource '${params.resource}' is strictly forbidden by policy.`;
      this.recordViolation(params.scope, params.resource, reason, 'protected_path_access');
      return { allowed: false, requiresApproval: false, reason };
    }

    // 3. Check dangerous shell commands
    if (params.command && this.isDangerousCommand(params.command)) {
      const reason = `Command contains dangerous execution pattern blocked by defensive controls: ${params.command}`;
      this.recordViolation(params.scope, params.command, reason, 'dangerous_command');
      return { allowed: false, requiresApproval: false, reason };
    }

    // 4. Enforce mode-specific restrictions
    switch (this.mode) {
      case 'observe': {
        // Observe mode strictly forbids all mutations, file writes, and commands
        if (params.isMutation || params.scope === PermissionScope.FILE_WRITE || params.scope === PermissionScope.FILE_DELETE) {
          const reason = 'Observe mode strictly forbids workspace mutations. Change proposal only.';
          this.recordViolation(params.scope, params.resource, reason, 'observe_mutation_blocked');
          return { allowed: false, requiresApproval: false, reason };
        }
        if (params.scope === PermissionScope.COMMAND_EXECUTE && !this.isSafeDiagnosticCommand(params.command)) {
          const reason = 'Observe mode restricts arbitrary command execution. Only read-only diagnostics allowed.';
          this.recordViolation(params.scope, params.resource, reason, 'observe_command_blocked');
          return { allowed: false, requiresApproval: false, reason };
        }
        return { allowed: true, requiresApproval: false };
      }

      case 'suggest': {
        // Suggest mode allows analysis and diff generation, but requires explicit approval to apply changes
        if (params.isMutation || params.scope === PermissionScope.FILE_WRITE || params.scope === PermissionScope.FILE_DELETE) {
          return {
            allowed: false,
            requiresApproval: true,
            reason: 'Suggest mode requires explicit operator approval before modifying files on disk.',
          };
        }
        if (params.scope === PermissionScope.COMMAND_EXECUTE && !this.isSafeDiagnosticCommand(params.command)) {
          return {
            allowed: false,
            requiresApproval: true,
            reason: 'Suggest mode requires operator approval before running shell commands.',
          };
        }
        return { allowed: true, requiresApproval: false };
      }

      case 'assisted': {
        // Assisted mode requires approval for mutations and commands unless pre-approved
        if (params.isMutation || params.scope === PermissionScope.FILE_WRITE || params.scope === PermissionScope.FILE_DELETE) {
          if (this.policy.requireApprovalForMutations) {
            return {
              allowed: false,
              requiresApproval: true,
              reason: 'Assisted mode requires confirmation for modifying files.',
            };
          }
        }
        if (params.scope === PermissionScope.COMMAND_EXECUTE && this.policy.requireApprovalForCommands) {
          return {
            allowed: false,
            requiresApproval: true,
            reason: 'Assisted mode requires confirmation for running commands.',
          };
        }
        return { allowed: true, requiresApproval: false };
      }

      case 'controlled_autonomous': {
        // Autonomous execution within defined budgets
        if (params.isMutation || params.scope === PermissionScope.FILE_WRITE) {
          if (this.state.fileModificationsCount >= this.policy.budget.maxFileModifications) {
            this.state.isBudgetExceeded = true;
            this.state.exceededReason = `Maximum file modification limit (${this.policy.budget.maxFileModifications}) reached.`;
            return { allowed: false, requiresApproval: true, reason: this.state.exceededReason };
          }
        }
        if (params.scope === PermissionScope.COMMAND_EXECUTE) {
          if (this.state.commandExecutionsCount >= this.policy.budget.maxCommandExecutions) {
            this.state.isBudgetExceeded = true;
            this.state.exceededReason = `Maximum command execution limit (${this.policy.budget.maxCommandExecutions}) reached.`;
            return { allowed: false, requiresApproval: true, reason: this.state.exceededReason };
          }
        }
        return { allowed: true, requiresApproval: false };
      }
    }
  }

  recordToolExecution(scope: PermissionScope, isMutation: boolean = false): void {
    this.state.toolInvocationsCount++;
    if (isMutation || scope === PermissionScope.FILE_WRITE || scope === PermissionScope.FILE_DELETE) {
      this.state.fileModificationsCount++;
    }
    if (scope === PermissionScope.COMMAND_EXECUTE || scope === PermissionScope.TEST_RUN) {
      this.state.commandExecutionsCount++;
    }

    if (this.state.toolInvocationsCount >= this.policy.budget.maxToolInvocations) {
      this.state.isBudgetExceeded = true;
      this.state.exceededReason = `Maximum tool invocation limit (${this.policy.budget.maxToolInvocations}) reached.`;
    }
  }

  private isProtectedPath(resourcePath: string): boolean {
    const normalized = resourcePath.replace(/\\/g, '/').toLowerCase();
    for (const pattern of this.policy.protectedPaths) {
      const cleanPat = pattern.toLowerCase();
      if (cleanPat.endsWith('/**')) {
        const prefix = cleanPat.slice(0, -3);
        if (normalized === prefix || normalized.startsWith(prefix + '/')) return true;
      } else if (cleanPat.startsWith('*.')) {
        const ext = cleanPat.slice(1);
        if (normalized.endsWith(ext)) return true;
      } else {
        if (normalized === cleanPat || normalized.endsWith('/' + cleanPat)) return true;
      }
    }
    return false;
  }

  private isDangerousCommand(command: string): boolean {
    for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
      if (pattern.test(command)) return true;
    }
    return false;
  }

  private isSafeDiagnosticCommand(command?: string): boolean {
    if (!command) return true;
    const trimmed = command.trim().toLowerCase();
    const safeStarts = ['git status', 'git log', 'git diff', 'git branch', 'npm test', 'vitest run', 'npx vitest', 'cat ', 'ls '];
    return safeStarts.some(s => trimmed.startsWith(s));
  }

  private checkTimeBudget(): void {
    const elapsedSec = (Date.now() - this.state.startedAt.getTime()) / 1000;
    if (elapsedSec > this.policy.budget.maxDurationSeconds) {
      this.state.isBudgetExceeded = true;
      this.state.exceededReason = `Maximum execution time budget (${this.policy.budget.maxDurationSeconds}s) exceeded.`;
    }
  }

  private recordViolation(scope: PermissionScope, resource: string, reason: string, attemptedAction: string): void {
    const violation: SecurityViolation = {
      id: randomUUID(),
      timestamp: new Date(),
      mode: this.mode,
      scope,
      resource,
      reason,
      blocked: true,
      attemptedAction,
    };
    this.state.violations.push(violation);
    logger.warn('autonomy', `[SECURITY VIOLATION BLOCKED] ${reason} (Scope: ${scope}, Target: ${resource})`);
  }

  private createDefaultPolicy(mode: AutonomyMode, customBudget?: Partial<SecurityBudget>): AutonomyPolicy {
    const baseBudget: SecurityBudget = {
      maxDurationSeconds: 300,
      maxToolInvocations: 25,
      maxFileModifications: 10,
      maxCommandExecutions: 15,
      ...customBudget,
    };

    switch (mode) {
      case 'observe':
        return {
          mode: 'observe',
          budget: { ...baseBudget, maxFileModifications: 0, maxCommandExecutions: 5 },
          protectedPaths: [...DEFAULT_PROTECTED_PATHS],
          dangerousCommands: [],
          requireApprovalForMutations: true,
          requireApprovalForCommands: true,
        };

      case 'suggest':
        return {
          mode: 'suggest',
          budget: { ...baseBudget, maxFileModifications: 0 },
          protectedPaths: [...DEFAULT_PROTECTED_PATHS],
          dangerousCommands: [],
          requireApprovalForMutations: true,
          requireApprovalForCommands: true,
        };

      case 'assisted':
        return {
          mode: 'assisted',
          budget: baseBudget,
          protectedPaths: [...DEFAULT_PROTECTED_PATHS],
          dangerousCommands: [],
          requireApprovalForMutations: true,
          requireApprovalForCommands: false,
        };

      case 'controlled_autonomous':
        return {
          mode: 'controlled_autonomous',
          budget: baseBudget,
          protectedPaths: [...DEFAULT_PROTECTED_PATHS],
          dangerousCommands: [],
          requireApprovalForMutations: false,
          requireApprovalForCommands: false,
        };
    }
  }
}
