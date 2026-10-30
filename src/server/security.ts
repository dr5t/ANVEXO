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
  if (targetPath.includes('\0') || rootPath.includes('\0')) {
    throw new SecurityError('Null byte injection detected in path', 400);
  }

  const resolvedRoot = path.resolve(rootPath);
  const canonicalRoot = fs.existsSync(resolvedRoot) ? fs.realpathSync(resolvedRoot) : resolvedRoot;
  const uncanonicalTarget = path.isAbsolute(targetPath) ? path.resolve(targetPath) : path.resolve(resolvedRoot, targetPath);

  const initialRel = path.relative(resolvedRoot, uncanonicalTarget);
  if (initialRel.startsWith('..') || path.isAbsolute(initialRel)) {
    throw new SecurityError(`Path traversal attempt detected: ${targetPath} escapes root ${rootPath}`, 403);
  }

  if (fs.existsSync(uncanonicalTarget)) {
    const canonicalTarget = fs.realpathSync(uncanonicalTarget);
    const canonicalRel = path.relative(canonicalRoot, canonicalTarget);
    if (canonicalRel.startsWith('..') || path.isAbsolute(canonicalRel)) {
      throw new SecurityError(`Symlink escape detected: ${targetPath} resolves outside root ${rootPath}`, 403);
    }
    return canonicalTarget;
  }

  let current = path.dirname(uncanonicalTarget);
  let resolvedCanonicalParent = canonicalRoot;
  while (current !== path.dirname(current)) {
    if (fs.existsSync(current)) {
      const canonicalParent = fs.realpathSync(current);
      const parentRel = path.relative(canonicalRoot, canonicalParent);
      if (parentRel.startsWith('..') || path.isAbsolute(parentRel)) {
        throw new SecurityError(`Symlink parent escape detected: ${targetPath} resolves outside root ${rootPath}`, 403);
      }
      resolvedCanonicalParent = canonicalParent;
      break;
    }
    current = path.dirname(current);
  }

  const remainder = path.relative(current, uncanonicalTarget);
  return path.resolve(resolvedCanonicalParent, remainder);
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
  return fs.realpathSync(resolved);
}

export function validateHostHeader(req: IncomingMessage, allowedHost: string = '127.0.0.1'): boolean {
  const rawHost = req.headers.host || '';
  if (!rawHost) return false;

  const hostname = rawHost.startsWith('[')
    ? (rawHost.split(']')[0] + ']').toLowerCase()
    : rawHost.split(':')[0].toLowerCase();

  if (allowedHost === '0.0.0.0' || allowedHost === '*') {
    return true;
  }

  const allowed = [
    '127.0.0.1',
    'localhost',
    '::1',
    '[::1]',
    allowedHost.toLowerCase(),
  ];

  if (process.env.ALLOWED_HOSTS) {
    const custom = process.env.ALLOWED_HOSTS.split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
    allowed.push(...custom);
  }

  return allowed.includes(hostname);
}

export function applySecurityHeaders(res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';",
  );
}

export function applyCorsHeaders(
  req: IncomingMessage,
  res: ServerResponse,
  allowedOrigins: string[] = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ],
): boolean {
  const origin = req.headers.origin;
  if (!origin) {
    return true;
  }

  const origins = [...allowedOrigins];
  if (process.env.ALLOWED_ORIGINS) {
    origins.push(...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean));
  }

  let isAllowed = origins.includes(origin);
  if (!isAllowed) {
    try {
      const parsed = new URL(origin);
      const host = parsed.hostname.toLowerCase();
      const reqHost = req.headers.host ? req.headers.host.split(':')[0].toLowerCase() : '';
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host === '[::1]' ||
        (reqHost && host === reqHost)
      ) {
        isAllowed = true;
      }
    } catch {
      isAllowed = false;
    }
  }

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return true;
  }

  return false;
}

export function validateSecFetchSite(req: IncomingMessage): boolean {
  const secFetchSite = req.headers['sec-fetch-site'];
  if (secFetchSite && typeof secFetchSite === 'string') {
    if (secFetchSite.toLowerCase() === 'cross-site') {
      return false;
    }
  }
  return true;
}
