import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL, fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { existsSync, readFileSync, statSync, readdirSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { InvestigationEngine, EngineeringWorkflowRunner } from '../engine/index.js';
import { discoverProject } from '../discovery/index.js';
import { ContextManager } from '../context/index.js';
import { PermissionScope, PermissionDecision, MemoryMode, logger } from '../core/index.js';
import { ConfigManager } from '../core/config.js';
import { ProviderFactory, GemmaProvider } from '../providers/index.js';
import { SkillManager } from '../skills/index.js';
import { RuleManager } from '../rules/index.js';
import { PluginManager } from '../plugins/index.js';
import { GitService } from '../git/index.js';
import { TerminalManager } from '../terminal/index.js';
import { AgentRuntime } from '../agent/index.js';
import { ToolRegistry, registerBuiltinTools } from '../tools/index.js';
import { PermissionManager } from '../permissions/index.js';
import { RateLimiter } from './rate-limiter.js';
import { JobManager } from './job-manager.js';
import { renderDocsHtml } from './docs-site.js';
import { ChangeImpactSimulator } from '../impact/index.js';
import { BugReproductionLab } from '../reproduction/index.js';
import { ProofVerifier } from '../proof/index.js';
import { DecisionMemoryManager, type DecisionMemoryType } from '../memory/index.js';
import { SafeAutonomyEngine, type AutonomyMode } from '../autonomy/index.js';
import {
  applySecurityHeaders,
  applyCorsHeaders,
  validateRepositoryExists,
  validatePathWithinRoot,
  validateHostHeader,
  validateSecFetchSite,
  SecurityError,
} from './security.js';

function buildDirTree(dirPath: string, rootPath: string, maxDepth: number = 4, depth: number = 0): unknown[] {
  if (depth > maxDepth) return [];
  if (!existsSync(dirPath)) return [];
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const result: unknown[] = [];
  const ignored = new Set(['.git', 'node_modules', 'dist', '.DS_Store', '.cache', 'coverage']);
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const fullPath = join(dirPath, entry.name);
    const relPath = relative(rootPath, fullPath);
    if (entry.isDirectory()) {
      result.push({
        name: entry.name,
        path: relPath,
        type: 'directory',
        children: buildDirTree(fullPath, rootPath, maxDepth, depth + 1),
      });
    } else {
      result.push({
        name: entry.name,
        path: relPath,
        type: 'file',
      });
    }
  }
  return result;
}

export class ApiRouter {
  private rateLimiter: RateLimiter;
  private heavyRateLimiter: RateLimiter;
  private fileRateLimiter: RateLimiter;
  private jobManager: JobManager;
  private engine: InvestigationEngine;
  private contextManager: ContextManager;
  private terminalManager: TerminalManager;
  private autonomyEngine: SafeAutonomyEngine;
  private host: string;

  constructor(host: string = '127.0.0.1') {
    this.host = host;
    this.rateLimiter = new RateLimiter({ windowMs: 60000, maxRequests: 300 });
    this.heavyRateLimiter = new RateLimiter({ windowMs: 60000, maxRequests: 20 });
    this.fileRateLimiter = new RateLimiter({ windowMs: 60000, maxRequests: 120 });
    this.jobManager = new JobManager();
    this.engine = new InvestigationEngine();
    this.contextManager = new ContextManager();
    this.terminalManager = new TerminalManager();
    this.autonomyEngine = new SafeAutonomyEngine('assisted');
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
    for (const s of this.terminalManager.listSessions()) {
      this.terminalManager.closeSession(s.id);
    }
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

      if (pathname === '/docs' || pathname === '/site') {
        const page = parsedUrl.searchParams.get('page') || 'overview';
        const html = renderDocsHtml(page);
        this.sendHtml(res, 200, html);
        return;
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

      if (pathname === '/icons.js') {
        const file = this.resolveUiFile('icons.js');
        if (file) {
          this.sendFile(res, 200, 'application/javascript; charset=utf-8', file);
          return;
        }
      }

      if (pathname === '/favicon.svg') {
        const file = this.resolveUiFile('favicon.svg');
        if (file) {
          this.sendFile(res, 200, 'image/svg+xml', file);
          return;
        }
      }

      if (pathname.startsWith('/brand/') && !pathname.includes('..')) {
        const file = this.resolveUiFile(pathname.slice(1));
        if (file) {
          this.sendFile(res, 200, 'image/svg+xml', file);
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

    const heavyPaths = [
      '/api/investigate',
      '/api/context/rebuild',
      '/api/context/clear',
      '/api/agent/prompt',
      '/api/impact',
      '/api/reproduce',
      '/api/reproduce/verify',
      '/api/verify',
      '/api/workflow',
    ];
    if (heavyPaths.includes(pathname)) {
      const heavyCheck = this.heavyRateLimiter.check(clientIp);
      if (!heavyCheck.allowed) {
        res.setHeader('Retry-After', Math.ceil(heavyCheck.resetMs / 1000).toString());
        this.sendJson(res, 429, { error: 'Rate limit exceeded for resource-intensive operations.' });
        return;
      }
    }

    if (pathname.startsWith('/api/file')) {
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

      if (method === 'GET' && pathname === '/api/providers') {
        const repoPath = parsedUrl.searchParams.get('repo') || process.cwd();
        const cm = new ConfigManager(repoPath);
        const pf = new ProviderFactory(cm);
        const list = await pf.listAvailableProviders();
        const active = pf.getActiveProvider();
        this.sendJson(res, 200, {
          providers: list,
          active: active.id,
          activeName: active.name,
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

      if (method === 'GET' && pathname === '/api/files/tree') {
        const repo = parsedUrl.searchParams.get('repo') || parsedUrl.searchParams.get('path');
        if (!repo) {
          this.sendJson(res, 400, { error: 'repo parameter is required' });
          return;
        }
        const validatedRepo = validateRepositoryExists(repo);
        const tree = buildDirTree(validatedRepo, validatedRepo);
        this.sendJson(res, 200, { root: validatedRepo, tree });
        return;
      }

      if (method === 'POST' && pathname === '/api/files/save') {
        const body = await this.readJsonBody(req);
        if (!body.repo || !body.path || typeof body.content !== 'string') {
          this.sendJson(res, 400, { error: 'repo, path, and content are required' });
          return;
        }
        const validatedRepo = validateRepositoryExists(body.repo as string);
        const validatedPath = validatePathWithinRoot(body.path as string, validatedRepo);
        const dir = dirname(validatedPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(validatedPath, body.content as string, 'utf-8');
        this.sendJson(res, 200, { success: true, path: body.path });
        return;
      }

      if (method === 'POST' && pathname === '/api/files/create') {
        const body = await this.readJsonBody(req);
        if (!body.repo || !body.path) {
          this.sendJson(res, 400, { error: 'repo and path are required' });
          return;
        }
        const validatedRepo = validateRepositoryExists(body.repo as string);
        const validatedPath = validatePathWithinRoot(body.path as string, validatedRepo);
        if (body.type === 'directory') {
          mkdirSync(validatedPath, { recursive: true });
        } else {
          const dir = dirname(validatedPath);
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
          }
          writeFileSync(validatedPath, (body.content as string) || '', 'utf-8');
        }
        this.sendJson(res, 200, { success: true, path: body.path });
        return;
      }

      if (method === 'POST' && pathname === '/api/files/delete') {
        const body = await this.readJsonBody(req);
        if (!body.repo || !body.path) {
          this.sendJson(res, 400, { error: 'repo and path are required' });
          return;
        }
        const validatedRepo = validateRepositoryExists(body.repo as string);
        const validatedPath = validatePathWithinRoot(body.path as string, validatedRepo);
        if (existsSync(validatedPath)) {
          unlinkSync(validatedPath);
        }
        this.sendJson(res, 200, { success: true, path: body.path });
        return;
      }

      if (method === 'GET' && pathname === '/api/git/status') {
        const repo = parsedUrl.searchParams.get('repo');
        if (!repo) {
          this.sendJson(res, 400, { error: 'repo parameter is required' });
          return;
        }
        const validatedRepo = validateRepositoryExists(repo);
        const gitService = new GitService();
        const status = await gitService.getStatus(validatedRepo);
        this.sendJson(res, 200, status);
        return;
      }

      if (method === 'GET' && pathname === '/api/git/diff') {
        const repo = parsedUrl.searchParams.get('repo');
        if (!repo) {
          this.sendJson(res, 400, { error: 'repo parameter is required' });
          return;
        }
        const validatedRepo = validateRepositoryExists(repo);
        const gitService = new GitService();
        const diff = await gitService.getDiff(validatedRepo);
        this.sendJson(res, 200, { diff });
        return;
      }

      if (method === 'POST' && pathname === '/api/git/stage') {
        const body = await this.readJsonBody(req);
        if (!body.repo || !body.files) {
          this.sendJson(res, 400, { error: 'repo and files are required' });
          return;
        }
        const validatedRepo = validateRepositoryExists(body.repo as string);
        const gitService = new GitService();
        const files = Array.isArray(body.files) ? (body.files as string[]) : [String(body.files)];
        for (const f of files) {
          await gitService.stageFile(validatedRepo, f);
        }
        this.sendJson(res, 200, { success: true, files });
        return;
      }

      if (method === 'POST' && pathname === '/api/git/commit') {
        const body = await this.readJsonBody(req);
        if (!body.repo || !body.message) {
          this.sendJson(res, 400, { error: 'repo and commit message are required' });
          return;
        }
        const validatedRepo = validateRepositoryExists(body.repo as string);
        const gitService = new GitService();
        const result = await gitService.commit(validatedRepo, body.message as string);
        this.sendJson(res, 200, result);
        return;
      }

      if (method === 'POST' && pathname === '/api/terminal/execute') {
        const body = await this.readJsonBody(req);
        if (!body.repo || !body.command) {
          this.sendJson(res, 400, { error: 'repo and command are required' });
          return;
        }
        const validatedRepo = validateRepositoryExists(body.repo as string);
        const session = this.terminalManager.createSession('web-terminal', validatedRepo);
        const command = String(body.command);

        const execPromise = new Promise<{ exitCode: number; output: string }>((resolvePromise) => {
          let outputBuffer = '';
          const onData = (data: string) => {
            outputBuffer += data;
          };
          const onExit = (code: number | null) => {
            session.off('data', onData);
            session.off('exit', onExit);
            resolvePromise({ exitCode: code ?? 0, output: outputBuffer });
          };
          session.on('data', onData);
          session.on('exit', onExit);
          session.executeCommand(command);
        });

        const timeoutPromise = new Promise<{ exitCode: number; output: string }>((resolvePromise) => {
          setTimeout(() => {
            resolvePromise({ exitCode: 0, output: session.getBuffer() });
          }, 3000);
        });

        const resData = await Promise.race([execPromise, timeoutPromise]);
        this.sendJson(res, 200, {
          sessionId: session.id,
          command,
          exitCode: resData.exitCode,
          output: resData.output || session.getBuffer(),
        });
        return;
      }

      if (method === 'GET' && pathname === '/api/skills') {
        const repo = parsedUrl.searchParams.get('repo') || process.cwd();
        const sm = new SkillManager();
        const skills = sm.listAllSkills(repo);
        this.sendJson(res, 200, skills);
        return;
      }

      if (method === 'GET' && pathname === '/api/rules') {
        const repo = parsedUrl.searchParams.get('repo') || process.cwd();
        const rm = new RuleManager();
        const rules = rm.listAllRules(repo);
        this.sendJson(res, 200, rules);
        return;
      }

      if (method === 'GET' && pathname === '/api/plugins') {
        const repo = parsedUrl.searchParams.get('repo') || process.cwd();
        const pm = new PluginManager();
        const plugins = pm.listAllPlugins(repo);
        this.sendJson(res, 200, plugins);
        return;
      }

      if (method === 'POST' && pathname === '/api/plugins/toggle') {
        const body = await this.readJsonBody(req);
        if (!body.id || typeof body.enabled !== 'boolean') {
          this.sendJson(res, 400, { error: 'id and enabled boolean are required' });
          return;
        }
        const repo = (body.repo as string) || process.cwd();
        const pm = new PluginManager();
        const success = pm.togglePlugin(body.id as string, body.enabled as boolean, 'project', repo);
        this.sendJson(res, 200, { success });
        return;
      }

      if (method === 'POST' && pathname === '/api/agent/prompt') {
        const body = await this.readJsonBody(req);
        if (!body.repo || !body.prompt) {
          this.sendJson(res, 400, { error: 'repo and prompt are required' });
          return;
        }
        const validatedRepo = validateRepositoryExists(body.repo as string);
        const cm = new ConfigManager(validatedRepo);
        const pf = new ProviderFactory(cm);
        const provider = pf.getActiveProvider();
        const permissions = new PermissionManager();
        const tools = new ToolRegistry(permissions);
        registerBuiltinTools(tools);

        const ruleManager = new RuleManager();
        const skillManager = new SkillManager();

        const runtime = new AgentRuntime({
          repoPath: validatedRepo,
          provider,
          permissions,
          tools,
          ruleManager,
          skillManager,
          mode: (body.mode as any) || 'autonomous',
        });

        const session = runtime.createSession((body.mode as any) || 'autonomous');
        const events: unknown[] = [];

        await runtime.run(String(body.prompt), session, (evt) => {
          events.push(evt);
        });

        this.sendJson(res, 200, {
          sessionId: session.id,
          status: session.status,
          messages: session.messages,
          plan: session.plan,
          events,
        });
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
          const currentCtx = this.contextManager.getContext();
          this.sendJson(res, 200, {
            mode: this.contextManager.getMode(),
            context: currentCtx,
          });
          return;
        }
        const validatedPath = validateRepositoryExists(targetPath);
        const ctx = await this.contextManager.init(validatedPath);
        this.sendJson(res, 200, {
          ...ctx,
          mode: this.contextManager.getMode(),
        });
        return;
      }

      if (method === 'POST' && pathname === '/api/context/mode') {
        const body = await this.readJsonBody(req);
        if (!body.mode || typeof body.mode !== 'string') {
          this.sendJson(res, 400, { error: 'Missing mode in request body' });
          return;
        }
        const validModes = Object.values(MemoryMode);
        if (!validModes.includes(body.mode as MemoryMode)) {
          this.sendJson(res, 400, { error: `Invalid memory mode. Must be one of: ${validModes.join(', ')}` });
          return;
        }
        this.contextManager.setMode(body.mode as MemoryMode);
        this.sendJson(res, 200, { mode: this.contextManager.getMode(), message: `Memory mode updated to ${body.mode}` });
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

      if (method === 'POST' && pathname === '/api/impact') {
        const body = await this.readJsonBody(req);
        if (!body.repo || typeof body.repo !== 'string' || !body.target || typeof body.target !== 'string') {
          this.sendJson(res, 400, { error: 'repo and target are required' });
          return;
        }
        const validatedRepo = validateRepositoryExists(body.repo as string);
        const simulator = new ChangeImpactSimulator(validatedRepo);
        const report = await simulator.simulate(body.target as string, {
          symbol: typeof body.symbol === 'string' ? body.symbol : undefined,
          proposedDiff: typeof body.gitDiff === 'string' ? body.gitDiff : (typeof body.proposedDiff === 'string' ? body.proposedDiff : undefined),
        });
        this.sendJson(res, 200, report);
        return;
      }

      if (method === 'POST' && pathname === '/api/reproduce') {
        const body = await this.readJsonBody(req);
        if (!body.repo || typeof body.repo !== 'string' || !body.bugDescription || typeof body.bugDescription !== 'string') {
          this.sendJson(res, 400, { error: 'repo and bugDescription are required' });
          return;
        }
        const validatedRepo = validateRepositoryExists(body.repo as string);
        const lab = new BugReproductionLab(validatedRepo);
        const session = await lab.runReproduction(body.bugDescription as string, {
          command: typeof body.command === 'string' ? body.command : undefined,
          reproductionTestPath: typeof body.reproductionFile === 'string' ? body.reproductionFile : (typeof body.reproductionTestPath === 'string' ? body.reproductionTestPath : undefined),
          timeoutMs: typeof body.timeoutMs === 'number' ? body.timeoutMs : undefined,
        });
        this.sendJson(res, 200, session);
        return;
      }

      if (method === 'POST' && pathname === '/api/reproduce/verify') {
        const body = await this.readJsonBody(req);
        if (!body.repo || typeof body.repo !== 'string' || !body.sessionId || typeof body.sessionId !== 'string') {
          this.sendJson(res, 400, { error: 'repo and sessionId are required' });
          return;
        }
        const validatedRepo = validateRepositoryExists(body.repo as string);
        const lab = new BugReproductionLab(validatedRepo);
        const fixSummary = typeof body.proposedFixSummary === 'string' ? body.proposedFixSummary : 'Applied proposed fix';
        const session = await lab.verifyFix(body.sessionId as string, fixSummary, {
          regressionCommand: typeof body.regressionCommand === 'string' ? body.regressionCommand : undefined,
        });
        this.sendJson(res, 200, session);
        return;
      }

      if (method === 'POST' && pathname === '/api/verify') {
        const body = await this.readJsonBody(req);
        if (!body.repo || typeof body.repo !== 'string') {
          this.sendJson(res, 400, { error: 'repo is required' });
          return;
        }
        const validatedRepo = validateRepositoryExists(body.repo as string);
        const verifier = new ProofVerifier(validatedRepo);
        if (Array.isArray(body.claims)) {
          for (const c of body.claims) {
            if (c && typeof c.statement === 'string' && typeof c.claimType === 'string') {
              verifier.recordClaim(c.claimType as any, c.statement, c.evidenceRefs || []);
            }
          }
        }
        if (Array.isArray(body.evidence)) {
          verifier.ingestEvidenceRecords(body.evidence as any);
        }
        const report = verifier.generateReport();
        this.sendJson(res, 200, report);
        return;
      }

      if (method === 'POST' && pathname === '/api/workflow') {
        const body = await this.readJsonBody(req);
        if (!body.repo || typeof body.repo !== 'string' || !body.bugDescription || typeof body.bugDescription !== 'string') {
          this.sendJson(res, 400, { error: 'repo and bugDescription are required' });
          return;
        }
        const validatedRepo = validateRepositoryExists(body.repo as string);
        const runner = new EngineeringWorkflowRunner(validatedRepo);
        const report = await runner.run({
          repositoryPath: validatedRepo,
          bugDescription: body.bugDescription as string,
          errorMessage: typeof body.errorMessage === 'string' ? body.errorMessage : undefined,
          stackTrace: typeof body.stackTrace === 'string' ? body.stackTrace : undefined,
          targetFile: typeof body.targetFile === 'string' ? body.targetFile : undefined,
          reproductionCommand: typeof body.reproductionCommand === 'string' ? body.reproductionCommand : (typeof body.command === 'string' ? body.command : undefined),
          reproductionTestPath: typeof body.reproductionTestPath === 'string' ? body.reproductionTestPath : undefined,
          autonomyMode: typeof body.autonomyMode === 'string' ? (body.autonomyMode as AutonomyMode) : undefined,
          skipTests: Boolean(body.skipTests),
          autoApprove: true,
        });
        this.sendJson(res, 200, report);
        return;
      }

      if (method === 'GET' && pathname === '/api/autonomy') {
        this.sendJson(res, 200, {
          mode: this.autonomyEngine.getMode(),
          policy: this.autonomyEngine.getPolicy(),
          state: this.autonomyEngine.getState(),
        });
        return;
      }

      if (method === 'POST' && pathname === '/api/autonomy') {
        const body = await this.readJsonBody(req);
        if (!body.mode || typeof body.mode !== 'string') {
          this.sendJson(res, 400, { error: 'mode is required (observe | suggest | assisted | controlled_autonomous)' });
          return;
        }
        const validModes: AutonomyMode[] = ['observe', 'suggest', 'assisted', 'controlled_autonomous'];
        if (!validModes.includes(body.mode as AutonomyMode)) {
          this.sendJson(res, 400, { error: `Invalid mode. Must be one of: ${validModes.join(', ')}` });
          return;
        }
        const policyUpdates: any = {};
        if (body.maxBudget && typeof body.maxBudget === 'object') policyUpdates.maxBudget = body.maxBudget;
        if (Array.isArray(body.allowedPaths)) policyUpdates.allowedPaths = body.allowedPaths;
        if (Array.isArray(body.deniedCommands)) policyUpdates.deniedCommands = body.deniedCommands;
        this.autonomyEngine.setMode(body.mode as AutonomyMode, policyUpdates);
        this.sendJson(res, 200, {
          message: `Autonomy mode set to ${body.mode}`,
          mode: this.autonomyEngine.getMode(),
          policy: this.autonomyEngine.getPolicy(),
        });
        return;
      }

      if (method === 'GET' && pathname === '/api/memory') {
        const repo = parsedUrl.searchParams.get('repo') || process.cwd();
        const validatedRepo = validateRepositoryExists(repo);
        const type = parsedUrl.searchParams.get('type') || undefined;
        const tag = parsedUrl.searchParams.get('tag') || undefined;
        const file = parsedUrl.searchParams.get('file') || undefined;
        const memoryManager = new DecisionMemoryManager(validatedRepo);
        const memories = await memoryManager.listMemories({
          types: type ? [type as DecisionMemoryType] : undefined,
          tags: tag ? [tag] : undefined,
          files: file ? [file] : undefined,
        });
        this.sendJson(res, 200, { repo: validatedRepo, count: memories.length, memories });
        return;
      }

      if (method === 'POST' && pathname === '/api/memory') {
        const body = await this.readJsonBody(req);
        if (!body.repo || typeof body.repo !== 'string' || !body.type || !body.summary || !body.explanation) {
          this.sendJson(res, 400, { error: 'repo, type, summary, and explanation are required' });
          return;
        }
        const validatedRepo = validateRepositoryExists(body.repo as string);
        const memoryManager = new DecisionMemoryManager(validatedRepo);
        const record = await memoryManager.recordMemory({
          type: body.type as DecisionMemoryType,
          summary: body.summary as string,
          explanation: body.explanation as string,
          relatedFiles: Array.isArray(body.relatedFiles) ? (body.relatedFiles as string[]) : [],
          relatedSymbols: Array.isArray(body.relatedSymbols) ? (body.relatedSymbols as string[]) : [],
          rejectedAlternatives: Array.isArray(body.rejectedAlternatives) ? (body.rejectedAlternatives as string[]) : [],
          tradeOffs: Array.isArray(body.tradeOffs) ? (body.tradeOffs as string[]) : [],
          tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
        });
        this.sendJson(res, 201, record);
        return;
      }

      if (method === 'POST' && pathname === '/api/memory/conflicts') {
        const body = await this.readJsonBody(req);
        if (!body.repo || typeof body.repo !== 'string' || !body.proposal || typeof body.proposal !== 'string') {
          this.sendJson(res, 400, { error: 'repo and proposal are required' });
          return;
        }
        const validatedRepo = validateRepositoryExists(body.repo as string);
        const memoryManager = new DecisionMemoryManager(validatedRepo);
        const conflicts = await memoryManager.checkConflicts(
          body.proposal as string,
          Array.isArray(body.targetFiles) ? (body.targetFiles as string[]) : undefined
        );
        this.sendJson(res, 200, { conflicts, count: conflicts.length });
        return;
      }

      if ((method === 'DELETE' || method === 'POST') && pathname === '/api/memory/delete') {
        const body = await this.readJsonBody(req);
        const id = (body.id as string) || parsedUrl.searchParams.get('id');
        const repo = (body.repo as string) || parsedUrl.searchParams.get('repo');
        if (!repo || !id) {
          this.sendJson(res, 400, { error: 'repo and id are required' });
          return;
        }
        const validatedRepo = validateRepositoryExists(repo);
        const memoryManager = new DecisionMemoryManager(validatedRepo);
        const success = await memoryManager.deleteMemory(id);
        this.sendJson(res, success ? 200 : 404, { success, id });
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

  private sendHtml(res: ServerResponse, status: number, html: string): void {
    const payload = Buffer.from(html, 'utf-8');
    res.writeHead(status, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': payload.length,
    });
    res.end(payload);
  }

  private async readJsonBody(req: IncomingMessage, maxBytes: number = 1_048_576): Promise<Record<string, unknown>> {
    const contentType = req.headers['content-type'] || '';
    if (contentType && !contentType.toLowerCase().includes('application/json')) {
      throw new SecurityError('Content-Type must be application/json', 415);
    }

    return new Promise((resolvePromise, reject) => {
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
          resolvePromise({});
          return;
        }
        try {
          const raw = Buffer.concat(chunks).toString('utf-8');
          const parsed = JSON.parse(raw, (key, value) => {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
              throw new SecurityError('Prototype pollution attempt detected in payload', 400);
            }
            return value;
          });
          this.assertNoPrototypePollution(parsed);
          resolvePromise(parsed);
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
