# Secrets & Variables Reference

Complete inventory of all secrets and environment variables required by this repository.

---

## GitHub Actions Secrets

Configure these in **Repository Settings > Secrets and variables > Actions > New repository secret**.

### Required

#### `COPILOT_PAT`

- **Type**: Fine-grained Personal Access Token
- **Required Permissions**: Read & Write access to **Pull Requests**, **Issues**, and **Contents**
- **Why**: `GITHUB_TOKEN` cannot wake native bots like `@copilot`. This PAT is used for authenticated git pushes, PR reviews, and bot assignments in CI workflows.
- **Used by**:
  - `.github/workflows/ci.yml`
  - `.github/workflows/copilot-recursive-loop.yml`
  - `.github/workflows/codex-review.yml`
  - `.github/workflows/claude-pr-autofix.yml`
  - `.github/workflows/workflow-test-runner.yml`
  - `.github/workflows/security-autofix.yml`
  - `.github/workflows/workflow-autofix.yml`
  - `.github/workflows/auto-test-generation.yml`
  - `.github/workflows/sub-pr-auto-merge.yml`

#### `APPROVER_PAT`

- **Type**: Fine-grained Personal Access Token from a **different GitHub account**
- **Required Permissions**: Read & Write access to **Pull Requests**
- **Why**: GitHub blocks self-approval. This PAT from a separate account satisfies branch protection "required approvals" when the automated review loop completes cleanly.
- **Used by**:
  - `.github/workflows/copilot-recursive-loop.yml` (auto-approve step)

### Required for AI Features

#### `CODEX_API_KEY`

- **Type**: OpenAI API key for the Codex CLI
- **Why**: Powers automated code review, workflow repair, security fixes, and test generation.
- **Behavior if missing**: Workflows check for this secret and exit gracefully with an error message directing you to add it.
- **Used by**:
  - `.github/workflows/codex-review.yml`
  - `.github/workflows/workflow-autofix.yml`
  - `.github/workflows/security-autofix.yml`
  - `.github/workflows/auto-test-generation.yml`

### Optional

#### `ANTHROPIC_API_KEY`

- **Type**: Anthropic Claude API key
- **Why**: Enables Claude-powered auto-fix for free-text PR review comments.
- **Behavior if missing**: The workflow skips silently without failure.
- **Used by**:
  - `.github/workflows/claude-pr-autofix.yml`

#### `CODEX_API_KEY`

- **Type**: OpenAI API key
- **Why**: Used by the Codex review job in CI. Configured with `continue-on-error: true`.
- **Behavior if missing**: The CI job is skipped; other jobs are unaffected.
- **Used by**:
  - `.github/workflows/codex-review.yml`

---

## Environment Variables (`.env` file)

These are **client-side** Vite variables loaded at build time via `import.meta.env`. They are defined in the `.env` file at the repository root and consumed in `src/integrations/supabase/client.ts`.

| Variable | Purpose | Example |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project API URL | `https://<project-id>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anonymous/public API key (JWT) | `eyJhbGciOi...` |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project identifier | `oadescawjwbtpbcaxuvm` |

> **Note**: These are public/anon keys intended for client-side use. They do not grant admin access. Row-level security (RLS) policies in Supabase control data access.

---

## Quick Setup Checklist

1. **`COPILOT_PAT`** — Create a fine-grained PAT with PRs + Issues + Contents (R/W). Add as repository secret.
2. **`APPROVER_PAT`** — Create a fine-grained PAT from a **separate** GitHub account with PRs (R/W). Add as repository secret.
3. **`CODEX_API_KEY`** — Get an OpenAI API key. Add as repository secret.
4. **`ANTHROPIC_API_KEY`** *(optional)* — Get an Anthropic API key. Add as repository secret.
5. **`OPENAI_API_KEY`** *(optional)* — Get an OpenAI API key. Add as repository secret.
6. **`.env`** — Copy `.env` or create one with the three `VITE_SUPABASE_*` variables pointing to your Supabase project.

For detailed setup of the Copilot review loop, see `.github/COPILOT_SETUP.md`.
