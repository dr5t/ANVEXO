import { randomUUID } from 'node:crypto';
import type { EvidenceRecord } from '../core/index.js';
import { EvidenceType, VerificationStatus } from '../core/index.js';

export class EvidenceCollector {
  private records: Map<string, EvidenceRecord> = new Map();

  add(params: {
    type: EvidenceType;
    source: string;
    content: string;
    toolName: string;
    metadata?: Record<string, unknown>;
    verificationStatus?: VerificationStatus;
  }): EvidenceRecord {
    const record: EvidenceRecord = {
      id: randomUUID(),
      type: params.type,
      source: params.source,
      content: params.content,
      timestamp: new Date(),
      toolName: params.toolName,
      verificationStatus: params.verificationStatus || VerificationStatus.OBSERVED,
      linkedHypothesisIds: [],
      metadata: params.metadata || {},
    };
    this.records.set(record.id, record);
    return record;
  }

  get(id: string): EvidenceRecord | undefined {
    return this.records.get(id);
  }

  getAll(): EvidenceRecord[] {
    return [...this.records.values()];
  }

  getByType(type: EvidenceType): EvidenceRecord[] {
    return this.getAll().filter(r => r.type === type);
  }

  getByTool(toolName: string): EvidenceRecord[] {
    return this.getAll().filter(r => r.toolName === toolName);
  }

  linkToHypothesis(evidenceId: string, hypothesisId: string): void {
    const record = this.records.get(evidenceId);
    if (record && !record.linkedHypothesisIds.includes(hypothesisId)) {
      record.linkedHypothesisIds.push(hypothesisId);
    }
  }

  updateVerification(id: string, status: VerificationStatus): void {
    const record = this.records.get(id);
    if (record) {
      record.verificationStatus = status;
    }
  }

  count(): number {
    return this.records.size;
  }

  clear(): void {
    this.records.clear();
  }
}
