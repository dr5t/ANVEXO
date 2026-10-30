import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import { ChangeImpactSimulator } from '../../src/impact/simulator.js';

describe('ChangeImpactSimulator', () => {
  let simulator: ChangeImpactSimulator;
  const repoRoot = process.cwd();

  beforeEach(() => {
    simulator = new ChangeImpactSimulator(repoRoot);
  });

  it('identifies direct dependencies of a core file', async () => {
    const report = await simulator.simulate('src/engine/index.ts');
    expect(report.target).toBe('src/engine/index.ts');
    expect(report.directDependencies.length).toBeGreaterThan(0);
    expect(report.directDependencies.some(d => d.includes('core'))).toBe(true);
  });

  it('identifies downstream reverse dependencies of imported modules', async () => {
    const report = await simulator.simulate('src/core/types.ts');
    expect(report.reverseDependencies.length).toBeGreaterThan(0);
    expect(report.affectedModules.length).toBeGreaterThan(report.reverseDependencies.length);
  });

  it('detects affected HTTP API endpoints when modifying router', async () => {
    const report = await simulator.simulate('src/server/router.ts');
    expect(report.affectedEndpoints.length).toBeGreaterThan(0);
    expect(report.affectedEndpoints.some(ep => ep.path.includes('/api/'))).toBe(true);
  });

  it('detects security flows when target touches permissions or security', async () => {
    const report = await simulator.simulate('src/permissions/manager.ts');
    expect(report.securityFlows.length).toBeGreaterThan(0);
  });

  it('maps relevant test suites covering target file', async () => {
    const report = await simulator.simulate('src/permissions/manager.ts');
    expect(report.relatedTests.length).toBeGreaterThan(0);
    expect(report.relatedTests.some(t => t.includes('permission'))).toBe(true);
  });

  it('calculates risk score and risk level properly', async () => {
    const report = await simulator.simulate('src/server/router.ts');
    expect(report.riskScore).toBeGreaterThan(0);
    expect(['low', 'medium', 'high', 'critical']).toContain(report.riskLevel);
    expect(report.riskFactors.length).toBeGreaterThan(0);
  });

  it('supports incremental git diff analysis', async () => {
    const diff = `
diff --git a/src/cli/index.ts b/src/cli/index.ts
index 1234567..89abcdef 100644
--- a/src/cli/index.ts
+++ b/src/cli/index.ts
@@ -10,3 +10,4 @@
+import { test } from 'vitest';
`;
    const report = await simulator.simulate({
      target: 'src/cli/index.ts',
      proposedDiff: diff,
    });
    expect(report.target).toContain('src/cli/index.ts');
    expect(report.directDependencies).toBeDefined();
  });

  it('formats human readable report with recommendations', async () => {
    const report = await simulator.simulate('src/engine/index.ts');
    const formatted = simulator.formatReport(report);
    expect(formatted).toContain('ANVEXO CHANGE IMPACT SIMULATION REPORT');
    expect(formatted).toContain('Target:');
    expect(formatted).toContain('Risk Level:');
    expect(formatted).toContain('RECOMMENDED VALIDATION STEPS:');
  });
});
