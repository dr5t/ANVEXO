import { simpleGit, SimpleGit } from 'simple-git';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AnvexoError } from '../core/types.js';

export interface GitWorkingStatus {
  hasGit?: boolean;
  branch: string;
  isClean: boolean;
  modified: string[];
  staged: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

export interface GitCommitRecord {
  hash: string;
  shortHash: string;
  date: string;
  message: string;
  author: string;
}

export class GitService {
  private defaultRepoPath?: string;

  constructor(defaultRepoPath?: string) {
    this.defaultRepoPath = defaultRepoPath;
  }

  private resolveRepo(repoPath?: string): string {
    const target = repoPath || this.defaultRepoPath || process.cwd();
    return target;
  }

  private getGit(repoPath?: string): SimpleGit {
    return simpleGit({ baseDir: this.resolveRepo(repoPath) });
  }

  async isGitRepo(repoPath?: string): Promise<boolean> {
    const target = this.resolveRepo(repoPath);
    if (!existsSync(join(target, '.git'))) {
      return false;
    }
    try {
      const git = this.getGit(target);
      return await git.checkIsRepo();
    } catch {
      return false;
    }
  }

  async isRepo(repoPath?: string): Promise<boolean> {
    return this.isGitRepo(repoPath);
  }

  async getStatus(repoPath?: string): Promise<GitWorkingStatus> {
    const target = this.resolveRepo(repoPath);
    const isRepo = await this.isGitRepo(target);
    if (!isRepo) {
      return {
        hasGit: false,
        branch: 'detached',
        isClean: true,
        modified: [],
        staged: [],
        untracked: [],
        ahead: 0,
        behind: 0,
      };
    }

    try {
      const git = this.getGit(target);
      const status = await git.status();
      return {
        hasGit: true,
        branch: status.current || 'main',
        isClean: status.isClean(),
        modified: status.modified,
        staged: status.staged,
        untracked: status.not_added,
        ahead: status.ahead,
        behind: status.behind,
      };
    } catch (err: unknown) {
      throw new AnvexoError(`Git status failed: ${(err as Error).message}`, 'GIT_ERROR', true);
    }
  }

  async getDiff(repoPathOrStaged?: string | boolean, stagedParam?: boolean): Promise<string> {
    let targetRepo: string | undefined;
    let staged = false;

    if (typeof repoPathOrStaged === 'string') {
      targetRepo = repoPathOrStaged;
      staged = Boolean(stagedParam);
    } else if (typeof repoPathOrStaged === 'boolean') {
      staged = repoPathOrStaged;
    }

    const resolved = this.resolveRepo(targetRepo);
    const isRepo = await this.isGitRepo(resolved);
    if (!isRepo) {
      return '';
    }
    try {
      const git = this.getGit(resolved);
      if (staged) {
        return await git.diff(['--staged']);
      }
      return await git.diff();
    } catch {
      return '';
    }
  }

  async getLog(repoPathOrLimit?: string | number, limitParam = 20): Promise<GitCommitRecord[]> {
    let targetRepo: string | undefined;
    let limit = 20;

    if (typeof repoPathOrLimit === 'string') {
      targetRepo = repoPathOrLimit;
      limit = limitParam;
    } else if (typeof repoPathOrLimit === 'number') {
      limit = repoPathOrLimit;
    }

    const resolved = this.resolveRepo(targetRepo);
    const isRepo = await this.isGitRepo(resolved);
    if (!isRepo) {
      return [];
    }
    try {
      const git = this.getGit(resolved);
      const logResult = await git.log({ maxCount: limit });
      return logResult.all.map((c) => ({
        hash: c.hash,
        shortHash: c.hash.slice(0, 8),
        date: c.date,
        message: c.message,
        author: c.author_name,
      }));
    } catch {
      return [];
    }
  }

  async getRecentCommits(limit = 20, repoPath?: string): Promise<GitCommitRecord[]> {
    return this.getLog(repoPath, limit);
  }

  async stageFile(repoPathOrFile: string, filePathParam?: string): Promise<void> {
    let targetRepo: string | undefined;
    let file = repoPathOrFile;
    if (filePathParam) {
      targetRepo = repoPathOrFile;
      file = filePathParam;
    }
    const git = this.getGit(targetRepo);
    await git.add(file);
  }

  async stage(files: string | string[], repoPath?: string): Promise<void> {
    const list = Array.isArray(files) ? files : [files];
    const git = this.getGit(repoPath);
    for (const f of list) {
      await git.add(f);
    }
  }

  async unstageFile(repoPathOrFile: string, filePathParam?: string): Promise<void> {
    let targetRepo: string | undefined;
    let file = repoPathOrFile;
    if (filePathParam) {
      targetRepo = repoPathOrFile;
      file = filePathParam;
    }
    const git = this.getGit(targetRepo);
    await git.reset(['HEAD', file]);
  }

  async commit(messageOrRepo: string, messageParam?: string): Promise<{ commitHash: string }> {
    let targetRepo: string | undefined;
    let message = messageOrRepo;
    if (messageParam) {
      targetRepo = messageOrRepo;
      message = messageParam;
    }
    if (!message || !message.trim()) {
      throw new AnvexoError('Commit message cannot be empty', 'GIT_INVALID_COMMIT', false);
    }
    const git = this.getGit(targetRepo);
    const result = await git.commit(message.trim());
    return { commitHash: result.commit || 'unknown' };
  }
}
