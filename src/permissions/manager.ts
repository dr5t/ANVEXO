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
    const grant = this.grants.get(key) || this.grants.get(wildcardKey);

    if (grant) {
      if (grant.expiresAt && grant.expiresAt < new Date()) {
        this.grants.delete(key);
      } else {
        const allowed = grant.decision === PermissionDecision.ALWAYS_ALLOW
          || grant.decision === PermissionDecision.ALLOW_ONCE;

        if (grant.decision === PermissionDecision.ALLOW_ONCE) {
          this.grants.delete(key);
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

  private key(scope: PermissionScope, resource: string): string {
    return `${scope}::${resource}`;
  }

  private logAudit(request: PermissionRequest, decision: PermissionDecision): void {
    this.auditLog.push({ timestamp: new Date(), request, decision });
  }
}
