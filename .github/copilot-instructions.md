# Copilot Code Review Instructions

## Review Behavior

- **Always attempt to fix issues**: For every issue identified during review, provide a concrete code fix using GitHub suggestion blocks. Never leave a comment without a fix.
- **Autonomous operation**: All suggestions are automatically applied without human review. Ensure every suggestion is correct, complete, and safe to apply immediately.
- **No advisory-only comments**: Do not post comments that only describe a problem. Every comment MUST include a `suggestion` block with the corrected code.
- Use triple-backtick `suggestion` blocks to propose inline fixes for every comment.
- If a fix requires changes across multiple files, create separate suggestion comments for each file.
- When identifying missing tests, provide a complete test file as a suggestion.
- Verify that each suggestion maintains backward compatibility and does not introduce regressions.
- Each suggestion must be independently valid — do not create suggestions that depend on other suggestions being applied first.

## Review Focus Areas

When reviewing pull requests, prioritize the following:

### Security
- Flag potential XSS, SQL injection, command injection vulnerabilities
- Check for hardcoded secrets, API keys, or credentials
- Verify proper input validation at system boundaries
- Flag unsafe use of `dangerouslySetInnerHTML`

### React Best Practices
- Verify proper use of React hooks (dependency arrays, rules of hooks)
- Check for missing `key` props in lists
- Flag direct DOM manipulation instead of React state
- Verify proper cleanup in useEffect hooks

### TypeScript
- Flag use of `any` type — suggest specific types
- Check for missing null/undefined handling
- Verify proper type narrowing in conditional blocks

### Accessibility
- Verify images have alt text
- Check form elements have labels
- Verify interactive elements are keyboard accessible
- Flag missing ARIA attributes on custom components

### Testing
- Every new component, hook, utility, or page MUST have a corresponding test file
- Test files follow the `__tests__/ComponentName.test.tsx` convention
- Flag PRs that add source files without corresponding tests
- When a fix is applied, the auto-test-generation workflow will create tests automatically — but always include test suggestions in your review comments as well

### Performance
- Flag unnecessary re-renders (missing useMemo/useCallback for expensive operations)
- Check for large bundle imports that could be code-split
- Verify images use appropriate formats and lazy loading

### Code Quality
- Flag console.log statements (use console.warn/error instead)
- Check for proper error handling in async operations
- Verify consistent naming conventions (PascalCase components, camelCase functions)

---

## SWE Agent Coding Instructions

When working on issues or PRs as the coding agent, follow these project conventions.

### Branch & Commit Behavior

- **ALWAYS push directly to the PR's existing branch** — never create a new branch or open a new PR
- When triggered by a review comment on a PR, check out the PR's head branch, apply fixes, and push to that same branch
- Do NOT request human review or approval — just fix the code and push the commit
- The automated loop will re-trigger the reviewer after your push; your job is only to fix and push

### PR-Triggered Work

When assigned directly to a PR:
- Read the `<!-- copilot-tasks-start -->` section in the PR body for fix instructions
- The task section lists all unresolved review threads with file paths and line numbers
- Apply all `suggestion` blocks exactly as written; for free-text comments, implement the requested change
- Push directly to the PR branch — do NOT create a new branch or PR
- The automated loop will re-trigger the reviewer after your push

### Project Structure

- `src/components/` — React components (section components + UI primitives in `ui/`)
- `src/pages/` — Page components that compose sections (`Index.tsx`, `NotFound.tsx`)
- `src/hooks/` — Custom hooks (`use-mobile.tsx`, `use-toast.ts`)
- `src/lib/` — Utilities (`utils.ts` for `cn()`, `motion.ts` for animation helpers)
- `src/test/` — Test setup and shared test utilities

### Import Conventions

Always use the `@/` alias for imports from `src/`:

```ts
import { cn } from "@/lib/utils";
import { fadeUpProps } from "@/lib/motion";
import { Button } from "@/components/ui/button";
```

### Component Patterns

Section components follow this pattern:
- Default function component export
- Local data arrays defined above the component
- Framer Motion for entrance animations using helpers from `@/lib/motion.ts`
- Wrapped in `<section id="..." className="py-20 ...">` with `<div className="section-container">`

Use `fadeUpProps(delay)` for scroll-triggered animations and `fadeUpAnimateProps(delay)` for mount animations. Use `staggerContainer` + `fadeUp` variants for staggered children.

### Styling

- Tailwind CSS with custom utility classes: `glass-card`, `glass-card-gold`, `section-container`, `data-mono`, `text-gold-gradient`
- Gold accent color: `hsl(43 72% 52%)` via `text-gold`, `border-gold`, `bg-gold`
- Fonts: `Inter` (body), `Instrument Serif` (headings), `IBM Plex Mono` (data/numbers)

### Naming Conventions

- **Components**: PascalCase (`HeroSection`, `SiteHeader`)
- **Hooks**: camelCase with `use` prefix (`useIsMobile`, `useToast`)
- **Utilities**: camelCase (`cn`, `fadeUp`)
- **CSS classes/IDs**: kebab-case (`glass-card`, `section-container`)

### Testing Requirements

Every new component, hook, utility, or page MUST have a corresponding test file:
- Place tests in `__tests__/` next to the source file (e.g., `src/components/__tests__/MyComponent.test.tsx`)
- Use `@testing-library/react` for component tests
- Mock Framer Motion using the Proxy pattern from existing tests
- Mock Recharts components when testing chart sections

### Validation Checklist

Run these commands before committing — all must pass:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### Commit Style

Short imperative present-tense phrases:
- `Add fleet section with vehicle table`
- `Fix responsive layout on mobile`
- `Update financial metrics`
