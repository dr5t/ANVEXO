import {
  PermissionScope,
  PermissionDecision,
  PermissionDeniedError,
  logger,
} from '../core/index.js';
import type { PermissionRequest, PermissionGrant } from '../core/index.js';

export class PermissionManager {
  private grants: Map<string, PermissionGrant> = new Map();
  private auditLog: Array<{
    timestamp: Date;
    request: PermissionRequest;
    decision: PermissionDecision;
  }> = [];
  private promptFn: ((req: PermissionRequest) => Promise<PermissionDecision>) | null = null;

  setPromptFunction(fn: (req: PermissionRequest) => Promise<PermissionDecision>): void {
    this.promptFn = fn;
  }

  grant(scope: PermissionScope, resource: string, decision: PermissionDecision): void {
    const key = this.key(scope, resource);
    this.grants.set(key, {
      scope,
      resource,
      decision,
      grantedAt: new Date(),
    });
    logger.info('permissions', `Granted ${decision} for ${scope} on ${resource}`);
  }

  revoke(scope: PermissionScope, resource: string): void {
    const key = this.key(scope, resource);
    this.grants.delete(key);
    logger.info('permissions', `Revoked permission for ${scope} on ${resource}`);
  }

  revokeAll(): void {
    this.grants.clear();
    logger.info('permissions', 'All permissions revoked');
  }

  async check(request: PermissionRequest): Promise<boolean> {
    const key = this.key(request.scope, request.resource);
    const wildcardKey = this.key(request.scope, '*');

    let matchingKey: string | null = null;
    if (this.grants.has(key)) {
      matchingKey = key;
    } else if (this.grants.has(wildcardKey)) {
      matchingKey = wildcardKey;
    } else {
      for (const [k, g] of this.grants.entries()) {
        if (g.scope === request.scope && g.resource.endsWith('*')) {
          const prefix = g.resource.slice(0, -1);
          if (request.resource.startsWith(prefix)) {
            matchingKey = k;
            break;
          }
        }
      }
    }

    const grant = matchingKey ? this.grants.get(matchingKey) : undefined;

    if (grant && matchingKey) {
      if (grant.expiresAt && grant.expiresAt < new Date()) {
        this.grants.delete(matchingKey);
      } else {
        const allowed = grant.decision === PermissionDecision.ALWAYS_ALLOW
          || grant.decision === PermissionDecision.ALLOW_ONCE;

        if (grant.decision === PermissionDecision.ALLOW_ONCE) {
          this.grants.delete(matchingKey);
        }

        this.logAudit(request, allowed ? PermissionDecision.ALLOW_ONCE : PermissionDecision.DENY);
        return allowed;
      }
    }

    if (this.promptFn) {
      const decision = await this.promptFn(request);
      this.logAudit(request, decision);

      if (decision === PermissionDecision.ALWAYS_ALLOW) {
        this.grant(request.scope, request.resource, decision);
        return true;
      }

      return decision === PermissionDecision.ALLOW_ONCE;
    }

    this.logAudit(request, PermissionDecision.DENY);
    return false;
  }

  async require(request: PermissionRequest): Promise<void> {
    const allowed = await this.check(request);
    if (!allowed) {
      throw new PermissionDeniedError(request.scope, request.resource);
    }
  }

  getAuditLog(): ReadonlyArray<{
    timestamp: Date;
    request: PermissionRequest;
    decision: PermissionDecision;
  }> {
    return [...this.auditLog];
  }

  listGrants(): PermissionGrant[] {
    return [...this.grants.values()];
  }

  clearAuditLog(): void {
    this.auditLog = [];
  }

  setPredefinedPolicy(policy: 'permissive' | 'balanced' | 'strict'): void {
    if (policy === 'permissive') {
      this.grant(PermissionScope.FILE_READ, '*', PermissionDecision.ALWAYS_ALLOW);
      this.grant(PermissionScope.GIT_READ, '*', PermissionDecision.ALWAYS_ALLOW);
      this.grant(PermissionScope.TEST_RUN, '*', PermissionDecision.ALWAYS_ALLOW);
      this.grant(PermissionScope.FILE_WRITE, '*', PermissionDecision.ALWAYS_ALLOW);
      this.grant(PermissionScope.COMMAND_EXECUTE, '*', PermissionDecision.ALWAYS_ALLOW);
    } else if (policy === 'balanced') {
      this.grant(PermissionScope.FILE_READ, '*', PermissionDecision.ALWAYS_ALLOW);
      this.grant(PermissionScope.GIT_READ, '*', PermissionDecision.ALWAYS_ALLOW);
      this.grant(PermissionScope.TEST_RUN, '*', PermissionDecision.ALWAYS_ALLOW);
    }
  }

  private key(scope: PermissionScope, resource: string): string {
    return `${scope}::${resource}`;
  }

  private logAudit(request: PermissionRequest, decision: PermissionDecision): void {
    this.auditLog.push({ timestamp: new Date(), request, decision });
  }
}
