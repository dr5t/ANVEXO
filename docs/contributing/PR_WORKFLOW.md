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

`main` is the stable default branch. The existing Hacktoberfest integration branch is **`pr-for-hacktoberrfest`**. Every contribution must use its own feature branch created from the latest `origin/pr-for-hacktoberrfest`, then open one PR from that feature branch into `pr-for-hacktoberrfest`.

1. **One approved task, one unique branch, one independent PR.** Do not combine unrelated issues or tasks.
2. **Never commit or push task changes directly to `main` or `pr-for-hacktoberrfest`.** Do not share or reuse another contributor's feature branch, push to another PR's head, or force-push.
3. **Stop if the branch is not cleanly scoped.** If the branch contains unrelated commits or another contributor's changes, do not open the PR; report the issue and ask the project lead how to proceed. Do not rewrite merged PR history.
4. **Branch naming:** use `feat/<contributor>-<task>` for features, `test/<contributor>-<task>` for test-only work, `ci/<contributor>-<task>` for CI, or `docs/<contributor>-<task>` for documentation. The branch name must be unique for the task.
5. **Code comment policy:** use descriptive names and types. Do not add code comments, TODOs, FIXMEs, or commented-out code.
6. **Gated license checkpoint:** any licensing modification requires Shaurya's explicit approval before editing. See the licensing audit documentation.

### Contributor branch examples

| Contributor | Example task branch |
| :--- | :--- |
| Shaurya | `feat/shaurya-e2e-demo` |
| Bhumika | `feat/bhumika-gemma-tests` |
| Alok | `feat/alok-evidence-validation` |
| Somi | `feat/somi-context-retrieval` |
| Akhil | `feat/akhil-security-tests` |

These are examples, not shared branches. Use a new branch name for each assigned task, even when the same contributor is working on multiple tasks.

### Start a task

Confirm the branch name is unused locally and remotely. Do not check out an existing contributor branch:

```bash
git status --short --branch
git fetch origin
git branch -a --list "*<unique-branch-name>*"
git switch --create <unique-branch-name> origin/pr-for-hacktoberrfest
```

Replace `<unique-branch-name>` with a branch such as `feat/alok-evidence-validation`. If a matching local or remote branch exists, choose another unique name. Keep commits focused on the assigned task and do not stage unrelated work.

### Validate and submit

Run the relevant tests plus the repository's available checks before submission:

```bash
npm ci
npm test
npm run lint
npm run build
```

Record the commands actually run and their actual results. If a check is unavailable or fails, disclose that in the PR rather than claiming success.

Before creating the PR, inspect the complete comparison against the integration branch:

```bash
git status --short --branch
git log --oneline origin/pr-for-hacktoberrfest..HEAD
git diff --name-status origin/pr-for-hacktoberrfest...HEAD
git diff --check origin/pr-for-hacktoberrfest...HEAD
git diff origin/pr-for-hacktoberrfest...HEAD
```

Verify that the commit list, changed files, and full diff contain only the assigned task. Push only your feature branch:

```bash
git push --set-upstream origin <unique-branch-name>
gh pr create --repo dr5t/ANVEXO --base pr-for-hacktoberrfest --head <unique-branch-name>
```

The PR head must be your dedicated feature branch and its base must be exactly `pr-for-hacktoberrfest`. Do not target `main` unless Shaurya explicitly approves a separate PR. Include the approved issue reference (when one exists), a concise problem/solution summary, changed behavior, tests with actual results, limitations, and relevant evidence. Do not invent an issue number.

Respond to review feedback on your own feature branch and update that same PR. Do not modify another contributor's branch or PR. Leave all merge decisions to Shaurya; contributors and AI agents must not merge PRs, including their own.

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
## Problem
What verified problem does this task address?

## Solution
Summarize the focused implementation and any relevant limitations.

## Issue or Task
Approved issue: #<issue_number>
If no approved issue exists, describe the assigned task without inventing an issue number.

## Branch and Scope
- Head: `<unique-feature-branch>`
- Base: `pr-for-hacktoberrfest`
- [ ] One independently reviewable task; no unrelated commits or files
- [ ] Complete commit list, changed-file list, and diff reviewed against the base
- [ ] No secrets or accidental generated files
- [ ] No code comments, TODOs, FIXMEs, or commented-out code added

## Verification
- Commands run:
- Actual test/build/lint/type-check results:
- Checks not run or failures and reason:

## Review
- [ ] I will address feedback on this branch and leave merging to Shaurya.
```

---

## 5. Peer Review Pairing Matrix

Peer review pairings help route reviews. Shaurya Tiwari is the final reviewer and the only person authorized by project workflow to merge contribution PRs. The repository currently has no GitHub branch protection enforcing this policy; see the administrator checklist below.

| Contributor | Subsystem | Designated Peer Reviewer | Final Architecture Approval |
| :--- | :--- | :--- | :--- |
| **Bhumika** | Gemma 4 Provider & Tests | Alok (Investigation Engine) | Shaurya (Lead) |
| **Alok** | ANVESHAN Evidence & Reports | Bhumika (Gemma 4 Provider) | Shaurya (Lead) |
| **Somi** | ECHO & TypeScript Impact | Akhil (Security & CI) | Shaurya (Lead) |
| **Akhil** | Security Sandbox & CI | Somi (ECHO & TypeScript Impact) | Shaurya (Lead) |
| **Shaurya** | Workflow & E2E Verification Demo | Bhumika & Alok | Peer Consensus |

---

## 6. Repository Administrator Checklist

The GitHub repository currently reports `main` and `pr-for-hacktoberrfest` as unprotected and has no repository rulesets. Configure protections for both branches in repository settings, without changing branch names:

- Require changes to enter through pull requests; block direct pushes and deletion.
- Require the available CI status checks once a CI workflow exists, and require those checks to pass before merge.
- Require at least one approving review and resolved review conversations; dismiss stale approvals after new commits.
- Apply rules to administrators and prevent bypasses except for an explicitly reviewed emergency policy.
- Restrict who may update or bypass protected branches so Shaurya alone can merge contribution PRs. Contributors should only push their own feature branches; if the plan cannot enforce this restriction, limit contributor write access and rely on manual lead-only merges.
- Disable force pushes.

No `.github/workflows/` directory or CI workflow is present in the inspected checkout, so there are currently no CI check names to require. GitHub enforcement options and required-review settings depend on repository permissions and the plan. This account can push but has neither admin nor maintain permission; protection settings could not be changed or fully administered here. Shaurya or a repository administrator must configure and verify the rules in GitHub.

## 7. Staged Implementation Sequence

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
