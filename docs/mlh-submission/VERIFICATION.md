# MLH Category Submission Verification & Evidence

## 1. Executive Summary

This document establishes the empirical verification evidence for ANVEXO's submission in two MLH hackathon categories:
1. **Best Use of Gemma 4**
2. **Best Open-Source AI Project**

All assertions below are grounded directly in active source code, verifiable test suites, and empirical invariants within the repository.

---

## 2. Category 1: Best Use of Gemma 4

### 2.1 Provider Architecture & Access Routes
- **Primary Implementation**: [`src/providers/gemma.ts`](../../src/providers/gemma.ts)
- **Supported Endpoints**:
  1. **Google AI Studio / Gemini API**: Direct REST communication with Google's Gemma 4 models at `https://generativelanguage.googleapis.com` utilizing `GEMMA_API_KEY` or `GEMINI_API_KEY`.
  2. **Local Inference Daemon**: Zero-cloud, air-gapped local inference via Ollama or vLLM running on `http://127.0.0.1:11434` (configurable via `GEMMA_BASE_URL`).
- **Supported Model Registry**:
  - `gemma-4-31b-it` (31B Dense Instruct, 256K context window, multimodal vision support)
  - `gemma-4-26b-a4b-it` (26B MoE Instruct, 256K context window, multimodal vision support)
  - `gemma-2-27b-it` (27B Dense Instruct, 8K context window)
  - `gemma-2-9b-it` (9B Dense Instruct, 8K context window)
  - `gemma4:latest` (Auto-discovered local Ollama tag)

### 2.2 Deep Multimodal Reasoning
ANVEXO applies Gemma 4 to **deterministic software debugging and failure triage**:
1. **Multimodal Investigation Context**:
   `GemmaProvider.investigateIssue()` accepts:
   - Natural language issue description
   - Repository file topography
   - Code snippet extracts
   - Active Git diff delta
   - Terminal stdout / stderr failure traces
   - Screenshot error captures (UI glitches, console crashes, visual regressions)
2. **Structured Engineering Output**:
   Gemma 4 returns structured JSON conforming to `GemmaInvestigationResult`:
   - `summary`: High-level diagnostic synopsis
   - `suspectedRootCause`: Pinpointed technical defect
   - `codeEvidence`: File paths, line numbers, and relevant code extracts
   - `proposedFix`: Remediation patch recommendation
   - `suggestedRegressionTests`: Test suites needed to prevent future regressions
   - `uncertainties`: Identified knowledge gaps requiring dynamic runtime proof
3. **Proof Mode Evidence Binding**:
   Gemma 4 claims are ingested into `ProofVerifier` as `VerificationStatus.UNVERIFIED`. The AI model's suggestions are never accepted as ground truth without empirical execution checks.

### 2.3 Verification Test Matrix
- **Offline Mocked Unit Tests (`tests/unit/gemma.test.ts` - Bhumika)**:
  ```bash
  npx vitest run tests/unit/gemma.test.ts
  ```
  Verifies payload serialization, image base64 validation (rejecting >5MB files), model routing, and markdown codeblock JSON extraction fallback without making external network calls.
- **Live Integration Tests (`tests/integration/gemma.test.ts` - Bhumika)**:
  ```bash
  GEMMA_API_KEY="your-key" npm run test:gemma
  ```
  Executes live multimodal investigation against a test fixture when credentials or a local daemon are available; prints diagnostic setup hints and skips cleanly when offline.
- **End-to-End Demo Verification Harness (`tests/integration/demo.test.ts` - Shaurya)**:
  ```bash
  npm run test:demo
  ```
  Validates the full workflow cycle from multimodal ingestion to structured Proof Mode verification.

---

## 3. Category 2: Best Open-Source AI Project

### 3.1 Transparent AI Architecture vs. Superficial Wrappers
ANVEXO is a full-featured engineering intelligence platform containing six integrated engines:
1. **ANVESHAN (Autonomous Investigation Engine)**: Directed Acyclic Graph (DAG) planner executing sandboxed diagnostic tools (`file_read`, `git_diff`, `file_search`, `run_command`).
2. **ECHO (Codebase Intelligence & Memory)**: Indexes repository topography across 40+ frameworks, caches dependency graphs in `.anvexo/context.json`, and records architectural decisions.
3. **Change Impact Simulator**: Calculates blast radiuses of code changes, mapping direct and reverse dependencies, impacted HTTP endpoints, and security-sensitive flows.
4. **Bug Reproduction Lab**: Executes reproductions in a secure, secret-redacted sandbox, reporting `cannot_reproduce` when failures are unconfirmed.
5. **Safe Autonomy Engine**: Enforces runtime security boundaries (`OBSERVE`, `SUGGEST`, `ASSISTED`, `CONTROLLED_AUTONOMOUS`), action budgets, and shell command blacklists.
6. **Proof Mode**: Distinguishes probabilistic model confidence from empirical verification, binding claims to execution checks and Git commit SHAs.

### 3.2 Gated Open-Source Licensing
- **License Target**: Apache License 2.0.
- **Governance Gate**: Gated task (`ISSUE-09`). All third-party dependencies (`commander`, `simple-git`, `@types/node`, `@vitest/coverage-v8`, `typescript`, `vitest`) are inspected for compatibility (MIT / Apache-2.0), documented in `docs/legal/LICENSE_AUDIT.md`, and require explicit Project Owner (Shaurya) sign-off prior to modifying `package.json` or adding `LICENSE`.

### 3.3 Quality Automation & Contributor Standards
- **Automated CI (`.github/workflows/ci.yml` - Akhil)**: Matrix testing across Node.js 20.x and 22.x on `ubuntu-latest` running linting, build, and all 26 test suites.
- **Contributor Guides (`docs/contributing/`)**:
  - `TEAM_WORKSTREAMS.md`: Five-member ownership matrix.
  - `ISSUE_BACKLOG.md`: 10-issue core and gated specifications.
  - `PR_WORKFLOW.md`: Peer review pairs, branching rules, and boundary compliance.

---

## 4. Feature Verification Status Table

| Capability | Component | Status | Owner | Verification Method |
| :--- | :--- | :--- | :--- | :--- |
| Gemma 4 Dual Routing | `src/providers/gemma.ts` | Implemented | Bhumika | `tests/unit/gemma.test.ts` |
| Multimodal Input Parsing | `src/providers/gemma.ts` | Implemented | Bhumika | `tests/unit/gemma.test.ts` |
| Live Gemma 4 Diagnostics | `tests/integration/` | Backlog | Bhumika | `tests/integration/gemma.test.ts` |
| Evidence Validation | `src/evidence/index.ts` | Backlog | Alok | `tests/unit/evidence.test.ts` |
| Workflow Failure Recovery | `src/engine/index.ts` | Backlog | Alok | `tests/unit/engine.test.ts` |
| Report Exporters (MD/JSON) | `src/reporting/` | Backlog | Alok | `tests/unit/reporting.test.ts` |
| ECHO Shared Graph Cache | `src/context/`, `src/impact/` | Backlog | Somi | `tests/unit/context.test.ts` |
| TypeScript Import Analysis | `src/impact/simulator.ts` | Backlog | Somi | `tests/unit/impact.test.ts` |
| Autonomy Sandbox Regression | `tests/unit/security.test.ts` | Backlog | Akhil | `tests/unit/autonomy.test.ts` |
| GitHub Actions CI | `.github/workflows/` | Backlog | Akhil | Local YAML validation & CI execution |
| Gated Apache-2.0 License | `docs/legal/`, `package.json` | Gated | Akhil / Shaurya | `docs/legal/LICENSE_AUDIT.md` review |
| End-to-End Demo Harness | `tests/integration/demo.ts` | Backlog | Shaurya | `npm run test:demo && npm test` |
| Gemma CLI Command | `src/cli/index.ts` | **Deferred** | - | Deferred until core tests verified |
| Visual Graph Exporter | `src/impact/graph.ts` | **Deferred** | - | Deferred until core impact verified |
| Workflow Progress Streaming | `src/engine/workflow.ts` | **Deferred** | - | Deferred until recovery verified |
