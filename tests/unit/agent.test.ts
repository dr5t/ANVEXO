import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { AgentRuntime } from '../../src/agent/index.js';
import { OfflineHeuristicProvider } from '../../src/providers/index.js';
import { PermissionManager } from '../../src/permissions/index.js';
import { PermissionDecision, PermissionScope } from '../../src/core/index.js';
import { ToolRegistry, registerBuiltinTools } from '../../src/tools/index.js';
import { RuleManager } from '../../src/rules/index.js';
import { SkillManager } from '../../src/skills/index.js';

describe('AgentRuntime', () => {
  let tempDir: string;
  let permissions: PermissionManager;
  let tools: ToolRegistry;
  let ruleManager: RuleManager;
  let skillManager: SkillManager;
  let provider: OfflineHeuristicProvider;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anvexo-agent-test-'));
    permissions = new PermissionManager();
    permissions.grant(PermissionScope.GIT_READ, '*', PermissionDecision.ALWAYS_ALLOW);
    permissions.grant(PermissionScope.FILE_READ, '*', PermissionDecision.ALWAYS_ALLOW);
    tools = new ToolRegistry(permissions);
    registerBuiltinTools(tools);
    ruleManager = new RuleManager(tempDir);
    skillManager = new SkillManager(tempDir);
    provider = new OfflineHeuristicProvider();
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('creates an agent session with default mode', () => {
    const runtime = new AgentRuntime({
      repoPath: tempDir,
      provider,
      permissions,
      tools,
      ruleManager,
      skillManager,
    });

    const session = runtime.createSession('interactive');
    expect(session.id).toBeDefined();
    expect(session.mode).toBe('interactive');
    expect(session.messages.length).toBe(0);
    expect(runtime.getSession(session.id)).toBe(session);
  });

  it('generates a structured plan in plan mode', async () => {
    const runtime = new AgentRuntime({
      repoPath: tempDir,
      provider,
      permissions,
      tools,
      ruleManager,
      skillManager,
    });

    const session = runtime.createSession('plan');
    const plan = await runtime.createPlan('Investigate failing tests and apply fix', session);
    expect(plan.goal).toContain('Investigate failing tests');
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.status).toBe('draft');
  });

  it('executes autonomous agent run with tool execution and events', async () => {
    const runtime = new AgentRuntime({
      repoPath: tempDir,
      provider,
      permissions,
      tools,
      ruleManager,
      skillManager,
      mode: 'autonomous',
    });

    const session = runtime.createSession('autonomous');
    const events: string[] = [];

    await runtime.run('Check status of git repository', session, (evt) => {
      events.push(evt.type);
    });

    expect(session.messages.length).toBeGreaterThanOrEqual(2);
    expect(events).toContain('done');
    expect(session.status).toBe('completed');
  });
});
