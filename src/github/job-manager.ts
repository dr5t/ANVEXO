import { randomUUID } from 'node:crypto';
import type {
  GitHubJob,
  GitHubJobSummary,
  GitHubInvestigationReport,
  StoredInvestigationSummary,
  InvestigationProgressEvent,
} from './types.js';
import { parseAndValidateGitHubUrl } from './url-validator.js';
import { GitHubClient } from './client.js';
import { GitHubRepositoryAnalyzer } from './analyzer.js';
import { GitHubHistoryStore } from './history-store.js';

export class GitHubJobManager {
  private jobs: Map<string, GitHubJob> = new Map();
  private historyStore: GitHubHistoryStore;

  constructor(repoRoot: string = process.cwd()) {
    this.historyStore = new GitHubHistoryStore(repoRoot);
  }

  getHistoryStore(): GitHubHistoryStore {
    return this.historyStore;
  }

  createJob(url: string, isMock?: boolean, token?: string): GitHubJob {
    const parsed = parseAndValidateGitHubUrl(url);
    const mockMode = isMock ?? parsed.isMock;
    const id = `gh-job-${randomUUID().slice(0, 8)}`;
    const abortController = new AbortController();

    const job: GitHubJob = {
      id,
      url,
      owner: parsed.owner,
      repo: parsed.repo,
      isMock: mockMode,
      status: 'pending',
      currentStage: 'validate_url',
      stageIndex: 0,
      totalStages: 14,
      percentage: 0,
      events: [],
      report: null,
      startedAt: new Date().toISOString(),
      abortController,
      token,
    };

    this.jobs.set(id, job);
    return job;
  }

  startJob(jobId: string): Promise<GitHubInvestigationReport> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return Promise.reject(new Error(`GitHub investigation job ${jobId} not found`));
    }

    job.status = 'running';

    const client = new GitHubClient({ token: job.token });
    const analyzer = new GitHubRepositoryAnalyzer(client);

    return analyzer.analyze(job.url, {
      mockMode: job.isMock,
      abortSignal: job.abortController.signal,
      onProgress: (evt: InvestigationProgressEvent) => {
        job.currentStage = evt.stage;
        job.stageIndex = evt.stageIndex;
        job.totalStages = evt.totalStages;
        job.percentage = evt.percentage;
        job.events.push(evt);
      },
    })
      .then((report) => {
        job.status = 'completed';
        job.completedAt = new Date().toISOString();
        job.report = report;
        job.percentage = 100;
        this.historyStore.saveReport(report);
        return report;
      })
      .catch((err) => {
        if (job.abortController.signal.aborted) {
          job.status = 'cancelled';
          job.error = 'Investigation was cancelled by user';
        } else {
          job.status = 'failed';
          job.error = err instanceof Error ? err.message : String(err);
        }
        job.completedAt = new Date().toISOString();
        throw err;
      });
  }

  getJob(jobId: string): GitHubJob | undefined {
    return this.jobs.get(jobId);
  }

  listJobs(): GitHubJobSummary[] {
    return Array.from(this.jobs.values()).map((job) => ({
      id: job.id,
      url: job.url,
      owner: job.owner,
      repo: job.repo,
      isMock: job.isMock,
      status: job.status,
      currentStage: job.currentStage,
      stageIndex: job.stageIndex,
      totalStages: job.totalStages,
      percentage: job.percentage,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      hasReport: Boolean(job.report),
      overallStatus: job.report?.finalConclusion?.overallStatus,
    }));
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    if (job.status !== 'running' && job.status !== 'pending') {
      return false;
    }
    job.abortController.abort();
    job.status = 'cancelled';
    job.completedAt = new Date().toISOString();
    job.error = 'Investigation cancelled by user';
    return true;
  }

  retryJob(jobId: string): GitHubJob | null {
    const existing = this.jobs.get(jobId);
    if (!existing) return null;

    const newJob = this.createJob(existing.url, existing.isMock, existing.token);
    // Asynchronously kick off the retried job
    this.startJob(newJob.id).catch(() => {});
    return newJob;
  }

  getReport(id: string): GitHubInvestigationReport | null {
    // Search active jobs first
    for (const job of this.jobs.values()) {
      if (job.id === id && job.report) {
        return job.report;
      }
      if (job.report && job.report.id === id) {
        return job.report;
      }
    }
    // Search persistence store
    return this.historyStore.getReport(id);
  }

  listHistory(): StoredInvestigationSummary[] {
    return this.historyStore.listRecent();
  }

  deleteHistory(id: string): boolean {
    const deleted = this.historyStore.deleteReport(id);
    for (const [key, job] of this.jobs.entries()) {
      if (job.id === id || job.report?.id === id) {
        this.jobs.delete(key);
      }
    }
    return deleted;
  }
}
