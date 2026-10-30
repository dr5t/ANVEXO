# ANVEXO Pull Request & Team Collaboration Workflow

## 1. Core Workflow Principles

This document sets the collaboration standards, branching models, review protocols, and quality gates for the five-person ANVEXO engineering team:
- **Shaurya**: Project Lead & Architecture Governance
- **Bhumika**: Gemma 4 Provider & Error Handling
- **Alok**: Investigation Evidence Validation & Reports
- **Somi**: TypeScript Impact Analysis & ECHO Context
- **Akhil**: Security Regression Tests & CI

---

## 2. Branching & Contribution Rules

1. **One Issue, One Branch, One PR**: Every PR maps to exactly one approved issue from [ISSUE_BACKLOG.md](./ISSUE_BACKLOG.md).
2. **Standardized Branch Naming**:
   - Features: `feat/<member-name>-<short-topic>` (e.g., `feat/bhumika-gemma-unit-tests`, `feat/alok-evidence-recovery`)
   - Tests: `test/<member-name>-<short-topic>` (e.g., `test/akhil-security-hardening`)
   - CI & Automation: `ci/<member-name>-<short-topic>` (e.g., `ci/akhil-github-actions`)
   - Docs & Audits: `docs/<member-name>-<short-topic>` (e.g., `docs/akhil-license-audit`)
3. **No Direct Commits to `main`**: All changes enter `main` exclusively through peer-reviewed pull requests.
4. **Code Comment Policy**: Self-documenting code with strong TypeScript typing and descriptive naming. Do not add code comments (`//`, `/* */`).
5. **Gated License Checkpoint**: Any licensing modification (e.g., changing `package.json` license or creating `LICENSE`) is strictly gated. The third-party attribution audit in `docs/legal/LICENSE_AUDIT.md` must be reviewed and approved by Shaurya before code edits occur.

---

## 3. Pull Request Boundaries & Ownership Matrix

```
+---------------------------------------------------------------------------------------------------+
|                                      FROZEN SHARED INTERFACES                                     |
|             (src/core/types.ts - Immutable without unanimous consent & Shaurya approval)          |
+---------------------------------------------------------------------------------------------------+
       |                            |                           |                       |
       v                            v                           v                       v
[BHUMIKA ZONE]               [ALOK ZONE]                 [SOMI ZONE]             [AKHIL ZONE]
src/providers/gemma.ts       src/evidence/index.ts       src/context/            tests/unit/security.
tests/unit/gemma.test.ts     src/engine/index.ts         src/impact/             tests/unit/autonomy.
tests/integration/gemma      src/reporting/              tests/unit/context.     .github/workflows/
                             tests/unit/reporting.       tests/unit/impact.      docs/legal/
```

### Boundary Compliance Table

| Issue ID | Assignee | Permitted Write Files | Strictly Restricted Files | Required Test Validation |
| :--- | :--- | :--- | :--- | :--- |
| **ISSUE-01** | Bhumika | `tests/unit/gemma.test.ts`, `src/providers/gemma.ts` | `src/engine/*`, `src/server/*`, `src/cli/*` | `npx vitest run tests/unit/gemma.test.ts` |
| **ISSUE-02** | Bhumika | `tests/integration/gemma.test.ts`, `package.json` (script only) | `src/context/*`, `src/proof/*`, `src/autonomy/*` | `npm run test:gemma` |
| **ISSUE-03** | Alok | `src/engine/index.ts`, `tests/unit/engine.test.ts` | `src/providers/*`, `src/impact/*` | `npx vitest run tests/unit/engine.test.ts` |
| **ISSUE-04** | Alok | `src/reporting/index.ts`, `src/reporting/markdown.ts`, `tests/unit/reporting.test.ts` | `src/providers/*`, `src/autonomy/*` | `npx vitest run tests/unit/reporting.test.ts` |
| **ISSUE-05** | Somi | `src/context/dependencies.ts`, `src/context/manager.ts`, `src/impact/simulator.ts` | `src/providers/*`, `src/reporting/*` | `npx vitest run tests/unit/context.test.ts tests/unit/impact.test.ts` |
| **ISSUE-06** | Somi | `src/impact/simulator.ts`, `src/impact/types.ts`, `tests/unit/impact.test.ts` | `src/engine/*`, `src/server/*` | `npx vitest run tests/unit/impact.test.ts` |
| **ISSUE-07** | Akhil | `tests/unit/security.test.ts`, `tests/unit/autonomy.test.ts`, `src/autonomy/engine.ts` | `src/providers/*`, `src/reporting/*` | `npx vitest run tests/unit/autonomy.test.ts tests/unit/security.test.ts` |
| **ISSUE-08** | Akhil | `.github/workflows/ci.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, `CONTRIBUTING.md` | `src/*` | GitHub Actions YAML validation & local build |
| **ISSUE-09** | Akhil & Shaurya | `docs/legal/LICENSE_AUDIT.md`, `LICENSE` (pending gate), `package.json` (pending gate) | `src/*` | `npm run build` & explicit owner sign-off |
| **ISSUE-10** | Shaurya | `tests/integration/demo.test.ts`, `src/engine/workflow.ts`, `package.json` | Submodule internals owned by members | `npm run test:demo && npm test` |

---

## 4. Pull Request Submission Template

Every pull request description must conform to the following template:

```markdown
## Summary
Concise 2-3 sentence technical description of the changes.

## Issue Reference
Closes #<issue_number>

## Contributor & Workstream
- Assignee: [Shaurya | Bhumika | Alok | Somi | Akhil]
- Subsystem: [Gemma 4 | ANVESHAN | ECHO & Impact | Security & CI]
- Branch: `feat/<name>-<topic>`

## Boundary & Style Compliance
- [ ] Changes strictly confined to assigned file ownership
- [ ] No modifications to frozen interfaces in src/core/types.ts without approval
- [ ] Zero comments added in code (preserving repository standards)
- [ ] Passes all 26 existing test suites without regressions

## Empirical Test Verification
- Command executed:
  \`\`\`bash
  npm run build
  npx vitest run <target_test_file>
  \`\`\`
- Output summary:
  \`\`\`text
  <paste test runner results>
  \`\`\`

## Proof Mode Assessment
- Verification Status: [VERIFIED | PARTIAL | UNVERIFIED]
- Dynamic executions: <count>
- Static inspections: <count>
```

---

## 5. Peer Review Pairing Matrix

To maintain rigorous code quality and shared context, every PR requires one designated peer review plus final approval from Shaurya (Project Lead):

| Contributor | Subsystem | Designated Peer Reviewer | Final Architecture Approval |
| :--- | :--- | :--- | :--- |
| **Bhumika** | Gemma 4 Provider & Tests | Alok (Investigation Engine) | Shaurya (Lead) |
| **Alok** | ANVESHAN Evidence & Reports | Bhumika (Gemma 4 Provider) | Shaurya (Lead) |
| **Somi** | ECHO & TypeScript Impact | Akhil (Security & CI) | Shaurya (Lead) |
| **Akhil** | Security Sandbox & CI | Somi (ECHO & TypeScript Impact) | Shaurya (Lead) |
| **Shaurya** | Workflow & E2E Verification Demo | Bhumika & Alok | Peer Consensus |

---

## 6. Staged Implementation Sequence

```
Sprint Day 1 (Foundation):
  - Akhil: ISSUE-08 (GitHub Actions CI & Contributor Setup)
  - Bhumika: ISSUE-01 (Gemma 4 Unit & Mock Tests)
  - Alok: ISSUE-03 (Investigation Evidence Validation)
  - Somi: ISSUE-05 (ECHO Context & Impact Simulator Integration)

Sprint Day 2 (Deepening & Hardening):
  - Bhumika: ISSUE-02 (Gemma 4 Live Tests & Environment Diagnostics)
  - Alok: ISSUE-04 (Structured Report Exporters & Disk Persistence)
  - Somi: ISSUE-06 (TypeScript Impact Analysis & Barrel Export Resolution)
  - Akhil: ISSUE-07 (Security Regression Test Suite Hardening)
  - Akhil & Shaurya: ISSUE-09 (License Audit Inspection & Approval Gate)

Sprint Day 3 (Integration & Verification):
  - Shaurya: ISSUE-10 (End-to-End Gemma 4 Verification & MLH Demo Harness)
  - Full Team: Complete regression verification (`npm test` across all 5 contributors' changes)
```
