import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { InvestigationEngine } from '../engine/index.js';
import { discoverProject } from '../discovery/index.js';
import { ContextManager } from '../context/index.js';
import { PermissionScope, PermissionDecision, logger } from '../core/index.js';
import { RateLimiter } from './rate-limiter.js';
import { JobManager } from './job-manager.js';
import {
  applySecurityHeaders,
  applyCorsHeaders,
  validateRepositoryExists,
  validatePathWithinRoot,
  validateHostHeader,
  validateSecFetchSite,
  SecurityError,
} from './security.js';

export class ApiRouter {
  private rateLimiter: RateLimiter;
  private heavyRateLimiter: RateLimiter;
  private fileRateLimiter: RateLimiter;
  private jobManager: JobManager;
  private engine: InvestigationEngine;
  private contextManager: ContextManager;
  private host: string;

  constructor(host: string = '127.0.0.1') {
    this.host = host;
    this.rateLimiter = new RateLimiter({ windowMs: 60000, maxRequests: 300 });
    this.heavyRateLimiter = new RateLimiter({ windowMs: 60000, maxRequests: 20 });
    this.fileRateLimiter = new RateLimiter({ windowMs: 60000, maxRequests: 120 });
    this.jobManager = new JobManager();
    this.engine = new InvestigationEngine();
    this.contextManager = new ContextManager();
  }

  getJobManager(): JobManager {
    return this.jobManager;
  }

  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  destroy(): void {
    this.rateLimiter.destroy();
    this.heavyRateLimiter.destroy();
    this.fileRateLimiter.destroy();
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    applySecurityHeaders(res);

    if (!validateHostHeader(req, this.host)) {
      this.sendJson(res, 400, { error: 'Invalid or forbidden Host header' });
      return;
    }

    const corsAllowed = applyCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
      res.writeHead(corsAllowed ? 204 : 403);
      res.end();
      return;
    }

    if (req.headers.origin && !corsAllowed) {
      this.sendJson(res, 403, { error: 'Cross-origin request rejected: unauthorized origin' });
      return;
    }

    const host = req.headers.host || '127.0.0.1';
    const parsedUrl = new URL(req.url || '/', `http://${host}`);
    const pathname = parsedUrl.pathname;
    const method = req.method || 'GET';

    if (['POST', 'PUT', 'DELETE'].includes(method)) {
      if (!validateSecFetchSite(req)) {
        this.sendJson(res, 403, { error: 'Cross-site request rejected via Sec-Fetch-Site' });
        return;
      }
    }

    if (method === 'GET') {
      if (pathname === '/' || pathname === '/index.html') {
        const file = this.resolveUiFile('index.html');
        if (file) {
          this.sendFile(res, 200, 'text/html; charset=utf-8', file);
          return;
        }
      }

      if (pathname === '/styles.css') {
        const file = this.resolveUiFile('styles.css');
        if (file) {
          this.sendFile(res, 200, 'text/css; charset=utf-8', file);
          return;
        }
      }

      if (pathname === '/app.js') {
        const file = this.resolveUiFile('app.js');
        if (file) {
          this.sendFile(res, 200, 'application/javascript; charset=utf-8', file);
          return;
        }
      }
    }

    const clientIp = req.socket.remoteAddress || '127.0.0.1';
    const rateCheck = this.rateLimiter.check(clientIp);
    res.setHeader('X-RateLimit-Remaining', rateCheck.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateCheck.resetMs / 1000).toString());

    if (!rateCheck.allowed) {
      res.setHeader('Retry-After', Math.ceil(rateCheck.resetMs / 1000).toString());
      this.sendJson(res, 429, { error: 'Rate limit exceeded. Please wait before retrying.' });
      return;
    }

    const heavyPaths = ['/api/investigate', '/api/context/rebuild', '/api/context/clear'];
    if (heavyPaths.includes(pathname)) {
      const heavyCheck = this.heavyRateLimiter.check(clientIp);
      if (!heavyCheck.allowed) {
        res.setHeader('Retry-After', Math.ceil(heavyCheck.resetMs / 1000).toString());
        this.sendJson(res, 429, { error: 'Rate limit exceeded for resource-intensive operations.' });
        return;
      }
    }

    if (pathname === '/api/file') {
      const fileCheck = this.fileRateLimiter.check(clientIp);
      if (!fileCheck.allowed) {
        res.setHeader('Retry-After', Math.ceil(fileCheck.resetMs / 1000).toString());
        this.sendJson(res, 429, { error: 'Rate limit exceeded for file operations.' });
        return;
      }
    }

    try {
      if (method === 'GET' && pathname === '/api/health') {
        this.sendJson(res, 200, {
          status: 'ok',
          platform: 'ANVEXO',
          version: '0.1.0',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (method === 'POST' && pathname === '/api/discover') {
        const body = await this.readJsonBody(req);
        if (!body.path || typeof body.path !== 'string') {
          this.sendJson(res, 400, { error: 'Missing or invalid path in request body' });
          return;
        }
        const validatedPath = validateRepositoryExists(body.path);
        const metadata = await discoverProject(validatedPath);
        this.sendJson(res, 200, metadata);
        return;
      }

      if (method === 'POST' && pathname === '/api/investigate') {
        const body = await this.readJsonBody(req);
        if (!body.path || typeof body.path !== 'string') {
          this.sendJson(res, 400, { error: 'Missing or invalid path in request body' });
          return;
        }
        if (body.path.length > 4096) {
          this.sendJson(res, 400, { error: 'Path parameter exceeds maximum allowed length' });
          return;
        }
        if (body.objective !== undefined && (typeof body.objective !== 'string' || body.objective.length > 4096)) {
          this.sendJson(res, 400, { error: 'Objective must be a string under 4096 characters' });
          return;
        }
        const validatedPath = validateRepositoryExists(body.path);
        const objective = typeof body.objective === 'string' && body.objective.trim()
          ? body.objective.trim()
          : 'General project investigation and health check';

        const job = this.jobManager.createJob(validatedPath, objective);
        this.jobManager.markRunning(job.id);

        this.engine.investigate({
          objective,
          repositoryPath: validatedPath,
          autoApprove: Boolean(body.autoApprove ?? true),
          skipTests: Boolean(body.skipTests ?? false),
          abortSignal: job.abortController.signal,
        }).then(report => {
          this.jobManager.markCompleted(job.id, report);
        }).catch(err => {
          const msg = err instanceof Error ? err.message : String(err);
          this.jobManager.markFailed(job.id, msg);
        });

        this.sendJson(res, 202, {
          jobId: job.id,
          status: 'running',
          repositoryPath: validatedPath,
          objective,
          startedAt: job.startedAt,
        });
        return;
      }

      if (method === 'GET' && pathname === '/api/jobs') {
        const jobs = this.jobManager.listJobs().map(j => ({
          id: j.id,
          repositoryPath: j.repositoryPath,
          objective: j.objective,
          status: j.status,
          startedAt: j.startedAt,
          completedAt: j.completedAt,
          hasReport: Boolean(j.report),
          error: j.error,
        }));
        this.sendJson(res, 200, jobs);
        return;
      }

      if (method === 'GET' && pathname.startsWith('/api/jobs/')) {
        const id = pathname.replace('/api/jobs/', '');
        const job = this.jobManager.getJob(id);
        if (!job) {
          this.sendJson(res, 404, { error: `Job ${id} not found` });
          return;
        }
        this.sendJson(res, 200, {
          id: job.id,
          repositoryPath: job.repositoryPath,
          objective: job.objective,
          status: job.status,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          report: job.report,
          error: job.error,
        });
        return;
      }

      if (method === 'POST' && pathname.match(/^\/api\/jobs\/[^/]+\/cancel$/)) {
        const parts = pathname.split('/');
        const id = parts[3];
        const cancelled = this.jobManager.cancelJob(id);
        if (!cancelled) {
          this.sendJson(res, 400, { error: `Job ${id} cannot be cancelled or was not found` });
          return;
        }
        this.sendJson(res, 200, { message: `Job ${id} cancelled successfully` });
        return;
      }

      if (method === 'GET' && pathname === '/api/file') {
        const repo = parsedUrl.searchParams.get('repo');
        const filePath = parsedUrl.searchParams.get('path');
        if (!repo || !filePath) {
          this.sendJson(res, 400, { error: 'repo and path query parameters are required' });
          return;
        }
        if (repo.length > 4096 || filePath.length > 4096) {
          this.sendJson(res, 400, { error: 'Path parameters exceed maximum allowed length' });
          return;
        }
        const validatedRepo = validateRepositoryExists(repo);
        const validatedFile = validatePathWithinRoot(filePath, validatedRepo);
        if (!existsSync(validatedFile)) {
          this.sendJson(res, 404, { error: `File not found: ${filePath}` });
          return;
        }
        const stat = statSync(validatedFile);
        if (stat.isDirectory()) {
          this.sendJson(res, 400, { error: `Path is a directory: ${filePath}` });
          return;
        }
        if (stat.size > 1_048_576) {
          this.sendJson(res, 413, { error: 'File too large to display (exceeds 1MB)' });
          return;
        }
        const content = readFileSync(validatedFile, 'utf-8');
        this.sendJson(res, 200, {
          path: filePath,
          size: stat.size,
          content,
        });
        return;
      }

      if (method === 'GET' && pathname === '/api/context') {
        const targetPath = parsedUrl.searchParams.get('path');
        if (!targetPath) {
          this.sendJson(res, 400, { error: 'Missing path query parameter' });
          return;
        }
        const validatedPath = validateRepositoryExists(targetPath);
        const ctx = await this.contextManager.init(validatedPath);
        this.sendJson(res, 200, ctx);
        return;
      }

      if (method === 'POST' && pathname === '/api/context/rebuild') {
        const body = await this.readJsonBody(req);
        if (!body.path || typeof body.path !== 'string') {
          this.sendJson(res, 400, { error: 'Missing path in request body' });
          return;
        }
        const validatedPath = validateRepositoryExists(body.path);
        const ctx = await this.contextManager.rebuildIndex(validatedPath);
        this.sendJson(res, 200, ctx);
        return;
      }

      if (method === 'POST' && pathname === '/api/context/clear') {
        const body = await this.readJsonBody(req);
        if (!body.path || typeof body.path !== 'string') {
          this.sendJson(res, 400, { error: 'Missing path in request body' });
          return;
        }
        const validatedPath = validateRepositoryExists(body.path);
        await this.contextManager.clearMemory(validatedPath);
        this.sendJson(res, 200, { message: `Context cleared for ${validatedPath}` });
        return;
      }

      if (method === 'GET' && pathname === '/api/permissions/audit') {
        const auditLog = this.engine.getPermissions().getAuditLog();
        this.sendJson(res, 200, auditLog);
        return;
      }

      if (method === 'POST' && pathname === '/api/permissions/grant') {
        const body = await this.readJsonBody(req);
        if (!body.scope || !body.resource || !body.decision) {
          this.sendJson(res, 400, { error: 'scope, resource, and decision are required' });
          return;
        }
        const validScopes = Object.values(PermissionScope) as string[];
        const validDecisions = Object.values(PermissionDecision) as string[];
        if (!validScopes.includes(String(body.scope))) {
          this.sendJson(res, 400, { error: `Invalid permission scope: ${String(body.scope)}` });
          return;
        }
        if (!validDecisions.includes(String(body.decision))) {
          this.sendJson(res, 400, { error: `Invalid permission decision: ${String(body.decision)}` });
          return;
        }
        if (typeof body.resource !== 'string' || body.resource.length > 1024) {
          this.sendJson(res, 400, { error: 'Resource must be a string with maximum length of 1024 characters' });
          return;
        }
        this.engine.getPermissions().grant(
          body.scope as PermissionScope,
          body.resource as string,
          body.decision as PermissionDecision,
        );
        this.sendJson(res, 200, { message: `Granted ${body.decision} for ${body.scope} on ${body.resource}` });
        return;
      }

      this.sendJson(res, 404, { error: `Endpoint not found: ${method} ${pathname}` });
    } catch (err) {
      if (err instanceof SecurityError) {
        this.sendJson(res, err.statusCode, { error: err.message });
      } else {
        const msg = err instanceof Error ? err.message : 'Internal Server Error';
        logger.error('router', `Unhandled error on ${method} ${pathname}: ${msg}`);
        this.sendJson(res, 500, { error: 'Internal server error' });
      }
    }
  }

  private sendJson(res: ServerResponse, status: number, data: unknown): void {
    const payload = JSON.stringify(data);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
    });
    res.end(payload);
  }

  private async readJsonBody(req: IncomingMessage, maxBytes: number = 1_048_576): Promise<Record<string, unknown>> {
    const contentType = req.headers['content-type'] || '';
    if (contentType && !contentType.toLowerCase().includes('application/json')) {
      throw new SecurityError('Content-Type must be application/json', 415);
    }

    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks: Buffer[] = [];

      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          reject(new SecurityError('Payload Too Large: Maximum allowed request size is 1MB', 413));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => {
        if (chunks.length === 0) {
          resolve({});
          return;
        }
        try {
          const raw = Buffer.concat(chunks).toString('utf-8');
          const parsed = JSON.parse(raw);
          this.assertNoPrototypePollution(parsed);
          resolve(parsed);
        } catch (err) {
          if (err instanceof SecurityError) {
            reject(err);
          } else {
            reject(new SecurityError('Invalid JSON in request payload', 400));
          }
        }
      });

      req.on('error', reject);
    });
  }

  private assertNoPrototypePollution(obj: unknown): void {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        this.assertNoPrototypePollution(item);
      }
      return;
    }
    const record = obj as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new SecurityError('Prototype pollution attempt detected in payload', 400);
      }
      this.assertNoPrototypePollution(record[key]);
    }
  }

  private resolveUiFile(name: string): string | null {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      join(currentDir, 'ui', name),
      join(currentDir, '../../src/server/ui', name),
      join(process.cwd(), 'src/server/ui', name),
      join(process.cwd(), 'dist/server/ui', name),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private sendFile(res: ServerResponse, status: number, contentType: string, filePath: string): void {
    const content = readFileSync(filePath);
    res.writeHead(status, {
      'Content-Type': contentType,
      'Content-Length': content.length,
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  }
}
