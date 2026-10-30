import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { redactSecrets, logger } from '../core/index.js';
import type {
  DecisionMemoryRecord,
  DecisionMemoryStatus,
  DecisionMemoryType,
  MemoryConflictWarning,
  MemoryQueryFilter,
} from './types.js';

export class DecisionMemoryManager {
  private repoRoot: string;
  private memoryFilePath: string;
  private records: Map<string, DecisionMemoryRecord> = new Map();

  constructor(repoRoot: string) {
    this.repoRoot = path.resolve(repoRoot);
    const anvexoDir = path.join(this.repoRoot, '.anvexo');
    this.memoryFilePath = path.join(anvexoDir, 'decision-memory.json');
    this.load();
  }

  getRepoRoot(): string {
    return this.repoRoot;
  }

  add(params: {
    type: DecisionMemoryType;
    summary: string;
    explanation: string;
    sourceEvidence?: string[];
    relatedFiles?: string[];
    relatedSymbols?: string[];
    rejectedAlternatives?: string[];
    tradeOffs?: string[];
    status?: DecisionMemoryStatus;
    confidence?: number;
    tags?: string[];
  }): DecisionMemoryRecord {
    const record: DecisionMemoryRecord = {
      id: randomUUID(),
      repoRoot: this.repoRoot,
      type: params.type,
      summary: redactSecrets(params.summary.trim()),
      explanation: redactSecrets(params.explanation.trim()),
      sourceEvidence: (params.sourceEvidence || []).map(e => redactSecrets(e)),
      relatedFiles: (params.relatedFiles || []).map(f => f.replace(/\\/g, '/')),
      relatedSymbols: params.relatedSymbols || [],
      rejectedAlternatives: (params.rejectedAlternatives || []).map(a => redactSecrets(a)),
      tradeOffs: (params.tradeOffs || []).map(t => redactSecrets(t)),
      createdAt: new Date(),
      lastVerifiedAt: new Date(),
      status: params.status || 'active',
      confidence: params.confidence !== undefined ? Math.min(1.0, Math.max(0.0, params.confidence)) : 0.9,
      tags: params.tags || [],
    };

    this.records.set(record.id, record);
    this.save();
    logger.info('memory', `Recorded project decision memory [${record.type}]: ${record.summary}`);
    return record;
  }

  get(id: string): DecisionMemoryRecord | undefined {
    return this.records.get(id);
  }

  list(filter?: MemoryQueryFilter): DecisionMemoryRecord[] {
    let result = [...this.records.values()];

    if (!filter) return result;

    if (filter.types && filter.types.length > 0) {
      result = result.filter(r => filter.types!.includes(r.type));
    }

    if (filter.status && filter.status.length > 0) {
      result = result.filter(r => filter.status!.includes(r.status));
    }

    if (filter.files && filter.files.length > 0) {
      const matchFiles = filter.files.map(f => f.replace(/\\/g, '/').toLowerCase());
      result = result.filter(r =>
        r.relatedFiles.some(rf => matchFiles.some(mf => rf.toLowerCase().includes(mf) || mf.includes(rf.toLowerCase()))),
      );
    }

    if (filter.symbols && filter.symbols.length > 0) {
      const matchSymbols = filter.symbols.map(s => s.toLowerCase());
      result = result.filter(r =>
        r.relatedSymbols.some(rs => matchSymbols.includes(rs.toLowerCase())),
      );
    }

    if (filter.tags && filter.tags.length > 0) {
      const matchTags = filter.tags.map(t => t.toLowerCase());
      result = result.filter(r =>
        r.tags.some(rt => matchTags.includes(rt.toLowerCase())),
      );
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      result = result.filter(r =>
        r.summary.toLowerCase().includes(searchLower) ||
        r.explanation.toLowerCase().includes(searchLower) ||
        r.tags.some(t => t.toLowerCase().includes(searchLower)),
      );
    }

    return result;
  }

  update(id: string, updates: Partial<Omit<DecisionMemoryRecord, 'id' | 'repoRoot' | 'createdAt'>>): DecisionMemoryRecord | undefined {
    const record = this.records.get(id);
    if (!record) return undefined;

    if (updates.summary) record.summary = redactSecrets(updates.summary);
    if (updates.explanation) record.explanation = redactSecrets(updates.explanation);
    if (updates.status) record.status = updates.status;
    if (updates.confidence !== undefined) record.confidence = updates.confidence;
    if (updates.relatedFiles) record.relatedFiles = updates.relatedFiles.map(f => f.replace(/\\/g, '/'));
    if (updates.relatedSymbols) record.relatedSymbols = updates.relatedSymbols;
    if (updates.sourceEvidence) record.sourceEvidence = updates.sourceEvidence;
    if (updates.tags) record.tags = updates.tags;
    if (updates.lastVerifiedAt) record.lastVerifiedAt = updates.lastVerifiedAt;

    this.save();
    return record;
  }

  archive(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.status = 'archived';
    this.save();
    return true;
  }

  delete(id: string): boolean {
    const deleted = this.records.delete(id);
    if (deleted) this.save();
    return deleted;
  }

  /**
   * Conflict Detection Engine:
   * Inspects proposed changes or user requests and flags conflicts against
   * active architectural decisions, rejected solutions, and deprecated patterns.
   */
  checkConflicts(proposalText: string, affectedFiles: string[] = []): MemoryConflictWarning[] {
    const warnings: MemoryConflictWarning[] = [];
    const textLower = proposalText.toLowerCase();
    const activeRecords = this.list({ status: ['active'] });

    for (const record of activeRecords) {
      const summaryLower = record.summary.toLowerCase();
      const explanationLower = record.explanation.toLowerCase();

      // Check if files overlap
      const hasFileOverlap = affectedFiles.some(af =>
        record.relatedFiles.some(rf => rf.toLowerCase().includes(af.toLowerCase()) || af.toLowerCase().includes(rf.toLowerCase())),
      );

      // 1. Rejected Solutions: warn if proposal attempts to do what was rejected
      if (record.type === 'rejected_solution') {
        const keywords = extractKeywords(record.summary);
        const matchCount = keywords.filter(kw => textLower.includes(kw)).length;

        if (matchCount >= 2 || (hasFileOverlap && matchCount >= 1)) {
          warnings.push({
            memoryId: record.id,
            memoryType: record.type,
            summary: record.summary,
            conflictType: 'repeats_rejected_solution',
            conflictingStatement: proposalText.slice(0, 150),
            explanation: `Proposed change appears to repeat a previously rejected approach: "${record.summary}". Reason for previous rejection: ${record.explanation}`,
            severity: 'high',
          });
        }
      }

      // 2. Deprecated Patterns: warn if using a deprecated pattern
      if (record.type === 'deprecated_pattern') {
        const keywords = extractKeywords(record.summary);
        const matchCount = keywords.filter(kw => textLower.includes(kw)).length;

        if (matchCount >= 1 && (textLower.includes(record.summary.toLowerCase()) || hasFileOverlap)) {
          warnings.push({
            memoryId: record.id,
            memoryType: record.type,
            summary: record.summary,
            conflictType: 'deprecated_pattern_used',
            conflictingStatement: proposalText.slice(0, 150),
            explanation: `Proposed change touches a documented deprecated pattern: "${record.summary}". Prescribed alternative: ${record.explanation}`,
            severity: 'medium',
          });
        }
      }

      // 3. Architecture Decisions: warn if proposal disputes or contradicts
      if (record.type === 'architecture_decision') {
        const keywords = extractKeywords(record.summary);
        const matchCount = keywords.filter(kw => textLower.includes(kw)).length;

        if (hasFileOverlap && matchCount >= 2) {
          warnings.push({
            memoryId: record.id,
            memoryType: record.type,
            summary: record.summary,
            conflictType: 'violates_decision',
            conflictingStatement: proposalText.slice(0, 150),
            explanation: `Proposed change modifies components governed by architectural decision: "${record.summary}". Documented rationale: ${record.explanation}`,
            severity: 'medium',
          });
        }
      }
    }

    return warnings;
  }

  buildAgentContextPrompt(affectedFiles: string[] = []): string {
    const activeMemories = this.list({ status: ['active'] });
    if (activeMemories.length === 0) return '';

    // Prioritize memories relevant to affected files
    const relevant = activeMemories.filter(m =>
      affectedFiles.length === 0 ||
      m.relatedFiles.length === 0 ||
      m.relatedFiles.some(rf => affectedFiles.some(af => af.includes(rf) || rf.includes(af))),
    );

    const targetList = relevant.length > 0 ? relevant : activeMemories.slice(0, 8);

    const lines: string[] = [
      '### Project Decision Memory (Historical Constraints & Architectural Decisions):',
      'The following engineering decisions and rejected solutions have been established for this repository. Respect these decisions and do not re-introduce rejected patterns:',
    ];

    for (const mem of targetList) {
      lines.push(`- [${mem.type.toUpperCase()}] ${mem.summary}`);
      lines.push(`  Details: ${mem.explanation}`);
      if (mem.relatedFiles.length > 0) {
        lines.push(`  Governed Files: ${mem.relatedFiles.join(', ')}`);
      }
    }

    return lines.join('\n');
  }

  private load(): void {
    if (!fs.existsSync(this.memoryFilePath)) {
      return;
    }

    try {
      const data = fs.readFileSync(this.memoryFilePath, 'utf-8');
      const parsed = JSON.parse(data) as DecisionMemoryRecord[];
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          this.records.set(item.id, {
            ...item,
            createdAt: new Date(item.createdAt),
            lastVerifiedAt: item.lastVerifiedAt ? new Date(item.lastVerifiedAt) : undefined,
          });
        }
      }
    } catch (err) {
      logger.warn('memory', `Could not read decision memory from ${this.memoryFilePath}: ${String(err)}`);
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.memoryFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = JSON.stringify([...this.records.values()], null, 2);
      fs.writeFileSync(this.memoryFilePath, data, 'utf-8');
    } catch (err) {
      logger.error('memory', `Could not save decision memory to ${this.memoryFilePath}: ${String(err)}`);
    }
  }

  // Aliases for interface consistency
  async recordMemory(params: Parameters<DecisionMemoryManager['add']>[0]): Promise<DecisionMemoryRecord> {
    return this.add(params);
  }

  async listMemories(filter?: MemoryQueryFilter): Promise<DecisionMemoryRecord[]> {
    return this.list(filter);
  }

  async deleteMemory(id: string): Promise<boolean> {
    return this.delete(id);
  }
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'use', 'using', 'into', 'not', 'can', 'are']);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
}
