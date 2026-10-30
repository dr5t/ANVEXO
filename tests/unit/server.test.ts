import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as http from 'node:http';
import {
  RateLimiter,
  JobManager,
  AnvexoServer,
  validatePathWithinRoot,
  validateHostHeader,
  SecurityError,
} from '../../src/server/index.js';

function makeRawRequest(url: string, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers,
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

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

    it('detects and blocks symlink escapes outside root', () => {
      const tempDir = path.join(testRoot, 'scratch_symlink_test');
      fs.mkdirSync(tempDir, { recursive: true });
      const outsideDir = fs.mkdtempSync(path.join(testRoot, 'scratch_symlink_outside_'));
      fs.copyFileSync(path.join(testRoot, 'package.json'), path.join(outsideDir, 'package.json'));
      const symlinkPath = path.join(tempDir, 'link_to_outside');

      try {
        if (fs.existsSync(symlinkPath)) fs.unlinkSync(symlinkPath);
        fs.symlinkSync(outsideDir, symlinkPath, 'junction');

        expect(() => {
          validatePathWithinRoot(path.join('link_to_outside', 'package.json'), tempDir);
        }).toThrow(/Symlink escape detected/);
      } finally {
        if (fs.existsSync(symlinkPath)) fs.unlinkSync(symlinkPath);
        if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
        fs.rmSync(outsideDir, { recursive: true, force: true });
      }
    });

    it('validates allowed and forbidden Host headers', () => {
      const fakeReq = (host: string) => ({ headers: { host } } as any);
      expect(validateHostHeader(fakeReq('localhost:4173'), '127.0.0.1')).toBe(true);
      expect(validateHostHeader(fakeReq('127.0.0.1:4173'), '127.0.0.1')).toBe(true);
      expect(validateHostHeader(fakeReq('[::1]:4173'), '127.0.0.1')).toBe(true);
      expect(validateHostHeader(fakeReq('evil.com:4173'), '127.0.0.1')).toBe(false);
      expect(validateHostHeader(fakeReq('attacker-rebound.net'), '127.0.0.1')).toBe(false);
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

    it('supports job cancellation and preserves cancelled status against late completion', () => {
      const job = jm.createJob(testRoot, 'Cancellable run');
      const cancelled = jm.cancelJob(job.id);
      expect(cancelled).toBe(true);
      expect(job.status).toBe('failed');
      expect(job.error).toContain('cancelled');
      expect(jm.isRepoLocked(testRoot)).toBe(false);

      jm.markCompleted(job.id, {
        id: job.id,
        objective: 'Cancellable run',
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
        plan: { objective: 'Cancellable run', steps: [], createdAt: new Date() },
        evidence: [],
        hypotheses: [],
        findings: [],
        limitations: [],
        unverifiedClaims: [],
        startedAt: new Date(),
        completedAt: new Date(),
      });

      expect(jm.getJob(job.id)?.status).toBe('failed');
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

    it('rejects unauthorized Host headers with 400', async () => {
      const res = await makeRawRequest(`${baseUrl}/api/health`, { Host: 'evil.attacker.com' });
      expect(res.status).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error).toContain('Invalid or forbidden Host header');
    });

    it('rejects cross-origin requests from unauthorized origins with 403', async () => {
      const res = await fetch(`${baseUrl}/api/discover`, {
        method: 'POST',
        headers: {
          Origin: 'http://malicious-website.com',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: testRoot }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Cross-origin request rejected');
    });

    it('rejects non-JSON payload Content-Type with 415', async () => {
      const res = await fetch(`${baseUrl}/api/discover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: 'path=.',
      });
      expect(res.status).toBe(415);
      const data = await res.json();
      expect(data.error).toContain('application/json');
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

    it('serves file contents via /api/file and blocks directory traversal', async () => {
      const okRes = await fetch(`${baseUrl}/api/file?repo=${encodeURIComponent(testRoot)}&path=package.json`);
      expect(okRes.status).toBe(200);
      const data = await okRes.json();
      expect(data.path).toBe('package.json');
      expect(data.content).toContain('anvexo');

      const traversalRes = await fetch(`${baseUrl}/api/file?repo=${encodeURIComponent(testRoot)}&path=../../etc/passwd`);
      expect(traversalRes.status).toBe(403);
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
      expect(html).toContain('Run npm test to check the current test status');
      expect(html).not.toContain('164/164');

      const cssRes = await fetch(`${baseUrl}/styles.css`);
      expect(cssRes.status).toBe(200);
      expect(cssRes.headers.get('content-type')).toContain('text/css');

      const jsRes = await fetch(`${baseUrl}/app.js`);
      expect(jsRes.status).toBe(200);
      expect(jsRes.headers.get('content-type')).toContain('application/javascript');

      const iconsRes = await fetch(`${baseUrl}/icons.js`);
      expect(iconsRes.status).toBe(200);
      expect(iconsRes.headers.get('content-type')).toContain('application/javascript');
      const iconsBody = await iconsRes.text();
      expect(iconsBody).toContain('AnvexoIcons');
    });

    it('serves test documentation without a hardcoded passing count', async () => {
      const docsRes = await fetch(`${baseUrl}/docs?page=verification`);
      expect(docsRes.status).toBe(200);
      const docs = await docsRes.text();
      expect(docs).toContain('npm test');
      expect(docs).not.toContain('164/164');
      expect(docs).not.toContain('100% pass rate');
    });
  });
});
