import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  parseAndValidateGitHubUrl,
  normalizeGitHubUrl,
  getMockRepositoriesList,
  generateMockReport,
  GitHubClient,
  GitHubRepositoryAnalyzer,
  GitHubHistoryStore,
  GitHubJobManager,
  exportReportAsMarkdown,
  exportReportAsJson,
  exportReportAsHtml,
} from '../../src/github/index.js';

describe('GitHub Repository Intelligence Platform', () => {
  const testRoot = path.join(process.cwd(), 'tests', 'fixtures', 'temp-github-test');

  beforeEach(() => {
    if (!fs.existsSync(testRoot)) {
      fs.mkdirSync(testRoot, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  describe('Phase 1: URL Validation and Parsing', () => {
    it('parses valid HTTPS GitHub repository URLs', () => {
      const parsed = parseAndValidateGitHubUrl('https://github.com/dr5t/ANVEXO');
      expect(parsed.owner).toBe('dr5t');
      expect(parsed.repo).toBe('ANVEXO');
      expect(parsed.host).toBe('github.com');
      expect(parsed.isMock).toBe(false);
      expect(parsed.originalUrl).toBe('https://github.com/dr5t/ANVEXO');
    });

    it('parses GitHub URLs ending with .git', () => {
      const parsed = parseAndValidateGitHubUrl('https://github.com/owner/my-service.git');
      expect(parsed.owner).toBe('owner');
      expect(parsed.repo).toBe('my-service');
      expect(parsed.isMock).toBe(false);
    });

    it('parses git SSH format (git@github.com:owner/repo.git)', () => {
      const parsed = parseAndValidateGitHubUrl('git@github.com:facebook/react.git');
      expect(parsed.owner).toBe('facebook');
      expect(parsed.repo).toBe('react');
      expect(parsed.isMock).toBe(false);
    });

    it('parses shorthand owner/repo notation', () => {
      const parsed = parseAndValidateGitHubUrl('dr5t/ANVEXO');
      expect(parsed.owner).toBe('dr5t');
      expect(parsed.repo).toBe('ANVEXO');
      expect(parsed.originalUrl).toBe('https://github.com/dr5t/ANVEXO');
    });

    it('parses mock:// scheme for simulated test scenarios', () => {
      const parsed = parseAndValidateGitHubUrl('mock://dr5t/ANVEXO-demo');
      expect(parsed.owner).toBe('dr5t');
      expect(parsed.repo).toBe('ANVEXO-demo');
      expect(parsed.isMock).toBe(true);
    });

    it('rejects unsupported or dangerous protocol schemes', () => {
      expect(() => parseAndValidateGitHubUrl('file:///etc/passwd')).toThrow(/Unsupported or dangerous protocol scheme/);
      expect(() => parseAndValidateGitHubUrl('javascript:alert(1)')).toThrow(/Unsupported or dangerous protocol scheme/);
      expect(() => parseAndValidateGitHubUrl('ftp://ftp.example.com/repo')).toThrow(/Unsupported or dangerous protocol scheme/);
    });

    it('rejects path traversal attempts in owner or repo name', () => {
      expect(() => parseAndValidateGitHubUrl('https://github.com/../../etc/passwd')).toThrow(/Invalid characters/);
      expect(() => parseAndValidateGitHubUrl('https://github.com/owner/..')).toThrow(/Invalid characters/);
    });

    it('rejects non-GitHub hosts', () => {
      expect(() => parseAndValidateGitHubUrl('https://gitlab.com/owner/repo')).toThrow(/Unsupported host/);
    });

    it('normalizes repository URL', () => {
      const normalized = normalizeGitHubUrl('https://github.com/dr5t/ANVEXO.git');
      expect(normalized).toBe('https://github.com/dr5t/ANVEXO');
    });
  });

  describe('Phase 8: Deterministic Mock Scenarios', () => {
    it('returns the list of available mock demo repositories', () => {
      const list = getMockRepositoriesList();
      expect(list.length).toBeGreaterThanOrEqual(4);
      expect(list.some(r => r.id === 'dr5t/ANVEXO-demo')).toBe(true);
      expect(list.some(r => r.id === 'sample/payment-gateway')).toBe(true);
    });

    it('generates a healthy mock report for dr5t/ANVEXO-demo', () => {
      const report = generateMockReport('dr5t', 'ANVEXO-demo');
      expect(report.isMock).toBe(true);
      expect(report.repository.owner).toBe('dr5t');
      expect(report.repository.repo).toBe('ANVEXO-demo');
      expect(report.finalConclusion.overallStatus).toBe('Healthy within the scope checked');
      expect(report.testExecution.status).toBe('all_passed');
      expect(report.testExecution.passedCount).toBe(304);
      expect(report.testExecution.failedCount).toBe(0);
      expect(report.contributors.length).toBe(2);
      expect(report.developmentTimeline.length).toBe(4);
      expect(report.stagesCompleted.length).toBe(14);
      expect(report.finalConclusion.answers.whatProjectDoes).toContain('ANVEXO');
    });

    it('generates an issue-heavy report for sample/payment-gateway', () => {
      const report = generateMockReport('sample', 'payment-gateway');
      expect(report.finalConclusion.overallStatus).toBe('Significant issues detected');
      expect(report.testExecution.status).toBe('has_failures');
      expect(report.testExecution.failedTestDetails.length).toBeGreaterThan(0);
      expect(report.securityFindings.some(f => f.severity === 'high')).toBe(true);
      expect(report.finalConclusion.prioritizedRemediationPlan.some(r => r.priority === 'P0' || r.priority === 'P1')).toBe(true);
    });

    it('generates dormant indicators for legacy/express-api', () => {
      const report = generateMockReport('legacy', 'express-api');
      expect(report.finalConclusion.overallStatus).toBe('Needs attention');
      expect(report.maintenanceIndicators.commitFrequency).toBe('low');
      expect(report.maintenanceIndicators.busFactorRisk).toBe('high');
    });

    it('generates partial incomplete report for timeout/incomplete-job', () => {
      const report = generateMockReport('timeout', 'incomplete-job');
      expect(report.finalConclusion.overallStatus).toBe('Incomplete investigation');
      expect(report.stagesFailed.length).toBeGreaterThan(0);
    });
  });

  describe('Phases 9 & 10: 14-Stage Investigation Pipeline', () => {
    it('executes all 14 stages and reports progress events in mock mode', async () => {
      const analyzer = new GitHubRepositoryAnalyzer();
      const events: string[] = [];

      const report = await analyzer.analyze('mock://dr5t/ANVEXO-demo', {
        mockMode: true,
        onProgress: (evt) => {
          events.push(evt.stage);
        },
      });

      expect(report).toBeDefined();
      expect(report.stagesCompleted.length).toBe(14);
      expect(report.durationMs).toBeGreaterThan(0);
      expect(events).toContain('validate_url');
      expect(events).toContain('fetch_metadata');
      expect(events).toContain('finalize_report');
    });

    it('deduplicates findings with identical titles and files', async () => {
      const report = generateMockReport('sample', 'payment-gateway');
      const keys = new Set();
      for (const f of report.securityFindings) {
        const key = `${f.title}:${f.file}`;
        expect(keys.has(key)).toBe(false);
        keys.add(key);
      }
    });

    it('answers all 10 core questions in the final conclusion', async () => {
      const report = generateMockReport('dr5t', 'ANVEXO-demo');
      const answers = report.finalConclusion.answers;
      expect(answers.whatProjectDoes).toBeTruthy();
      expect(answers.howStructured).toBeTruthy();
      expect(answers.developmentHistoryVisible).toBeTruthy();
      expect(answers.contributorsAndComponents).toBeTruthy();
      expect(answers.whatIsWorking).toBeTruthy();
      expect(answers.whatIsFailing).toBeTruthy();
      expect(answers.verifiedIssues).toBeDefined();
      expect(answers.needsFurtherInvestigation).toBeDefined();
      expect(answers.isReadyForIntendedUse).toBeTruthy();
      expect(answers.whatToFixFirst).toBeDefined();
    });
  });

  describe('Phase 12: Report Exports', () => {
    const report = generateMockReport('dr5t', 'ANVEXO-demo');

    it('exports report as Markdown containing MOCK MODE warning', () => {
      const md = exportReportAsMarkdown(report);
      expect(md).toContain('# ANVEXO GitHub Repository Intelligence Report');
      expect(md).toContain('MOCK MODE SIMULATION');
      expect(md).toContain('1. Executive Summary');
      expect(md).toContain('10 Core Answers');
      expect(md).toContain('HEALTHY WITHIN THE SCOPE CHECKED');
    });

    it('exports report as valid JSON', () => {
      const jsonStr = exportReportAsJson(report);
      const parsed = JSON.parse(jsonStr);
      expect(parsed.id).toBe(report.id);
      expect(parsed.isMock).toBe(true);
      expect(parsed.repository.owner).toBe('dr5t');
      expect(parsed.testExecution.passedCount).toBe(304);
    });

    it('exports report as standalone HTML', () => {
      const html = exportReportAsHtml(report);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('ANVEXO Repository Intelligence Report');
      expect(html).toContain('MOCK MODE SIMULATION');
      expect(html).toContain('dr5t/ANVEXO-demo');
    });
  });

  describe('Phase 1: History Store and Job Management', () => {
    it('persists, retrieves, lists, and deletes investigation reports', () => {
      const store = new GitHubHistoryStore(testRoot);
      const report = generateMockReport('dr5t', 'ANVEXO-demo');

      // Save
      store.saveReport(report);

      // Get
      const loaded = store.getReport(report.id);
      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe(report.id);
      expect(loaded?.repository.owner).toBe('dr5t');

      // List
      const recents = store.listRecent();
      expect(recents.length).toBe(1);
      expect(recents[0].repo).toBe('ANVEXO-demo');

      // Delete
      const deleted = store.deleteReport(report.id);
      expect(deleted).toBe(true);
      expect(store.getReport(report.id)).toBeNull();
    });

    it('manages investigation jobs with JobManager', async () => {
      const jobManager = new GitHubJobManager(testRoot);
      const job = jobManager.createJob('mock://dr5t/ANVEXO-demo', true);
      expect(job.status).toBe('pending');

      const promise = jobManager.startJob(job.id);
      const completedReport = await promise;

      expect(completedReport).toBeDefined();
      const updatedJob = jobManager.getJob(job.id);
      expect(updatedJob?.status).toBe('completed');
      expect(updatedJob?.report).toBeDefined();

      const jobsList = jobManager.listJobs();
      expect(jobsList.some(j => j.id === job.id)).toBe(true);

      // Retry
      const retried = jobManager.retryJob(job.id);
      expect(retried).toBeDefined();
      expect(retried?.id).not.toBe(job.id);
    });

    it('supports cancelling a running job', () => {
      const jobManager = new GitHubJobManager(testRoot);
      const job = jobManager.createJob('mock://dr5t/ANVEXO-demo', true);
      job.status = 'running';

      const cancelled = jobManager.cancelJob(job.id);
      expect(cancelled).toBe(true);
      expect(job.status).toBe('cancelled');
    });
  });
});
