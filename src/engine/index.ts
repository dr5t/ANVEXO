import { randomUUID } from 'node:crypto';
import type { InvestigationReport, ProjectMetadata, ToolResult } from '../core/index.js';
import { EvidenceType, VerificationStatus, PermissionScope, PermissionDecision, MemoryMode, logger } from '../core/index.js';
import { PermissionManager } from '../permissions/index.js';
import { ToolRegistry, registerBuiltinTools } from '../tools/index.js';
import { discoverProject } from '../discovery/index.js';
import { EvidenceCollector } from '../evidence/index.js';
import { createInvestigationPlan } from '../planner/index.js';
import { formatReport, generateFindings } from '../reporting/index.js';
import { ContextManager } from '../context/index.js';
import { ProofVerifier } from '../proof/index.js';
import { DecisionMemoryManager } from '../memory/index.js';

export interface InvestigationOptions {
  objective: string;
  repositoryPath: string;
  autoApprove?: boolean;
  skipTests?: boolean;
  verbose?: boolean;
  memoryMode?: MemoryMode;
  abortSignal?: AbortSignal;
}

export class InvestigationEngine {
  private permissions: PermissionManager;
  private toolRegistry: ToolRegistry;
  private evidence: EvidenceCollector;
  private contextManager: ContextManager;

  constructor(memoryMode: MemoryMode = MemoryMode.PERSISTENT_INTELLIGENCE) {
    this.permissions = new PermissionManager();
    this.toolRegistry = new ToolRegistry(this.permissions);
    this.evidence = new EvidenceCollector();
    this.contextManager = new ContextManager(memoryMode);
    registerBuiltinTools(this.toolRegistry);
  }

  getPermissions(): PermissionManager {
    return this.permissions;
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  getContextManager(): ContextManager {
    return this.contextManager;
  }

  async investigate(options: InvestigationOptions): Promise<InvestigationReport> {
    const startedAt = new Date();
    logger.info('engine', `Starting investigation: ${options.objective}`);
    logger.info('engine', `Repository: ${options.repositoryPath}`);

    if (options.memoryMode) {
      this.contextManager.setMode(options.memoryMode);
    }

    if (options.autoApprove) {
      this.permissions.grant(PermissionScope.FILE_READ, '*', PermissionDecision.ALWAYS_ALLOW);
      this.permissions.grant(PermissionScope.GIT_READ, '*', PermissionDecision.ALWAYS_ALLOW);
      if (!options.skipTests) {
        this.permissions.grant(PermissionScope.TEST_RUN, '*', PermissionDecision.ALWAYS_ALLOW);
        this.permissions.grant(PermissionScope.COMMAND_EXECUTE, '*', PermissionDecision.ALWAYS_ALLOW);
      }
    }

    let project: ProjectMetadata;
    try {
      project = await discoverProject(options.repositoryPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('engine', `Discovery failed: ${msg}`);
      return this.buildErrorReport(options, startedAt, `Project discovery failed: ${msg}`);
    }

    await this.contextManager.init(options.repositoryPath);
    const staleCheck = await this.contextManager.checkStale(options.repositoryPath);
    if (staleCheck.isStale) {
      this.evidence.add({
        type: EvidenceType.PROJECT_METADATA,
        source: 'context_manager',
        content: `Repository commit shifted: previous ${staleCheck.savedCommit}, current ${staleCheck.currentCommit}`,
        toolName: 'context_manager',
        verificationStatus: VerificationStatus.OBSERVED,
      });
    }

    this.evidence.add({
      type: EvidenceType.PROJECT_METADATA,
      source: 'discovery',
      content: JSON.stringify(project, null, 2),
      toolName: 'discovery',
      metadata: project as unknown as Record<string, unknown>,
    });

    const plan = createInvestigationPlan(options.objective, project);

    for (const step of plan.steps) {
      if (options.abortSignal?.aborted) {
        step.status = 'failed';
        step.error = 'Investigation aborted by operator';
        break;
      }

      if (options.skipTests && step.toolName === 'run_command') {
        step.status = 'skipped';
        continue;
      }

      step.status = 'running';
      logger.info('engine', `Executing: ${step.description}`);

      let result: ToolResult;
      try {
        result = await this.toolRegistry.execute(step.toolName, step.toolArgs);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        step.status = 'failed';
        step.error = msg;

        this.evidence.add({
          type: EvidenceType.ERROR,
          source: step.description,
          content: msg,
          toolName: step.toolName,
          verificationStatus: VerificationStatus.OBSERVED,
        });
        continue;
      }

      if (result.success) {
        step.status = 'completed';
        const evidenceType = mapToolToEvidenceType(step.toolName);
        const ev = this.evidence.add({
          type: evidenceType,
          source: step.description,
          content: result.output,
          toolName: step.toolName,
          metadata: result.metadata,
        });
        step.evidenceIds.push(ev.id);
      } else {
        step.status = 'failed';
        step.error = result.error || 'Unknown error';
        const ev = this.evidence.add({
          type: EvidenceType.ERROR,
          source: step.description,
          content: result.error || result.output || 'Tool returned failure with no output',
          toolName: step.toolName,
          verificationStatus: VerificationStatus.OBSERVED,
          metadata: result.metadata,
        });
        step.evidenceIds.push(ev.id);
      }
    }

    const allEvidence = this.evidence.getAll();
    const report: InvestigationReport = {
      id: randomUUID(),
      objective: options.objective,
      repositoryPath: options.repositoryPath,
      projectMetadata: project,
      plan,
      evidence: allEvidence,
      hypotheses: [],
      findings: [],
      limitations: this.collectLimitations(plan, project),
      unverifiedClaims: [],
      startedAt,
      completedAt: new Date(),
    };

    report.findings = generateFindings(report);

    const contradictions = this.contextManager.detectContradictions(report.findings);
    for (const c of contradictions) {
      report.findings.push({
        claim: `Contradiction with previous context: ${c.claim}`,
        evidenceIds: [],
        verificationStatus: VerificationStatus.CONTRADICTED,
        confidence: 0.85,
        details: `Conflicts with: ${c.previousEvidence}`,
      });
    }

    const memoryManager = new DecisionMemoryManager(options.repositoryPath);
    const memoryConflicts = memoryManager.checkConflicts(options.objective);
    for (const mc of memoryConflicts) {
      report.findings.push({
        claim: `Conflict with Project Decision Memory: ${mc.summary}`,
        evidenceIds: [],
        verificationStatus: VerificationStatus.CONTRADICTED,
        confidence: 0.9,
        details: mc.explanation,
      });
    }

    report.unverifiedClaims = this.collectUnverifiedClaims(report);

    const proofVerifier = new ProofVerifier(options.repositoryPath);
    proofVerifier.ingestEvidenceRecords(allEvidence);
    for (const f of report.findings) {
      const claim = proofVerifier.recordClaim({
        statement: f.claim,
        category: f.claim.toLowerCase().includes('test') ? 'test_execution' : 'general',
        rationale: f.details,
      });
      for (const evId of f.evidenceIds) {
        proofVerifier.attachEvidence(claim.id, evId, f.verificationStatus === VerificationStatus.VERIFIED);
      }
    }
    report.proofReport = proofVerifier.generateReport(report.id);

    await this.contextManager.recordInvestigation(report);

    const completedSteps = plan.steps.filter(s => s.status === 'completed').length;
    const failedSteps = plan.steps.filter(s => s.status === 'failed').length;
    logger.info('engine', `Investigation complete. Steps: ${completedSteps} completed, ${failedSteps} failed, ${allEvidence.length} evidence records`);

    return report;
  }

  formatReport(report: InvestigationReport): string {
    return formatReport(report);
  }

  private collectLimitations(plan: ReturnType<typeof createInvestigationPlan>, project: ProjectMetadata): string[] {
    const limitations: string[] = [];

    const failedSteps = plan.steps.filter(s => s.status === 'failed');
    if (failedSteps.length > 0) {
      limitations.push(`${failedSteps.length} investigation step(s) failed and could not provide evidence`);
    }

    const skippedSteps = plan.steps.filter(s => s.status === 'skipped');
    if (skippedSteps.length > 0) {
      limitations.push(`${skippedSteps.length} step(s) were skipped (tests may not have been executed)`);
    }

    if (!project.hasGit) {
      limitations.push('No Git repository detected; commit history analysis was not possible');
    }

    if (!project.testRunner) {
      limitations.push('No test runner detected; automated test verification was not available');
    }

    limitations.push('No AI model was used; analysis is limited to deterministic tool output');
    limitations.push('Phase 1 investigation does not include code modification or fix proposals');

    return limitations;
  }

  private collectUnverifiedClaims(report: InvestigationReport): string[] {
    return report.findings
      .filter(f => f.verificationStatus === VerificationStatus.UNVERIFIED || f.verificationStatus === VerificationStatus.INFERRED)
      .map(f => f.claim);
  }

  private buildErrorReport(options: InvestigationOptions, startedAt: Date, error: string): InvestigationReport {
    return {
      id: randomUUID(),
      objective: options.objective,
      repositoryPath: options.repositoryPath,
      projectMetadata: {
        rootPath: options.repositoryPath,
        name: 'unknown',
        languages: [],
        frameworks: [],
        hasGit: false,
        configFiles: [],
        entryPoints: [],
      },
      plan: { objective: options.objective, steps: [], createdAt: new Date() },
      evidence: [],
      hypotheses: [],
      findings: [],
      limitations: [error],
      unverifiedClaims: [],
      startedAt,
      completedAt: new Date(),
    };
  }
}

function mapToolToEvidenceType(toolName: string): EvidenceType {
  switch (toolName) {
    case 'file_read': return EvidenceType.FILE_CONTENT;
    case 'file_list': return EvidenceType.FILE_CONTENT;
    case 'file_search': return EvidenceType.SEARCH_RESULT;
    case 'git_status': return EvidenceType.GIT_STATUS;
    case 'git_log': return EvidenceType.GIT_LOG;
    case 'git_diff': return EvidenceType.GIT_DIFF;
    case 'run_command': return EvidenceType.TEST_RESULT;
    default: return EvidenceType.COMMAND_OUTPUT;
  }
}
