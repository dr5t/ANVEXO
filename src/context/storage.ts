import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ProjectContext } from '../core/index.js';
import { logger } from '../core/index.js';

export interface StorageAdapter {
  load(repoRoot: string): Promise<ProjectContext | null>;
  save(context: ProjectContext): Promise<void>;
  delete(repoRoot: string): Promise<void>;
  exists(repoRoot: string): Promise<boolean>;
}

export class MemoryStorageAdapter implements StorageAdapter {
  private store: Map<string, ProjectContext> = new Map();

  async load(repoRoot: string): Promise<ProjectContext | null> {
    return this.store.get(repoRoot) || null;
  }

  async save(context: ProjectContext): Promise<void> {
    this.store.set(context.repoRoot, context);
  }

  async delete(repoRoot: string): Promise<void> {
    this.store.delete(repoRoot);
  }

  async exists(repoRoot: string): Promise<boolean> {
    return this.store.has(repoRoot);
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  private getStoragePath(repoRoot: string): string {
    return path.join(repoRoot, '.anvexo', 'context.json');
  }

  async load(repoRoot: string): Promise<ProjectContext | null> {
    const filePath = this.getStoragePath(repoRoot);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      parsed.lastAnalyzedAt = new Date(parsed.lastAnalyzedAt);
      for (const inv of parsed.historicalInvestigations) {
        inv.timestamp = new Date(inv.timestamp);
      }
      for (const bug of parsed.knownBugs) {
        bug.discoveredAt = new Date(bug.discoveredAt);
      }
      for (const c of parsed.contradictions) {
        c.detectedAt = new Date(c.detectedAt);
      }
      return parsed as ProjectContext;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('storage', `Failed to load context: ${msg}`);
      return null;
    }
  }

  async save(context: ProjectContext): Promise<void> {
    try {
      const filePath = this.getStoragePath(context.repoRoot);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const tempFile = `${filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(context, null, 2), 'utf-8');
      fs.renameSync(tempFile, filePath);
      logger.debug('storage', `Saved context to ${filePath}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('storage', `Failed to save context: ${msg}`);
    }
  }

  async delete(repoRoot: string): Promise<void> {
    const filePath = this.getStoragePath(repoRoot);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    const dir = path.dirname(filePath);
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  }

  async exists(repoRoot: string): Promise<boolean> {
    return fs.existsSync(this.getStoragePath(repoRoot));
  }
}

export class UserCloudStorageAdapter implements StorageAdapter {
  private endpoint: string;
  private apiKey?: string;
  private memoryFallback: MemoryStorageAdapter = new MemoryStorageAdapter();

  constructor(endpoint: string, apiKey?: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
  }

  getEndpoint(): string {
    return this.endpoint;
  }

  hasApiKey(): boolean {
    return Boolean(this.apiKey);
  }

  async load(repoRoot: string): Promise<ProjectContext | null> {
    return this.memoryFallback.load(repoRoot);
  }

  async save(context: ProjectContext): Promise<void> {
    await this.memoryFallback.save(context);
  }

  async delete(repoRoot: string): Promise<void> {
    await this.memoryFallback.delete(repoRoot);
  }

  async exists(repoRoot: string): Promise<boolean> {
    return this.memoryFallback.exists(repoRoot);
  }
}
