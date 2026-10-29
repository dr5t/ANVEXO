import { describe, it, expect } from 'vitest';
import { GitService } from '../../src/git/index.js';

describe('GitService', () => {
  it('detects git status in current workspace', async () => {
    const git = new GitService(process.cwd());
    const isRepo = await git.isRepo();
    expect(isRepo).toBe(true);

    const status = await git.getStatus();
    expect(status.hasGit).toBe(true);
    expect(typeof status.branch).toBe('string');
    expect(Array.isArray(status.modified)).toBe(true);
  });

  it('retrieves recent commit log', async () => {
    const git = new GitService(process.cwd());
    const commits = await git.getRecentCommits(5);
    expect(commits.length).toBeGreaterThan(0);
    expect(commits[0].hash).toBeDefined();
    expect(commits[0].message).toBeDefined();
  });

  it('retrieves diff string', async () => {
    const git = new GitService(process.cwd());
    const diff = await git.getDiff();
    expect(typeof diff).toBe('string');
  });
});
