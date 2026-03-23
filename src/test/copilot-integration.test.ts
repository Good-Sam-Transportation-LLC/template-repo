/**
 * Copilot Integration Validation Tests
 *
 * These tests verify that the GitHub Copilot configuration files are
 * correctly set up with proper code review instructions, SWE agent
 * setup steps, and documentation.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parse } from "yaml";

const ROOT = path.resolve(import.meta.dirname, "../..");
const readText = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf-8");

// ---------------------------------------------------------------------------
// Group 1: Copilot Code Review Instructions
// ---------------------------------------------------------------------------
describe("Copilot code review instructions", () => {
  it("Copilot instructions file exists at .github/copilot-instructions.md", () => {
    expect(fs.existsSync(path.join(ROOT, ".github/copilot-instructions.md"))).toBe(true);
  });

  it("Copilot instructions cover security review", () => {
    const content = readText(".github/copilot-instructions.md");
    expect(content).toContain("Security");
  });

  it("Copilot instructions cover accessibility review", () => {
    const content = readText(".github/copilot-instructions.md");
    expect(content).toContain("Accessibility");
  });

  it("Copilot instructions require tests for new code", () => {
    const content = readText(".github/copilot-instructions.md");
    expect(content).toMatch(/test/i);
  });

  it("Copilot instructions require always attempting to fix issues", () => {
    const content = readText(".github/copilot-instructions.md");
    expect(content.toLowerCase()).toContain("always attempt to fix");
  });

  it("Copilot instructions mention suggestion blocks", () => {
    const content = readText(".github/copilot-instructions.md");
    expect(content).toContain("suggestion");
  });

  it("Copilot instructions enforce autonomous operation", () => {
    const content = readText(".github/copilot-instructions.md");
    expect(content.toLowerCase()).toContain("autonomous");
  });

  it("Copilot instructions prohibit advisory-only comments", () => {
    const content = readText(".github/copilot-instructions.md");
    expect(content.toLowerCase()).toContain("no advisory-only comments");
  });

  it("Copilot instructions include PR-Triggered Work section", () => {
    const content = readText(".github/copilot-instructions.md");
    expect(content).toContain("PR-Triggered Work");
    expect(content).toContain("copilot-tasks-start");
  });
});

// ---------------------------------------------------------------------------
// Group 2: Copilot SWE Agent Setup
// ---------------------------------------------------------------------------
describe("Copilot SWE agent setup", () => {
  it("Copilot setup steps file exists at .github/copilot-setup-steps.yml", () => {
    expect(fs.existsSync(path.join(ROOT, ".github/copilot-setup-steps.yml"))).toBe(true);
  });

  it("setup steps define a copilot-setup-steps job", () => {
    const content = readText(".github/copilot-setup-steps.yml");
    const parsed = parse(content);
    expect(parsed.jobs["copilot-setup-steps"]).toBeDefined();
  });

  it("setup steps job runs on ubuntu-latest", () => {
    const content = readText(".github/copilot-setup-steps.yml");
    const parsed = parse(content);
    expect(parsed.jobs["copilot-setup-steps"]["runs-on"]).toBe("ubuntu-latest");
  });

  it("setup steps use Node 20", () => {
    const content = readText(".github/copilot-setup-steps.yml");
    const parsed = parse(content);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const steps = parsed.jobs["copilot-setup-steps"].steps as any[];
    const setupNodeStep = steps.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => typeof s.uses === "string" && s.uses.startsWith("actions/setup-node"),
    );
    expect(setupNodeStep).toBeDefined();
    expect(setupNodeStep.with["node-version"]).toBe(20);
  });

  it("setup steps install dependencies with npm ci", () => {
    const content = readText(".github/copilot-setup-steps.yml");
    const parsed = parse(content);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const steps = parsed.jobs["copilot-setup-steps"].steps as any[];
    const npmCiStep = steps.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => typeof s.run === "string" && s.run.includes("npm ci"),
    );
    expect(npmCiStep).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Group 3: Copilot Documentation
// ---------------------------------------------------------------------------
describe("Copilot documentation", () => {
  it("Copilot setup guide exists at .github/COPILOT_SETUP.md", () => {
    expect(fs.existsSync(path.join(ROOT, ".github/COPILOT_SETUP.md"))).toBe(true);
  });

  it("setup guide documents code review configuration", () => {
    const content = readText(".github/COPILOT_SETUP.md");
    expect(content).toMatch(/code review/i);
  });

  it("setup guide documents SWE agent configuration", () => {
    const content = readText(".github/COPILOT_SETUP.md");
    expect(content).toMatch(/coding agent|SWE agent/i);
  });

  it("setup guide documents autofix behavior", () => {
    const content = readText(".github/COPILOT_SETUP.md");
    expect(content.toLowerCase()).toContain("autofix");
  });
});

// ---------------------------------------------------------------------------
// Group 4: Copilot Recursive Loop Workflow
// ---------------------------------------------------------------------------
describe("Copilot recursive loop workflow", () => {
  it("copilot-recursive-loop.yml workflow exists", () => {
    expect(fs.existsSync(path.join(ROOT, ".github/workflows/copilot-recursive-loop.yml"))).toBe(true);
  });

  it("recursive loop workflow triggers on pull_request and pull_request_review (ping-pong)", () => {
    const content = readText(".github/workflows/copilot-recursive-loop.yml");
    const parsed = parse(content);
    expect(parsed.on).toHaveProperty("pull_request");
    expect(parsed.on).toHaveProperty("pull_request_review");
  });

  it("recursive loop workflow has three active jobs: call-reviewer, debug-review-event, and evaluate-and-fix", () => {
    const content = readText(".github/workflows/copilot-recursive-loop.yml");
    const parsed = parse(content);
    expect(parsed.jobs).toHaveProperty("call-reviewer");
    expect(parsed.jobs).toHaveProperty("debug-review-event");
    expect(parsed.jobs).toHaveProperty("evaluate-and-fix");
    // auto-merge-sub-pr is commented out (handled by sub-pr-auto-merge.yml)
    expect(parsed.jobs).not.toHaveProperty("auto-merge-sub-pr");
    expect(Object.keys(parsed.jobs)).toHaveLength(3);
  });

  it("evaluate-and-fix job handles Copilot reviewer reviews", () => {
    const content = readText(".github/workflows/copilot-recursive-loop.yml");
    expect(content).toContain("review.user.login == 'Copilot'");
  });

  it("recursive loop workflow has pull-requests write permission", () => {
    const content = readText(".github/workflows/copilot-recursive-loop.yml");
    const parsed = parse(content);
    expect(parsed.permissions["pull-requests"]).toBe("write");
  });

  it("recursive loop workflow has contents read permission", () => {
    const content = readText(".github/workflows/copilot-recursive-loop.yml");
    const parsed = parse(content);
    expect(parsed.permissions.contents).toBe("read");
  });

  it("recursive loop workflow uses COPILOT_PAT for SWE agent trigger", () => {
    const content = readText(".github/workflows/copilot-recursive-loop.yml");
    expect(content).toContain("COPILOT_PAT");
  });

  it("recursive loop workflow has circuit breaker with MAX_LOOPS", () => {
    const content = readText(".github/workflows/copilot-recursive-loop.yml");
    expect(content).toContain("MAX_LOOPS");
  });

  it("recursive loop workflow mentions @copilot via createComment to trigger SWE agent", () => {
    const content = readText(".github/workflows/copilot-recursive-loop.yml");
    expect(content).toContain("@copilot");
    expect(content).toContain("issues.createComment");
    expect(content).toContain("Debug");
  });

  it("recursive loop workflow updates PR body with task section", () => {
    const content = readText(".github/workflows/copilot-recursive-loop.yml");
    expect(content).toContain("copilot-tasks-start");
    expect(content).toContain("copilot-tasks-end");
    expect(content).toContain("pulls.update");
  });

  it("recursive loop workflow includes review URL in @copilot comment", () => {
    const content = readText(".github/workflows/copilot-recursive-loop.yml");
    expect(content).toContain("REVIEW_URL");
    expect(content).toContain("review.html_url");
  });

  it("recursive loop workflow does not use [bot] suffix in reviewer request calls", () => {
    const content = readText(".github/workflows/copilot-recursive-loop.yml");
    const lines = content.split('\n');
    const reviewerLines = lines.filter(l => l.includes('--add-reviewer') || l.includes('--remove-reviewer'));
    for (const line of reviewerLines) {
      expect(line).not.toContain('[bot]');
    }
  });

  it("recursive loop workflow uses gh pr edit --add-reviewer @copilot", () => {
    const content = readText(".github/workflows/copilot-recursive-loop.yml");
    expect(content).toContain("--add-reviewer @copilot");
  });

  it("recursive loop workflow preserves circuit breaker magic phrase", () => {
    const content = readText(".github/workflows/copilot-recursive-loop.yml");
    expect(content).toContain("The Copilot Code Reviewer found issues");
  });

  it("recursive loop has both event-driven and polling paths that process reviews", () => {
    const content = readText(".github/workflows/copilot-recursive-loop.yml");
    // No SWE guard needed — hybrid approach with dedup
    expect(content).not.toContain("swe-guard");
    // Event-driven path via pull_request_review trigger
    const parsed = parse(content);
    expect(parsed.on).toHaveProperty("pull_request_review");
    // Polling fallback detects AND processes reviews
    expect(content).toContain("polling fallback");
    expect(content).toContain("polling path");
  });

  it("only evaluate-and-fix mentions @copilot (no duplicate from call-reviewer)", () => {
    const content = readText(".github/workflows/copilot-recursive-loop.yml");
    const parsed = parse(content);

    // evaluate-and-fix mentions @copilot via createComment inside github-script
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evalJob = parsed.jobs["evaluate-and-fix"] as Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collectStep = evalJob.steps.find((s: any) =>
      String(s.name || "").includes("Collect unresolved comments"),
    );
    expect(collectStep).toBeDefined();
    expect(collectStep.with.script).toContain("issues.createComment");
    expect(collectStep.with.script).toContain("@copilot");

    // call-reviewer does NOT assign or mention @copilot (SWE agent only triggered after review)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const crJob = parsed.jobs["call-reviewer"] as Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestStep = crJob.steps.find((s: any) =>
      s.name === "Request Copilot Code Review",
    );
    expect(requestStep.run).not.toContain("--add-assignee @copilot");
  });
});

// ---------------------------------------------------------------------------
// Group 5: Auto Test Generation
// ---------------------------------------------------------------------------
describe("Auto test generation", () => {
  it("auto-test-generation.yml workflow exists", () => {
    expect(fs.existsSync(path.join(ROOT, ".github/workflows/auto-test-generation.yml"))).toBe(true);
  });

  it("auto-test-generation workflow triggers on push", () => {
    const content = readText(".github/workflows/auto-test-generation.yml");
    const parsed = parse(content);
    expect(parsed.on).toHaveProperty("push");
  });

  it("auto-test-generation workflow detects bot commits", () => {
    const content = readText(".github/workflows/auto-test-generation.yml");
    expect(content).toContain("copilot");
    expect(content).toContain("codex");
  });

  it("auto-test-generation workflow has write permissions", () => {
    const content = readText(".github/workflows/auto-test-generation.yml");
    const parsed = parse(content);
    expect(parsed.permissions.contents).toBe("write");
  });

  it("auto-test-generation workflow uses Codex for test generation", () => {
    const content = readText(".github/workflows/auto-test-generation.yml");
    expect(content).toContain("@openai/codex");
  });

  it("auto-test-generation workflow commits generated tests", () => {
    const content = readText(".github/workflows/auto-test-generation.yml");
    expect(content).toContain("git commit");
    expect(content).toContain("Auto-generate test suite");
  });

  it("generate-test-stubs.sh script exists", () => {
    expect(fs.existsSync(path.join(ROOT, ".github/scripts/generate-test-stubs.sh"))).toBe(true);
  });

  it("generate-test-stubs script is a bash script", () => {
    const content = readText(".github/scripts/generate-test-stubs.sh");
    expect(content.startsWith("#!/usr/bin/env bash")).toBe(true);
  });

  it("generate-test-stubs script uses __tests__ convention", () => {
    const content = readText(".github/scripts/generate-test-stubs.sh");
    expect(content).toContain("__tests__");
  });

  it("generate-test-stubs script skips shadcn/ui components", () => {
    const content = readText(".github/scripts/generate-test-stubs.sh");
    expect(content).toContain("src/components/ui/*");
  });

  it("generate-test-stubs script generates TSX tests for components", () => {
    const content = readText(".github/scripts/generate-test-stubs.sh");
    expect(content).toContain("@testing-library/react");
  });

  it("generate-test-stubs script uses @/ import alias", () => {
    const content = readText(".github/scripts/generate-test-stubs.sh");
    expect(content).toContain('@/');
  });
});

// ---------------------------------------------------------------------------
// Group 6: Workflow Self-Healing
// ---------------------------------------------------------------------------
describe("Workflow self-healing", () => {
  it("workflow-autofix.yml exists", () => {
    expect(fs.existsSync(path.join(ROOT, ".github/workflows/workflow-autofix.yml"))).toBe(true);
  });

  it("workflow-autofix triggers on workflow_run completion", () => {
    const content = readText(".github/workflows/workflow-autofix.yml");
    const parsed = parse(content);
    expect(parsed.on).toHaveProperty("workflow_run");
  });

  it("workflow-autofix only runs on failure", () => {
    const content = readText(".github/workflows/workflow-autofix.yml");
    expect(content).toContain("failure");
  });

  it("workflow-autofix uses Codex to diagnose and fix", () => {
    const content = readText(".github/workflows/workflow-autofix.yml");
    expect(content).toContain("@openai/codex");
  });

  it("workflow-autofix commits fixes automatically", () => {
    const content = readText(".github/workflows/workflow-autofix.yml");
    expect(content).toContain("git commit");
    expect(content).toContain("Auto-fix");
  });

  it("workflow-test-runner.yml exists", () => {
    expect(fs.existsSync(path.join(ROOT, ".github/workflows/workflow-test-runner.yml"))).toBe(true);
  });

  it("workflow-test-runner triggers on workflow file changes", () => {
    const content = readText(".github/workflows/workflow-test-runner.yml");
    expect(content).toContain(".github/workflows/*.yml");
  });

  it("workflow-test-runner runs generate-workflow-tests.sh", () => {
    const content = readText(".github/workflows/workflow-test-runner.yml");
    expect(content).toContain("generate-workflow-tests.sh");
  });

  it("workflow-test-runner commits generated tests", () => {
    const content = readText(".github/workflows/workflow-test-runner.yml");
    expect(content).toContain("git commit");
  });

  it("generate-workflow-tests.sh script exists", () => {
    expect(fs.existsSync(path.join(ROOT, ".github/scripts/generate-workflow-tests.sh"))).toBe(true);
  });

  it("generate-workflow-tests script is a bash script", () => {
    const content = readText(".github/scripts/generate-workflow-tests.sh");
    expect(content.startsWith("#!/usr/bin/env bash")).toBe(true);
  });

  it("generate-workflow-tests script creates test files", () => {
    const content = readText(".github/scripts/generate-workflow-tests.sh");
    expect(content).toContain("GENERATED");
    expect(content).toContain(".test.ts");
  });
});

// ---------------------------------------------------------------------------
// Group 7: Codex Review Workflow — No Copilot Automation
// ---------------------------------------------------------------------------
describe("Codex review workflow has no Copilot automation", () => {
  it("codex-review workflow does not assign copilot to PR", () => {
    const content = readText(".github/workflows/codex-review.yml");
    expect(content).not.toContain("addAssignees");
    expect(content).not.toContain("removeAssignees");
    expect(content).not.toContain("ASSIGNEE_NAMES");
  });

  it("codex-review workflow explicitly excludes copilot reviews", () => {
    const content = readText(".github/workflows/codex-review.yml");
    expect(content).toContain("!contains(github.event.review.user.login, 'copilot')");
  });
});

// ---------------------------------------------------------------------------
// Group 8: Cross-workflow consistency for PR-based SWE agent triggering
// ---------------------------------------------------------------------------
describe("Cross-workflow SWE agent triggering consistency", () => {
  const loopContent = () => readText(".github/workflows/copilot-recursive-loop.yml");
  const codexContent = () => readText(".github/workflows/codex-review.yml");

  it("recursive loop workflow updates PR body with copilot-tasks section", () => {
    const content = loopContent();
    expect(content).toContain("copilot-tasks-start");
    expect(content).toContain("copilot-tasks-end");
    expect(content).toContain("pulls.update");
  });

  it("both workflows use COPILOT_PAT", () => {
    for (const content of [loopContent(), codexContent()]) {
      expect(content).toContain("COPILOT_PAT");
    }
  });

  it("recursive loop workflow preserves circuit breaker magic phrase", () => {
    expect(loopContent()).toContain("The Copilot Code Reviewer found issues");
  });

  it("codex-review workflow does not use assignment-based SWE triggering", () => {
    const content = codexContent();
    expect(content).not.toContain("addAssignees");
    expect(content).not.toContain("removeAssignees");
  });

  it("recursive loop workflow uses comment-based SWE triggering", () => {
    const content = loopContent();
    expect(content).toContain("@copilot");
    expect(content).toContain("gh pr comment");
  });
});
