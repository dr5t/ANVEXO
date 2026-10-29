# ANVEXO Web Application and Public Site Architecture Specification

## 1. Architectural Distinction

ANVEXO separates the public documentation and marketing web presence from the technical investigation application workbench:

1. Public Web Presence: A high-performance, content-driven editorial site communicating architecture, technical documentation, security disclosures, and commercial licensing. Contains zero unverified marketing claims or fabricated testimonials.
2. Workbench Application: The Split IDE Canvas console (Obsidian Slate design system) running locally on `localhost:3110` or an authorized private network endpoint.

Both surfaces share the same typography (Inter and JetBrains Mono), hairline border geometry, and restrained technical aesthetic.

## 2. Public Website Information Architecture

### Page 1: Home (`/`)
- Purpose: Primary introduction to ANVEXO as an autonomous software investigation and codebase intelligence platform.
- Hero Section: Technical platform overview emphasizing deterministic verification, git evidence linkage, and zero covert telemetry.
- Architectural Pillars: Anveshan (autonomous root-cause investigation) and Echo (deep codebase intelligence).
- Quick Start: Single-command installation (`npm install -g anvexo` or local runner execution).

### Page 2: Product Overview (`/overview`)
- Capabilities: Automated topography discovery across 40+ languages and frameworks.
- Deterministic Planning: Directed Acyclic Graph (DAG) generation of investigation steps.
- Evidence-Backed Verification: Claim verification status (`VERIFIED`, `CONTRADICTED`, `PENDING`) with direct file line and git commit citations.

### Page 3: Features (`/features`)
- Topography Engine: Identification of package managers, test runners, entry points, and build manifests.
- Multi-Source Evidence Collection: Unstaged diffs, git commit history, file searches, and isolated test runs.
- Contradiction Detection: Cross-referencing current hypotheses against past investigations to prevent recurring regressions.
- Permission Management: Granular operator authorization (`file:read`, `file:write`, `command:execute`, `git:read`, `test:run`).

### Page 4: How ANVEXO Works (`/how-it-works`)
- Step 1 Discovery: Topography scanner catalogs source files, build systems, and runtime configs.
- Step 2 Planning: Deterministic planner produces an actionable investigation DAG.
- Step 3 Execution: Sandbox runner executes tools with timeout limits and permission checks.
- Step 4 Synthesis: Evidence store resolves hypotheses into verified findings or recorded limitations.

### Page 5: Architecture (`/architecture`)
- Detailed data flow diagrams and component boundaries.
- Local-first memory models: Mode A (Ephemeral), Mode B (Local Repo Context), Mode C (Persistent Machine Intelligence), Mode D (User-Configured Cloud).
- Process isolation and subprocess execution safety guarantees.

### Page 6: Documentation (`/docs`)
- CLI command reference: `anvexo investigate`, `anvexo discover`, `anvexo context`, `anvexo serve`.
- REST API endpoint specifications: `/api/health`, `/api/discover`, `/api/investigate`, `/api/jobs/:id`, `/api/context`, `/api/permissions`.
- Custom tool authoring and plugin integration guides.

### Page 7: Integrations (`/integrations`)
- Version Control: Local Git repositories, GitHub CLI, GitLab runners.
- Package Ecosystems: Node.js, Python, Go, Rust, Java, Ruby, PHP, C++, .NET.
- Model Providers: Anthropic Claude, OpenAI, Local Ollama, air-gapped endpoints.

### Page 8: Security & Privacy (`/security`)
- Path containment guarantees and `fs.realpathSync` traversal prevention.
- Zero-telemetry policy and local data retention standards.
- Vulnerability reporting procedures and PGP keys.

### Page 9: Commercial Licensing (`/pricing`)
- Transparent tier breakdown: Community (Evaluation), Professional Developer Seat, Enterprise Team & CI/CD.
- Self-hosted deployment options with no vendor lock-in.

### Page 10: Changelog (`/changelog`)
- Version release history, security patches, tool improvements, and breaking changes.

## 3. Technical Workbench Application Routes

The authenticated/local workbench application exposes dedicated views within the Split IDE Canvas:

1. Workspace Route (`/`):
   - Left Pane (40%): Repository path selector, objective input, active plan timeline DAG, hypothesis statuses, and permission prompts.
   - Right Pane (60%): Tabbed workbench containing:
     - Report & Findings: Verified claims, confidence scores, and limitations.
     - Code & Topography: Discovered project structure, entry points, and dependency graphs.
     - Tool Console: Live terminal output with millisecond execution durations and error logs.
     - Git Evidence: Detailed inspection of unstaged diffs and commit logs.

2. API Routes:
   - `GET /api/health`: Server health check and version metadata.
   - `POST /api/discover`: Synchronous repository topography analysis.
   - `POST /api/investigate`: Asynchronous job creation and DAG execution.
   - `GET /api/jobs/:id`: Polling endpoint for real-time investigation progress and results.
   - `POST /api/jobs/:id/cancel`: Process cancellation and concurrency lock release.
   - `GET /api/context`: Project memory inspection.
   - `POST /api/context/clear`: Explicit context purging.
   - `GET /api/permissions/audit`: Complete audit log of all tool access decisions.
   - `POST /api/permissions/grant`: Dynamic permission granting.
