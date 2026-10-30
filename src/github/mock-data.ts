import type {
  GitHubInvestigationReport,
  GitHubMetadata,
  CommitRecord,
  ContributorProfile,
  TimelineMilestone,
  SecurityFinding,
  DependencyManifest,
  TestExecutionSummary,
  FinalConclusion,
} from './types.js';

export function getMockRepositoriesList(): Array<{ id: string; owner: string; repo: string; title: string; description: string; scenario: string }> {
  return [
    {
      id: 'dr5t/ANVEXO-demo',
      owner: 'dr5t',
      repo: 'ANVEXO-demo',
      title: 'ANVEXO Engineering Workbench (Healthy Sample)',
      description: 'Autonomous Software Investigation & Persistent Codebase Intelligence Workbench with clean test suite and active commit history.',
      scenario: 'healthy',
    },
    {
      id: 'sample/payment-gateway',
      owner: 'sample',
      repo: 'payment-gateway',
      title: 'Global Payment Gateway API (Vulnerability & Test Failure Sample)',
      description: 'Microservices payment processor with leaked API tokens, path traversal vulnerability, and failing Stripe webhook tests.',
      scenario: 'failing_and_vulnerabilities',
    },
    {
      id: 'legacy/express-api',
      owner: 'legacy',
      repo: 'express-api',
      title: 'Legacy Monolith API (Needs Attention Sample)',
      description: 'High bus-factor single-maintainer API with unpinned dependencies, no lockfile, and missing automated CI.',
      scenario: 'needs_attention',
    },
    {
      id: 'timeout/incomplete-job',
      owner: 'timeout',
      repo: 'incomplete-job',
      title: 'Enterprise ERP Monorepo (Incomplete / Timeout Scenario)',
      description: 'Massive enterprise monorepo that exceeded execution limits, disclosing exact partial execution boundaries.',
      scenario: 'incomplete',
    },
  ];
}

export function generateMockReport(owner: string, repo: string, scenarioOverride?: string): GitHubInvestigationReport {
  const normalizedKey = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
  const now = new Date();
  const startedAt = new Date(now.getTime() - 42_000).toISOString();
  const completedAt = now.toISOString();

  if (normalizedKey.includes('payment-gateway') || scenarioOverride === 'failing_and_vulnerabilities') {
    return createPaymentGatewayMockReport(owner, repo, startedAt, completedAt);
  } else if (normalizedKey.includes('express-api') || scenarioOverride === 'needs_attention') {
    return createLegacyExpressMockReport(owner, repo, startedAt, completedAt);
  } else if (normalizedKey.includes('incomplete') || scenarioOverride === 'incomplete') {
    return createIncompleteMockReport(owner, repo, startedAt, completedAt);
  }

  // Default: ANVEXO-demo / Healthy
  return createHealthyMockReport(owner, repo, startedAt, completedAt);
}

function createHealthyMockReport(owner: string, repo: string, startedAt: string, completedAt: string): GitHubInvestigationReport {
  const metadata: GitHubMetadata = {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
    description: 'Autonomous Software Investigation & Persistent Codebase Intelligence Workbench',
    homepage: 'https://anvexo.onrender.com/',
    htmlUrl: `https://github.com/${owner}/${repo}`,
    createdAt: '2026-03-15T09:30:00Z',
    updatedAt: new Date().toISOString(),
    pushedAt: new Date().toISOString(),
    firstCommitDate: '2026-03-15T10:14:22Z',
    defaultBranch: 'main',
    starsCount: 342,
    forksCount: 48,
    openIssuesCount: 4,
    watchersCount: 342,
    primaryLanguage: 'TypeScript',
    languageDistribution: {
      TypeScript: 84.5,
      JavaScript: 11.2,
      CSS: 3.1,
      HTML: 1.2,
    },
    license: {
      key: 'mit',
      name: 'MIT License',
      spdxId: 'MIT',
      url: 'https://api.github.com/licenses/mit',
    },
    isPrivate: false,
    isFork: false,
    isArchived: false,
    sizeKb: 14200,
    branches: [
      { name: 'main', protected: true, latestCommitSha: '4b690a2d' },
      { name: 'feat/github-intelligence', protected: false, latestCommitSha: '78c7719f' },
      { name: 'docs/render-deployment', protected: false, latestCommitSha: 'fa7cbb7e' },
    ],
    tags: ['v0.1.0', 'v0.0.9', 'v0.0.5'],
    releases: [
      {
        id: 'rel_1',
        tagName: 'v0.1.0',
        name: 'ANVEXO 0.1.0 Public Release',
        publishedAt: '2026-10-30T10:00:00Z',
        htmlUrl: `https://github.com/${owner}/${repo}/releases/tag/v0.1.0`,
        isPrerelease: false,
        body: 'Initial production-ready release of ANVEXO Autonomous Investigation Workbench.',
      },
    ],
    readmePreview: '# ANVEXO: Autonomous Codebase Intelligence Platform\n\nEmpirical root-cause debugging and deterministic repository topology analysis.',
    hasIssues: true,
    hasWiki: false,
    hasPages: false,
  };

  const commitsSample: CommitRecord[] = [
    {
      sha: '4b690a2df39c1410294819203912839182390123',
      shortSha: '4b690a2',
      message: 'docs: update README with live Render deployment URL and cloud documentation links',
      firstLine: 'docs: update README with live Render deployment URL and cloud documentation links',
      author: { name: 'Shaurya Tiwari', email: 'shaurya@example.com', date: '2026-10-30T11:02:00Z', githubUsername: 'dr5t' },
      committer: { name: 'GitHub', email: 'noreply@github.com', date: '2026-10-30T11:02:00Z' },
      parentShas: ['78c7719f'],
      isMerge: false,
      stats: { additions: 34, deletions: 12, total: 46 },
      changedFiles: ['README.md', 'render.yaml'],
    },
    {
      sha: '78c7719fa9238491820391829031829301823901',
      shortSha: '78c7719',
      message: 'fix: harden subprocess execution with shell:false and canonical path validation',
      firstLine: 'fix: harden subprocess execution with shell:false and canonical path validation',
      author: { name: 'Devin Lead', email: 'devin@example.com', date: '2026-10-29T16:40:00Z', githubUsername: 'devin-ai' },
      committer: { name: 'Devin Lead', email: 'devin@example.com', date: '2026-10-29T16:40:00Z', githubUsername: 'devin-ai' },
      parentShas: ['fa7cbb7e'],
      isMerge: false,
      stats: { additions: 180, deletions: 45, total: 225 },
      changedFiles: ['src/terminal/command.ts', 'src/reproduction/lab.ts', 'tests/unit/reproduction.test.ts'],
    },
    {
      sha: 'fa7cbb7e01928301928301928301928301928301',
      shortSha: 'fa7cbb7',
      message: 'feat: add ECHO context engine with 4 memory modes and contradiction detector',
      firstLine: 'feat: add ECHO context engine with 4 memory modes and contradiction detector',
      author: { name: 'Shaurya Tiwari', email: 'shaurya@example.com', date: '2026-10-28T09:15:00Z', githubUsername: 'dr5t' },
      committer: { name: 'Shaurya Tiwari', email: 'shaurya@example.com', date: '2026-10-28T09:15:00Z', githubUsername: 'dr5t' },
      parentShas: ['2f83a120'],
      isMerge: false,
      stats: { additions: 512, deletions: 80, total: 592 },
      changedFiles: ['src/context/manager.ts', 'src/context/storage.ts', 'tests/unit/context.test.ts'],
    },
    {
      sha: '2f83a12039482938491029384910293849102938',
      shortSha: '2f83a12',
      message: 'Merge branch main into feat/github-intelligence',
      firstLine: 'Merge branch main into feat/github-intelligence',
      author: { name: 'Shaurya Tiwari', email: 'shaurya@example.com', date: '2026-10-27T18:22:00Z', githubUsername: 'dr5t' },
      committer: { name: 'Shaurya Tiwari', email: 'shaurya@example.com', date: '2026-10-27T18:22:00Z', githubUsername: 'dr5t' },
      parentShas: ['a123bc45', 'e678fd90'],
      isMerge: true,
      stats: { additions: 25, deletions: 10, total: 35 },
      changedFiles: ['package.json'],
    },
  ];

  const developmentTimeline: TimelineMilestone[] = [
    {
      date: '2026-03-15T10:14:22Z',
      title: 'Repository Inception & Core Scaffold',
      description: 'Initial architectural commit establishing modular TypeScript build, Vitest config, and permission engine.',
      type: 'initial_commit',
      commitSha: 'a123bc45',
    },
    {
      date: '2026-06-10T14:30:00Z',
      title: 'ANVESHAN Diagnostic Engine Released',
      description: 'Implemented heuristic DAG planner, evidence collection ledger, and sandboxed subprocess runner.',
      type: 'architecture_shift',
      commitSha: 'b456cd78',
    },
    {
      date: '2026-08-20T11:00:00Z',
      title: 'ECHO Context Engine Integration',
      description: 'Added persistent dependency graph modeling, commit drift analysis, and contradiction detection.',
      type: 'architecture_shift',
      commitSha: 'fa7cbb7e',
    },
    {
      date: '2026-10-30T10:00:00Z',
      title: 'v0.1.0 General Availability & Cloud Deployment',
      description: 'Published initial stable release with interactive split IDE canvas and Render cloud service.',
      type: 'release',
      commitSha: '4b690a2d',
      referenceUrl: `https://github.com/${owner}/${repo}/releases/tag/v0.1.0`,
    },
  ];

  const contributors: ContributorProfile[] = [
    {
      id: 'dr5t',
      displayName: 'Shaurya Tiwari',
      email: 'shaurya@example.com',
      githubUsername: 'dr5t',
      avatarUrl: 'https://avatars.githubusercontent.com/u/10293847?v=4',
      profileUrl: 'https://github.com/dr5t',
      commitCount: 142,
      firstCommitDate: '2026-03-15T10:14:22Z',
      lastCommitDate: '2026-10-30T11:02:00Z',
      additionsCount: 18450,
      deletionsCount: 3200,
      filesModifiedCount: 88,
      topFiles: ['src/server/server.ts', 'src/core/index.ts', 'src/engine/index.ts'],
      technicalAreas: ['Server Runtime', 'Core Types', 'Investigation Engine', 'Reporting'],
      collaborationRoles: ['author', 'committer', 'merger'],
      significantCommits: [
        { sha: '4b690a2', message: 'docs: update README with live Render deployment URL', date: '2026-10-30' },
        { sha: 'fa7cbb7', message: 'feat: add ECHO context engine', date: '2026-10-28' },
      ],
      attributionNote: 'Primary author of core server architecture, diagnostic planner, and investigation reports based on commit authorship and diff analysis.',
    },
    {
      id: 'devin-ai',
      displayName: 'Devin Lead',
      email: 'devin@example.com',
      githubUsername: 'devin-ai',
      avatarUrl: 'https://avatars.githubusercontent.com/u/5551234?v=4',
      profileUrl: 'https://github.com/devin-ai',
      commitCount: 56,
      firstCommitDate: '2026-05-01T12:00:00Z',
      lastCommitDate: '2026-10-29T16:40:00Z',
      additionsCount: 8200,
      deletionsCount: 1450,
      filesModifiedCount: 42,
      topFiles: ['src/terminal/command.ts', 'src/reproduction/lab.ts', 'src/autonomy/engine.ts'],
      technicalAreas: ['Process Isolation', 'Bug Reproduction Lab', 'Safe Autonomy'],
      collaborationRoles: ['author', 'committer'],
      significantCommits: [
        { sha: '78c7719', message: 'fix: harden subprocess execution with shell:false', date: '2026-10-29' },
      ],
      attributionNote: 'Core contributor for security hardening, process sandboxing, and safe autonomy rules based on commit diffs.',
    },
  ];

  const securityFindings: SecurityFinding[] = [
    {
      id: 'sec-safe-exec',
      title: 'Subprocess Invocation Enforces Shell Isolation',
      severity: 'info',
      category: 'command_injection',
      file: 'src/terminal/command.ts',
      line: 65,
      description: 'Diagnostic commands execute with spawnSync and shell: false, converting arguments into sanitized vectors.',
      recommendation: 'Maintain direct argument vectors without shell evaluation wrappers.',
      confidence: 1.0,
      status: 'confirmed',
    },
    {
      id: 'sec-path-containment',
      title: 'Canonical Path Traversal Boundary Verified',
      severity: 'info',
      category: 'path_traversal',
      file: 'src/server/security.ts',
      line: 82,
      description: 'Filesystem operations resolve canonical paths via fs.realpathSync to block symlink escapes.',
      recommendation: 'Continue validating all file reads against the repository root.',
      confidence: 1.0,
      status: 'confirmed',
    },
  ];

  const dependencyManifests: DependencyManifest[] = [
    {
      type: 'npm',
      file: 'package.json',
      directDependenciesCount: 2,
      devDependenciesCount: 4,
      hasLockfile: true,
      lockfile: 'package-lock.json',
      packages: [
        { name: 'commander', version: '^14.0.3', isDev: false },
        { name: 'simple-git', version: '^4.0.2', isDev: false },
        { name: 'typescript', version: '^7.0.2', isDev: true },
        { name: 'vitest', version: '^4.1.12', isDev: true },
      ],
    },
  ];

  const testExecution: TestExecutionSummary = {
    attempted: true,
    executed: true,
    runner: 'vitest v4.1.12',
    command: 'npm test',
    exitCode: 0,
    passedCount: 304,
    failedCount: 0,
    skippedCount: 0,
    totalCount: 304,
    failedTestDetails: [],
    durationMs: 3600,
    timedOut: false,
    interrupted: false,
    status: 'all_passed',
    notes: 'All 304 automated unit and integration tests completed successfully with zero failures.',
  };

  const finalConclusion: FinalConclusion = {
    overallStatus: 'Healthy within the scope checked',
    readinessVerdict: 'Ready for intended software investigation and engineering analysis workloads.',
    summaryAnswer: 'The repository exhibits high engineering discipline with 100% test pass rate, hardened subprocess sandbox, and clean modular structure.',
    answers: {
      whatProjectDoes: 'ANVEXO is an autonomous software investigation and codebase intelligence platform that diagnoses issues and analyzes repository topology.',
      howStructured: 'Layered architecture: CLI & Server Entry points -> ANVESHAN Investigation Engine & ECHO Context -> Hardened Terminal & Permission Manager.',
      developmentHistoryVisible: 'Consistent commit history since March 2026 across 200+ commits with clear semantic messages and tags.',
      contributorsAndComponents: 'Shaurya Tiwari (Core & Server), Devin Lead (Sandboxing & Autonomy). Ownership distributed cleanly by subsystem.',
      whatIsWorking: 'All 304 test cases pass, build runs cleanly, live cloud deployment responsive, permission boundaries intact.',
      whatIsFailing: 'Zero failing tests or critical CVEs detected in the verified code paths.',
      verifiedIssues: [],
      needsFurtherInvestigation: ['Monitor hosted model token consumption under heavy multi-tenant load'],
      isReadyForIntendedUse: 'Yes. Verified safe for production developer usage within local or cloud environments.',
      whatToFixFirst: ['Optional: Add automated Docker container packaging for one-click self-hosting.'],
    },
    prioritizedRemediationPlan: [
      {
        priority: 'P2',
        action: 'Add GitHub Actions matrix build for Node 24 experimental',
        targetComponent: '.github/workflows/ci.yml',
        rationale: 'Preemptively verify upcoming Node runtime updates.',
      },
      {
        priority: 'P3',
        action: 'Add automated container health-check endpoint monitor',
        targetComponent: 'render.yaml',
        rationale: 'Enhance cloud observability during cold starts.',
      },
    ],
  };

  return {
    id: `investigation_${Date.now()}`,
    repository: {
      owner,
      repo,
      host: 'github.com',
      originalUrl: `mock://${owner}/${repo}`,
      isMock: true,
    },
    metadata,
    startedAt,
    completedAt,
    durationMs: 42000,
    isMock: true,
    stagesCompleted: [
      'validate_url',
      'fetch_metadata',
      'inspect_structure',
      'fetch_commit_history',
      'analyze_contributors',
      'inspect_milestones_and_diffs',
      'inspect_dependencies',
      'run_security_scan',
      'evaluate_tests',
      'collect_evidence',
      'deduplicate_findings',
      'synthesize_architecture',
      'generate_conclusion',
      'finalize_report',
    ],
    stagesFailed: [],
    stagesSkipped: [],
    executiveSummary: 'ANVEXO repository analysis demonstrates an enterprise-grade autonomous software intelligence workbench. The code possesses strong architectural boundaries, default-deny security controls, 304 passing automated tests, and consistent release governance.',
    developmentTimeline,
    commitsAnalyzedCount: 198,
    commitsSample,
    contributors,
    architectureOverview: {
      summary: 'TypeScript Node.js application uniting a local HTTP API server, split IDE canvas frontend, CLI dispatcher, and empirical investigation engine.',
      primaryStack: 'Node.js 20+, TypeScript 5.4+, Commander, Simple-Git, Vitest',
      entryPoints: ['src/index.ts', 'src/cli/index.ts', 'src/server/server.ts'],
      directories: [
        { path: 'src/engine', purpose: 'ANVESHAN autonomous investigation DAG orchestrator' },
        { path: 'src/context', purpose: 'ECHO persistent repository memory and dependency graph' },
        { path: 'src/server', purpose: 'HTTP API and Split IDE Canvas browser workbench' },
        { path: 'src/terminal', purpose: 'Shell-free sandboxed subprocess execution' },
      ],
      externalIntegrations: ['Google Gemini API', 'Google Gemma 4', 'GitHub REST API'],
      configurationFiles: ['package.json', 'tsconfig.json', 'vitest.config.ts', 'render.yaml'],
    },
    majorFeatures: [
      'Heuristic Diagnostic DAG Planning',
      'Subprocess Process Isolation (shell: false)',
      'ECHO Context & Contradiction Detection Engine',
      'Split IDE Canvas Interactive Workbench',
      'Proof Mode Ground-Truth Hypothesis Verification',
    ],
    codeQualityFindings: [
      {
        claim: 'Strict TypeScript compilation enforced across all source modules',
        evidenceIds: ['ev_tsconfig'],
        verificationStatus: 'observed' as any,
        confidence: 1.0,
        details: 'tsconfig.json specifies strict: true, noImplicitAny, isolatedModules, and skipLibCheck: true.',
      },
    ],
    securityFindings,
    dependencyManifests,
    testExecution,
    maintenanceIndicators: {
      commitFrequency: 'high',
      openIssueRatio: '4 open / 42 closed',
      hasContinuousIntegration: true,
      hasDocumentation: true,
      hasLicense: true,
      busFactorRisk: 'low',
    },
    missingDocumentationOrConfig: [],
    limitations: [
      'Investigation ran in Mock Mode simulation using deterministic repository data.',
      'Analysis evaluated code committed to default branch main.',
    ],
    finalConclusion,
    evidence: [],
  };
}

function createPaymentGatewayMockReport(owner: string, repo: string, startedAt: string, completedAt: string): GitHubInvestigationReport {
  const base = createHealthyMockReport(owner, repo, startedAt, completedAt);
  base.metadata.fullName = `${owner}/${repo}`;
  base.metadata.description = 'Global Multi-Currency Payment Gateway Microservice API';
  base.metadata.primaryLanguage = 'TypeScript';

  base.securityFindings = [
    {
      id: 'sec_hardcoded_stripe_key',
      title: 'Potential Hardcoded Secret in Webhook Controller',
      severity: 'critical',
      category: 'secret_leak',
      file: 'src/controllers/webhook.ts',
      line: 42,
      description: 'Pattern matching live API credentials detected: sk_live_51... embedded in source code.',
      recommendation: 'Immediately rotate credentials in payment provider dashboard and migrate to environment secrets manager.',
      confidence: 0.98,
      status: 'confirmed',
      redactedEvidence: 'const apiKey = "sk_live_51***REDACTED***";',
    },
    {
      id: 'sec_path_traversal_receipts',
      title: 'Path Traversal Risk in PDF Receipt Download Endpoint',
      severity: 'high',
      category: 'path_traversal',
      file: 'src/routes/receipts.ts',
      line: 88,
      description: 'Unsanitized user-supplied invoice parameter passed directly into path.join() allowing ../ directory traversal.',
      recommendation: 'Use canonical path resolution with boundary check (e.g. validatePathWithinRoot).',
      confidence: 0.92,
      status: 'confirmed',
    },
  ];

  base.dependencyManifests = [
    {
      type: 'npm',
      file: 'package.json',
      directDependenciesCount: 8,
      devDependenciesCount: 5,
      hasLockfile: false,
      packages: [
        { name: 'express', version: '4.17.1', outdated: true, vulnerabilityWarning: 'Prototype pollution vulnerability in query parsing' },
        { name: 'stripe', version: '^8.2.0', outdated: true },
        { name: 'axios', version: '0.21.1', outdated: true, vulnerabilityWarning: 'SSRF vulnerability in followed redirects' },
      ],
    },
  ];

  base.testExecution = {
    attempted: true,
    executed: true,
    runner: 'vitest v4.1.12',
    command: 'npm test',
    exitCode: 1,
    passedCount: 88,
    failedCount: 4,
    skippedCount: 1,
    totalCount: 93,
    failedTestDetails: [
      {
        name: 'Webhook signature verification > rejects tampered event payload',
        file: 'tests/unit/webhook.test.ts',
        error: 'AssertionError: expected 200 to equal 400',
      },
      {
        name: 'Receipt service > validates invoice path confinement',
        file: 'tests/unit/receipt.test.ts',
        error: 'SecurityError: Path escaped expected directory boundary',
      },
      {
        name: 'Currency conversion > handles zero decimal currencies properly',
        file: 'tests/unit/fx.test.ts',
        error: 'RangeError: Invalid fractional amount for JPY transaction',
      },
      {
        name: 'Idempotency ledger > rejects duplicate transaction ID within window',
        file: 'tests/unit/idempotency.test.ts',
        error: 'AssertionError: expected false to be true',
      },
    ],
    durationMs: 4800,
    timedOut: false,
    interrupted: false,
    status: 'has_failures',
    notes: '4 test cases failed out of 93. Webhook signature and path traversal assertions failed.',
  };

  base.finalConclusion = {
    overallStatus: 'Significant issues detected',
    readinessVerdict: 'NOT ready for production. Critical security leaks and failed test cases must be resolved first.',
    summaryAnswer: 'Severe security findings including live API keys and path traversal vulnerabilities alongside 4 failing test cases.',
    answers: {
      whatProjectDoes: 'Payment gateway API handling credit card charges, currency conversion, and receipt generation.',
      howStructured: 'Express router -> Webhook Controller -> Third-party payment provider SDKs.',
      developmentHistoryVisible: 'Recent rapid commits with insufficient test verification prior to merge.',
      contributorsAndComponents: '2 primary contributors touching billing controllers and routes.',
      whatIsWorking: 'Basic charge request parsing and logging framework operational.',
      whatIsFailing: '4 unit tests failing in webhook and receipt modules.',
      verifiedIssues: [
        'Hardcoded API secret in src/controllers/webhook.ts:42',
        'Path traversal vulnerability in src/routes/receipts.ts:88',
        'Missing package-lock.json allowing non-deterministic dependency installations',
      ],
      needsFurtherInvestigation: ['Audit git history to ensure leaked secret was not pushed to public commits'],
      isReadyForIntendedUse: 'No. The platform must not handle real transactions until critical remediation is complete.',
      whatToFixFirst: [
        'Rotate exposed live credentials immediately.',
        'Sanitize file path parameters in receipt route.',
        'Fix 4 failing tests in webhook.test.ts and receipt.test.ts.',
      ],
    },
    prioritizedRemediationPlan: [
      {
        priority: 'P0',
        action: 'Revoke and rotate leaked payment gateway credential',
        targetComponent: 'src/controllers/webhook.ts',
        rationale: 'Active credential exposure presents immediate financial and compliance risk.',
      },
      {
        priority: 'P0',
        action: 'Enforce canonical path validation on receipt download endpoint',
        targetComponent: 'src/routes/receipts.ts',
        rationale: 'Prevents arbitrary filesystem read escapes.',
      },
      {
        priority: 'P1',
        action: 'Fix 4 failing unit tests and re-run suite',
        targetComponent: 'tests/unit/webhook.test.ts',
        rationale: 'Restores core test suite integrity.',
      },
      {
        priority: 'P2',
        action: 'Generate package-lock.json and upgrade outdated dependencies',
        targetComponent: 'package.json',
        rationale: 'Resolves known prototype pollution in express 4.17.1.',
      },
    ],
  };

  return base;
}

function createLegacyExpressMockReport(owner: string, repo: string, startedAt: string, completedAt: string): GitHubInvestigationReport {
  const base = createHealthyMockReport(owner, repo, startedAt, completedAt);
  base.metadata.fullName = `${owner}/${repo}`;
  base.metadata.description = 'Legacy Monolithic Express REST API Service';
  base.maintenanceIndicators.busFactorRisk = 'high';
  base.maintenanceIndicators.commitFrequency = 'low';
  base.maintenanceIndicators.hasContinuousIntegration = false;

  base.finalConclusion = {
    overallStatus: 'Needs attention',
    readinessVerdict: 'Technical debt and single maintainer risk require attention prior to scaling.',
    summaryAnswer: 'The repository functions but suffers from high bus-factor (single committer), no automated CI workflow, and unpinned dependencies.',
    answers: {
      whatProjectDoes: 'Backend API providing user profiles and inventory management.',
      howStructured: 'Single monolith server.js with embedded routing.',
      developmentHistoryVisible: 'Sporadic commits from single author over 2 years.',
      contributorsAndComponents: '1 author accounts for 98% of total commits.',
      whatIsWorking: 'Basic endpoints respond correctly.',
      whatIsFailing: 'No automated CI tests executed on PRs.',
      verifiedIssues: ['Missing CI pipeline', 'No package-lock.json', 'Bus factor = 1'],
      needsFurtherInvestigation: ['Test coverage of core authentication logic'],
      isReadyForIntendedUse: 'Usable with caution in staging environments.',
      whatToFixFirst: ['Add GitHub Actions CI workflow', 'Pin package versions with lockfile'],
    },
    prioritizedRemediationPlan: [
      {
        priority: 'P1',
        action: 'Configure GitHub Actions CI workflow',
        targetComponent: '.github/workflows',
        rationale: 'Automates testing on all incoming contributions.',
      },
      {
        priority: 'P2',
        action: 'Generate package-lock.json',
        targetComponent: 'package.json',
        rationale: 'Ensures deterministic builds.',
      },
    ],
  };

  return base;
}

function createIncompleteMockReport(owner: string, repo: string, startedAt: string, completedAt: string): GitHubInvestigationReport {
  const base = createHealthyMockReport(owner, repo, startedAt, completedAt);
  base.stagesCompleted = ['validate_url', 'fetch_metadata', 'inspect_structure'];
  base.stagesFailed = ['fetch_commit_history'];
  base.stagesSkipped = ['analyze_contributors', 'inspect_milestones_and_diffs', 'run_security_scan', 'evaluate_tests', 'generate_conclusion'];
  base.limitations = [
    'Investigation was interrupted due to API rate limit exhaustion and network timeout.',
    'Commit history and contributor profiling could not complete.',
    'Report contains partial metadata only.',
  ];

  base.finalConclusion = {
    overallStatus: 'Incomplete investigation',
    readinessVerdict: 'Investigation aborted before conclusion could be verified.',
    summaryAnswer: 'Investigation could not finish within allocated limits. Re-run with valid GitHub authentication or smaller sample depth.',
    answers: {
      whatProjectDoes: 'Large enterprise monorepo.',
      howStructured: 'Multi-package lerna/pnpm monorepo.',
      developmentHistoryVisible: 'Incomplete - commit history retrieval timed out.',
      contributorsAndComponents: 'Not determined due to incomplete run.',
      whatIsWorking: 'Repository structure scan succeeded.',
      whatIsFailing: 'Commit history ingestion timed out.',
      verifiedIssues: [],
      needsFurtherInvestigation: ['Complete analysis requires authenticated GITHUB_TOKEN'],
      isReadyForIntendedUse: 'Cannot determine readiness from incomplete data.',
      whatToFixFirst: ['Retry investigation with authorized credentials.'],
    },
    prioritizedRemediationPlan: [
      {
        priority: 'P1',
        action: 'Retry investigation with GITHUB_TOKEN environment secret',
        rationale: 'Provides 5,000 requests/hr rate limit compared to 60 for unauthenticated requests.',
      },
    ],
  };

  return base;
}
