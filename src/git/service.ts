import { simpleGit, SimpleGit } from 'simple-git';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AnvexoError } from '../core/types.js';

export interface GitWorkingStatus {
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
  private getGit(repoPath: string): SimpleGit {
    return simpleGit({ baseDir: repoPath });
  }

  async isGitRepo(repoPath: string): Promise<boolean> {
    if (!existsSync(join(repoPath, '.git'))) {
      return false;
    }
    try {
      const git = this.getGit(repoPath);
      return await git.checkIsRepo();
    } catch {
      return false;
    }
  }

  async getStatus(repoPath: string): Promise<GitWorkingStatus> {
    const isRepo = await this.isGitRepo(repoPath);
    if (!isRepo) {
      return {
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
      const git = this.getGit(repoPath);
      const status = await git.status();
      return {
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

  async getDiff(repoPath: string, staged = false): Promise<string> {
    const isRepo = await this.isGitRepo(repoPath);
    if (!isRepo) {
      return '';
    }
    try {
      const git = this.getGit(repoPath);
      if (staged) {
        return await git.diff(['--staged']);
      }
      return await git.diff();
    } catch {
      return '';
    }
  }

  async getLog(repoPath: string, limit = 20): Promise<GitCommitRecord[]> {
    const isRepo = await this.isGitRepo(repoPath);
    if (!isRepo) {
      return [];
    }
    try {
      const git = this.getGit(repoPath);
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

  async stageFile(repoPath: string, filePath: string): Promise<void> {
    const git = this.getGit(repoPath);
    await git.add(filePath);
  }

  async unstageFile(repoPath: string, filePath: string): Promise<void> {
    const git = this.getGit(repoPath);
    await git.reset(['HEAD', filePath]);
  }

  async commit(repoPath: string, message: string): Promise<{ commitHash: string }> {
    if (!message || !message.trim()) {
      throw new AnvexoError('Commit message cannot be empty', 'GIT_INVALID_COMMIT', false);
    }
    const git = this.getGit(repoPath);
    const result = await git.commit(message.trim());
    return { commitHash: result.commit || 'unknown' };
  }
}
