import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type {
  ProjectContext,
  HistoricalInvestigationRecord,
  KnownBugRecord,
  ContradictionRecord,
  InvestigationReport,
  Finding,
} from '../core/index.js';
import { MemoryMode, logger } from '../core/index.js';
import {
  type StorageAdapter,
  MemoryStorageAdapter,
  LocalStorageAdapter,
  UserCloudStorageAdapter,
} from './storage.js';
import { analyzeDependencies } from './dependencies.js';

export class ContextManager {
  private adapter: StorageAdapter;
  private currentContext: ProjectContext | null = null;
  private mode: MemoryMode;

  constructor(mode: MemoryMode = MemoryMode.PERSISTENT_INTELLIGENCE, customAdapter?: StorageAdapter) {
    this.mode = mode;
    if (customAdapter) {
      this.adapter = customAdapter;
    } else {
      this.adapter = this.createAdapter(mode);
    }
  }

  getMode(): MemoryMode {
    return this.mode;
  }

  setMode(mode: MemoryMode): void {
    this.mode = mode;
    this.adapter = this.createAdapter(mode);
    if (this.currentContext) {
      this.currentContext.mode = mode;
    }
  }

  getContext(): ProjectContext | null {
    return this.currentContext ? { ...this.currentContext } : null;
  }

  async init(repoRoot: string): Promise<ProjectContext> {
    const loaded = await this.adapter.load(repoRoot);
    const currentCommit = this.getCurrentCommit(repoRoot);

    if (loaded) {
      this.currentContext = loaded;
      logger.info('context', `Loaded existing context for ${repoRoot} (${loaded.historicalInvestigations.length} past investigations)`);
      return this.currentContext;
    }

    const { dependencies, dependencyGraph } = analyzeDependencies(repoRoot);

    this.currentContext = {
      repoRoot,
      lastCommitHash: currentCommit,
      lastAnalyzedAt: new Date(),
      mode: this.mode,
      dependencies,
      dependencyGraph,
      historicalInvestigations: [],
      knownBugs: [],
      contradictions: [],
    };

    if (this.mode !== MemoryMode.ZERO_PERSISTENT) {
      await this.adapter.save(this.currentContext);
    }

    logger.info('context', `Initialized fresh context for ${repoRoot} with ${Object.keys(dependencies).length} dependencies`);
    return this.currentContext;
  }

  async checkStale(repoRoot: string): Promise<{ isStale: boolean; currentCommit: string; savedCommit: string }> {
    const currentCommit = this.getCurrentCommit(repoRoot);
    const savedCommit = this.currentContext?.lastCommitHash || '';
    const isStale = Boolean(savedCommit && currentCommit && savedCommit !== currentCommit);
    return { isStale, currentCommit, savedCommit };
  }

  async recordInvestigation(report: InvestigationReport): Promise<void> {
    if (!this.currentContext) {
      await this.init(report.repositoryPath);
    }

    if (!this.currentContext) return;

    const commitHash = this.getCurrentCommit(report.repositoryPath);
    const record: HistoricalInvestigationRecord = {
      id: report.id,
      objective: report.objective,
      timestamp: report.completedAt,
      commitHash,
      findingsCount: report.findings.length,
      success: report.plan.steps.every(s => s.status === 'completed' || s.status === 'skipped'),
    };

    this.currentContext.historicalInvestigations.push(record);
    this.currentContext.lastAnalyzedAt = new Date();
    this.currentContext.lastCommitHash = commitHash;

    const contradictions = this.detectContradictions(report.findings);
    for (const c of contradictions) {
      this.currentContext.contradictions.push(c);
    }

    for (const finding of report.findings) {
      if (finding.claim.toLowerCase().includes('fail') || finding.claim.toLowerCase().includes('error')) {
        const bug: KnownBugRecord = {
          id: randomUUID(),
          title: finding.claim,
          rootCause: finding.details || 'Identified during automated investigation',
          affectedFiles: this.extractAffectedFiles(finding.details),
          discoveredAt: new Date(),
          resolved: false,
        };
        const exists = this.currentContext.knownBugs.some(b => b.title === bug.title && !b.resolved);
        if (!exists) {
          this.currentContext.knownBugs.push(bug);
        }
      }
    }

    if (this.mode !== MemoryMode.ZERO_PERSISTENT) {
      await this.adapter.save(this.currentContext);
    }
  }

  async recordKnownBug(bug: Omit<KnownBugRecord, 'id' | 'discoveredAt'>): Promise<KnownBugRecord> {
    if (!this.currentContext) {
      throw new Error('Context not initialized');
    }

    const record: KnownBugRecord = {
      id: randomUUID(),
      title: bug.title,
      rootCause: bug.rootCause,
      affectedFiles: bug.affectedFiles,
      discoveredAt: new Date(),
      resolved: bug.resolved,
    };

    this.currentContext.knownBugs.push(record);

    if (this.mode !== MemoryMode.ZERO_PERSISTENT) {
      await this.adapter.save(this.currentContext);
    }

    return record;
  }

  detectContradictions(newFindings: Finding[]): ContradictionRecord[] {
    if (!this.currentContext || (this.currentContext.historicalInvestigations.length === 0 && this.currentContext.knownBugs.length === 0)) {
      return [];
    }

    const contradictions: ContradictionRecord[] = [];

    for (const finding of newFindings) {
      const claimLower = finding.claim.toLowerCase();
      if (claimLower.includes('all detected tests pass')) {
        const unresolvedFailures = this.currentContext.knownBugs.filter(b => !b.resolved && b.title.toLowerCase().includes('fail'));
        for (const failure of unresolvedFailures) {
          contradictions.push({
            id: randomUUID(),
            claim: finding.claim,
            previousEvidence: `Unresolved bug: ${failure.title}`,
            conflictingEvidence: finding.details,
            detectedAt: new Date(),
          });
        }
      }
    }

    return contradictions;
  }

  async rebuildIndex(repoRoot?: string): Promise<ProjectContext> {
    const targetRoot = repoRoot || this.currentContext?.repoRoot;
    if (!targetRoot) {
      throw new Error('Cannot rebuild index: no repository root defined');
    }

    const currentCommit = this.getCurrentCommit(targetRoot);
    const { dependencies, dependencyGraph } = analyzeDependencies(targetRoot);

    const updated: ProjectContext = {
      repoRoot: targetRoot,
      lastCommitHash: currentCommit,
      lastAnalyzedAt: new Date(),
      mode: this.mode,
      dependencies,
      dependencyGraph,
      historicalInvestigations: this.currentContext?.historicalInvestigations || [],
      knownBugs: this.currentContext?.knownBugs || [],
      contradictions: this.currentContext?.contradictions || [],
    };

    this.currentContext = updated;

    if (this.mode !== MemoryMode.ZERO_PERSISTENT) {
      await this.adapter.save(this.currentContext);
    }

    logger.info('context', `Rebuilt context index for ${targetRoot}`);
    return this.currentContext;
  }

  async clearMemory(repoRoot?: string): Promise<void> {
    const targetRoot = repoRoot || this.currentContext?.repoRoot;
    if (targetRoot) {
      await this.adapter.delete(targetRoot);
    }
    this.currentContext = null;
    logger.info('context', `Cleared project memory for ${targetRoot}`);
  }

  exportContext(): string {
    if (!this.currentContext) {
      return JSON.stringify({ error: 'No active context' }, null, 2);
    }
    return JSON.stringify(this.currentContext, null, 2);
  }

  private getCurrentCommit(repoRoot: string): string {
    try {
      return execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 }).trim();
    } catch {
      return '';
    }
  }

  private extractAffectedFiles(details: string): string[] {
    const matches = details.match(/(?:[\w.-]+\/)+[\w.-]+\.[a-zA-Z0-9]+/g);
    return matches ? [...new Set(matches)] : [];
  }

  private createAdapter(mode: MemoryMode): StorageAdapter {
    switch (mode) {
      case MemoryMode.ZERO_PERSISTENT:
        return new MemoryStorageAdapter();
      case MemoryMode.LOCAL_CONTEXT:
      case MemoryMode.PERSISTENT_INTELLIGENCE:
        return new LocalStorageAdapter();
      case MemoryMode.USER_CLOUD:
        return new UserCloudStorageAdapter('https://api.anvexo.local/storage');
      default:
        return new LocalStorageAdapter();
    }
  }
}
