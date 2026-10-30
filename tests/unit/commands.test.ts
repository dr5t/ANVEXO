import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { CommandDispatcher } from '../../src/commands/index.js';
import { ConfigManager } from '../../src/core/config.js';
import { ProviderFactory } from '../../src/providers/index.js';
import { SkillManager } from '../../src/skills/index.js';
import { RuleManager } from '../../src/rules/index.js';
import { PluginManager } from '../../src/plugins/index.js';
import { GitService } from '../../src/git/index.js';
import { handleGemmaAction, formatGemmaInvestigation } from '../../src/cli/index.js';
import { GemmaProvider, type GemmaInvestigationResult } from '../../src/providers/gemma.js';
import { EvidenceType, VerificationStatus } from '../../src/core/types.js';

describe('CommandDispatcher', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anvexo-commands-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('rejects commands that do not start with a slash', async () => {
    const dispatcher = new CommandDispatcher();
    const configManager = new ConfigManager(tempDir);
    const providerFactory = new ProviderFactory(configManager);
    const skillManager = new SkillManager(tempDir);
    const ruleManager = new RuleManager(tempDir);
    const pluginManager = new PluginManager(tempDir);
    const gitService = new GitService(tempDir);

    const res = await dispatcher.execute('help', {
      repoPath: tempDir,
      configManager,
      skillManager,
      ruleManager,
      pluginManager,
      providerFactory,
      gitService,
    });
    expect(res.success).toBe(false);
    expect(res.message).toContain('must start with a slash');
  });

  it('executes /help command successfully', async () => {
    const dispatcher = new CommandDispatcher();
    const configManager = new ConfigManager(tempDir);
    const providerFactory = new ProviderFactory(configManager);
    const skillManager = new SkillManager(tempDir);
    const ruleManager = new RuleManager(tempDir);
    const pluginManager = new PluginManager(tempDir);
    const gitService = new GitService(tempDir);

    const res = await dispatcher.execute('/help', {
      repoPath: tempDir,
      configManager,
      skillManager,
      ruleManager,
      pluginManager,
      providerFactory,
      gitService,
    });
    expect(res.success).toBe(true);
    expect(res.message).toContain('/doctor');
    expect(res.message).toContain('/skills');
    expect(res.message).toContain('/rules');
  });

  it('executes /doctor command and returns truthful environment info', async () => {
    const dispatcher = new CommandDispatcher();
    const configManager = new ConfigManager(tempDir);
    const providerFactory = new ProviderFactory(configManager);
    const skillManager = new SkillManager(tempDir);
    const ruleManager = new RuleManager(tempDir);
    const pluginManager = new PluginManager(tempDir);
    const gitService = new GitService(tempDir);

    const res = await dispatcher.execute('/doctor', {
      repoPath: tempDir,
      configManager,
      skillManager,
      ruleManager,
      pluginManager,
      providerFactory,
      gitService,
    });
    expect(res.success).toBe(true);
    expect(res.message).toContain('ANVEXO Doctor Diagnostics');
    expect(res.message).toContain('Node.js Runtime');
  });
});

describe('Gemma CLI Command', () => {
  let tempDir: string;
  let stdoutOutput = '';
  let stderrOutput = '';
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  const mockResult: GemmaInvestigationResult = {
    summary: 'Null pointer dereference in auth handler',
    suspectedRootCause: 'User object is undefined when session token expires',
    visualEvidence: 'Screenshot shows error dialog 500 on login',
    codeEvidence: [{ file: 'src/auth/handler.ts', lineRange: '45-52', snippet: 'const user = session.user;\nuser.id;' }],
    proposedFix: 'Add optional chaining user?.id before dereference',
    suggestedRegressionTests: ['npm test tests/unit/auth.test.ts'],
    confidence: 0.95,
    uncertainties: ['Edge case with concurrent token refresh'],
    missingInformation: ['Redis session store logs'],
    evidenceRecords: [
      {
        id: 'ev-1',
        type: EvidenceType.FILE_CONTENT,
        source: 'src/auth/handler.ts',
        content: 'user.id access without null check',
        timestamp: new Date('2026-10-30T00:00:00Z'),
        toolName: 'gemma_analyzer',
        verificationStatus: VerificationStatus.VERIFIED,
        linkedHypothesisIds: [],
        metadata: {},
      },
    ],
    modelUsed: 'gemma-4-31b-it',
    routeUsed: 'gemini-api',
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anvexo-gemma-cli-test-'));
    stdoutOutput = '';
    stderrOutput = '';
    process.stdout.write = vi.fn().mockImplementation((chunk: string | Uint8Array) => {
      stdoutOutput += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString();
      return true;
    });
    process.stderr.write = vi.fn().mockImplementation((chunk: string | Uint8Array) => {
      stderrOutput += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString();
      return true;
    });
  });

  afterEach(() => {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    vi.restoreAllMocks();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('formats Gemma investigation result into structured terminal output', () => {
    const formatted = formatGemmaInvestigation(mockResult, 'Fix login 500 crash', '/app/test');
    expect(formatted).toContain('ANVEXO GEMMA 4 MULTIMODAL INVESTIGATION');
    expect(formatted).toContain('Fix login 500 crash');
    expect(formatted).toContain('/app/test');
    expect(formatted).toContain('gemma-4-31b-it');
    expect(formatted).toContain('gemini-api');
    expect(formatted).toContain('Confidence:              95%');
    expect(formatted).toContain('--- SUMMARY ---');
    expect(formatted).toContain('Null pointer dereference in auth handler');
    expect(formatted).toContain('--- SUSPECTED ROOT CAUSE ---');
    expect(formatted).toContain('User object is undefined when session token expires');
    expect(formatted).toContain('--- VISUAL EVIDENCE ---');
    expect(formatted).toContain('Screenshot shows error dialog 500 on login');
    expect(formatted).toContain('--- CODE EVIDENCE ---');
    expect(formatted).toContain('src/auth/handler.ts:45-52');
    expect(formatted).toContain('--- PROPOSED FIX ---');
    expect(formatted).toContain('Add optional chaining user?.id before dereference');
    expect(formatted).toContain('--- RECOMMENDED REGRESSION TESTS ---');
    expect(formatted).toContain('1. npm test tests/unit/auth.test.ts');
    expect(formatted).toContain('--- UNCERTAINTIES ---');
    expect(formatted).toContain('Edge case with concurrent token refresh');
    expect(formatted).toContain('--- EVIDENCE RECORDS (1) ---');
    expect(formatted).toContain('[verified] file_content');
  });

  it('executes handleGemmaAction successfully with mock provider', async () => {
    const mockProvider = new GemmaProvider({ apiKey: 'dummy-key' });
    vi.spyOn(mockProvider, 'investigateIssue').mockResolvedValue(mockResult);

    const code = await handleGemmaAction('Fix login crash', { path: tempDir }, mockProvider);

    expect(code).toBe(0);
    expect(stdoutOutput).toContain('ANVEXO GEMMA 4 MULTIMODAL INVESTIGATION');
    expect(stdoutOutput).toContain('Null pointer dereference');
    expect(stderrOutput).toBe('');
  });

  it('outputs JSON formatted result when json option is true', async () => {
    const mockProvider = new GemmaProvider({ apiKey: 'dummy-key' });
    vi.spyOn(mockProvider, 'investigateIssue').mockResolvedValue(mockResult);

    const code = await handleGemmaAction('Fix login crash', { path: tempDir, json: true }, mockProvider);

    expect(code).toBe(0);
    const parsed = JSON.parse(stdoutOutput.trim());
    expect(parsed.summary).toBe('Null pointer dereference in auth handler');
    expect(parsed.modelUsed).toBe('gemma-4-31b-it');
    expect(parsed.confidence).toBe(0.95);
  });

  it('loads and encodes screenshot file when provided', async () => {
    const screenshotPath = path.join(tempDir, 'sample-error.png');
    fs.writeFileSync(screenshotPath, Buffer.from('fake-png-binary-data'));

    const mockProvider = new GemmaProvider({ apiKey: 'dummy-key' });
    const spy = vi.spyOn(mockProvider, 'investigateIssue').mockResolvedValue(mockResult);

    const code = await handleGemmaAction('Diagnose UI error', {
      path: tempDir,
      screenshot: screenshotPath,
    }, mockProvider);

    expect(code).toBe(0);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      screenshot: expect.objectContaining({
        mimeType: 'image/png',
        label: 'sample-error.png',
        data: Buffer.from('fake-png-binary-data').toString('base64'),
      }),
    }));
  });

  it('returns error code 1 when screenshot file does not exist', async () => {
    const mockProvider = new GemmaProvider({ apiKey: 'dummy-key' });
    const code = await handleGemmaAction('Diagnose UI error', {
      path: tempDir,
      screenshot: path.join(tempDir, 'nonexistent.png'),
    }, mockProvider);

    expect(code).toBe(1);
    expect(stderrOutput).toContain('Screenshot file not found');
  });

  it('returns error code 1 when screenshot has unsupported extension', async () => {
    const unsupportedFile = path.join(tempDir, 'screenshot.bmp');
    fs.writeFileSync(unsupportedFile, 'fake-bmp-data');

    const mockProvider = new GemmaProvider({ apiKey: 'dummy-key' });
    const code = await handleGemmaAction('Diagnose UI error', {
      path: tempDir,
      screenshot: unsupportedFile,
    }, mockProvider);

    expect(code).toBe(1);
    expect(stderrOutput).toContain('Unsupported screenshot format: .bmp');
  });

  it('loads terminal log file when provided', async () => {
    const logPath = path.join(tempDir, 'build-error.log');
    fs.writeFileSync(logPath, 'TypeError: cannot read property id of undefined\n    at loginHandler');

    const mockProvider = new GemmaProvider({ apiKey: 'dummy-key' });
    const spy = vi.spyOn(mockProvider, 'investigateIssue').mockResolvedValue(mockResult);

    const code = await handleGemmaAction('Investigate build failure', {
      path: tempDir,
      log: logPath,
    }, mockProvider);

    expect(code).toBe(0);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      terminalLog: expect.stringContaining('TypeError: cannot read property id of undefined'),
    }));
  });

  it('returns error code 1 when log file does not exist', async () => {
    const mockProvider = new GemmaProvider({ apiKey: 'dummy-key' });
    const code = await handleGemmaAction('Investigate log', {
      path: tempDir,
      log: path.join(tempDir, 'nonexistent.log'),
    }, mockProvider);

    expect(code).toBe(1);
    expect(stderrOutput).toContain('Log file not found');
  });

  it('gathers git diff when diff option is true', async () => {
    const mockProvider = new GemmaProvider({ apiKey: 'dummy-key' });
    const spy = vi.spyOn(mockProvider, 'investigateIssue').mockResolvedValue(mockResult);

    const code = await handleGemmaAction('Review changes', {
      path: tempDir,
      diff: true,
    }, mockProvider);

    expect(code).toBe(0);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      gitDiff: expect.any(String),
    }));
  });

  it('displays setup hint when Gemma API key is missing', async () => {
    const mockProvider = new GemmaProvider({ apiKey: '' });
    vi.spyOn(mockProvider, 'investigateIssue').mockRejectedValue(
      new Error('Gemma API key is not configured for Gemini API access. Set GEMMA_API_KEY or GEMINI_API_KEY in your environment, or switch to the local inference route.')
    );

    const code = await handleGemmaAction('Test issue', { path: tempDir }, mockProvider);

    expect(code).toBe(1);
    expect(stderrOutput).toContain('Gemma investigation error');
    expect(stderrOutput).toContain('Setup Hint:');
    expect(stderrOutput).toContain('GEMMA_API_KEY="AIzaSy..."');
  });

  it('displays setup hint when local Gemma daemon is unreachable', async () => {
    const mockProvider = new GemmaProvider({ route: 'local' });
    vi.spyOn(mockProvider, 'investigateIssue').mockRejectedValue(
      new Error('Failed to reach local Gemma inference daemon at http://127.0.0.1:11434: fetch failed')
    );

    const code = await handleGemmaAction('Test issue', { path: tempDir }, mockProvider);

    expect(code).toBe(1);
    expect(stderrOutput).toContain('Gemma investigation error');
    expect(stderrOutput).toContain('Setup Hint:');
    expect(stderrOutput).toContain('ollama serve');
  });
});

