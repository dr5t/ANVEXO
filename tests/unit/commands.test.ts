import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
