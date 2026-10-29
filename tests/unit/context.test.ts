import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  ContextManager,
  MemoryStorageAdapter,
  LocalStorageAdapter,
  analyzeDependencies,
} from '../../src/context/index.js';
import { MemoryMode, VerificationStatus } from '../../src/core/index.js';
import type { Finding } from '../../src/core/index.js';

describe('Context and Persistent Intelligence', () => {
  const testDir = path.resolve(process.cwd());

  describe('Storage Adapters', () => {
    it('MemoryStorageAdapter saves and retrieves', async () => {
      const adapter = new MemoryStorageAdapter();
      const mockContext = {
        repoRoot: '/mock',
        lastCommitHash: 'abc',
        lastAnalyzedAt: new Date(),
        mode: MemoryMode.ZERO_PERSISTENT,
        dependencies: { react: '19.0.0' },
        dependencyGraph: {},
        historicalInvestigations: [],
        knownBugs: [],
        contradictions: [],
      };

      await adapter.save(mockContext);
      expect(await adapter.exists('/mock')).toBe(true);

      const loaded = await adapter.load('/mock');
      expect(loaded).toEqual(mockContext);

      await adapter.delete('/mock');
      expect(await adapter.exists('/mock')).toBe(false);
      expect(await adapter.load('/mock')).toBeNull();
    });

    it('LocalStorageAdapter persists context file', async () => {
      const adapter = new LocalStorageAdapter();
      const mockContext = {
        repoRoot: testDir,
        lastCommitHash: 'commit-123',
        lastAnalyzedAt: new Date(),
        mode: MemoryMode.LOCAL_CONTEXT,
        dependencies: { vitest: '3.0.0' },
        dependencyGraph: { 'src/index.ts': ['src/core/index.ts'] },
        historicalInvestigations: [],
        knownBugs: [],
        contradictions: [],
      };

      await adapter.save(mockContext);
      expect(await adapter.exists(testDir)).toBe(true);

      const loaded = await adapter.load(testDir);
      expect(loaded).toBeDefined();
      expect(loaded?.lastCommitHash).toBe('commit-123');
      expect(loaded?.dependencies.vitest).toBe('3.0.0');

      await adapter.delete(testDir);
      expect(await adapter.exists(testDir)).toBe(false);
    });
  });

  describe('analyzeDependencies', () => {
    it('analyzes dependencies and local imports in project', () => {
      const result = analyzeDependencies(testDir);
      expect(result.dependencies).toBeDefined();
      expect(Object.keys(result.dependencies).length).toBeGreaterThan(0);
      expect(result.dependencyGraph).toBeDefined();
      expect(Object.keys(result.dependencyGraph).length).toBeGreaterThan(0);
    });
  });

  describe('ContextManager', () => {
    let cm: ContextManager;

    beforeEach(() => {
      cm = new ContextManager(MemoryMode.ZERO_PERSISTENT);
    });

    afterEach(async () => {
      await cm.clearMemory(testDir);
    });

    it('initializes context with dependency analysis', async () => {
      const ctx = await cm.init(testDir);
      expect(ctx.repoRoot).toBe(testDir);
      expect(ctx.mode).toBe(MemoryMode.ZERO_PERSISTENT);
      expect(Object.keys(ctx.dependencies).length).toBeGreaterThan(0);
      expect(cm.getContext()).toBeDefined();
    });

    it('handles mode switching', async () => {
      await cm.init(testDir);
      cm.setMode(MemoryMode.LOCAL_CONTEXT);
      expect(cm.getMode()).toBe(MemoryMode.LOCAL_CONTEXT);
      expect(cm.getContext()?.mode).toBe(MemoryMode.LOCAL_CONTEXT);
    });

    it('records known bugs', async () => {
      await cm.init(testDir);
      const bug = await cm.recordKnownBug({
        title: 'Authentication timeout bug',
        rootCause: 'Connection pool exhausted under load',
        affectedFiles: ['src/auth/service.ts'],
        resolved: false,
      });

      expect(bug.id).toBeDefined();
      expect(bug.discoveredAt).toBeInstanceOf(Date);
      expect(cm.getContext()?.knownBugs).toHaveLength(1);
    });

    it('detects contradictions with past failures', async () => {
      await cm.init(testDir);
      await cm.recordKnownBug({
        title: 'Tests fail in auth module',
        rootCause: 'Token expiration mismatch',
        affectedFiles: ['src/auth.ts'],
        resolved: false,
      });

      const newFindings: Finding[] = [
        {
          claim: 'All detected tests pass',
          evidenceIds: ['ev-1'],
          verificationStatus: VerificationStatus.OBSERVED,
          confidence: 0.9,
          details: '10 tests passed in vitest run',
        },
      ];

      const contradictions = cm.detectContradictions(newFindings);
      expect(contradictions).toHaveLength(1);
      expect(contradictions[0].claim).toBe('All detected tests pass');
      expect(contradictions[0].previousEvidence).toContain('Tests fail in auth module');
    });

    it('rebuilds index', async () => {
      await cm.init(testDir);
      const rebuilt = await cm.rebuildIndex(testDir);
      expect(rebuilt.repoRoot).toBe(testDir);
      expect(rebuilt.lastAnalyzedAt).toBeInstanceOf(Date);
    });

    it('exports serialized context JSON', async () => {
      await cm.init(testDir);
      const exported = cm.exportContext();
      const parsed = JSON.parse(exported);
      expect(parsed.repoRoot).toBe(testDir);
      expect(parsed.dependencies).toBeDefined();
    });

    it('ensures ZERO_PERSISTENT mode never persists context file to disk', async () => {
      const isolatedDir = fs.mkdtempSync(path.join(testDir, 'tmp-zero-mem-'));
      try {
        const zeroCm = new ContextManager(MemoryMode.ZERO_PERSISTENT);
        await zeroCm.init(isolatedDir);
        await zeroCm.recordKnownBug({
          title: 'Ephemeral bug',
          rootCause: 'In memory only',
          affectedFiles: ['index.ts'],
          resolved: false,
        });

        const expectedFile = path.join(isolatedDir, '.anvexo', 'context.json');
        expect(fs.existsSync(expectedFile)).toBe(false);
      } finally {
        fs.rmSync(isolatedDir, { recursive: true, force: true });
      }
    });

    it('clears memory cache and removes disk context file in LOCAL_CONTEXT mode', async () => {
      const isolatedDir = fs.mkdtempSync(path.join(testDir, 'tmp-local-mem-'));
      try {
        const localCm = new ContextManager(MemoryMode.LOCAL_CONTEXT);
        await localCm.init(isolatedDir);
        await localCm.recordKnownBug({
          title: 'Persistent bug',
          rootCause: 'Written to disk',
          affectedFiles: ['index.ts'],
          resolved: false,
        });

        const contextFile = path.join(isolatedDir, '.anvexo', 'context.json');
        expect(fs.existsSync(contextFile)).toBe(true);

        await localCm.clearMemory(isolatedDir);
        expect(fs.existsSync(contextFile)).toBe(false);
        expect(localCm.getContext()).toBeNull();
      } finally {
        fs.rmSync(isolatedDir, { recursive: true, force: true });
      }
    });
  });
});
