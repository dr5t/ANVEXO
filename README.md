# ANVEXO

Autonomous Software Investigation and Codebase Intelligence Platform.

ANVEXO combines autonomous debugging, hypothesis testing, and root-cause analysis (ANVESHAN) with codebase intelligence, Git history analysis, and historical project context (ECHO) into a unified platform.

---

## Overview

Software investigation today is fragmented. When a critical failure occurs, developers manually inspect logs, search codebases, review commit history, formulate hypotheses, test assumptions, and piece together root causes. 

ANVEXO provides a controlled, evidence-first framework for software investigation. It discovers project topography, generates structured investigation plans, runs permission-gated diagnostic tools, collects verifiable evidence, tracks hypothesis confidence, and generates root-cause reports.

### Core Tenets

- Controlled Autonomy: Every tool invocation and file access is gated by an explicit, auditable permission layer.
- Evidence Before Conclusions: Claims must be grounded in collected tool outputs, file contents, git context, or test executions.
- Verification Before Claims: Success is declared only when automated tests or verification checks confirm the outcome.
- Local-First Operation: Functions entirely offline on local repositories using deterministic tooling.
- Commercial Ownership: Designed from day one as a commercial platform with defined licensing boundaries.

---

## Architecture

```
+-----------------------------------------------------------------------+
|                             ANVEXO CORE                               |
|                                                                       |
|  +--------------------+   +---------------------+   +---------------+  |
|  | Project Discovery  |-->| Investigation Engine|-->| Report Engine |  |
|  +--------------------+   +---------------------+   +---------------+  |
|            |                         |                      ^         |
|            v                         v                      |         |
|  +--------------------+   +---------------------+           |         |
|  |     Plan Builder   |   |   Evidence Store    |-----------+         |
|  +--------------------+   +---------------------+                     |
|                                      |                                |
|                                      v                                |
|  +-----------------------------------------------------------------+  |
|  |                    Permission Enforcement Layer                 |  |
|  |    Scope-based ACLs | Wildcard matching | Granular audit trail  |  |
|  +-----------------------------------------------------------------+  |
|                                      |                                |
|                                      v                                |
|  +-----------------------------------------------------------------+  |
|  |                       Tool Execution Engine                     |  |
|  |  file_read | file_list | file_search | git_status | git_log     |  |
|  |  git_diff  | run_command                                        |  |
|  +-----------------------------------------------------------------+  |
+-----------------------------------------------------------------------+
```

---

## Implemented Modules (Phase 1)

1. Core Engine: Orchestrates project discovery, planning, tool execution, evidence collection, and report generation.
2. Permission System: Enforces strict least-privilege access across file reads, file writes, Git operations, command executions, and tests.
3. Tool Registry: Permission-gated execution of system tools with execution limits, timeouts, and structured error handling.
4. Project Discovery: Stack detection supporting 40+ frameworks and languages, package managers, test runners, and entry points.
5. Evidence Collector: UUID-tagged evidence store tracking verification states (observed, inferred, hypothesized, verified, contradicted).
6. Investigation Planner: Deterministic multi-step plan generation mapping user objectives to targeted diagnostics.
7. Report Generator: Generates structured audit reports with confidence metrics, evidence citations, and honest limitation disclosures.
8. CLI: Executable binary providing `investigate` and `discover` commands with JSON and formatted text outputs.

---

## Installation

### Prerequisites

- Node.js >= 20.0.0
- Git >= 2.0.0

### Setup

```bash
git clone <repository-url>
cd ANVEXO
npm install
npm run build
```

---

## Usage

### Command Line Interface

#### 1. Discover Project Metadata

Analyze an arbitrary project directory to detect languages, frameworks, package managers, and entry points:

```bash
node dist/cli/index.js discover /path/to/project
```

Output formatted as JSON:

```bash
node dist/cli/index.js discover /path/to/project --json
```

#### 2. Execute an Investigation

Run a full investigation against a target repository:

```bash
node dist/cli/index.js investigate /path/to/project \
  --objective "Investigate why authentication fails intermittently" \
  --auto-approve
```

CLI Options:

| Option | Description |
|---|---|
| `-o, --objective <text>` | Specific investigation objective or failure description |
| `--auto-approve` | Grant read permissions automatically for the duration of the run |
| `--skip-tests` | Omit test execution steps from the investigation |
| `--verbose` | Output debug-level engine logs to stderr |
| `--quiet` | Suppress log messages and output only the final report |
| `--json` | Output the complete investigation report as structured JSON |

---

## Programmatic API

ANVEXO can be embedded as an engine inside other applications:

```typescript
import { InvestigationEngine } from 'anvexo';

const engine = new InvestigationEngine();

const report = await engine.investigate({
  objective: 'Investigate test failures in auth module',
  repositoryPath: '/path/to/target/project',
  autoApprove: true,
  skipTests: false,
});

console.log(engine.formatReport(report));
```

---

## Security Model

ANVEXO enforces permissions at the tool boundary before any filesystem, process, or network operation occurs:

- Default Deny: All operations require an explicit grant unless pre-authorized.
- Resource Scoping: Grants can be limited to exact file paths or wildcard patterns.
- One-Time Authorization: High-risk operations can be approved for a single execution.
- Audit Log: Every permission evaluation (allow or deny) is timestamped and recorded.
- No Silent Data Egress: Phase 1 includes zero external network transmission.

---

## Verification and Testing

The test suite runs using Vitest with V8 code coverage:

```bash
npm test
npm run test:coverage
```

### Coverage Metrics

- Core Engine: 90.4% statements
- Permissions: 97.4% statements
- Evidence Store: 100% statements
- Tool Registry: 80.3% statements
- Overall Test Suite: 46 passing tests across unit and integration suites

---

## Roadmap

- Phase 0: Repository and Engineering Foundation (Completed)
- Phase 1: Working Core Investigation Engine (Completed)
- Phase 2: Persistent Project Intelligence and Memory Models
- Phase 3: Controlled Code Modification and Automated Recovery
- Phase 4: Browser Automation and Reproduction via Playwright
- Phase 5: Graphical Interfaces (CLI, Desktop, Web) pending User Approval
- Phase 6: Integration Ecosystem (MCP Server, Agent Skills)
- Phase 7: Commercial Licensing and Enterprise Deployment

---

## Commercial Ownership and Licensing

All rights reserved. ANVEXO is proprietary software. Commercial distribution, SaaS hosting, and unauthorized redistribution are strictly prohibited without an explicit commercial license.
