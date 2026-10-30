import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  formatReport,
  formatMarkdownReport,
  formatJsonReport,
  saveReport,
  listSavedReports,
  loadSavedReport,
} from '../../src/reporting/index.js';
import { InvestigationEngine } from '../../src/engine/index.js';
import {
  EvidenceType,
  VerificationStatus,
  type InvestigationReport,
  type Finding,
  type EvidenceRecord,
} from '../../src/core/types.js';

describe('Reporting Subsystem', () => {
  let tempDir: string;

  const mockEvidence: EvidenceRecord[] = [
    {
      id: 'ev-1',
      type: EvidenceType.PROJECT_METADATA,
      source: 'package.json',
      content: '{"name": "test-repo", "version": "1.0.0"}',
      timestamp: new Date('2026-10-30T10:00:00Z'),
      toolName: 'file_read',
      verificationStatus: VerificationStatus.OBSERVED,
      linkedHypothesisIds: [],
      metadata: {},
    },
    {
      id: 'ev-2',
      type: EvidenceType.GIT_DIFF,
      source: 'git diff',
      content: '- const x = 1;\n+ const x = 2;',
      timestamp: new Date('2026-10-30T10:01:00Z'),
      toolName: 'git_diff',
      verificationStatus: VerificationStatus.VERIFIED,
      linkedHypothesisIds: ['hyp-1'],
      metadata: {},
    },
    {
      id: 'ev-3',
      type: EvidenceType.TEST_RESULT,
      source: 'npm test',
      content: 'Tests: 1 failed | 5 passed',
      timestamp: new Date('2026-10-30T10:02:00Z'),
      toolName: 'test_run',
      verificationStatus: VerificationStatus.OBSERVED,
      linkedHypothesisIds: ['hyp-1'],
      metadata: {},
    },
  ];

  const mockReport: InvestigationReport = {
    id: 'test-report-uuid-1234',
    objective: 'Diagnose memory leak and uncommitted diffs',
    repositoryPath: '/workspace/test-repo',
    projectMetadata: {
      rootPath: '/workspace/test-repo',
      name: 'test-repo',
      languages: ['typescript', 'javascript'],
      frameworks: ['express'],
      packageManager: 'npm',
      testRunner: 'vitest',
      hasGit: true,
      configFiles: ['package.json', 'tsconfig.json'],
    },
    plan: {
      id: 'plan-1',
      objective: 'Diagnose memory leak',
      steps: [
        {
          id: 'step-1',
          description: 'Read package.json manifest | check dependencies',
          toolName: 'file_read',
          parameters: { path: 'package.json' },
          status: 'completed',
          evidenceIds: ['ev-1'],
        },
        {
          id: 'step-2',
          description: 'Execute test suite\nmulti-line description',
          toolName: 'test_run',
          parameters: {},
          status: 'failed',
          error: 'Test execution process exited with 1',
          evidenceIds: ['ev-3'],
        },
      ],
      createdAt: new Date('2026-10-30T10:00:00Z'),
    },
    evidence: mockEvidence,
    hypotheses: [
      {
        id: 'hyp-1',
        statement: 'Memory leak caused by unclosed event listener | in server.ts',
        status: 'supported',
        supportingEvidenceIds: ['ev-2', 'ev-3'],
        contradictingEvidenceIds: [],
      },
    ],
    findings: [
      {
        claim: 'Test suite failure detected | requires patch',
        evidenceIds: ['ev-3'],
        verificationStatus: VerificationStatus.VERIFIED,
        confidence: 0.95,
        details: 'Vitest reported 1 failed test case in auth.test.ts',
      },
    ],
    limitations: [
      'Docker daemon was offline; containerized tests were skipped',
    ],
    unverifiedClaims: [
      'Production cluster might have different memory limits',
    ],
    proofReport: {
      investigationId: 'test-report-uuid-1234',
      generatedAt: new Date('2026-10-30T10:03:00Z'),
      overallStatus: 'verified',
      checksAttemptedCount: 3,
      checksPassedCount: 3,
      checksFailedCount: 0,
      dynamicExecutionsCount: 2,
      staticAnalysesCount: 1,
      revisionHash: 'abc1234',
      claims: [
        {
          id: 'claim-1',
          statement: 'Tests pass under node 20',
          category: 'test_execution',
          status: 'verified',
          checks: [
            {
              id: 'chk-1',
              name: 'Vitest run',
              type: 'test_run',
              description: 'Ran vitest run',
              attempted: true,
              completed: true,
              passed: true,
              timestamp: new Date('2026-10-30T10:02:30Z'),
              isExecution: true,
            },
          ],
        },
      ],
      suggestedNextSteps: ['Run load tests with k6'],
    },
    startedAt: new Date('2026-10-30T10:00:00Z'),
    completedAt: new Date('2026-10-30T10:03:00Z'),
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anvexo-reporting-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('formatMarkdownReport', () => {
    it('produces valid GitHub Flavored Markdown with clean tables and headers', () => {
      const md = formatMarkdownReport(mockReport);

      expect(md).toContain('# ANVEXO Investigation Report');
      expect(md).toContain('`test-report-uuid-1234`');
      expect(md).toContain('Diagnose memory leak and uncommitted diffs');
      expect(md).toContain('## Executive Summary & Metadata');
      expect(md).toContain('| **Project Name** | **test-repo** |');
      expect(md).toContain('| **Languages** | typescript, javascript |');
      expect(md).toContain('| **Package Manager** | `npm` |');
      expect(md).toContain('| **Test Runner** | `vitest` |');
      expect(md).toContain('| **Total Duration** | 3.0min |');
      expect(md).toContain('## Diagnostic Plan Execution (2 Steps)');
      expect(md).toContain('## Ground-Truth Findings (1)');
      expect(md).toContain('## Evaluated Hypotheses (1)');
      expect(md).toContain('## Unverified Claims & Inferences');
      expect(md).toContain('## Proof Mode Verification');
      expect(md).toContain('## Evidence Ledger (3 Records)');
      expect(md).toContain('## Disclosed Limitations & Boundary Conditions');
      expect(md).toContain('```diff');
      expect(md).toContain('- const x = 1;\n+ const x = 2;');
    });

    it('escapes pipes and newlines inside table cells to prevent broken tables', () => {
      const md = formatMarkdownReport(mockReport);
      const tableLines = md.split('\n').filter(l => l.startsWith('|'));

      expect(tableLines.length).toBeGreaterThan(5);
      tableLines.forEach(line => {
        expect(line.startsWith('|')).toBe(true);
        expect(line.endsWith('|')).toBe(true);
      });

      expect(md).toContain('Read package.json manifest \\| check dependencies');
      expect(md).toContain('Execute test suite<br/>multi-line description');
      expect(md).toContain('Memory leak caused by unclosed event listener \\| in server.ts');
    });

    it('handles minimal report without proofReport, hypotheses, or findings gracefully', () => {
      const minimalReport: InvestigationReport = {
        id: 'minimal-123',
        objective: 'Minimal scan',
        repositoryPath: '/test',
        projectMetadata: {
          rootPath: '/test',
          name: '',
          languages: [],
          frameworks: [],
          configFiles: [],
          hasGit: false,
        },
        plan: { id: 'p-1', objective: 'Scan', steps: [], createdAt: new Date() },
        evidence: [],
        hypotheses: [],
        findings: [],
        limitations: [],
        unverifiedClaims: [],
        startedAt: new Date(),
        completedAt: new Date(),
      };

      const md = formatMarkdownReport(minimalReport);
      expect(md).toContain('# ANVEXO Investigation Report');
      expect(md).toContain('`minimal-123`');
      expect(md).not.toContain('## Ground-Truth Findings');
      expect(md).not.toContain('## Evaluated Hypotheses');
      expect(md).not.toContain('## Proof Mode Verification');
      expect(md).not.toContain('## Disclosed Limitations');
    });
  });

  describe('formatJsonReport', () => {
    it('produces formatted JSON containing full investigation report data', () => {
      const jsonStr = formatJsonReport(mockReport);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.id).toBe('test-report-uuid-1234');
      expect(parsed.objective).toBe('Diagnose memory leak and uncommitted diffs');
      expect(parsed.projectMetadata.name).toBe('test-repo');
      expect(parsed.plan.steps.length).toBe(2);
      expect(parsed.evidence.length).toBe(3);
      expect(parsed.hypotheses.length).toBe(1);
      expect(parsed.findings.length).toBe(1);
      expect(parsed.proofReport.overallStatus).toBe('verified');
    });
  });

  describe('saveReport and disk persistence', () => {
    it('persists JSON and Markdown files under .anvexo/reports/ directory', async () => {
      const { jsonPath, markdownPath } = await saveReport(mockReport, tempDir);

      expect(fs.existsSync(jsonPath)).toBe(true);
      expect(fs.existsSync(markdownPath)).toBe(true);
      expect(jsonPath).toBe(path.join(tempDir, '.anvexo', 'reports', 'report-test-report-uuid-1234.json'));
      expect(markdownPath).toBe(path.join(tempDir, '.anvexo', 'reports', 'report-test-report-uuid-1234.md'));

      const jsonContent = fs.readFileSync(jsonPath, 'utf8');
      const mdContent = fs.readFileSync(markdownPath, 'utf8');

      expect(JSON.parse(jsonContent).id).toBe('test-report-uuid-1234');
      expect(mdContent).toContain('# ANVEXO Investigation Report');
    });

    it('lists saved report files in repository reports directory', async () => {
      expect(listSavedReports(tempDir)).toEqual([]);

      await saveReport(mockReport, tempDir);
      const list = listSavedReports(tempDir);

      expect(list).toContain('report-test-report-uuid-1234.json');
      expect(list).toContain('report-test-report-uuid-1234.md');
    });

    it('loads saved report from disk and reconstructs Date objects', async () => {
      await saveReport(mockReport, tempDir);

      const loaded = loadSavedReport('test-report-uuid-1234', tempDir);
      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe('test-report-uuid-1234');
      expect(loaded?.startedAt).toBeInstanceOf(Date);
      expect(loaded?.completedAt).toBeInstanceOf(Date);
      expect(loaded?.evidence[0].timestamp).toBeInstanceOf(Date);

      const loadedByPath = loadSavedReport(path.join(tempDir, '.anvexo', 'reports', 'report-test-report-uuid-1234.json'), tempDir);
      expect(loadedByPath?.id).toBe('test-report-uuid-1234');
    });

    it('returns null when loading non-existent report', () => {
      const result = loadSavedReport('non-existent-report-id', tempDir);
      expect(result).toBeNull();
    });
  });

  describe('InvestigationEngine Integration', () => {
    it('exposes report formatting and auto-persists report during investigation', async () => {
      const packageJsonPath = path.join(tempDir, 'package.json');
      fs.writeFileSync(packageJsonPath, JSON.stringify({ name: 'integration-sample', version: '0.1.0' }));

      const engine = new InvestigationEngine();
      expect(typeof engine.formatReport).toBe('function');
      expect(typeof engine.formatMarkdownReport).toBe('function');
      expect(typeof engine.formatJsonReport).toBe('function');
      expect(typeof engine.saveReport).toBe('function');

      const report = await engine.investigate({
        objective: 'Test auto persistence',
        repositoryPath: tempDir,
        autoApprove: true,
        skipTests: true,
      });

      expect(report.id).toBeDefined();

      const expectedJson = path.join(tempDir, '.anvexo', 'reports', `report-${report.id}.json`);
      const expectedMd = path.join(tempDir, '.anvexo', 'reports', `report-${report.id}.md`);

      expect(fs.existsSync(expectedJson)).toBe(true);
      expect(fs.existsSync(expectedMd)).toBe(true);

      const formattedMd = engine.formatMarkdownReport(report);
      expect(formattedMd).toContain('# ANVEXO Investigation Report');
      expect(formattedMd).toContain(report.id);

      const formattedJson = engine.formatJsonReport(report);
      expect(JSON.parse(formattedJson).id).toBe(report.id);
    });
  });
});
