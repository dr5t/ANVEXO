import { describe, it, expect } from 'vitest';
import { EvidenceCollector } from '../../src/evidence/index.js';
import { EvidenceType, VerificationStatus } from '../../src/core/types.js';

describe('EvidenceCollector', () => {
  it('adds and retrieves evidence', () => {
    const collector = new EvidenceCollector();
    const record = collector.add({
      type: EvidenceType.FILE_CONTENT,
      source: 'test.ts',
      content: 'const x = 1;',
      toolName: 'file_read',
    });

    expect(record.id).toBeTruthy();
    expect(record.type).toBe(EvidenceType.FILE_CONTENT);
    expect(record.verificationStatus).toBe(VerificationStatus.OBSERVED);
    expect(collector.count()).toBe(1);
    expect(collector.get(record.id)).toBe(record);
  });

  it('filters by type', () => {
    const collector = new EvidenceCollector();
    collector.add({ type: EvidenceType.FILE_CONTENT, source: 'a', content: 'a', toolName: 'file_read' });
    collector.add({ type: EvidenceType.GIT_LOG, source: 'b', content: 'b', toolName: 'git_log' });
    collector.add({ type: EvidenceType.FILE_CONTENT, source: 'c', content: 'c', toolName: 'file_read' });

    expect(collector.getByType(EvidenceType.FILE_CONTENT)).toHaveLength(2);
    expect(collector.getByType(EvidenceType.GIT_LOG)).toHaveLength(1);
  });

  it('filters by tool', () => {
    const collector = new EvidenceCollector();
    collector.add({ type: EvidenceType.FILE_CONTENT, source: 'a', content: 'a', toolName: 'file_read' });
    collector.add({ type: EvidenceType.SEARCH_RESULT, source: 'b', content: 'b', toolName: 'file_search' });

    expect(collector.getByTool('file_read')).toHaveLength(1);
    expect(collector.getByTool('file_search')).toHaveLength(1);
  });

  it('links evidence to hypothesis', () => {
    const collector = new EvidenceCollector();
    const record = collector.add({ type: EvidenceType.FILE_CONTENT, source: 'a', content: 'a', toolName: 'file_read' });
    collector.linkToHypothesis(record.id, 'hyp-1');
    collector.linkToHypothesis(record.id, 'hyp-1');

    expect(record.linkedHypothesisIds).toEqual(['hyp-1']);
  });

  it('updates verification status', () => {
    const collector = new EvidenceCollector();
    const record = collector.add({ type: EvidenceType.FILE_CONTENT, source: 'a', content: 'a', toolName: 'file_read' });
    collector.updateVerification(record.id, VerificationStatus.VERIFIED);
    expect(record.verificationStatus).toBe(VerificationStatus.VERIFIED);
  });

  it('clears all evidence', () => {
    const collector = new EvidenceCollector();
    collector.add({ type: EvidenceType.FILE_CONTENT, source: 'a', content: 'a', toolName: 'file_read' });
    collector.add({ type: EvidenceType.FILE_CONTENT, source: 'b', content: 'b', toolName: 'file_read' });
    collector.clear();
    expect(collector.count()).toBe(0);
  });
});
