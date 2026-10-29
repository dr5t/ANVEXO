import { randomUUID } from 'node:crypto';
import type { InvestigationReport } from '../core/index.js';
import { logger } from '../core/index.js';

export type JobStatus = 'queued' | 'running' | 'cancelling' | 'completed' | 'failed';

export interface InvestigationJob {
  id: string;
  repositoryPath: string;
  objective: string;
  status: JobStatus;
  startedAt: Date;
  completedAt?: Date;
  report?: InvestigationReport;
  error?: string;
  abortController: AbortController;
}

export class JobManager {
  private jobs: Map<string, InvestigationJob> = new Map();
  private repoLocks: Set<string> = new Set();
  private maxHistory: number;

  constructor(maxHistory: number = 50) {
    this.maxHistory = maxHistory;
  }

  isRepoLocked(repoPath: string): boolean {
    return this.repoLocks.has(repoPath);
  }

  createJob(repositoryPath: string, objective: string): InvestigationJob {
    if (this.repoLocks.has(repositoryPath)) {
      throw new Error(`Repository ${repositoryPath} is already executing an active investigation`);
    }

    const job: InvestigationJob = {
      id: randomUUID(),
      repositoryPath,
      objective,
      status: 'queued',
      startedAt: new Date(),
      abortController: new AbortController(),
    };

    this.jobs.set(job.id, job);
    this.repoLocks.add(repositoryPath);
    logger.info('jobs', `Created job ${job.id} for ${repositoryPath}`);
    return job;
  }

  getJob(id: string): InvestigationJob | undefined {
    return this.jobs.get(id);
  }

  listJobs(): InvestigationJob[] {
    return [...this.jobs.values()].map(j => ({ ...j }));
  }

  markRunning(id: string): void {
    const job = this.jobs.get(id);
    if (job) {
      job.status = 'running';
      logger.info('jobs', `Job ${id} is running`);
    }
  }

  markCompleted(id: string, report: InvestigationReport): void {
    const job = this.jobs.get(id);
    if (job) {
      job.status = 'completed';
      job.completedAt = new Date();
      job.report = report;
      this.repoLocks.delete(job.repositoryPath);
      logger.info('jobs', `Job ${id} completed in ${job.completedAt.getTime() - job.startedAt.getTime()}ms`);
      this.trimHistory();
    }
  }

  markFailed(id: string, error: string): void {
    const job = this.jobs.get(id);
    if (job) {
      job.status = 'failed';
      job.completedAt = new Date();
      job.error = error;
      this.repoLocks.delete(job.repositoryPath);
      logger.error('jobs', `Job ${id} failed: ${error}`);
      this.trimHistory();
    }
  }

  cancelJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;

    if (job.status === 'completed' || job.status === 'failed') {
      return false;
    }

    job.status = 'cancelling';
    job.abortController.abort();
    job.status = 'failed';
    job.error = 'Investigation cancelled by user';
    job.completedAt = new Date();
    this.repoLocks.delete(job.repositoryPath);
    logger.warn('jobs', `Job ${id} cancelled`);
    return true;
  }

  private trimHistory(): void {
    const completed = [...this.jobs.values()].filter(j => j.status === 'completed' || j.status === 'failed');
    if (completed.length > this.maxHistory) {
      completed.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
      const toRemove = completed.slice(0, completed.length - this.maxHistory);
      for (const j of toRemove) {
        this.jobs.delete(j.id);
      }
    }
  }
}
