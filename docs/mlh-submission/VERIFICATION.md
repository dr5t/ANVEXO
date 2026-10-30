# MLH Category Submission Verification & Evidence

This document establishes the empirical verification evidence for ANVEXO's submission in two MLH hackathon categories:
1. **Best Use of Gemma 4**
2. **Best Open-Source AI Project**

All statements below are verified directly against implementation in the codebase.

---

## 1. Category 1: Best Use of Gemma 4

### 1.1 Model Integration & Architecture

- **Primary Source Code**: [`src/providers/gemma.ts`](../../src/providers/gemma.ts)
- **Supported Access Routes**:
  1. **Google AI Studio / Gemini API Endpoint**: Direct access to Google-hosted Gemma models via REST at `https://generativelanguage.googleapis.com` utilizing `GEMMA_API_KEY` or `GEMINI_API_KEY`.
  2. **Local Inference Daemon Endpoint**: Zero-cloud, air-gapped local inference via Ollama or vLLM running on `http://127.0.0.1:11434` (configurable via `GEMMA_BASE_URL`).
- **Supported Models**:
  - `gemma-4-31b-it` (31B Dense Instruct, 256K context window, multimodal vision support)
  - `gemma-4-26b-a4b-it` (26B MoE Instruct, 256K context window, multimodal vision support)
  - `gemma-2-27b-it` (27B Dense Instruct, 8K context window)
  - `gemma-2-9b-it` (9B Dense Instruct, 8K context window)
  - `gemma4:latest` (Auto-discovered local Ollama model tag)

### 1.2 Meaningful Gemma 4 Functionality

ANVEXO does not use Gemma 4 as a superficial chatbot. It leverages Gemma 4 for **deterministic multimodal software investigation**:

1. **Multimodal Diagnostic Reasoning**:
   `GemmaProvider.investigateIssue()` accepts an investigation context consisting of:
   - User issue statement / bug objective
   - Full repository path and topography
   - Relevant source code snippets
   - Active Git diff delta
   - Terminal stdout/stderr failure logs
   - Screenshot error captures (UI crashes, browser console errors, visual regression bugs)
2. **Structured Root Cause & Fix Synthesis**:
   Gemma 4 analyzes the multimodal inputs and returns structured JSON conforming to `GemmaInvestigationResult`:
   - `summary`: Concise engineering synopsis of the problem.
   - `suspectedRootCause`: Pinpointed explanation of the underlying defect.
   - `codeEvidence`: Target files, line ranges, and relevant code extracts.
   - `proposedFix`: Remediation patch recommendation.
   - `suggestedRegressionTests`: Specific automated test suites to execute to prevent regressions.
   - `uncertainties`: Self-reported areas requiring empirical runtime validation.
3. **Proof Mode Integration**:
   Every Gemma 4 finding is transformed into an `EvidenceRecord` (`EvidenceType.FILE_CONTENT`) and fed directly into `ProofVerifier`. The AI model's output is explicitly labeled as `VerificationStatus.UNVERIFIED` until dynamic test execution passes.

### 1.3 Reproducible Test Verification

- **Configuration Reference**: Full setup and model parameters documented in [`docs/providers/GEMMA_CONFIGURATION.md`](../providers/GEMMA_CONFIGURATION.md).
- **Mocked Unit Test Harness (30 cases)**:
  ```bash
  npx vitest run tests/unit/gemma.test.ts
  ```
  Verifies multimodal payload packing, MIME validation, 5MB image limit guarding, local Ollama image array forwarding, model parameter routing, API key scrubbing in error messages, and fallback parsing without requiring API keys or network calls.
- **Live API Integration Smoke Test**:
  ```bash
  npm run test:gemma
  ```
  The opt-in live API smoke test reads `GEMMA_API_KEY` from the environment, defaults to `gemma-4-31b-it`, and can be configured with `GEMMA_MODEL` and `GEMMA_BASE_URL`. It is excluded from `npm test`; without `GEMMA_API_KEY`, `npm run test:gemma` skips without making a network request. See the [Gemma configuration and verification guide](../providers/GEMMA_CONFIGURATION.md) for secure key setup.

### 1.4 Known Gaps & Incomplete Items

- Dedicated CLI flag `anvexo gemma <objective>` is staged in backlog (`DEF-01`) to allow direct command-line invocation.
- Continuous streaming token response (`completeStream`) currently buffers completion chunks rather than piping tokens directly to stdout.

---

## 2. Category 2: Best Open-Source AI Project

### 2.1 Open-Source Licensing & Governance

- **License**: Apache License 2.0 (staged via `ISSUE-09` transitioning from development `UNLICENSED`).
- **Repository**: [https://github.com/dr5t/ANVEXO](https://github.com/dr5t/ANVEXO)
- **Contributor Documentation**:
  - Contribution guidelines in [`docs/contributing/PR_WORKFLOW.md`](../contributing/PR_WORKFLOW.md)
  - Workstream architecture matrix in [`docs/contributing/TEAM_WORKSTREAMS.md`](../contributing/TEAM_WORKSTREAMS.md)
  - Transparent issue backlog in [`docs/contributing/ISSUE_BACKLOG.md`](../contributing/ISSUE_BACKLOG.md)
- **Automated CI**: GitHub Actions workflow defined in `.github/workflows/ci.yml` running linting, TypeScript build, and Vitest test matrix on every PR.

### 2.2 Genuine AI & Deterministic Engineering Capabilities

Unlike prompt wrappers or mock dashboards, ANVEXO is a real, production-architected developer platform:

1. **ANVESHAN (Autonomous Investigation Engine)**:
   Generates deterministic Directed Acyclic Graph (DAG) investigation plans, executes sandboxed diagnostic tools (`file_read`, `git_diff`, `file_search`, `run_command`), and collects empirical evidence records.
2. **ECHO (Codebase Intelligence & Memory)**:
   Indexes repository topography across 40+ frameworks, caches dependency graphs, tracks commit drift across investigations, and persists architectural decisions in `.anvexo/decision-memory.json`.
3. **Change Impact Simulator**:
   Simulates blast radiuses of code changes, computing direct and reverse dependencies, affected HTTP endpoints, security/auth flows, and quantified 0-100 risk scores.
4. **Bug Reproduction Lab**:
   Executes reproductions in a secure, secret-redacted sandbox. Accurately reports `cannot_reproduce` when failures are not observed, preventing hallucinated bug fixes.
5. **Safe Autonomy Engine**:
   Enforces runtime security modes (`OBSERVE`, `SUGGEST`, `ASSISTED`, `CONTROLLED_AUTONOMOUS`), blocks dangerous shell patterns (`rm -rf`, `sudo`, `dd`, `mkfs`), and enforces file and command execution budgets.
6. **Proof Mode**:
   Distinguishes model confidence from empirical verification. Enforces that test claims require real dynamic executions with exit code 0 and binds findings to immutable Git commit SHAs.

### 2.3 Reproducible Verification Commands

Run the complete test suite locally to verify all 26 test suites and 206 tests:

```bash
# 1. Install dependencies
npm ci

# 2. Compile TypeScript and build web UI assets
npm run build

# 3. Execute complete test suite (100% passing across 26 test files)
npm test

# 4. Run end-to-end cross-feature workflow integration test
npx vitest run tests/integration/workflow.test.ts
```

### 2.4 Contributor Setup & Demo Scenarios

#### Local Setup in Under 2 Minutes:
```bash
git clone https://github.com/dr5t/ANVEXO.git
cd ANVEXO
npm install
npm run build
```

#### Demo Scenario 1: CLI Investigation with Proof Mode
```bash
node dist/cli/index.ts investigate "Verify authentication test suite" --path .
```
Produces an ANVESHAN diagnostic report with topography, plan execution steps, evidence records, and Proof Mode verification status.

#### Demo Scenario 2: Change Impact Simulation
```bash
node dist/cli/index.ts impact src/server/router.ts
```
Calculates reverse dependencies, impacted HTTP API endpoints, security flows, and a risk assessment score.

#### Demo Scenario 3: End-to-End Engineering Intelligence Workflow
```bash
node dist/cli/index.ts workflow "Investigate permission check validation in autonomy engine" --target src/autonomy/engine.ts --cmd "node -e 'process.exit(1)'"
```
Orchestrates the entire 8-stage pipeline across ANVESHAN, ECHO, Change Impact, Decision Memory, Autonomy, Reproduction Lab, and Proof Mode.

#### Demo Scenario 4: Web UI Workbench
```bash
node dist/cli/index.ts serve --port 3000
```
Open `http://localhost:3000` to interact with the visual split-screen workbench featuring Proof Mode claims, Change Impact blast radius, Reproduction Lab runner, Autonomy mode toggle, and Decision Memory manager.
