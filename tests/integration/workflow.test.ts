import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'node:path';
import { EngineeringWorkflowRunner } from '../../src/engine/workflow.js';
import { InvestigationEngine } from '../../src/engine/index.js';
import { DecisionMemoryManager } from '../../src/memory/manager.js';
import { ChangeImpactSimulator } from '../../src/impact/index.js';

describe('EngineeringWorkflowRunner Integration', () => {
  const repoRoot = path.resolve(process.cwd());
  let runner: EngineeringWorkflowRunner;

  beforeEach(() => {
    runner = new EngineeringWorkflowRunner(repoRoot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('executes full 8-stage engineering workflow across all 5 capabilities', async () => {
    const report = await runner.run({
      repositoryPath: repoRoot,
      bugDescription: 'Verify token expiration in authentication flow',
      targetFile: 'src/server/router.ts',
      reproductionCommand: 'node -e "process.exit(1)"',
      autonomyMode: 'assisted',
      autoApprove: true,
      skipTests: true,
    });

    expect(report.id).toBeTruthy();
    expect(report.repositoryPath).toBe(repoRoot);
    expect(report.bugDescription).toBe('Verify token expiration in authentication flow');
    expect(report.startedAt).toBeInstanceOf(Date);
    expect(report.completedAt).toBeInstanceOf(Date);

    expect(report.investigation).toBeDefined();
    expect(report.investigation.evidence.length).toBeGreaterThan(0);

    expect(report.impactReport).toBeDefined();
    expect(report.impactReport?.target).toBe('src/server/router.ts');
    expect(report.impactReport?.affectedEndpoints.length).toBeGreaterThan(0);

    expect(report.reproductionSession).toBeDefined();
    expect(report.reproductionSession?.isReproduced).toBe(true);
    expect(report.reproductionSession?.status).toBe('reproduced_failure');

    expect(report.proofReport).toBeDefined();
    expect(report.proofReport.claims.length).toBeGreaterThan(0);
    expect(report.proofReport.checksAttemptedCount).toBeGreaterThan(0);
    expect(report.proofReport.dynamicExecutionsCount).toBeGreaterThan(0);

    expect(report.autonomyPolicy).toBeDefined();
    expect(report.autonomyPolicy.mode).toBe('assisted');

    expect(report.summary).toBeTruthy();
    expect(report.suggestedNextSteps.length).toBeGreaterThan(0);
  });

  it('detects memory conflicts and provides context from previous engineering decisions', async () => {
    const memoryMgr = new DecisionMemoryManager(repoRoot);
    await memoryMgr.recordDecision({
      repositoryPath: repoRoot,
      type: 'rejected_solution',
      summary: 'Never use hardcoded jwt secret in router',
      detailedExplanation: 'Hardcoded jwt secrets violate security policy and cause token verification failures',
      relatedFiles: ['src/server/router.ts'],
    });

    const report = await runner.run({
      repositoryPath: repoRoot,
      bugDescription: 'router jwt secret fallback',
      targetFile: 'src/server/router.ts',
      reproductionCommand: 'node -e "process.exit(0)"',
      autonomyMode: 'observe',
      autoApprove: true,
      skipTests: true,
    });

    expect(report.reproductionSession?.isReproduced).toBe(false);
    expect(report.decisionMemories.length).toBeGreaterThan(0);
    expect(report.decisionMemories.some(m => m.summary.includes('jwt secret'))).toBe(true);
  });

  it('exposes executeWorkflow directly on InvestigationEngine', async () => {
    const engine = new InvestigationEngine();
    const report = await engine.executeWorkflow({
      repositoryPath: repoRoot,
      bugDescription: 'Permission check validation in autonomy engine',
      targetFile: 'src/autonomy/engine.ts',
      reproductionCommand: 'node -e "process.exit(1)"',
      autonomyMode: 'controlled_autonomous',
      autoApprove: true,
      skipTests: true,
    });

    expect(report.id).toBeTruthy();
    expect(report.impactReport).toBeDefined();
    expect(report.proofReport).toBeDefined();
    expect(report.autonomyPolicy.mode).toBe('controlled_autonomous');
  });

  it('recovers when impact analysis fails and reports the failed stage', async () => {
    vi.spyOn(ChangeImpactSimulator.prototype, 'simulate')
      .mockRejectedValue(new Error('Impact analysis unavailable'));

    const report = await runner.run({
      repositoryPath: repoRoot,
      bugDescription: 'Recover from impact analysis failure',
      targetFile: 'src/engine/workflow.ts',
      reproductionCommand: 'node -e "process.exit(1)"',
      autoApprove: true,
      skipTests: true,
    });

    expect(report.stageFailures).toEqual([{
      stage: 'impact_analysis',
      message: 'Impact analysis unavailable',
    }]);
    expect(runner.formatReport(report)).toContain('impact_analysis: Impact analysis unavailable');
    expect(report.reproductionSession).toBeDefined();
    expect(report.proofReport.claims.length).toBeGreaterThan(0);
  });

  it('returns available workflow results when impact analysis is unavailable', async () => {
    vi.spyOn(ChangeImpactSimulator.prototype, 'simulate')
      .mockRejectedValue(new Error('simulator timed out'));

    const report = await runner.run({
      repositoryPath: repoRoot,
      bugDescription: 'Preserve partial workflow results',
      targetFile: 'src/engine/workflow.ts',
      reproductionCommand: 'node -e "process.exit(0)"',
      autoApprove: true,
      skipTests: true,
    });

    expect(report.impactReport).toBeUndefined();
    expect(report.investigation.evidence.length).toBeGreaterThan(0);
    expect(report.reproductionSession).toBeDefined();
    expect(report.proofReport.claims.length).toBeGreaterThan(0);
    expect(report.stageFailures).toHaveLength(1);
  });
});
