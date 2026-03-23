# CLAUDE.md — Golden Chariot Growth

This file provides guidance for AI assistants working in this repository.

---

## Project Overview

**Good Sam Transportation** investor relations website. A modern, single-page React application that serves as a pitch/investor portal for a luxury ground transportation company. The site showcases financial metrics, fleet details, market opportunity, and investment terms to attract capital partners for fleet expansion.

Built with the [Lovable](https://lovable.dev) platform, but fully standard Vite + React + TypeScript code.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18.3.1 |
| Language | TypeScript 5.8.3 |
| Build Tool | Vite 5.4.19 (with SWC) |
| Styling | Tailwind CSS 3.4.17 |
| UI Primitives | shadcn/ui (Radix UI) |
| Animations | Framer Motion 12 |
| Icons | Lucide React |
| Routing | React Router DOM v6 |
| Server State | TanStack React Query v5 |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Unit Tests | Vitest + Testing Library |
| E2E Tests | Playwright |
| Linter | ESLint 9 (TypeScript rules) |
| Package Manager | npm (also has bun lockfile for Lovable platform) |

---

## Project Structure

```
/
├── src/
│   ├── components/          # All React components
│   │   ├── ui/              # shadcn/ui primitives (~60 components, generated)
│   │   ├── HeroSection.tsx  # Landing hero with key metrics
│   │   ├── FinancialsSection.tsx  # Charts + unit economics
│   │   ├── MarketSection.tsx      # Market opportunity + competitive advantages
│   │   ├── FleetSection.tsx       # Fleet inventory table
│   │   ├── InvestmentSection.tsx  # Use of funds + risk mitigation
│   │   ├── ContactSection.tsx     # Investor inquiry form
│   │   ├── SiteHeader.tsx         # Fixed nav with mobile menu
│   │   ├── SiteFooter.tsx         # Footer branding
│   │   ├── Ticker.tsx             # Scrolling metrics ticker
│   │   └── NavLink.tsx            # Anchor-linked nav item
│   ├── pages/
│   │   ├── Index.tsx        # Main page — composes all sections
│   │   └── NotFound.tsx     # 404 page
│   ├── hooks/
│   │   ├── use-mobile.tsx   # Returns boolean for <768px screens
│   │   └── use-toast.ts     # shadcn toast hook
│   ├── lib/
│   │   ├── utils.ts         # cn() class-merging utility
│   │   └── motion.ts        # Framer Motion animation presets
│   ├── test/
│   │   ├── setup.ts         # Vitest setup (jsdom + matchMedia mock)
│   │   └── example.test.ts  # Example test
│   ├── App.tsx              # Root: Router, QueryClient, Toast providers
│   ├── main.tsx             # ReactDOM.createRoot entry point
│   ├── index.css            # Global styles, CSS variables, utility classes
│   └── vite-env.d.ts        # Vite type shims
├── public/                  # Static assets
├── index.html               # HTML entry point
├── package.json
├── vite.config.ts           # Vite config: port 8080, @ alias, SWC, lovable-tagger
├── tailwind.config.ts       # Theme: gold accents, dark mode, custom fonts
├── tsconfig.json            # Path alias @ → src/
├── vitest.config.ts         # Test config: jsdom, globals, @ alias
├── playwright.config.ts     # E2E config via lovable-agent-playwright-config
├── eslint.config.js         # ESLint: TS rules + react-hooks + react-refresh
├── components.json          # shadcn/ui CLI config
└── postcss.config.js
```

---

## Development Commands

```bash
# Start dev server (localhost:8080)
npm run dev

# Production build → dist/
npm run build

# Development build (includes debug info)
npm run build:dev

# Preview production build
npm run preview

# Run ESLint
npm run lint

# Run unit tests once
npm test

# Run unit tests in watch mode
npm run test:watch
```

---

## Architecture & Conventions

### Component Patterns

**Section components** are the main building blocks. Each one:
- Lives in `src/components/`
- Contains its own local data arrays (metrics, tables, etc.)
- Uses Framer Motion for entrance animations
- Exports a default function component

```tsx
// Typical section pattern
const data = [{ id: 1, label: "Example", value: "$100K" }];

const MySection = () => (
  <section id="my-section" className="py-20 ...">
    <div className="section-container">
      <motion.h2 {...fadeUpAnimateProps(0.1)}>Title</motion.h2>
      {data.map((item) => (
        <motion.div key={item.id} {...fadeUpProps(0.2)}>
          {item.label}: {item.value}
        </motion.div>
      ))}
    </div>
  </section>
);

export default MySection;
```

**Pages** (`src/pages/`) simply compose section components:

```tsx
// Index.tsx pattern
const Index = () => (
  <div>
    <SiteHeader />
    <HeroSection />
    <FinancialsSection />
    {/* etc. */}
    <SiteFooter />
  </div>
);
```

### Naming Conventions

- **Components**: PascalCase (`HeroSection`, `SiteHeader`)
- **Hooks**: camelCase prefixed with `use` (`useIsMobile`, `useToast`)
- **Utilities/functions**: camelCase (`cn`, `fadeUp`, `fadeUpAnimate`)
- **Local data arrays**: camelCase (`metrics`, `vehicles`, `advantages`)
- **CSS classes/IDs**: kebab-case (`glass-card`, `section-container`)

### Import Alias

Use `@/` for all imports from `src/`:

```ts
import { cn } from "@/lib/utils";
import { fadeUpProps } from "@/lib/motion";
import { Button } from "@/components/ui/button";
```

### TypeScript

- Non-strict mode: `strictNullChecks: false`, `noImplicitAny: false`
- `skipLibCheck: true`
- Prefer interfaces for prop types
- Use `satisfies` for type validation without explicit annotations where helpful

---

## Animation System

All animations use utilities from `src/lib/motion.ts`.

**Props-spread helpers** (pass all motion props via spread — use these for standalone animated elements):

```ts
// Scroll-triggered (fires when element enters viewport)
<motion.div {...fadeUpProps(delay)}>

// Mount animation (fires immediately on render)
<motion.div {...fadeUpAnimateProps(delay)}>
```

**Variants objects** (use with a parent `staggerContainer` for staggered children):

```tsx
<motion.div variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true }}>
  <motion.p variants={fadeUp}>...</motion.p>
  <motion.h2 variants={fadeUp}>...</motion.h2>
</motion.div>
```

Both helpers accept an optional `delay` (seconds). The easing curve is `[0.16, 1, 0.3, 1]` throughout the app — do not change this for consistency.

Scroll-triggered animations use `viewport: { once: true, margin: "-60px" }` — they fire once and don't repeat.

---

## Styling System

### Tailwind Configuration

- **Dark mode**: `class` strategy (toggle `.dark` on `<html>`)
- **Fonts**: `Inter` (sans-serif body), `Instrument Serif` (serif headings), `IBM Plex Mono` (data/numbers)
- **Custom color**: `gold` (`hsl(43 72% 52%)`) — used for accents, borders, highlights

### CSS Variables (`src/index.css`)

Core palette colors are HSL CSS variables. Key ones include:
- `--background`: dark blue-gray `220 20% 4%`
- `--foreground`: near-white `210 40% 96%`
- `--primary` / `--primary-foreground`
- `--gold`: `43 72% 52%` (golden accent)
- `--surface`: slightly lighter than background
- Glass/shadow tokens (e.g., `--glass-bg`, `--glass-border`, `--shadow-card`) use `rgba(...)` for alpha-blended effects.
### Utility Classes

Defined in `src/index.css` — use these instead of repeating utility combinations:

| Class | Purpose |
|---|---|
| `.section-container` | Max-width wrapper with responsive horizontal padding |
| `.glass-card` | Dark frosted-glass card with blur and border |
| `.glass-card-gold` | Glass card with gold border variant |
| `.data-mono` | Monospace font with tabular numbers for metrics |
| `.text-gold-gradient` | Golden gradient text effect |
| `.ticker-scroll` | Infinite horizontal scroll animation |

---

## Testing

### Unit Tests (Vitest)

- Test files: `src/**/*.{test,spec}.{ts,tsx}`
- Environment: jsdom (DOM simulation)
- Globals: `describe`, `it`, `expect`, `beforeEach`, etc. available without imports
- Setup: `src/test/setup.ts` — mocks `window.matchMedia`

Write tests alongside source files or in `src/test/`:

```ts
import { render, screen } from "@testing-library/react";
import MyComponent from "@/components/MyComponent";

describe("MyComponent", () => {
  it("renders expected content", () => {
    render(<MyComponent />);
    expect(screen.getByText("Expected text")).toBeInTheDocument();
  });
});
```

### E2E Tests (Playwright)

- Config: `playwright.config.ts` (extends Lovable's base config)
- Import test fixture from `lovable-agent-playwright-config`

---

## Key Files Reference

| File | Purpose |
|---|---|
| `src/App.tsx` | Root — sets up Router, QueryClientProvider, TooltipProvider, shadcn Toaster, and Sonner toaster |
| `src/pages/Index.tsx` | Main page — assembles all sections |
| `src/index.css` | Global styles, CSS custom properties, utility classes |
| `src/lib/utils.ts` | `cn()` — Tailwind class merging helper |
| `src/lib/motion.ts` | `fadeUpProps()`, `fadeUpAnimateProps()` — scroll/mount animation prop helpers; `fadeUp`, `staggerContainer` — Variants objects for staggered animations |
| `src/hooks/use-mobile.tsx` | `useIsMobile()` — responsive breakpoint hook |
| `tailwind.config.ts` | Theme tokens, custom colors, fonts, animations |
| `vite.config.ts` | Build config: port 8080, `@` alias, SWC, lovable-tagger |
| `components.json` | shadcn/ui CLI config (path aliases, style settings) |

---

## shadcn/ui Components

All UI primitives live in `src/components/ui/`. These are **generated files** — do not hand-edit them unless necessary. To add new shadcn components, use the CLI:

```bash
npx shadcn@latest add <component-name>
```

Existing components include: Button, Card, Dialog, Form, Input, Select, Tabs, Table, Toast, Tooltip, Badge, Separator, Sheet, Accordion, and many more.

---

## Git Workflow

- **Commit style**: Short imperative phrases, present tense. Examples:
  - `Reduce funding target under 500K`
  - `Implement investorSite groundwork`
  - `Add fleet section with vehicle table`
- **Main branch**: `main`
- **Feature branches**: Descriptive names off `main`

---

## Mandatory Testing & Quality Rules

**CRITICAL: These rules MUST be followed for every change.**

### Always Write Tests
- Every new component MUST have a corresponding test file in `__tests__/` next to the source
- Every new hook MUST have tests in `src/hooks/__tests__/`
- Every new utility function MUST have tests in `src/lib/__tests__/`
- Every new page MUST have tests in `src/pages/__tests__/`
- Test files follow the pattern: `ComponentName.test.tsx` or `hook-name.test.ts`
- Use `renderWithProviders` from `src/test/test-utils.tsx` for components needing providers
- Mock Framer Motion using the Proxy pattern established in existing tests
- Mock Recharts components when testing chart sections

### Always Verify Linting
- Run `npm run lint` after making changes — zero new errors allowed
- If adding new code patterns, consider whether new ESLint rules should be added to `eslint.config.js`
- Test any new ESLint rules by adding test cases to `src/test/eslint-rules.test.ts`

### Always Verify Build
- Run `npm run build` to confirm production build succeeds
- If changing build configuration, update tests in `src/test/build-config.test.ts`
- If changing CI workflows, update tests in `src/test/ci-pipeline.test.ts`

### CI Pipeline Tests
- Any new GitHub Actions workflow MUST have corresponding tests in `src/test/`
- Any modification to `.github/workflows/ci.yml` MUST be reflected in `src/test/ci-pipeline.test.ts`

### Test Execution Checklist
Before finishing any task, run:
1. `npm test` — all unit tests pass
2. `npm run lint` — no new lint errors
3. `npm run typecheck` — no type errors

---

## GitHub Copilot Integration

This repository uses GitHub Copilot for automated code review and issue resolution via an event-driven recursive loop.

### Autonomous Review ➔ Fix Loop (`.github/workflows/copilot-recursive-loop.yml`)
- **Phase 1 (call-reviewer)**: On PR open or new commit push, requests Copilot as code reviewer
- **Phase 2 (evaluate-and-fix)**: When Copilot submits a non-approved review, the workflow:
  1. Checks a **circuit breaker** (MAX_LOOPS=100) to prevent infinite loops
  2. Analyzes the review for line comments or requested changes
  3. Updates the PR body with a `<!-- copilot-tasks-start -->` section listing all unresolved comments
  4. Assigns `@copilot` directly to the PR to trigger the SWE Agent
- **Recursion**: The SWE Agent fixes code and pushes a commit → triggers Phase 1 again → loop continues until clean or limit reached
- Every review comment must include a `suggestion` block with a fix (no advisory-only comments)
- Configured via `.github/copilot-instructions.md`

### Human Review Auto-Fix
- `codex-review.yml` — processes human review comments via OpenAI Codex CLI
- `claude-pr-autofix.yml` — processes free-text review comments via Claude API (runs after the recursive loop completes)

### Copilot SWE Agent
- Configured via `.github/copilot-setup-steps.yml`
- Assign issues to `@copilot` to trigger automated fixes
- Agent runs in a pre-configured environment with Node 20, npm, lint, and tests

### Required Secrets
- **`COPILOT_PAT`** — Fine-grained PAT with Read & Write access to Pull Requests, Issues, and Contents (required because `GITHUB_TOKEN` cannot wake native bots)

### Setup
See `.github/COPILOT_SETUP.md` for instructions on enabling these features.

---

## OpenAI Codex CI Integration

OpenAI Codex runs via a dedicated `codex-review` workflow (`.github/workflows/codex-review.yml`) rather than as a job in `ci.yml`.

### How It Works
- Trigger: `pull_request_review` (runs when a human submits a review on a pull request)
- Operates as a separate workflow from `ci.yml` — runs independently of the main CI pipeline
- Uses `@openai/codex` CLI via `codex exec --dangerously-bypass-approvals-and-sandbox` to review and fix issues on the PR branch
- The `codex-review` job does **not** use `continue-on-error: true`, so missing or invalid Codex credentials (or CLI failures) will cause the workflow to fail and surface clearly in the PR checks

### Required Secret
Add `CODEX_API_KEY` to your repository secrets:
1. Go to **Repository Settings** > **Secrets and variables** > **Actions**
2. Click **New repository secret**
3. Name: `CODEX_API_KEY`, Value: your Codex API key

---

## Automatic Test Generation

Every fix applied by Copilot, Codex, or any bot automatically triggers test generation.

### How It Works
1. Bot applies a fix (Copilot suggestion, Codex auto-fix, etc.)
2. `.github/workflows/auto-test-generation.yml` triggers on the bot's commit
3. Workflow detects which source files were changed but lack test files
4. Codex generates comprehensive test suites for each file missing tests
5. Generated tests are committed automatically to the branch

### Test Stub Script
`.github/scripts/generate-test-stubs.sh` creates basic test scaffolding:
- TSX files get React component tests with `@testing-library/react`
- TS files get module export tests
- All stubs use the `__tests__/` directory convention and `@/` import alias

---

## Workflow Self-Healing

The CI system is self-healing — failed workflows are automatically diagnosed and fixed.

### Auto-Fix Failed Workflows
- `.github/workflows/workflow-autofix.yml` triggers when any workflow fails
- Uses Codex CLI to read error logs, diagnose the issue, and apply fixes
- Commits fixes automatically to the branch

### Auto-Generate Workflow Tests
- `.github/workflows/workflow-test-runner.yml` triggers when workflow files change
- Runs `.github/scripts/generate-workflow-tests.sh` to create tests for new workflows
- Every workflow gets a Vitest test file validating its structure
- Generated tests check: file existence, triggers, jobs, runner, checkout action

---

## Security Autofix

Security vulnerabilities are automatically detected and fixed.

### CI Security Job
- The `security` job in CI now auto-fixes npm audit vulnerabilities inline
- Runs `npm audit fix` and `npm audit fix --force` when vulnerabilities are detected
- Commits fixes automatically, then re-runs the audit to verify

### Security Autofix Workflow (`.github/workflows/security-autofix.yml`)
- Triggers when CI or CodeQL workflows fail, plus daily at 7 AM UTC
- **npm audit fixes**: Runs `npm audit fix` to update vulnerable dependencies
- **CodeQL fixes**: Fetches open CodeQL alerts, uses Codex CLI to fix code vulnerabilities
- All fixes are verified (lint, typecheck, test) before committing
