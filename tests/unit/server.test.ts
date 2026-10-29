import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import {
  RateLimiter,
  JobManager,
  AnvexoServer,
  validatePathWithinRoot,
  SecurityError,
} from '../../src/server/index.js';

describe('Server & Security Infrastructure', () => {
  const testRoot = path.resolve(process.cwd());

  describe('RateLimiter', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
      limiter = new RateLimiter({ windowMs: 1000, maxRequests: 3 });
    });

    afterEach(() => {
      limiter.destroy();
    });

    it('allows requests within threshold and tracks remaining', () => {
      const first = limiter.check('client-1');
      expect(first.allowed).toBe(true);
      expect(first.remaining).toBe(2);

      const second = limiter.check('client-1');
      expect(second.allowed).toBe(true);
      expect(second.remaining).toBe(1);

      const third = limiter.check('client-1');
      expect(third.allowed).toBe(true);
      expect(third.remaining).toBe(0);

      const fourth = limiter.check('client-1');
      expect(fourth.allowed).toBe(false);
      expect(fourth.remaining).toBe(0);
      expect(fourth.resetMs).toBeGreaterThan(0);
    });

    it('isolates rate limits between clients', () => {
      limiter.check('client-a');
      limiter.check('client-a');
      limiter.check('client-a');
      expect(limiter.check('client-a').allowed).toBe(false);
      expect(limiter.check('client-b').allowed).toBe(true);
    });

    it('resets client on demand', () => {
      limiter.check('client-x');
      limiter.check('client-x');
      limiter.check('client-x');
      expect(limiter.check('client-x').allowed).toBe(false);

      limiter.reset('client-x');
      expect(limiter.check('client-x').allowed).toBe(true);
    });
  });

  describe('Security & Path Containment', () => {
    it('allows valid subpaths', () => {
      const valid = validatePathWithinRoot('src/core', testRoot);
      expect(valid).toBe(path.join(testRoot, 'src/core'));
    });

    it('rejects path traversal attempts', () => {
      expect(() => {
        validatePathWithinRoot('../../etc/passwd', testRoot);
      }).toThrow(SecurityError);
    });

    it('rejects empty or non-string paths', () => {
      expect(() => {
        validatePathWithinRoot('', testRoot);
      }).toThrow(SecurityError);
    });
  });

  describe('JobManager & Concurrency Locks', () => {
    let jm: JobManager;

    beforeEach(() => {
      jm = new JobManager();
    });

    it('creates job and acquires lock on repo', () => {
      const job = jm.createJob(testRoot, 'Test run');
      expect(job.id).toBeDefined();
      expect(job.status).toBe('queued');
      expect(jm.isRepoLocked(testRoot)).toBe(true);
    });

    it('blocks concurrent jobs on the same repo', () => {
      jm.createJob(testRoot, 'First run');
      expect(() => {
        jm.createJob(testRoot, 'Second run');
      }).toThrow('already executing');
    });

    it('releases lock upon completion', () => {
      const job = jm.createJob(testRoot, 'Test run');
      jm.markCompleted(job.id, {
        id: job.id,
        objective: 'Test run',
        repositoryPath: testRoot,
        projectMetadata: {
          rootPath: testRoot,
          name: 'anvexo',
          languages: [],
          frameworks: [],
          hasGit: true,
          configFiles: [],
          entryPoints: [],
        },
        plan: { objective: 'Test run', steps: [], createdAt: new Date() },
        evidence: [],
        hypotheses: [],
        findings: [],
        limitations: [],
        unverifiedClaims: [],
        startedAt: new Date(),
        completedAt: new Date(),
      });

      expect(jm.isRepoLocked(testRoot)).toBe(false);
      expect(jm.getJob(job.id)?.status).toBe('completed');
    });

    it('supports job cancellation', () => {
      const job = jm.createJob(testRoot, 'Cancellable run');
      const cancelled = jm.cancelJob(job.id);
      expect(cancelled).toBe(true);
      expect(job.status).toBe('failed');
      expect(job.error).toContain('cancelled');
      expect(jm.isRepoLocked(testRoot)).toBe(false);
    });
  });

  describe('AnvexoServer Integration', () => {
    let server: AnvexoServer;
    let baseUrl: string;

    beforeEach(async () => {
      server = new AnvexoServer({ port: 0, host: '127.0.0.1' });
      const info = await server.start();
      baseUrl = info.url;
    });

    afterEach(async () => {
      await server.stop();
    });

    it('serves /api/health with security headers', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');

      const data = await res.json();
      expect(data.status).toBe('ok');
      expect(data.platform).toBe('ANVEXO');
    });

    it('serves /api/discover for repository', async () => {
      const res = await fetch(`${baseUrl}/api/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: testRoot }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('anvexo');
      expect(data.languages).toContain('typescript');
    });

    it('rejects /api/discover for nonexistent paths', async () => {
      const res = await fetch(`${baseUrl}/api/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/nonexistent/random/path/xyz' }),
      });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain('does not exist');
    });

    it('handles 404 for unknown routes', async () => {
      const res = await fetch(`${baseUrl}/api/unknown_route`);
      expect(res.status).toBe(404);
    });

    it('serves UI index.html, styles.css, and app.js', async () => {
      const htmlRes = await fetch(`${baseUrl}/`);
      expect(htmlRes.status).toBe(200);
      expect(htmlRes.headers.get('content-type')).toContain('text/html');
      const html = await htmlRes.text();
      expect(html).toContain('ANVEXO');
      expect(html).toContain('workbench');

      const cssRes = await fetch(`${baseUrl}/styles.css`);
      expect(cssRes.status).toBe(200);
      expect(cssRes.headers.get('content-type')).toContain('text/css');

      const jsRes = await fetch(`${baseUrl}/app.js`);
      expect(jsRes.status).toBe(200);
      expect(jsRes.headers.get('content-type')).toContain('application/javascript');
    });
  });
});
