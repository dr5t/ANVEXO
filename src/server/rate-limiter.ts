export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

interface ClientRecord {
  timestamps: number[];
}

export class RateLimiter {
  private clients: Map<string, ClientRecord> = new Map();
  private windowMs: number;
  private maxRequests: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimitConfig = { windowMs: 60000, maxRequests: 120 }) {
    this.windowMs = config.windowMs;
    this.maxRequests = config.maxRequests;
    this.startCleanup();
  }

  check(clientId: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let record = this.clients.get(clientId);
    if (!record) {
      record = { timestamps: [] };
      this.clients.set(clientId, record);
    }

    record.timestamps = record.timestamps.filter(t => t > windowStart);

    if (record.timestamps.length >= this.maxRequests) {
      const oldest = record.timestamps[0] || now;
      const resetMs = Math.max(0, oldest + this.windowMs - now);
      return {
        allowed: false,
        remaining: 0,
        resetMs,
      };
    }

    record.timestamps.push(now);
    const remaining = this.maxRequests - record.timestamps.length;
    const resetMs = this.windowMs;

    return {
      allowed: true,
      remaining,
      resetMs,
    };
  }

  reset(clientId?: string): void {
    if (clientId) {
      this.clients.delete(clientId);
    } else {
      this.clients.clear();
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clients.clear();
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const windowStart = Date.now() - this.windowMs;
      for (const [id, record] of this.clients.entries()) {
        record.timestamps = record.timestamps.filter(t => t > windowStart);
        if (record.timestamps.length === 0) {
          this.clients.delete(id);
        }
      }
    }, this.windowMs);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }
}
