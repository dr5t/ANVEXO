import * as path from 'node:path';
import * as fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';

export class SecurityError extends Error {
  constructor(message: string, public readonly statusCode: number = 400) {
    super(message);
    this.name = 'SecurityError';
  }
}

export function validatePathWithinRoot(targetPath: string, rootPath: string): string {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new SecurityError('Target path must be a non-empty string', 400);
  }
  if (!rootPath || typeof rootPath !== 'string') {
    throw new SecurityError('Root path must be a non-empty string', 400);
  }

  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(resolvedRoot, targetPath);

  const rel = path.relative(resolvedRoot, resolvedTarget);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new SecurityError(`Path traversal attempt detected: ${targetPath} escapes root ${rootPath}`, 403);
  }

  return resolvedTarget;
}

export function validateRepositoryExists(repoPath: string): string {
  const resolved = path.resolve(repoPath);
  if (!fs.existsSync(resolved)) {
    throw new SecurityError(`Repository path does not exist: ${resolved}`, 404);
  }
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new SecurityError(`Repository path is not a directory: ${resolved}`, 400);
  }
  return resolved;
}

export function applySecurityHeaders(res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: http:;",
  );
}

export function applyCorsHeaders(req: IncomingMessage, res: ServerResponse, allowedOrigins: string[] = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173']): boolean {
  const origin = req.headers.origin;
  if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    return true;
  }

  const isAllowed = allowedOrigins.includes(origin)
    || origin.startsWith('http://localhost:')
    || origin.startsWith('http://127.0.0.1:');

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return true;
  }

  return false;
}
