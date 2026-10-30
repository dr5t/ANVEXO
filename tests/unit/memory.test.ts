import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DecisionMemoryManager } from '../../src/memory/manager.js';

describe('DecisionMemoryManager', () => {
  let memory: DecisionMemoryManager;
  const tempDir = path.join(process.cwd(), '.anvexo-test-memory-' + Date.now());

  beforeEach(() => {
    fs.mkdirSync(tempDir, { recursive: true });
    memory = new DecisionMemoryManager(tempDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('records architecture decisions with metadata and secret redaction', () => {
    const record = memory.add({
      type: 'architecture_decision',
      summary: 'Use Vitest as primary test runner with API_KEY=sk-test1234567890abcdef',
      explanation: 'Native TypeScript ESM compatibility without transpilation latency.',
      relatedFiles: ['vitest.config.ts', 'package.json'],
      tags: ['testing', 'architecture'],
    });

    expect(record.id).toBeDefined();
    expect(record.type).toBe('architecture_decision');
    expect(record.summary).not.toContain('sk-test1234567890abcdef');
    expect(record.summary).toContain('[REDACTED');
    expect(record.status).toBe('active');
    expect(record.relatedFiles).toEqual(['vitest.config.ts', 'package.json']);
  });

  it('filters memory records by type, tag, and search query', () => {
    memory.add({
      type: 'architecture_decision',
      summary: 'Observability uses OpenTelemetry',
      explanation: 'Standardized distributed tracing',
      tags: ['telemetry'],
    });

    memory.add({
      type: 'rejected_solution',
      summary: 'Do not use Jest for ESM testing',
      explanation: 'Module resolution failures in pure NodeNext',
      tags: ['testing'],
    });

    const decisions = memory.list({ types: ['architecture_decision'] });
    expect(decisions.length).toBe(1);
    expect(decisions[0].summary).toContain('OpenTelemetry');

    const searchResults = memory.list({ search: 'Jest' });
    expect(searchResults.length).toBe(1);
    expect(searchResults[0].type).toBe('rejected_solution');
  });

  it('warns when a proposed change repeats a rejected solution', () => {
    memory.add({
      type: 'rejected_solution',
      summary: 'Do not use Jest for ESM testing',
      explanation: 'Causes pure ESM loader hangs under Node 22',
      relatedFiles: ['package.json'],
    });

    const warnings = memory.checkConflicts('We should configure Jest for testing our project', ['package.json']);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].conflictType).toBe('repeats_rejected_solution');
    expect(warnings[0].severity).toBe('high');
  });

  it('warns when a proposed change uses a deprecated pattern', () => {
    memory.add({
      type: 'deprecated_pattern',
      summary: 'Direct process.exit in web handlers is deprecated',
      explanation: 'Use response.status(500) and graceful error handler instead',
      relatedFiles: ['src/server/router.ts'],
    });

    const warnings = memory.checkConflicts('Direct process.exit in web handlers is deprecated', ['src/server/router.ts']);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].conflictType).toBe('deprecated_pattern_used');
  });

  it('builds prioritized agent context prompt for affected files', () => {
    memory.add({
      type: 'architecture_decision',
      summary: 'Strict Default-Deny on tool execution',
      explanation: 'All tools must pass permission validation before execution',
      relatedFiles: ['src/tools/index.ts', 'src/permissions/manager.ts'],
    });

    const prompt = memory.buildAgentContextPrompt(['src/permissions/manager.ts']);
    expect(prompt).toContain('Project Decision Memory');
    expect(prompt).toContain('Default-Deny on tool execution');
  });

  it('updates, archives, and deletes memory records', () => {
    const record = memory.add({
      type: 'known_limitation',
      summary: 'In-memory rate limiter does not synchronize across distributed replicas',
      explanation: 'Sufficient for single-node desktop IDE, but requires Redis in cluster mode',
    });

    memory.update(record.id, { summary: 'Updated rate limiter limitation headline' });
    expect(memory.get(record.id)?.summary).toBe('Updated rate limiter limitation headline');

    memory.archive(record.id);
    expect(memory.get(record.id)?.status).toBe('archived');
    expect(memory.list({ status: ['active'] }).length).toBe(0);

    const deleted = memory.delete(record.id);
    expect(deleted).toBe(true);
    expect(memory.get(record.id)).toBeUndefined();
  });
});
