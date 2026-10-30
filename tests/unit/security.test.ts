import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import {
  AnvexoServer,
  validatePathWithinRoot,
  SecurityError,
} from '../../src/server/index.js';
import { redactSecrets } from '../../src/core/index.js';
import {
  createFileReadTool,
  createFileWriteTool,
  createFileDeleteTool,
  getCleanSubprocessEnv,
} from '../../src/tools/builtin.js';

describe('Security Baseline and Defensive Controls', () => {
  let tmpDir: string;
  let server: AnvexoServer;
  let serverUrl: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anvexo-sec-'));
    server = new AnvexoServer({ port: 0, host: '127.0.0.1' });
    const res = await server.start();
    serverUrl = res.url;
  });

  afterEach(async () => {
    await server.stop();
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('Path Traversal and Filesystem Confinement', () => {
    it('rejects path traversal attempting to escape root', () => {
      expect(() => {
        validatePathWithinRoot('../../etc/passwd', tmpDir);
      }).toThrow(SecurityError);
    });

    it('rejects null byte injection in paths', () => {
      expect(() => {
        validatePathWithinRoot('safe.txt\0/../../etc/passwd', tmpDir);
      }).toThrow(SecurityError);
    });

    it('rejects symlink escape pointing outside canonical root', () => {
      const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anvexo-outside-'));
      fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'secret outside content');
      const symlinkPath = path.join(tmpDir, 'symlink-escape');
      fs.symlinkSync(outsideDir, symlinkPath, 'junction');

      try {
        expect(() => {
          validatePathWithinRoot(path.join('symlink-escape', 'secret.txt'), tmpDir);
        }).toThrow(/Symlink escape detected/);
      } finally {
        fs.rmSync(outsideDir, { recursive: true, force: true });
      }
    });

    it('allows valid canonical path within root', () => {
      const validFile = path.join(tmpDir, 'valid.txt');
      fs.writeFileSync(validFile, 'valid content');
      const resolved = validatePathWithinRoot('valid.txt', tmpDir);
      expect(resolved).toBe(fs.realpathSync(validFile));
    });

    it('blocks file_read from following symlinks escaping rootPath', async () => {
      const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anvexo-read-outside-'));
      fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'secret-content');
      const symlinkPath = path.join(tmpDir, 'symlink-read');
      fs.symlinkSync(outsideDir, symlinkPath, 'junction');

      try {
        const tool = createFileReadTool();
        const res = await tool.execute({ path: path.join('symlink-read', 'secret.txt'), rootPath: tmpDir });
        expect(res.success).toBe(false);
        expect(res.error).toContain('Symlink escape detected');
      } finally {
        fs.rmSync(outsideDir, { recursive: true, force: true });
      }
    });

    it('blocks file_write from following symlinks escaping rootPath', async () => {
      const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anvexo-write-outside-'));
      const outsideFile = path.join(outsideDir, 'target.txt');
      fs.writeFileSync(outsideFile, 'initial-content');
      const symlinkPath = path.join(tmpDir, 'symlink-write');
      fs.symlinkSync(outsideDir, symlinkPath, 'junction');

      try {
        const tool = createFileWriteTool();
        const res = await tool.execute({
          path: path.join('symlink-write', 'target.txt'),
          content: 'overwritten',
          rootPath: tmpDir,
        });
        expect(res.success).toBe(false);
        expect(res.error).toContain('Symlink escape detected');
        expect(fs.readFileSync(outsideFile, 'utf-8')).toBe('initial-content');
      } finally {
        fs.rmSync(outsideDir, { recursive: true, force: true });
      }
    });

    it('blocks file_delete from unlinking targets outside rootPath via symlinks', async () => {
      const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anvexo-del-outside-'));
      const outsideFile = path.join(outsideDir, 'target.txt');
      fs.writeFileSync(outsideFile, 'do-not-delete');
      const symlinkPath = path.join(tmpDir, 'symlink-del');
      fs.symlinkSync(outsideDir, symlinkPath, 'junction');

      try {
        const tool = createFileDeleteTool();
        const res = await tool.execute({ path: path.join('symlink-del', 'target.txt'), rootPath: tmpDir });
        expect(res.success).toBe(false);
        expect(res.error).toContain('Symlink escape detected');
        expect(fs.existsSync(outsideFile)).toBe(true);
      } finally {
        fs.rmSync(outsideDir, { recursive: true, force: true });
      }
    });
  });

  describe('Secret Redaction Engine', () => {
    it('redacts AWS access keys', () => {
      const raw = 'Config AWS key is AKIAIOSFODNN7EXAMPLE in profile';
      const redacted = redactSecrets(raw);
      expect(redacted).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(redacted).toContain('[REDACTED_AWS_KEY]');
    });

    it('redacts GitHub personal access tokens', () => {
      const raw = 'Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz12';
      const redacted = redactSecrets(raw);
      expect(redacted).not.toContain('ghp_1234567890abcdefghijklmnopqrstuvwxyz12');
      expect(redacted).toContain('[REDACTED_GITHUB_TOKEN]');
    });

    it('redacts Bearer authentication tokens', () => {
      const raw = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.signature';
      const redacted = redactSecrets(raw);
      expect(redacted).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.signature');
      expect(redacted).toContain('Bearer [REDACTED_TOKEN]');
    });

    it('redacts private keys', () => {
      const raw = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0m...\n-----END RSA PRIVATE KEY-----';
      const redacted = redactSecrets(raw);
      expect(redacted).toContain('[REDACTED_PRIVATE_KEY]');
      expect(redacted).not.toContain('MIIEowIBAAKCAQEA0m');
    });

    it('redacts generic API keys and passwords', () => {
      const raw = 'apikey="supersecrettokenvalue123" and password="myultraheavysecretpassword"';
      const redacted = redactSecrets(raw);
      expect(redacted).not.toContain('supersecrettokenvalue123');
      expect(redacted).not.toContain('myultraheavysecretpassword');
      expect(redacted).toContain('[REDACTED]');
    });

    it('redacts Slack bot and user tokens', () => {
      const dummyBot = ['xoxb', '123456789012', '1234567890123', 'abcdefghijklmnopqrstuv'].join('-');
      const dummyUser = ['xoxp', '9876543210', 'abcdefghijkl'].join('-');
      const raw = `Slack bot is ${dummyBot} and user is ${dummyUser}`;
      const redacted = redactSecrets(raw);
      expect(redacted).not.toContain(dummyBot);
      expect(redacted).not.toContain(dummyUser);
      expect(redacted).toContain('[REDACTED_SLACK_TOKEN]');
    });

    it('redacts unquoted passwords in environment style', () => {
      const raw = 'DB_PASSWORD=myUnquotedPassword987\nAPI_KEY=mySecretApiKeyToken99';
      const redacted = redactSecrets(raw);
      expect(redacted).not.toContain('myUnquotedPassword987');
      expect(redacted).not.toContain('mySecretApiKeyToken99');
      expect(redacted).toContain('[REDACTED_SECRET]');
      expect(redacted).toContain('[REDACTED]');
    });

    it('redacts secrets in structured JSON format', () => {
      const raw = JSON.stringify({ password: 'myJsonSecretPassword', auth: 'tokenValue12345' });
      const redacted = redactSecrets(raw);
      expect(redacted).not.toContain('myJsonSecretPassword');
      expect(redacted).not.toContain('tokenValue12345');
      expect(redacted).toContain('[REDACTED_SECRET]');
    });

    it('redacts secrets in escaped JSON strings', () => {
      const raw = '{"data": "{\\"token\\": \\"innerSecretToken12345\\"}"}';
      const redacted = redactSecrets(raw);
      expect(redacted).not.toContain('innerSecretToken12345');
      expect(redacted).toContain('[REDACTED]');
    });

    it('preserves ordinary text without false positive redactions', () => {
      const raw = 'const passwordInput = document.getElementById("pwd"); const userAuth = true; const password_hash = calculateHash(salt);';
      const redacted = redactSecrets(raw);
      expect(redacted).toBe(raw);
    });

    it('handles malformed, empty, and non-string inputs safely', () => {
      expect(redactSecrets('')).toBe('');
      expect(redactSecrets(null as unknown as string)).toBe(null);
      expect(redactSecrets(undefined as unknown as string)).toBe(undefined);
      expect(redactSecrets(12345 as unknown as string)).toBe(12345);
    });
  });

  describe('Subprocess Execution Isolation', () => {
    it('filters inherited environment to safe whitelist', () => {
      const oldAws = process.env.AWS_SECRET_ACCESS_KEY;
      const oldGh = process.env.GITHUB_TOKEN;
      process.env.AWS_SECRET_ACCESS_KEY = 'secret-aws-key';
      process.env.GITHUB_TOKEN = 'secret-gh-token';

      try {
        const cleanEnv = getCleanSubprocessEnv();
        expect(cleanEnv.AWS_SECRET_ACCESS_KEY).toBeUndefined();
        expect(cleanEnv.GITHUB_TOKEN).toBeUndefined();
        expect(cleanEnv.CI).toBe('true');
        expect(cleanEnv.GIT_TERMINAL_PROMPT).toBe('0');
        expect(cleanEnv.PATH).toBeDefined();
      } finally {
        if (oldAws !== undefined) process.env.AWS_SECRET_ACCESS_KEY = oldAws;
        else delete process.env.AWS_SECRET_ACCESS_KEY;
        if (oldGh !== undefined) process.env.GITHUB_TOKEN = oldGh;
        else delete process.env.GITHUB_TOKEN;
      }
    });

    it('blocks access to system sensitive files in file_read tool', async () => {
      const tool = createFileReadTool();
      const result = await tool.execute({ path: '/etc/passwd' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('forbidden');
    });

    it('blocks sensitive POSIX system paths consistently across file tools', async () => {
      const readResult = await createFileReadTool().execute({ path: '\\etc\\passwd' });
      const writeResult = await createFileWriteTool().execute({ path: '/etc/shadow', content: 'modified' });
      const deleteResult = await createFileDeleteTool().execute({ path: '/etc/sudoers' });

      expect(readResult.error).toContain('forbidden');
      expect(writeResult.error).toContain('forbidden');
      expect(deleteResult.error).toContain('forbidden');
    });
  });

  describe('Local API Authorization, CSRF and Prototype Pollution', () => {
    it('rejects prototype pollution attempts in JSON body', async () => {
      const payload = '{"__proto__": {"polluted": true}, "path": ' + JSON.stringify(tmpDir) + '}';

      const res = await fetch(`${serverUrl}/api/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Prototype pollution attempt detected');
    });

    it('rejects constructor.prototype pollution attempts', async () => {
      const payload = JSON.stringify({
        constructor: { prototype: { admin: true } },
        path: tmpDir,
      });

      const res = await fetch(`${serverUrl}/api/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Prototype pollution attempt detected');
    });

    it('rejects cross-site CSRF requests with Sec-Fetch-Site cross-site', async () => {
      const res = await fetch(`${serverUrl}/api/context/clear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Sec-Fetch-Site': 'cross-site',
        },
        body: JSON.stringify({ path: tmpDir }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Sec-Fetch-Site');
    });

    it('validates permission grant scopes and decisions', async () => {
      const invalidScopeRes = await fetch(`${serverUrl}/api/permissions/grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'invalid:scope:attack',
          resource: '*',
          decision: 'always_allow',
        }),
      });
      expect(invalidScopeRes.status).toBe(400);

      const invalidDecisionRes = await fetch(`${serverUrl}/api/permissions/grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'file:read',
          resource: '*',
          decision: 'malicious_decision',
        }),
      });
      expect(invalidDecisionRes.status).toBe(400);
    });
  });
});
