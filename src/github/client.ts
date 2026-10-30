import type {
  GitHubMetadata,
  CommitRecord,
  GitHubBranch,
  GitHubRelease,
} from './types.js';

export interface GitHubClientOptions {
  token?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export class GitHubClient {
  private token?: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(options: GitHubClientOptions = {}) {
    this.token = options.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    this.baseUrl = (options.baseUrl || 'https://api.github.com').replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs || 25_000;
  }

  private async fetchApi<T>(path: string): Promise<{ data: T | null; status: number; headers: Headers; error?: string }> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'ANVEXO-Repository-Intelligence-Platform/0.1.0',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!res.ok) {
        let errMessage = `GitHub API HTTP ${res.status}: ${res.statusText}`;
        if (res.status === 404) {
          errMessage = 'Repository not found or private. Ensure URL is correct and public, or set GITHUB_TOKEN.';
        } else if (res.status === 403) {
          const rateLimitRemaining = res.headers.get('x-ratelimit-remaining');
          if (rateLimitRemaining === '0') {
            const resetTime = res.headers.get('x-ratelimit-reset');
            const resetDate = resetTime ? new Date(parseInt(resetTime, 10) * 1000).toLocaleTimeString() : 'soon';
            errMessage = `GitHub API rate limit exceeded. Resets at ${resetDate}. Set GITHUB_TOKEN for 5,000 req/hr or enable Mock Mode.`;
          }
        }
        return { data: null, status: res.status, headers: res.headers, error: errMessage };
      }

      const data = await res.json() as T;
      return { data, status: res.status, headers: res.headers };
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        return { data: null, status: 408, headers: new Headers(), error: `Request timed out after ${this.timeoutMs}ms.` };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return { data: null, status: 500, headers: new Headers(), error: `Network error connecting to GitHub: ${msg}` };
    } finally {
      clearTimeout(timer);
    }
  }

  async getRepositoryMetadata(owner: string, repo: string): Promise<GitHubMetadata> {
    const repoRes = await this.fetchApi<Record<string, unknown>>(`/repos/${owner}/${repo}`);
    if (!repoRes.data) {
      throw new Error(repoRes.error || `Failed to fetch metadata for ${owner}/${repo}`);
    }

    const raw = repoRes.data;

    // Concurrently fetch supplementary details
    const [langRes, branchesRes, tagsRes, releasesRes, readmeRes] = await Promise.all([
      this.fetchApi<Record<string, number>>(`/repos/${owner}/${repo}/languages`),
      this.fetchApi<Array<{ name: string; protected?: boolean }>>(`/repos/${owner}/${repo}/branches?per_page=30`),
      this.fetchApi<Array<{ name: string }>>(`/repos/${owner}/${repo}/tags?per_page=30`),
      this.fetchApi<Array<{ id: number; tag_name: string; name: string; published_at: string; html_url: string; prerelease: boolean; body?: string }>>(`/repos/${owner}/${repo}/releases?per_page=10`),
      this.fetchApi<{ content?: string; encoding?: string }>(`/repos/${owner}/${repo}/readme`),
    ]);

    const branches: GitHubBranch[] = (branchesRes.data || []).map(b => ({
      name: b.name,
      protected: Boolean(b.protected),
    }));

    const tags = (tagsRes.data || []).map(t => t.name);

    const releases: GitHubRelease[] = (releasesRes.data || []).map(r => ({
      id: String(r.id),
      tagName: r.tag_name,
      name: r.name || r.tag_name,
      publishedAt: r.published_at || new Date().toISOString(),
      htmlUrl: r.html_url || `https://github.com/${owner}/${repo}/releases/tag/${r.tag_name}`,
      isPrerelease: Boolean(r.prerelease),
      body: r.body,
    }));

    let readmePreview: string | undefined;
    if (readmeRes.data?.content && readmeRes.data.encoding === 'base64') {
      try {
        const decoded = Buffer.from(readmeRes.data.content, 'base64').toString('utf-8');
        readmePreview = decoded.slice(0, 1500);
      } catch {}
    }

    const licenseRaw = raw.license as Record<string, string> | null;
    const license = licenseRaw ? {
      key: licenseRaw.key,
      name: licenseRaw.name,
      spdxId: licenseRaw.spdx_id,
      url: licenseRaw.url,
    } : null;

    return {
      owner,
      repo,
      fullName: (raw.full_name as string) || `${owner}/${repo}`,
      description: (raw.description as string) || null,
      homepage: (raw.homepage as string) || null,
      htmlUrl: (raw.html_url as string) || `https://github.com/${owner}/${repo}`,
      createdAt: (raw.created_at as string) || new Date().toISOString(),
      updatedAt: (raw.updated_at as string) || new Date().toISOString(),
      pushedAt: (raw.pushed_at as string) || new Date().toISOString(),
      defaultBranch: (raw.default_branch as string) || 'main',
      starsCount: Number(raw.stargazers_count) || 0,
      forksCount: Number(raw.forks_count) || 0,
      openIssuesCount: Number(raw.open_issues_count) || 0,
      watchersCount: Number(raw.watchers_count) || 0,
      primaryLanguage: (raw.language as string) || null,
      languageDistribution: langRes.data || {},
      license,
      isPrivate: Boolean(raw.private),
      isFork: Boolean(raw.fork),
      isArchived: Boolean(raw.archived),
      sizeKb: Number(raw.size) || 0,
      branches: branches.length > 0 ? branches : [{ name: 'main', protected: false }],
      tags,
      releases,
      readmePreview,
      hasIssues: Boolean(raw.has_issues),
      hasWiki: Boolean(raw.has_wiki),
      hasPages: Boolean(raw.has_pages),
    };
  }

  async getRecentCommits(owner: string, repo: string, limit: number = 60): Promise<CommitRecord[]> {
    const res = await this.fetchApi<Array<Record<string, unknown>>>(`/repos/${owner}/${repo}/commits?per_page=${Math.min(limit, 100)}`);
    if (!res.data || !Array.isArray(res.data)) {
      return [];
    }

    return res.data.map(item => {
      const sha = (item.sha as string) || '';
      const commit = (item.commit as Record<string, unknown>) || {};
      const author = (commit.author as Record<string, string>) || {};
      const committer = (commit.committer as Record<string, string>) || {};
      const authorUser = (item.author as Record<string, string>) || {};
      const committerUser = (item.committer as Record<string, string>) || {};
      const parents = (item.parents as Array<{ sha: string }>) || [];
      const message = (commit.message as string) || '';
      const firstLine = message.split('\n')[0].trim() || 'No commit message';

      return {
        sha,
        shortSha: sha.slice(0, 7),
        message,
        firstLine,
        author: {
          name: author.name || 'Unknown Author',
          email: author.email || '',
          date: author.date || new Date().toISOString(),
          githubUsername: authorUser.login,
          avatarUrl: authorUser.avatar_url,
        },
        committer: {
          name: committer.name || 'Unknown Committer',
          email: committer.email || '',
          date: committer.date || new Date().toISOString(),
          githubUsername: committerUser.login,
          avatarUrl: committerUser.avatar_url,
        },
        parentShas: parents.map(p => p.sha),
        isMerge: parents.length > 1 || firstLine.toLowerCase().startsWith('merge '),
      };
    });
  }
}
