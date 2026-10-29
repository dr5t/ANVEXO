---
name: Review Diff
description: Perform strict code review on staged or unstaged Git modifications
tools: git_diff, git_status, file_read
---

# Review Diff Skill

Audit pending working tree or branch changes for defects, security risks, regressions, and style compliance.

## Workflow

1. Inspect working tree status and diff hunk outputs.
2. Verify that new code follows existing project conventions.
3. Check for exposed secrets, API keys, or unsafe hardcoded credentials.
4. Check for boundary validation, error handling, and potential race conditions.
5. Provide actionable line-by-line review comments and safety verification.

## Arguments
- `scope`: Target branch or commit range to compare against (default: unstaged)

## Prompts
- "Review current unstaged diffs for security concerns and missing error checks"
- "Review changes before staging and committing"
