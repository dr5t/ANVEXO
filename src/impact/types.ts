export type ImpactRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface SymbolReference {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'variable' | 'type' | 'export';
  definedIn: string;
  referencedIn: string[];
}

export interface AffectedApiEndpoint {
  method: string;
  path: string;
  handlerFile: string;
  line?: number;
}

export interface AffectedDatabaseSchema {
  modelName: string;
  schemaFile: string;
  operation?: string;
}

export interface AffectedSecurityFlow {
  type: 'auth_middleware' | 'permission_scope' | 'token_validation' | 'secret_handling' | 'data_sanitization';
  description: string;
  file: string;
}

export interface ChangeImpactReport {
  id: string;
  target: string;
  repositoryPath: string;
  timestamp: Date;
  directDependencies: string[];
  reverseDependencies: string[];
  exports: string[];
  imports: string[];
  symbolReferences: SymbolReference[];
  affectedEndpoints: AffectedApiEndpoint[];
  relatedTests: string[];
  affectedModules: string[];
  configDependencies: string[];
  databaseSchemas: AffectedDatabaseSchema[];
  securityFlows: AffectedSecurityFlow[];
  riskLevel: ImpactRiskLevel;
  riskScore: number;
  riskFactors: string[];
  confidence: number;
  limitations: string[];
  recommendedValidationSteps: string[];
  summary: string;
}

export interface ImpactSimulatorOptions {
  repoRoot?: string;
  target: string;
  symbol?: string;
  proposedDiff?: string;
  shallow?: boolean;
}
