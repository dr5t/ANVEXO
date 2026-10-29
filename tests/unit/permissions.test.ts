import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionManager } from '../../src/permissions/manager.js';
import { PermissionScope, PermissionDecision, PermissionDeniedError } from '../../src/core/types.js';

describe('PermissionManager', () => {
  let pm: PermissionManager;

  beforeEach(() => {
    pm = new PermissionManager();
  });

  it('denies by default when no grant exists and no prompt function', async () => {
    const allowed = await pm.check({
      scope: PermissionScope.FILE_READ,
      resource: '/some/path',
      description: 'test',
      risk: 'low',
    });
    expect(allowed).toBe(false);
  });

  it('allows when ALWAYS_ALLOW is granted', async () => {
    pm.grant(PermissionScope.FILE_READ, '/some/path', PermissionDecision.ALWAYS_ALLOW);
    const allowed = await pm.check({
      scope: PermissionScope.FILE_READ,
      resource: '/some/path',
      description: 'test',
      risk: 'low',
    });
    expect(allowed).toBe(true);
  });

  it('ALLOW_ONCE is consumed after one use', async () => {
    pm.grant(PermissionScope.FILE_READ, '/some/path', PermissionDecision.ALLOW_ONCE);

    const first = await pm.check({
      scope: PermissionScope.FILE_READ,
      resource: '/some/path',
      description: 'test',
      risk: 'low',
    });
    expect(first).toBe(true);

    const second = await pm.check({
      scope: PermissionScope.FILE_READ,
      resource: '/some/path',
      description: 'test',
      risk: 'low',
    });
    expect(second).toBe(false);
  });

  it('supports wildcard grants', async () => {
    pm.grant(PermissionScope.FILE_READ, '*', PermissionDecision.ALWAYS_ALLOW);
    const allowed = await pm.check({
      scope: PermissionScope.FILE_READ,
      resource: '/any/path/at/all',
      description: 'test',
      risk: 'low',
    });
    expect(allowed).toBe(true);
  });

  it('denies explicitly denied permissions', async () => {
    pm.grant(PermissionScope.FILE_WRITE, '/path', PermissionDecision.DENY);
    const allowed = await pm.check({
      scope: PermissionScope.FILE_WRITE,
      resource: '/path',
      description: 'test',
      risk: 'medium',
    });
    expect(allowed).toBe(false);
  });

  it('require throws PermissionDeniedError on denial', async () => {
    await expect(pm.require({
      scope: PermissionScope.COMMAND_EXECUTE,
      resource: 'rm -rf /',
      description: 'test',
      risk: 'critical',
    })).rejects.toThrow(PermissionDeniedError);
  });

  it('revoke removes a specific grant', async () => {
    pm.grant(PermissionScope.FILE_READ, '/path', PermissionDecision.ALWAYS_ALLOW);
    pm.revoke(PermissionScope.FILE_READ, '/path');
    const allowed = await pm.check({
      scope: PermissionScope.FILE_READ,
      resource: '/path',
      description: 'test',
      risk: 'low',
    });
    expect(allowed).toBe(false);
  });

  it('revokeAll clears all grants', async () => {
    pm.grant(PermissionScope.FILE_READ, '*', PermissionDecision.ALWAYS_ALLOW);
    pm.grant(PermissionScope.GIT_READ, '*', PermissionDecision.ALWAYS_ALLOW);
    pm.revokeAll();
    expect(pm.listGrants()).toHaveLength(0);
  });

  it('records audit log entries', async () => {
    await pm.check({
      scope: PermissionScope.FILE_READ,
      resource: '/test',
      description: 'test check',
      risk: 'low',
    });
    const log = pm.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0].decision).toBe(PermissionDecision.DENY);
  });

  it('uses prompt function when no existing grant', async () => {
    pm.setPromptFunction(async () => PermissionDecision.ALLOW_ONCE);
    const allowed = await pm.check({
      scope: PermissionScope.COMMAND_EXECUTE,
      resource: 'ls',
      description: 'list files',
      risk: 'low',
    });
    expect(allowed).toBe(true);
  });

  it('prompt function returning ALWAYS_ALLOW persists the grant', async () => {
    pm.setPromptFunction(async () => PermissionDecision.ALWAYS_ALLOW);
    await pm.check({
      scope: PermissionScope.FILE_READ,
      resource: '/path',
      description: 'test',
      risk: 'low',
    });
    expect(pm.listGrants()).toHaveLength(1);
    expect(pm.listGrants()[0].decision).toBe(PermissionDecision.ALWAYS_ALLOW);
  });

  it('scopes are independent', async () => {
    pm.grant(PermissionScope.FILE_READ, '/path', PermissionDecision.ALWAYS_ALLOW);
    const writeAllowed = await pm.check({
      scope: PermissionScope.FILE_WRITE,
      resource: '/path',
      description: 'test',
      risk: 'medium',
    });
    expect(writeAllowed).toBe(false);
  });

  it('wildcard ALLOW_ONCE is consumed after first use and does not persist', async () => {
    pm.grant(PermissionScope.FILE_READ, '*', PermissionDecision.ALLOW_ONCE);
    const first = await pm.check({
      scope: PermissionScope.FILE_READ,
      resource: '/first/path',
      description: 'test',
      risk: 'low',
    });
    expect(first).toBe(true);

    const second = await pm.check({
      scope: PermissionScope.FILE_READ,
      resource: '/second/path',
      description: 'test',
      risk: 'low',
    });
    expect(second).toBe(false);
  });

  it('supports prefix wildcard grants', async () => {
    pm.grant(PermissionScope.FILE_READ, 'src/*', PermissionDecision.ALWAYS_ALLOW);
    const match = await pm.check({
      scope: PermissionScope.FILE_READ,
      resource: 'src/index.ts',
      description: 'test',
      risk: 'low',
    });
    expect(match).toBe(true);

    const noMatch = await pm.check({
      scope: PermissionScope.FILE_READ,
      resource: 'docs/index.md',
      description: 'test',
      risk: 'low',
    });
    expect(noMatch).toBe(false);
  });
});
