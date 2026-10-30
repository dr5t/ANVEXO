import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { InvestigationReport, EvidenceRecord } from '../core/types.js';
import { EvidenceType, VerificationStatus } from '../core/types.js';
import { InvestigationEngine } from './index.js';
import { ContextManager } from '../context/index.js';
import { ChangeImpactSimulator } from '../impact/index.js';
import type { ChangeImpactReport } from '../impact/types.js';
import { DecisionMemoryManager } from '../memory/index.js';
import type { DecisionMemoryRecord, MemoryConflictWarning } from '../memory/types.js';
import { SafeAutonomyEngine } from '../autonomy/index.js';
import type { AutonomyMode, AutonomyPolicy } from '../autonomy/types.js';
import { BugReproductionLab } from '../reproduction/index.js';
import type { BugReproductionSession } from '../reproduction/types.js';
import { ProofVerifier } from '../proof/index.js';
import type { ProofReport } from '../proof/types.js';

export interface WorkflowOptions {
  repositoryPath: string;
  bugDescription: string;
  errorMessage?: string;
  stackTrace?: string;
  targetFile?: string;
  reproductionCommand?: string;
  reproductionTestPath?: string;
  autonomyMode?: AutonomyMode;
  skipTests?: boolean;
  autoApprove?: boolean;
}

export interface UnifiedEngineeringReport {
  id: string;
  repositoryPath: string;
  bugDescription: string;
  startedAt: Date;
  completedAt: Date;
  investigation: InvestigationReport;
  impactReport?: ChangeImpactReport;
  stageFailures: Array<{ stage: string; message: string }>;
  reproductionSession?: BugReproductionSession;
  proofReport: ProofReport;
  decisionMemories: DecisionMemoryRecord[];
  memoryConflicts: MemoryConflictWarning[];
  autonomyPolicy: AutonomyPolicy;
  proposedFix?: string;
  status: import('../proof/types.js').ClaimVerificationState;
  summary: string;
  suggestedNextSteps: string[];
}

export class EngineeringWorkflowRunner {
  private repoRoot: string;

  constructor(repoRoot: string) {
    this.repoRoot = path.resolve(repoRoot);
  }

  async run(options: WorkflowOptions): Promise<UnifiedEngineeringReport> {
    const startedAt = new Date();
    const repoPath = path.resolve(options.repositoryPath || this.repoRoot);
    const workflowId = randomUUID();

    const autonomyEngine = new SafeAutonomyEngine(options.autonomyMode || 'assisted');
    const autonomyPolicy = autonomyEngine.getPolicy();

    const engine = new InvestigationEngine();
    const investigation = await engine.investigate({
      objective: options.bugDescription,
      repositoryPath: repoPath,
      autoApprove: options.autoApprove ?? true,
      skipTests: options.skipTests ?? false,
    });

    const contextManager = new ContextManager();
    await contextManager.init(repoPath);

    let targetFile = options.targetFile;
    if (!targetFile && investigation.projectMetadata.entryPoints.length > 0) {
      targetFile = investigation.projectMetadata.entryPoints[0];
    }
    if (!targetFile && options.errorMessage) {
      const match = options.errorMessage.match(/(?:[a-zA-Z0-9_-]+\/)+[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+/);
      if (match) targetFile = match[0];
    }
    if (!targetFile) {
      targetFile = 'package.json';
    }

    let impactReport: ChangeImpactReport | undefined;
    const stageFailures: UnifiedEngineeringReport['stageFailures'] = [];
    try {
      const simulator = new ChangeImpactSimulator(repoPath);
      impactReport = await simulator.simulate(targetFile);
    } catch (error) {
      impactReport = undefined;
      stageFailures.push({
        stage: 'impact_analysis',
        message: error instanceof Error ? error.message : String(error),
      });
    }

    const memoryManager = new DecisionMemoryManager(repoPath);
    const relevantMemories = memoryManager.list({ status: ['active'] });
    const memoryConflicts = memoryManager.checkConflicts(
      options.bugDescription,
      targetFile ? [targetFile] : [],
    );

    let proposedFix: string | undefined;
    if (investigation.findings.length > 0) {
      proposedFix = `Proposed remediation for ${options.bugDescription}: Address issues discovered in ${targetFile}. Validate dependencies: ${impactReport ? impactReport.directDependencies.slice(0, 3).join(', ') : 'none'}.`;
    }

    let reproductionSession: BugReproductionSession | undefined;
    const lab = new BugReproductionLab(repoPath);
    reproductionSession = await lab.runReproduction({
      repoRoot: repoPath,
      bugDescription: options.bugDescription,
      errorMessage: options.errorMessage,
      stackTrace: options.stackTrace,
      reproductionCommand: options.reproductionCommand,
      reproductionTestPath: options.reproductionTestPath,
    });

    const verifier = new ProofVerifier(repoPath);
    if (investigation.evidence) {
      verifier.ingestEvidenceRecords(investigation.evidence);
    }
    if (reproductionSession.evidence) {
      verifier.ingestEvidenceRecords(reproductionSession.evidence);
    }

    const rootCauseClaim = verifier.recordClaim({
      statement: `Root cause investigated for: ${options.bugDescription}`,
      category: 'root_cause',
      rationale: investigation.findings.length > 0 ? investigation.findings[0].claim : 'Investigation completed',
    });

    verifier.addCheck(rootCauseClaim.id, {
      name: 'Investigation Findings Check',
      type: 'static_analysis',
      description: `Synthesized ${investigation.findings.length} findings from topography discovery`,
      attempted: true,
      completed: true,
      passed: investigation.findings.length > 0,
      isExecution: false,
    });

    const reproClaim = verifier.recordClaim({
      statement: `Bug reproduction: ${options.bugDescription}`,
      category: 'regression_check',
      rationale: reproductionSession.summary,
    });

    verifier.addCheck(reproClaim.id, {
      name: 'Automated Reproduction Execution Check',
      type: 'dynamic_execution',
      description: `Execution outcome for ${reproductionSession.reproductionCommand || 'reproduction script'}`,
      attempted: reproductionSession.initialExecution !== undefined,
      completed: reproductionSession.initialExecution !== undefined,
      passed: reproductionSession.isReproduced,
      isExecution: true,
      commandExecuted: reproductionSession.initialExecution?.command,
      exitCode: reproductionSession.initialExecution?.exitCode,
      error: reproductionSession.isReproduced ? undefined : 'Failure was not reproduced with command',
    });

    if (impactReport) {
      const impactClaim = verifier.recordClaim({
        statement: `Change impact analyzed for target: ${targetFile}`,
        category: 'general',
        rationale: `Detected ${impactReport.reverseDependencies.length} reverse dependencies and risk score ${impactReport.riskScore}`,
      });

      verifier.addCheck(impactClaim.id, {
        name: 'Dependency Graph Static Analysis',
        type: 'static_analysis',
        description: `Risk level evaluated as ${impactReport.riskLevel}`,
        attempted: true,
        completed: true,
        passed: true,
        isExecution: false,
      });
    }

    const proofReport = verifier.generateReport(workflowId);

    const suggestedNextSteps: string[] = [
      ...proofReport.suggestedNextSteps,
      ...(impactReport?.recommendedValidationSteps || []),
    ];

    const completedAt = new Date();
    const summary = `Unified Engineering Workflow completed at revision ${proofReport.revisionHash.slice(0, 8) || 'working-tree'}. Proof status: [${proofReport.overallStatus.toUpperCase()}]. Reproduction status: [${reproductionSession.status}]. Impact Risk: [${impactReport ? impactReport.riskLevel.toUpperCase() : 'UNKNOWN'}].`;

    return {
      id: workflowId,
      repositoryPath: repoPath,
      bugDescription: options.bugDescription,
      startedAt,
      completedAt,
      investigation,
      impactReport,
      stageFailures,
      reproductionSession,
      proofReport,
      decisionMemories: relevantMemories,
      memoryConflicts,
      autonomyPolicy,
      proposedFix,
      status: proofReport.overallStatus,
      summary,
      suggestedNextSteps: [...new Set(suggestedNextSteps)],
    };
  }

  formatReport(report: UnifiedEngineeringReport): string {
    const lines: string[] = [];
    lines.push('================================================================================');
    lines.push('                   ANVEXO UNIFIED ENGINEERING REPORT                            ');
    lines.push('================================================================================');
    lines.push(`Workflow ID:     ${report.id}`);
    lines.push(`Repository:      ${report.repositoryPath}`);
    lines.push(`Objective:       ${report.bugDescription}`);
    lines.push(`Status:          [${report.status.toUpperCase()}]`);
    lines.push(`Started:         ${report.startedAt.toISOString()}`);
    lines.push(`Completed:       ${report.completedAt.toISOString()}`);
    lines.push(`Autonomy Policy: [${report.autonomyPolicy.mode.toUpperCase()}]`);
    lines.push('--------------------------------------------------------------------------------');

    if (report.stageFailures.length > 0) {
      lines.push('RECOVERED WORKFLOW STAGE FAILURES:');
      for (const failure of report.stageFailures) {
        lines.push(`  ! ${failure.stage}: ${failure.message}`);
      }
      lines.push('--------------------------------------------------------------------------------');
    }

    if (report.reproductionSession) {
      lines.push('BUG REPRODUCTION:');
      lines.push(`  Status:      [${report.reproductionSession.status.toUpperCase()}]`);
      lines.push(`  Reproduced:  ${report.reproductionSession.isReproduced ? 'YES' : 'NO'}`);
      lines.push(`  Command:     ${report.reproductionSession.reproductionCommand || 'None'}`);
      lines.push(`  Summary:     ${report.reproductionSession.summary}`);
      lines.push('--------------------------------------------------------------------------------');
    }

    if (report.impactReport) {
      lines.push('CHANGE IMPACT SIMULATION:');
      lines.push(`  Target:               ${report.impactReport.target}`);
      lines.push(`  Risk Level:           [${report.impactReport.riskLevel.toUpperCase()}] (${report.impactReport.riskScore}/100)`);
      lines.push(`  Reverse Dependencies: ${report.impactReport.reverseDependencies.length} modules`);
      lines.push(`  Relevant Tests:       ${report.impactReport.relatedTests.length}`);
      lines.push(`  Security Flows:       ${report.impactReport.securityFlows.length}`);
      lines.push('--------------------------------------------------------------------------------');
    }

    if (report.memoryConflicts.length > 0) {
      lines.push('PROJECT DECISION MEMORY CONFLICT WARNINGS:');
      for (const mc of report.memoryConflicts) {
        lines.push(`  ! [${mc.severity.toUpperCase()}] ${mc.summary}`);
        lines.push(`    ${mc.explanation}`);
      }
      lines.push('--------------------------------------------------------------------------------');
    }

    lines.push('PROOF MODE VERIFICATION SUMMARY:');
    lines.push(`  Overall:             [${report.proofReport.overallStatus.toUpperCase()}]`);
    lines.push(`  Checks Passed:       ${report.proofReport.checksPassedCount}/${report.proofReport.checksAttemptedCount} (${report.proofReport.checksFailedCount} failed)`);
    lines.push(`  Dynamic Executions:  ${report.proofReport.dynamicExecutionsCount}`);
    lines.push(`  Static Analyses:     ${report.proofReport.staticAnalysesCount}`);
    for (const c of report.proofReport.claims) {
      lines.push(`    - [${c.status.toUpperCase()}] ${c.statement}`);
    }
    lines.push('--------------------------------------------------------------------------------');

    if (report.suggestedNextSteps.length > 0) {
      lines.push('RECOMMENDED NEXT STEPS:');
      for (const step of report.suggestedNextSteps) {
        lines.push(`  → ${step}`);
      }
      lines.push('--------------------------------------------------------------------------------');
    }

    lines.push(`SUMMARY: ${report.summary}`);
    lines.push('================================================================================');
    return lines.join('\n');
  }
}
