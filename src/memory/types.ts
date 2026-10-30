export type DecisionMemoryType =
  | 'architecture_decision'
  | 'implementation_choice'
  | 'confirmed_root_cause'
  | 'rejected_solution'
  | 'known_limitation'
  | 'test_failure'
  | 'remediation_step'
  | 'deprecated_pattern'
  | 'project_convention';

export type DecisionMemoryStatus =
  | 'active'
  | 'superseded'
  | 'deprecated'
  | 'archived';

export interface DecisionMemoryRecord {
  id: string;
  repoRoot: string;
  type: DecisionMemoryType;
  summary: string;
  explanation: string;
  sourceEvidence?: string[];
  relatedFiles: string[];
  relatedSymbols: string[];
  rejectedAlternatives?: string[];
  tradeOffs?: string[];
  createdAt: Date;
  lastVerifiedAt?: Date;
  status: DecisionMemoryStatus;
  confidence: number;
  tags: string[];
}

export interface MemoryConflictWarning {
  memoryId: string;
  memoryType: DecisionMemoryType;
  summary: string;
  conflictType: 'violates_decision' | 'repeats_rejected_solution' | 'deprecated_pattern_used' | 'contradicts_convention';
  conflictingStatement: string;
  explanation: string;
  severity: 'low' | 'medium' | 'high';
}

export interface MemoryQueryFilter {
  types?: DecisionMemoryType[];
  status?: DecisionMemoryStatus[];
  files?: string[];
  symbols?: string[];
  tags?: string[];
  search?: string;
}
