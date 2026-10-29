import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
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
  SecurityError,
} from './security.js';

export class ApiRouter {
  private rateLimiter: RateLimiter;
  private jobManager: JobManager;
  private engine: InvestigationEngine;
  private contextManager: ContextManager;

  constructor() {
    this.rateLimiter = new RateLimiter({ windowMs: 60000, maxRequests: 120 });
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

  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    applySecurityHeaders(res);
    const corsAllowed = applyCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
      res.writeHead(corsAllowed ? 204 : 403);
      res.end();
      return;
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

    const host = req.headers.host || 'localhost';
    const parsedUrl = new URL(req.url || '/', `http://${host}`);
    const pathname = parsedUrl.pathname;
    const method = req.method || 'GET';

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
        this.sendJson(res, 500, { error: msg });
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
          resolve(JSON.parse(raw));
        } catch {
          reject(new SecurityError('Invalid JSON in request payload', 400));
        }
      });

      req.on('error', reject);
    });
  }
}
