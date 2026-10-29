import { describe, it, expect } from 'vitest';
import { InvestigationEngine } from '../../src/engine/index.js';
import * as path from 'node:path';

describe('InvestigationEngine', () => {
  it('investigates the ANVEXO project itself', async () => {
    const engine = new InvestigationEngine();
    const report = await engine.investigate({
      objective: 'General project health check',
      repositoryPath: path.resolve(process.cwd()),
      autoApprove: true,
      skipTests: true,
    });

    expect(report.id).toBeTruthy();
    expect(report.objective).toBe('General project health check');
    expect(report.projectMetadata.name).toBe('anvexo');
    expect(report.projectMetadata.languages).toContain('typescript');
    expect(report.evidence.length).toBeGreaterThan(0);
    expect(report.plan.steps.length).toBeGreaterThan(0);

    const completedSteps = report.plan.steps.filter(s => s.status === 'completed');
    expect(completedSteps.length).toBeGreaterThan(0);

    expect(report.limitations).toBeDefined();
    expect(report.limitations.length).toBeGreaterThan(0);
    expect(report.startedAt).toBeInstanceOf(Date);
    expect(report.completedAt).toBeInstanceOf(Date);
  });

  it('produces a formatted report', async () => {
    const engine = new InvestigationEngine();
    const report = await engine.investigate({
      objective: 'Quick check',
      repositoryPath: path.resolve(process.cwd()),
      autoApprove: true,
      skipTests: true,
    });

    const formatted = engine.formatReport(report);
    expect(formatted).toContain('ANVEXO INVESTIGATION REPORT');
    expect(formatted).toContain('Quick check');
    expect(formatted).toContain('EVIDENCE COLLECTED');
    expect(formatted).toContain('LIMITATIONS');
    expect(formatted).toContain('END OF REPORT');
  });

  it('handles nonexistent repository gracefully', async () => {
    const engine = new InvestigationEngine();
    const report = await engine.investigate({
      objective: 'Test error handling',
      repositoryPath: '/nonexistent/repo/path/xyz',
      autoApprove: true,
    });

    expect(report.limitations.some(l => l.includes('discovery failed'))).toBe(true);
    expect(report.evidence).toHaveLength(0);
  });

  it('skips steps without permission', async () => {
    const engine = new InvestigationEngine();
    const report = await engine.investigate({
      objective: 'No permissions test',
      repositoryPath: path.resolve(process.cwd()),
      autoApprove: false,
      skipTests: true,
    });

    const failedSteps = report.plan.steps.filter(s => s.status === 'failed');
    expect(failedSteps.length).toBeGreaterThan(0);
  });

  it('reports findings with evidence links', async () => {
    const engine = new InvestigationEngine();
    const report = await engine.investigate({
      objective: 'Check findings generation',
      repositoryPath: path.resolve(process.cwd()),
      autoApprove: true,
      skipTests: true,
    });

    expect(report.findings.length).toBeGreaterThan(0);
    for (const finding of report.findings) {
      expect(finding.claim).toBeTruthy();
      expect(finding.verificationStatus).toBeTruthy();
      expect(typeof finding.confidence).toBe('number');
    }
  });
});
