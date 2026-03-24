# Codex Agent Instructions

This file is read automatically by the OpenAI Codex CLI when running in this repository.

---

## Approval Modes

Configure how much Codex can do without stopping for confirmation:

- **Never-ask / `-a never`** (used in `workflow-autofix.yml` and `security-autofix.yml`): Auto-executes all commands, never prompts for approval. Combined with `--sandbox workspace-write` so execution is scoped to the workspace. "approval: never" in the startup banner confirms this mode.
  ```bash
  codex exec -a never --sandbox workspace-write "your prompt"
  ```
- **On-request / `-a on-request`**: The model decides when to ask for approval. Suitable for interactive local sessions where a human is present.
- **Untrusted / `-a untrusted`**: Asks before running non-trusted commands (anything beyond ls, cat, sed, etc.). Conservative mode for auditing.
- **Full bypass** (`--dangerously-bypass-approvals-and-sandbox`): Skips both approval and sandbox. Used in `codex-review.yml` and `auto-test-generation.yml` where Codex needs unrestricted file access to apply multi-file fixes and generate tests.

Switch modes interactively with `/permissions` inside an interactive Codex session.

> **Note:** `--full-auto` is a convenience alias that maps to `-a on-request --sandbox workspace-write`. It was replaced with the explicit `-a never --sandbox workspace-write` in CI workflows to avoid ambiguity and ensure truly non-interactive execution.

---

## Fixing Workflow Failures

When a CI workflow fails, follow this checklist to diagnose and fix:

1. **Read the error logs** — identify the exact failing step and the full error message before making any changes.
2. **Lint errors** (`npm run lint`): Fix ESLint violations — unused variables, missing hook dependencies, incorrect type assertions, import order issues.
3. **Type errors** (`npm run typecheck`): Fix TypeScript errors — wrong prop types, missing generics, implicit `any`, incorrect return types.
4. **Test failures** (`npm test`): Fix failing assertions — update stale snapshots, fix mock setups, correct expected values, ensure test isolation.
5. **Build failures** (`npm run build`): Fix missing imports, resolve circular dependencies, correct asset paths, fix Vite/Rollup config issues.
6. **Workflow YAML errors**: Fix indentation (YAML is indentation-sensitive), quote strings containing special characters, correct `uses:` action version pins.
7. **Security audit** (`npm audit`): Run `npm audit fix` first; if that's insufficient, `npm audit fix --force` — but then run `npm ls --depth=0` to verify no peer dependency breakage. If force-fix broke deps, roll back with `git checkout -- package.json package-lock.json && npm ci`.
8. **Dependency conflicts**: Check `npm ls` for peer dep errors. Pin exact versions in `package.json` (no `^` prefix). The `.npmrc` has `save-exact=true` to prevent caret ranges.

After fixing any issue, always verify the full suite before committing:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

---

## General Fix Guidelines

- Never skip hooks (`--no-verify`) or force-push without explicit user instruction.
- When fixing one file, check whether the same issue exists in related files (e.g., template copies mirror source workflows).
- Prefer minimal, targeted fixes over broad refactors — change only what is necessary.
- Keep commit messages short and imperative: `Fix Codex CLI flag syntax`, `Pin vite to exact version`.
- Never commit `.env` files or secrets.
- Run the full verification suite before every commit.
