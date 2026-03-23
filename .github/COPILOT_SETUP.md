# GitHub Copilot Integration Setup

This repository is configured for GitHub Copilot code review and SWE agent. Follow these steps to enable them.

## 1. Enable Copilot Code Review (Automatic PR Reviews)

Copilot code review is a repository setting, not a GitHub Action.

### Steps:
1. Go to **Repository Settings** > **Rules** > **Rulesets**
2. Click **New ruleset** > **New branch ruleset**
3. Name it "Main branch protection"
4. Under **Target branches**, add `main`
5. Under **Branch rules**, check **Require a pull request before merging**
6. Check **Require review from Code owners**
7. Optionally check **Review new pushes** for re-review on force pushes
8. Click **Create**

> **Note:** Do NOT enable "Automatically request Copilot code review" in the ruleset. The `copilot-recursive-loop.yml` workflow explicitly requests Copilot review via `gh pr edit --add-reviewer @copilot`. Enabling the automatic setting creates duplicate review requests and race conditions.

### Custom Instructions:
Copilot uses `.github/copilot-instructions.md` to customize its review behavior. This file is already configured with focus areas for security, React, TypeScript, accessibility, testing, and performance.

## 2. Enable Copilot SWE Agent (Automated Issue Resolution)

The Copilot coding agent can automatically work on issues assigned to `@copilot`.

### Prerequisites:
- GitHub Copilot Enterprise or Copilot Pro+ subscription
- Repository must allow GitHub Actions

### Steps:
1. Go to **Repository Settings** > **Copilot** > **Coding agent**
2. Enable the coding agent for this repository
3. The environment is configured via `.github/copilot-setup-steps.yml`

### Usage:
- Assign any issue to `@copilot` to trigger the agent
- Copilot will create a draft PR with the fix
- Review the PR as you would any human contribution
- The agent runs lint, typecheck, and tests before submitting

## 3. What's Configured

| File | Purpose |
|------|---------|
| `.github/copilot-instructions.md` | Custom review instructions + SWE agent coding guidelines |
| `.github/copilot-setup-steps.yml` | SWE agent environment setup (Node 20, npm ci, lint, test, build) |
| `.github/workflows/copilot-recursive-loop.yml` | Event-driven Review ➔ Fix ➔ Re-Review recursive loop |
| `.github/workflows/codex-review.yml` | Codex-powered auto-fix for human review comments |
| `.github/workflows/claude-pr-autofix.yml` | Claude-powered auto-fix for free-text review comments |
| `.github/COPILOT_SETUP.md` | This setup guide |

## 4. Autonomous Autofix Behavior

This repository is configured so Copilot operates **fully autonomously** — no human in the loop.

### How It Works (Event-Driven Recursive Loop):
1. A PR is opened or a new commit is pushed → `copilot-recursive-loop.yml` requests Copilot as code reviewer
2. Copilot asynchronously reviews the code and submits a review
3. If the review contains issues (line comments or requested changes), the workflow posts a `@copilot` mention to wake the Copilot SWE Agent
4. The SWE Agent fixes the code and pushes a new commit → this triggers `pull_request synchronize`, restarting the loop from step 1
5. A **circuit breaker** (MAX_LOOPS=100) prevents infinite loops — after 100 iterations, the loop stops and requests human intervention
6. For **human reviews**, `codex-review.yml` and `claude-pr-autofix.yml` handle fixes separately

### Configuration Files:
- `.github/copilot-instructions.md` — instructs Copilot to always provide fixable suggestions; also provides SWE agent coding guidelines
- `.github/workflows/copilot-recursive-loop.yml` — the recursive Review ➔ Fix ➔ Re-Review loop
- `.github/workflows/codex-review.yml` — Codex-powered auto-fix for human review comments
- `.github/workflows/claude-pr-autofix.yml` — Claude-powered auto-fix for free-text review comments
- `.github/copilot-setup-steps.yml` — SWE agent environment for issue resolution

### Required Secrets:
- **`COPILOT_PAT`** — A fine-grained Personal Access Token (PAT) with Read & Write access to Pull Requests, Issues, and Contents. Required because `GITHUB_TOKEN` cannot wake native bots like `@copilot`. Create from a user account with write access to the repository.

### Repository Settings Required:
1. Go to **Repository Settings** > **Rules** > **Rulesets** and ensure branch protection is configured (see Section 1)
2. Do NOT enable "Automatically request Copilot code review" — the workflow handles review requests explicitly
3. Add `COPILOT_PAT` to repository secrets (Settings > Secrets and variables > Actions)
4. The recursive loop workflow runs automatically — no additional settings needed

## 5. How It Works in CI

- **On every PR**: `copilot-recursive-loop.yml` requests Copilot code review via the workflow (not automatic settings)
- **On issue assignment**: Copilot SWE agent creates a PR (if enabled)
- **On every commit**: Existing CI runs lint, typecheck, test, security audit, build
- **CodeQL**: Scans every commit for security vulnerabilities

## 6. Automatic Test Generation

Every fix applied by Copilot or Codex automatically generates corresponding tests.

### Workflow: `.github/workflows/auto-test-generation.yml`
- Triggers on push when the commit is from a bot (copilot, codex, github-actions)
- Finds changed source files missing `__tests__/` test files
- Uses Codex CLI to generate comprehensive test suites
- Commits the generated tests to the branch

### Script: `.github/scripts/generate-test-stubs.sh`
- Generates test stub files for source files missing tests
- Creates React component tests (TSX) or module tests (TS)
- Follows the `__tests__/ComponentName.test.tsx` convention
- Can be run locally: `bash .github/scripts/generate-test-stubs.sh src/components/MyComponent.tsx`

## 7. Workflow Self-Healing

### Auto-Fix (`.github/workflows/workflow-autofix.yml`)
- Triggers when any monitored workflow fails (`workflow_run` event)
- Downloads error logs from the failed run
- Uses Codex CLI to diagnose and fix the issue
- Commits the fix and pushes automatically

### Auto-Test (`.github/workflows/workflow-test-runner.yml`)
- Triggers when `.github/workflows/*.yml` files change
- Runs `generate-workflow-tests.sh` to create test files for new workflows
- Runs `npm test` to verify all workflow tests pass
- Commits new test files automatically

## 8. Security Autofix

### Inline CI Fix (`.github/workflows/ci.yml` — security job)
- Detects npm audit failures and runs `npm audit fix` automatically
- Verifies fixes with `npm test`, then commits and pushes
- Falls back to `npm audit fix --force` for breaking changes

### Dedicated Workflow (`.github/workflows/security-autofix.yml`)
- Triggers when CI or CodeQL workflows fail, plus daily at 7 AM UTC
- **Job 1 — npm audit**: Runs `npm audit fix` and `npm audit fix --force`
- **Job 2 — CodeQL**: Fetches open CodeQL alerts via API, uses Codex CLI to fix code vulnerabilities
- All fixes are verified (lint, typecheck, test) before committing
