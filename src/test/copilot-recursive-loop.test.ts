/**
 * Copilot Recursive Loop Workflow Tests
 *
 * Validates the structure and configuration of
 * .github/workflows/copilot-recursive-loop.yml — the event-driven
 * "ping-pong" architecture: Request Review ➔ Evaluate ➔ Fix ➔ repeat.
 */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { parse } from "yaml";

const ROOT = path.resolve(import.meta.dirname, "../..");
const WORKFLOW_PATH = path.join(
  ROOT,
  ".github/workflows/copilot-recursive-loop.yml",
);
const readText = (p: string) => fs.readFileSync(p, "utf-8");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let workflow: Record<string, any> = {};

beforeAll(() => {
  if (fs.existsSync(WORKFLOW_PATH)) {
    workflow = parse(readText(WORKFLOW_PATH)) as Record<string, any>;
  }
});

// ---------------------------------------------------------------------------
// Group 1: File existence and metadata
// ---------------------------------------------------------------------------
describe("Copilot recursive loop workflow file structure", () => {
  it("workflow file exists", () => {
    expect(fs.existsSync(WORKFLOW_PATH)).toBe(true);
  });

  it('is named "Autonomous AI Loop: Review ➔ Fix"', () => {
    expect(workflow.name).toBe("Autonomous AI Loop: Review ➔ Fix");
  });
});

// ---------------------------------------------------------------------------
// Group 2: Triggers
// ---------------------------------------------------------------------------
describe("Copilot recursive loop triggers", () => {
  it("triggers on pull_request opened, synchronize, and reopened", () => {
    expect(workflow.on).toHaveProperty("pull_request");
    const types = workflow.on.pull_request.types;
    expect(types).toContain("opened");
    expect(types).toContain("synchronize");
    expect(types).toContain("reopened");
  });

  it("triggers on pull_request_review submitted (event-driven ping-pong)", () => {
    expect(workflow.on).toHaveProperty("pull_request_review");
    expect(workflow.on.pull_request_review.types).toContain("submitted");
  });

  it("does not use workflow_dispatch or workflow_run triggers", () => {
    expect(workflow.on).not.toHaveProperty("workflow_dispatch");
    expect(workflow.on).not.toHaveProperty("workflow_run");
  });
});

// ---------------------------------------------------------------------------
// Group 3: Permissions
// ---------------------------------------------------------------------------
describe("Copilot recursive loop permissions", () => {
  it("has contents: write permission", () => {
    expect(workflow.permissions.contents).toBe("write");
  });

  it("has pull-requests: write permission", () => {
    expect(workflow.permissions["pull-requests"]).toBe("write");
  });

  it("has issues: write permission", () => {
    expect(workflow.permissions.issues).toBe("write");
  });
});

// ---------------------------------------------------------------------------
// Group 4: Job structure — three jobs (ping-pong + debug)
// ---------------------------------------------------------------------------
describe("Copilot recursive loop jobs", () => {
  it("defines three active jobs: call-reviewer, debug-review-event, and evaluate-and-fix", () => {
    const jobIds = Object.keys(workflow.jobs);
    expect(jobIds).toContain("call-reviewer");
    expect(jobIds).toContain("debug-review-event");
    expect(jobIds).toContain("evaluate-and-fix");
    // auto-merge-sub-pr is commented out (handled by sub-pr-auto-merge.yml)
    expect(jobIds).not.toContain("auto-merge-sub-pr");
    expect(jobIds).toHaveLength(3);
  });

  it("both jobs run on ubuntu-latest", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((workflow.jobs["call-reviewer"] as any)["runs-on"]).toBe("ubuntu-latest");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((workflow.jobs["evaluate-and-fix"] as any)["runs-on"]).toBe("ubuntu-latest");
  });

  it("call-reviewer has concurrency group per PR", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const job = workflow.jobs["call-reviewer"] as any;
    expect(job.concurrency).toBeDefined();
    expect(String(job.concurrency.group)).toContain("pull_request.number");
  });

  it("evaluate-and-fix has concurrency group per PR", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const job = workflow.jobs["evaluate-and-fix"] as any;
    expect(job.concurrency).toBeDefined();
    expect(String(job.concurrency.group)).toContain("pull_request.number");
  });
});

// ---------------------------------------------------------------------------
// Group 4b: debug-review-event job — gate condition logging
// ---------------------------------------------------------------------------
describe("debug-review-event job — gate condition logging", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getJob = () => workflow.jobs["debug-review-event"] as Record<string, any>;

  it("job exists and runs on ubuntu-latest", () => {
    expect(getJob()).toBeDefined();
    expect(getJob()["runs-on"]).toBe("ubuntu-latest");
  });

  it("runs on all pull_request_review events (diagnostic job)", () => {
    const condition = String(getJob().if);
    expect(condition).toContain("pull_request_review");
    // Debug job should not filter sub-PRs — it logs on all review events
    expect(condition).not.toContain("copilot[bot]");
  });

  it("logs all six evaluate-and-fix gate conditions", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) => s.name === "Log evaluate-and-fix gate conditions");
    expect(step).toBeDefined();
    expect(step.run).toContain("event_name");
    expect(step.run).toContain("head.repo.full_name");
    expect(step.run).toContain("review.user.login");
    expect(step.run).toContain("review.state");
    expect(step.run).toContain("review.commit_id");
    expect(step.run).toContain("pull_request.head.sha");
    expect(step.run).toContain("Is sub-PR");
  });

  it("emits a warning annotation when evaluate-and-fix will be skipped", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) => s.name === "Log evaluate-and-fix gate conditions");
    expect(step.run).toContain("::warning::");
    expect(step.run).toContain("SKIPPED");
  });
});

// ---------------------------------------------------------------------------
// Group 5: call-reviewer job — Phase 1 (request review)
// ---------------------------------------------------------------------------
describe("call-reviewer job — request review", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getJob = () => workflow.jobs["call-reviewer"] as Record<string, any>;

  it("runs only on pull_request events", () => {
    const condition = String(getJob().if);
    expect(condition).toContain("pull_request");
  });

  it("skips fork PRs", () => {
    expect(String(getJob().if)).toContain("head.repo.full_name");
  });

  it("detects sub-PRs by checking for a parent PR via API", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const steps = getJob().steps as any[];
    const checkStep = steps.find((s: any) =>
      String(s.name).includes("Check if this PR is a sub-PR"),
    );
    expect(checkStep).toBeDefined();
    // Uses gh pr list --head to find parent PR
    expect(checkStep.run).toContain("gh pr list");
    expect(checkStep.run).toContain("--head");
    expect(checkStep.run).toContain("is_sub_pr");
    // Must be the second step (after COPILOT_PAT validation)
    expect(steps[1].name).toContain("Check if this PR is a sub-PR");
  });

  it("gates all review steps on is_sub_pr == false", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const steps = getJob().steps as any[];
    // All steps after the sub-PR check should be gated
    const gatedSteps = steps.filter((s: any) =>
      String(s.if || "").includes("is_sub_pr"),
    );
    expect(gatedSteps.length).toBeGreaterThanOrEqual(4);
  });

  it("no longer uses copilot[bot] login in job condition", () => {
    const condition = String(getJob().if);
    expect(condition).not.toContain("copilot[bot]");
  });

  it("marks draft PRs as ready for review before requesting", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Mark draft PR as ready"),
    );
    expect(step).toBeDefined();
    expect(step.run).toContain("draft");
    expect(step.run).toContain("gh pr ready");
  });

  it("dismisses previous Copilot review before re-requesting", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Dismiss previous Copilot review"),
    );
    expect(step).toBeDefined();
    expect(step.run).toContain("dismissals");
    expect(step.run).toContain('"Copilot"');
  });

  it("dismiss step deletes COMMENTED reviews via DELETE endpoint", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Dismiss previous Copilot review"),
    );
    expect(step.run).toContain("COMMENTED");
    expect(step.run).toContain("--method DELETE");
    expect(step.run).toContain("cannot dismiss");
  });

  it("dismiss step handles all non-DISMISSED reviews", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Dismiss previous Copilot review"),
    );
    expect(step.run).toContain("DISMISSED");
    expect(step.run).toContain("CHANGES_REQUESTED");
    expect(step.run).toContain("APPROVED");
  });

  it("mark-ready step runs before dismiss and request steps", () => {
    const steps = getJob().steps;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const readyIdx = steps.findIndex((s: any) =>
      String(s.name).includes("Mark draft PR as ready"),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dismissIdx = steps.findIndex((s: any) =>
      String(s.name).includes("Dismiss previous Copilot review"),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestIdx = steps.findIndex((s: any) =>
      s.name === "Request Copilot Code Review",
    );
    expect(readyIdx).toBeGreaterThan(-1);
    expect(dismissIdx).toBeGreaterThan(readyIdx);
    expect(requestIdx).toBeGreaterThan(dismissIdx);
  });

  it("checks for pending Copilot SWE sub-PRs before requesting review", () => {
    const steps = getJob().steps;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checkStep = steps.find((s: any) => s.name === "Check for pending Copilot SWE sub-PR");
    expect(checkStep).toBeDefined();
    expect(checkStep.id).toBe("check-sub-pr");
    expect(checkStep.run).toContain("gh pr list");
    expect(checkStep.run).toContain("app/copilot");
    expect(checkStep.run).toContain("pending=true");
    expect(checkStep.run).toContain("pending=false");

    // Must come before the Request step
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checkIdx = steps.findIndex((s: any) => s.name === "Check for pending Copilot SWE sub-PR");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestIdx = steps.findIndex((s: any) => s.name === "Request Copilot Code Review");
    expect(checkIdx).toBeGreaterThan(-1);
    expect(requestIdx).toBeGreaterThan(checkIdx);
  });

  it("gates review request on sub-PR check", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestStep = getJob().steps.find((s: any) => s.name === "Request Copilot Code Review");
    expect(String(requestStep.if)).toContain("check-sub-pr");
    expect(String(requestStep.if)).toContain("false");
  });

  it("requests Copilot as reviewer via gh pr edit --add-reviewer", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) => s.name === "Request Copilot Code Review");
    expect(step).toBeDefined();
    expect(step.run).toContain("--add-reviewer");
    expect(step.run).toContain("@copilot");
  });

  it("does not assign Copilot as assignee (SWE agent triggered only in evaluate-and-fix)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) => s.name === "Request Copilot Code Review");
    expect(step.run).not.toContain("--add-assignee @copilot");
  });

  it("removes Codex reviewer and assignee when requesting Copilot review", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) => s.name === "Request Copilot Code Review");
    expect(step.run).toContain('test("codex"');
    expect(step.run).toContain("--remove-reviewer");
    expect(step.run).toContain("--remove-assignee");
  });

  it("verifies Copilot was added as reviewer and retries if not found", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) => s.name === "Request Copilot Code Review");
    expect(step.run).toContain("requested_reviewers");
    expect(step.run).toContain("retrying");
  });

  it("request step removes reviewer before re-requesting", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) => s.name === "Request Copilot Code Review");
    expect(step.run).toContain("--remove-reviewer");
    expect(step.run).toContain("@copilot");
  });

  it("request step uses gh pr edit (not the requested_reviewers REST API)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) => s.name === "Request Copilot Code Review");
    expect(step.run).toContain("gh pr edit");
    // The step should not POST to the requested_reviewers endpoint to add reviewers
    expect(step.run).not.toContain("--method POST");
    expect(step.run).not.toMatch(/gh api.*--method PUT.*requested_reviewers/);
  });

  it("request step does not use [bot] suffix in reviewer calls", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) => s.name === "Request Copilot Code Review");
    const lines = step.run.split('\n');
    const reviewerLines = lines.filter((l: string) => l.includes('--add-reviewer') || l.includes('--remove-reviewer'));
    for (const line of reviewerLines) {
      expect(line).not.toContain('[bot]');
    }
  });

  it("request step emits diagnostic errors when Copilot review cannot be requested", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) => s.name === "Request Copilot Code Review");
    expect(step.run).toContain("::error::");
    expect(step.run).toContain("Could not request Copilot code review");
  });

  it("uses COPILOT_PAT for all API calls", () => {
    const steps = getJob().steps;
    for (const step of steps) {
      if (step.env?.GH_TOKEN) {
        expect(String(step.env.GH_TOKEN)).toContain("COPILOT_PAT");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Group 5b: call-reviewer job — auto-resolve stale threads
// ---------------------------------------------------------------------------
describe("call-reviewer job — auto-resolve stale review threads", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getJob = () => workflow.jobs["call-reviewer"] as Record<string, any>;

  it("has an auto-resolve stale threads step", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Auto-resolve stale review threads"),
    );
    expect(step).toBeDefined();
  });

  it("auto-resolve step is guarded by is_sub_pr == false", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Auto-resolve stale review threads"),
    );
    expect(String(step.if)).toContain("is_sub_pr");
    expect(String(step.if)).toContain("false");
  });

  it("auto-resolve step uses resolveReviewThread GraphQL mutation", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Auto-resolve stale review threads"),
    );
    expect(step.with.script).toContain("resolveReviewThread");
  });

  it("auto-resolve step uses compare API to check diff", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Auto-resolve stale review threads"),
    );
    expect(step.with.script).toContain("compareCommitsWithBasehead");
  });

  it("auto-resolve step checks both line changes and suggestion matches", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Auto-resolve stale review threads"),
    );
    expect(step.with.script).toContain("linesChanged");
    expect(step.with.script).toContain("suggestionApplied");
  });

  it("auto-resolve step has full-file suggestion fallback for outdated threads", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Auto-resolve stale review threads"),
    );
    expect(step.with.script).toContain("suggestionAppliedFullFile");
    // Full-file fallback only activates for outdated threads
    expect(step.with.script).toContain("thread.isOutdated && suggestions");
  });

  it("auto-resolve step tracks changed files for outdated free-text resolution", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Auto-resolve stale review threads"),
    );
    expect(step.with.script).toContain("changedFiles");
    expect(step.with.script).toContain("fileChanged");
  });

  it("auto-resolve step has four resolution paths", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Auto-resolve stale review threads"),
    );
    const script = step.with.script;
    // Path 1: windowed suggestion match
    expect(script).toContain("suggestionApplied");
    // Path 2: outdated + lines changed
    expect(script).toContain("thread.isOutdated && linesChanged");
    // Path 3: outdated + full-file suggestion match
    expect(script).toContain("suggestionAppliedFullFile");
    // Path 4: outdated + free-text + file changed
    expect(script).toContain("!suggestions && fileChanged");
  });
});

// ---------------------------------------------------------------------------
// Group 6: evaluate-and-fix job — Phase 2 (analyze + fix)
// ---------------------------------------------------------------------------
describe("evaluate-and-fix job — review analysis and SWE trigger", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getJob = () => workflow.jobs["evaluate-and-fix"] as Record<string, any>;

  it("runs only on pull_request_review events from Copilot reviewer", () => {
    const condition = String(getJob().if);
    expect(condition).toContain("pull_request_review");
    expect(condition).toContain("Copilot");
  });

  it("detects sub-PRs by checking for a parent PR via API (not login match)", () => {
    // Job condition no longer uses copilot[bot] — sub-PR detection moved to step
    const condition = String(getJob().if);
    expect(condition).not.toContain("copilot[bot]");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const steps = getJob().steps as any[];
    const checkStep = steps.find((s: any) =>
      String(s.name).includes("Check if this PR is a sub-PR"),
    );
    expect(checkStep).toBeDefined();
    expect(checkStep.run).toContain("gh pr list");
    expect(checkStep.run).toContain("--head");
    expect(checkStep.run).toContain("is_sub_pr");
  });

  it("skips approved reviews (no action needed)", () => {
    const condition = String(getJob().if);
    expect(condition).toContain("approved");
  });

  it("has a circuit breaker step with MAX_LOOPS", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Circuit Breaker"),
    );
    expect(step).toBeDefined();
    expect(step.env.MAX_LOOPS).toBeDefined();
  });

  it("circuit breaker counts invocations via magic phrase in PR comments", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Circuit Breaker"),
    );
    expect(step.run).toContain("The Copilot Code Reviewer found issues");
    expect(step.run).toContain("INVOCATIONS");
  });

  it("circuit breaker stops and notifies when limit is reached", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Circuit Breaker"),
    );
    expect(step.run).toContain("Auto-fix loop stopped");
    expect(step.run).toContain("Human intervention");
  });

  it("has an analyze step that checks review comment count and state", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Analyze Review"),
    );
    expect(step).toBeDefined();
    expect(step.run).toContain("COMMENT_COUNT");
    expect(step.run).toContain("changes_requested");
    expect(step.run).toContain("REVIEW_BODY");
    expect(step.run).toContain("HAS_ACTIONABLE_BODY");
  });

  it("analyze step detects Copilot can't-review response", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Analyze Review"),
    );
    expect(step.run).toContain("wasn.t able to review");
    expect(step.run).toContain("unable to review");
  });

  it("analyze step filters out praise-only reviews", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Analyze Review"),
    );
    expect(step.run).toContain("great");
    expect(step.run).toContain("lgtm");
  });

  it("analyze step is gated on dedup guard and circuit breaker", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      s.name === "Analyze Review Comments",
    );
    expect(String(step.if)).toContain("loop-limit");
    expect(String(step.if)).toContain("dedup");
  });

  it("analyze step posts completion message when no issues found", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Analyze Review"),
    );
    expect(step.run).toContain("Auto-fix loop complete!");
    expect(step.run).toContain("has_issues=false");
  });

  it("analyze step logs diagnostic values for debugging", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Analyze Review"),
    );
    expect(step.run).toContain("REVIEW_BODY length");
    expect(step.run).toContain("BODY_CANON");
    expect(step.run).toContain("HAS_ACTIONABLE_BODY");
  });
});

// ---------------------------------------------------------------------------
// Group 7: evaluate-and-fix job — auto-resolve applied suggestions
// ---------------------------------------------------------------------------
describe("evaluate-and-fix job — auto-resolve applied suggestions", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getJob = () => workflow.jobs["evaluate-and-fix"] as Record<string, any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getResolveStep = () => getJob().steps.find((s: any) =>
    String(s.name).includes("Auto-resolve threads"),
  );

  it("has an auto-resolve step between analyze and collect steps", () => {
    const steps = getJob().steps;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolveIdx = steps.findIndex((s: any) =>
      String(s.name).includes("Auto-resolve threads"),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const analyzeIdx = steps.findIndex((s: any) =>
      String(s.name).includes("Analyze Review"),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collectIdx = steps.findIndex((s: any) =>
      String(s.name).includes("Collect unresolved comments"),
    );
    expect(resolveIdx).toBeGreaterThan(analyzeIdx);
    expect(resolveIdx).toBeLessThan(collectIdx);
  });

  it("uses actions/github-script@v7", () => {
    expect(getResolveStep().uses).toContain("actions/github-script");
  });

  it("uses COPILOT_PAT for authentication", () => {
    const step = getResolveStep();
    expect(String(step.env.GH_TOKEN)).toContain("COPILOT_PAT");
    expect(String(step.with["github-token"])).toContain("COPILOT_PAT");
  });

  it("is gated on circuit breaker and issues detected", () => {
    const cond = String(getResolveStep().if);
    expect(cond).toContain("loop-limit");
    expect(cond).toContain("analyze");
  });

  it("parses suggestion blocks from comment bodies via regex", () => {
    const script = getResolveStep().with.script;
    expect(script).toContain("suggestion");
    expect(script).toContain("suggestionRegex");
  });

  it("fetches file content via GitHub Contents API with caching", () => {
    const script = getResolveStep().with.script;
    expect(script).toContain("getContent");
    expect(script).toContain("fileCache");
  });

  it("uses resolveReviewThread GraphQL mutation", () => {
    expect(getResolveStep().with.script).toContain("resolveReviewThread");
  });

  it("skips threads without suggestion blocks (free-text only)", () => {
    const script = getResolveStep().with.script;
    expect(script).toContain("!suggestions");
    expect(script).toContain("continue");
  });

  it("paginates review threads using GraphQL cursor", () => {
    const script = getResolveStep().with.script;
    expect(script).toContain("hasNextPage");
    expect(script).toContain("endCursor");
  });

  it("searches entire file for suggestion text (not line-based)", () => {
    const script = getResolveStep().with.script;
    expect(script).toContain("normalizedFile.includes");
    expect(script).not.toContain("getLines(");
  });

  it("handles outdated comments where line numbers are null", () => {
    const script = getResolveStep().with.script;
    expect(script).toContain("outdated");
    expect(script).not.toContain("if (!startLine) continue");
  });

  it("logs detailed diagnostics for unmatched threads", () => {
    const script = getResolveStep().with.script;
    expect(script).toContain("NOT matched");
    expect(script).toContain("skippedNoSuggestion");
    expect(script).toContain("skippedNoFile");
  });
});

// ---------------------------------------------------------------------------
// Group 8: evaluate-and-fix job — collect comments and call SWE agent
// ---------------------------------------------------------------------------
describe("evaluate-and-fix job — collect comments and call SWE agent", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getJob = () => workflow.jobs["evaluate-and-fix"] as Record<string, any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getCollectStep = () => getJob().steps.find((s: any) =>
    String(s.name).includes("Collect unresolved comments"),
  );

  it("has a collect step that uses actions/github-script@v7", () => {
    const step = getCollectStep();
    expect(step).toBeDefined();
    expect(step.uses).toContain("actions/github-script");
  });

  it("uses COPILOT_PAT for authentication (required for @copilot mention)", () => {
    const step = getCollectStep();
    expect(String(step.env.GH_TOKEN)).toContain("COPILOT_PAT");
    expect(String(step.with["github-token"])).toContain("COPILOT_PAT");
  });

  it("is gated on circuit breaker and issues detected", () => {
    const cond = String(getCollectStep().if);
    expect(cond).toContain("loop-limit");
    expect(cond).toContain("analyze");
    expect(cond).toContain("has_issues");
  });

  it("paginates review threads using GraphQL cursor", () => {
    const script = getCollectStep().with.script;
    expect(script).toContain("hasNextPage");
    expect(script).toContain("endCursor");
    expect(script).toContain("pageInfo");
  });

  it("processes ALL comments in each thread, not just the first", () => {
    const script = getCollectStep().with.script;
    expect(script).toContain("for (const comment of thread.comments.nodes)");
  });

  it("fetches standalone review comments via REST API as fallback", () => {
    const script = getCollectStep().with.script;
    expect(script).toContain("listReviewComments");
    expect(script).toContain("paginate");
  });

  it("deduplicates comments across GraphQL and REST sources", () => {
    const script = getCollectStep().with.script;
    expect(script).toContain("processedIds");
    expect(script).toContain("threadCommentIds");
  });

  it("includes outdated threads (may have valid unresolved suggestions)", () => {
    const script = getCollectStep().with.script;
    expect(script).toContain("isOutdated");
    expect(script).toContain("!t.isResolved");
    expect(script).not.toContain("!t.isOutdated");
  });

  it("processes orphaned comments not in any thread", () => {
    const script = getCollectStep().with.script;
    expect(script).toContain("orphanedComments");
  });

  it("updates PR body with copilot-tasks section", () => {
    const script = getCollectStep().with.script;
    expect(script).toContain("copilot-tasks-start");
    expect(script).toContain("copilot-tasks-end");
    expect(script).toContain("pulls.update");
  });

  it("cleans up task section from PR body when all comments are resolved", () => {
    const script = getCollectStep().with.script;
    expect(script).toContain("all resolved");
    expect(script).toContain("copilot-tasks-start");
  });

  it("fetches branch name from PR API", () => {
    const script = getCollectStep().with.script;
    expect(script).toContain("pulls.get");
    expect(script).toContain("head.ref");
  });

  it("calls @copilot via createComment inside the github-script step", () => {
    // The @copilot mention is now inside the actions/github-script step
    // (not a separate shell step) to match the original working approach
    const script = getCollectStep().with.script;
    expect(script).toContain("issues.createComment");
    expect(script).toContain("@copilot");
  });

  it("has a debug step to verify SWE agent activation", () => {
    const evalJob = workflow.jobs["evaluate-and-fix"] as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const steps = evalJob.steps as any[];
    const debugStep = steps.find((s: any) =>
      String(s.name).includes("Debug"),
    );
    expect(debugStep).toBeDefined();
    expect(debugStep.run).toContain("Copilot SWE agent activated");
    // Must come after the collect step
    const collectIdx = steps.findIndex((s: any) =>
      String(s.name).includes("Collect unresolved comments"),
    );
    const debugIdx = steps.findIndex((s: any) =>
      String(s.name).includes("Debug"),
    );
    expect(debugIdx).toBeGreaterThan(collectIdx);
  });

  it("logs a warning when REVIEW_ID cannot be parsed as integer", () => {
    const script = getCollectStep().with.script;
    expect(script).toContain("REVIEW_ID");
    expect(script).toContain("not a valid number");
  });
});

// ---------------------------------------------------------------------------
// Group 9: Loop cycling — event-driven recursion via ping-pong
// ---------------------------------------------------------------------------
describe("ping-pong loop cycling", () => {
  const rawText = () => readText(WORKFLOW_PATH);

  it("each iteration is driven by a new commit triggering the synchronize event", () => {
    const triggers = workflow.on.pull_request.types;
    expect(triggers).toContain("synchronize");
  });

  it("review phase is driven by pull_request_review event (no polling)", () => {
    expect(workflow.on.pull_request_review.types).toContain("submitted");
  });

  it("dismiss + re-request pattern enables review on every iteration", () => {
    const text = rawText();
    expect(text).toContain("Dismiss previous Copilot review");
    expect(text).toContain("Request Copilot Code Review");
    expect(text).toContain("dismissals");
    expect(text).toContain("requested_reviewers");
  });

  it("draft PRs are marked ready so Copilot reviewer engages on every iteration", () => {
    const text = rawText();
    expect(text).toContain("Mark draft PR as ready for review");
    expect(text).toContain("gh pr ready");
  });

  it("magic phrase in tracking comment increments the circuit breaker counter", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evalJob = workflow.jobs["evaluate-and-fix"] as Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cbStep = evalJob.steps.find((s: any) =>
      String(s.name).includes("Circuit Breaker"),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collectStep = evalJob.steps.find((s: any) =>
      String(s.name).includes("Collect unresolved comments"),
    );
    const magicPhrase = "The Copilot Code Reviewer found issues";
    expect(cbStep.run).toContain(magicPhrase);
  });

  it("loop terminates naturally when no actionable issues remain", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evalJob = workflow.jobs["evaluate-and-fix"] as Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const analyzeStep = evalJob.steps.find((s: any) =>
      String(s.name).includes("Analyze Review"),
    );
    expect(analyzeStep.run).toContain("Auto-fix loop complete!");
    expect(analyzeStep.run).toContain("has_issues=false");
  });

  it("does not have SWE guard step (event-driven architecture eliminates the need)", () => {
    const text = rawText();
    expect(text).not.toContain("swe-guard");
    expect(text).not.toContain("SWE agent is active");
  });
});

// ---------------------------------------------------------------------------
// Group 10: call-reviewer job — no polling (fire-and-forget)
// ---------------------------------------------------------------------------
describe("call-reviewer job — no polling", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getJob = () => workflow.jobs["call-reviewer"] as Record<string, any>;

  it("does not have a polling fallback step", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getJob().steps.find((s: any) =>
      String(s.name).includes("Wait for Copilot review (polling fallback)"),
    );
    expect(step).toBeUndefined();
  });

  it("does not have HEAD SHA capture or request timestamp steps", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headSha = getJob().steps.find((s: any) =>
      String(s.name).includes("Capture HEAD SHA"),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reqTime = getJob().steps.find((s: any) =>
      String(s.name).includes("Record request timestamp"),
    );
    expect(headSha).toBeUndefined();
    expect(reqTime).toBeUndefined();
  });

  it("ends with the review request step (no trailing steps)", () => {
    const steps = getJob().steps;
    const lastStep = steps[steps.length - 1];
    expect(lastStep.name).toBe("Request Copilot Code Review");
  });
});

// ---------------------------------------------------------------------------
// Group 11: Dedup guard and @copilot invocation control
// ---------------------------------------------------------------------------
describe("dedup guard and @copilot invocation control", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getCallReviewer = () => workflow.jobs["call-reviewer"] as Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getEvalAndFix = () => workflow.jobs["evaluate-and-fix"] as Record<string, any>;

  it("evaluate-and-fix has a dedup guard step", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getEvalAndFix().steps.find((s: any) =>
      String(s.name).includes("already processed"),
    );
    expect(step).toBeDefined();
    expect(step.id).toBe("dedup");
    expect(step.run).toContain("REVIEW_URL");
    expect(step.run).toContain("skip=true");
  });

  it("dedup guard checks for existing PR comment containing the review URL", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getEvalAndFix().steps.find((s: any) =>
      String(s.name).includes("already processed"),
    );
    expect(step.run).toContain("ALREADY_PROCESSED");
    expect(step.run).toContain("contains");
  });

  it("COPILOT_PAT validation is the first step, sub-PR check is the second, dedup guard is the third step in evaluate-and-fix", () => {
    const steps = getEvalAndFix().steps;
    expect(steps[0].name).toContain("Validate COPILOT_PAT");
    expect(steps[1].id).toBe("check-is-sub-pr");
    expect(steps[2].id).toBe("dedup");
  });

  it("circuit breaker in evaluate-and-fix is gated on dedup guard", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getEvalAndFix().steps.find((s: any) =>
      String(s.name).includes("Circuit Breaker"),
    );
    expect(String(step.if)).toContain("dedup.outputs.skip");
  });

  it("analyze step in evaluate-and-fix is gated on dedup guard", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getEvalAndFix().steps.find((s: any) =>
      s.name === "Analyze Review Comments",
    );
    expect(String(step.if)).toContain("dedup.outputs.skip");
  });

  it("auto-resolve step in evaluate-and-fix is gated on dedup guard", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getEvalAndFix().steps.find((s: any) =>
      s.name === "Auto-resolve threads with applied suggestions",
    );
    expect(String(step.if)).toContain("dedup.outputs.skip");
  });

  it("collect step in evaluate-and-fix is gated on dedup guard", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getEvalAndFix().steps.find((s: any) =>
      s.name === "Collect unresolved comments and call Copilot SWE Agent",
    );
    expect(String(step.if)).toContain("dedup.outputs.skip");
  });

  it("only evaluate-and-fix mentions @copilot via createComment", () => {
    // evaluate-and-fix mentions @copilot inside the github-script collect step
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collectStep = getEvalAndFix().steps.find((s: any) =>
      String(s.name).includes("Collect unresolved comments"),
    );
    expect(collectStep).toBeDefined();
    expect(collectStep.with.script).toContain("issues.createComment");
    expect(collectStep.with.script).toContain("@copilot");
    // call-reviewer should NOT assign copilot
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestStep = getCallReviewer().steps.find((s: any) =>
      s.name === "Request Copilot Code Review",
    );
    expect(requestStep.run).not.toContain("--add-assignee @copilot");
  });

  it("request step removes then adds reviewer (no variant loops)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = getCallReviewer().steps.find((s: any) =>
      s.name === "Request Copilot Code Review",
    );
    // Should remove then add reviewer using gh pr edit
    expect(step.run).toContain("--remove-reviewer @copilot");
    expect(step.run).toContain("--add-reviewer @copilot");
    // No for-loop over variants — single reviewer name
    expect(step.run).not.toContain("for REVIEWER in");
  });
});

// ---------------------------------------------------------------------------
// Group 11b: Auto-approve steps — verify, wait for CI, approve
// ---------------------------------------------------------------------------
describe("evaluate-and-fix job — auto-approve on clean review", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getJob = () => workflow.jobs["evaluate-and-fix"] as Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getSteps = () => getJob().steps as any[];

  it("has a 'Verify zero unresolved review threads' step", () => {
    const step = getSteps().find((s: any) =>
      String(s.name).includes("Verify zero unresolved review threads"),
    );
    expect(step).toBeDefined();
    expect(step.id).toBe("verify-clean");
  });

  it("verify-clean step uses GraphQL to query review threads", () => {
    const step = getSteps().find((s: any) => s.id === "verify-clean");
    expect(step.with.script).toContain("reviewThreads");
    expect(step.with.script).toContain("isResolved");
    expect(step.with.script).toContain("all_resolved");
  });

  it("verify-clean step is gated on has_issues == false", () => {
    const step = getSteps().find((s: any) => s.id === "verify-clean");
    const cond = String(step.if);
    expect(cond).toContain("analyze");
    expect(cond).toContain("has_issues");
    expect(cond).toContain("false");
  });

  it("has a 'Wait for CI checks to pass' step", () => {
    const step = getSteps().find((s: any) =>
      String(s.name).includes("Wait for CI checks to pass"),
    );
    expect(step).toBeDefined();
    expect(step.id).toBe("ci-wait");
  });

  it("ci-wait step polls gh pr checks with a timeout", () => {
    const step = getSteps().find((s: any) => s.id === "ci-wait");
    expect(step.run).toContain("gh pr checks");
    expect(step.run).toContain("MAX_WAIT");
    expect(step.run).toContain("POLL_INTERVAL");
    expect(step.run).toContain("ci_passed");
  });

  it("ci-wait step is gated on verify-clean.outputs.all_resolved", () => {
    const step = getSteps().find((s: any) => s.id === "ci-wait");
    const cond = String(step.if);
    expect(cond).toContain("verify-clean");
    expect(cond).toContain("all_resolved");
  });

  it("has an 'Auto-approve PR' step", () => {
    const step = getSteps().find((s: any) =>
      String(s.name).includes("Auto-approve PR"),
    );
    expect(step).toBeDefined();
  });

  it("auto-approve step uses APPROVER_PAT (not COPILOT_PAT)", () => {
    const step = getSteps().find((s: any) =>
      String(s.name).includes("Auto-approve PR"),
    );
    expect(String(step.env.GH_TOKEN)).toContain("APPROVER_PAT");
    expect(String(step.env.GH_TOKEN)).not.toContain("COPILOT_PAT");
  });

  it("auto-approve step uses gh pr review --approve", () => {
    const step = getSteps().find((s: any) =>
      String(s.name).includes("Auto-approve PR"),
    );
    expect(step.run).toContain("gh pr review");
    expect(step.run).toContain("--approve");
  });

  it("auto-approve step checks for skip-auto-approve label", () => {
    const step = getSteps().find((s: any) =>
      String(s.name).includes("Auto-approve PR"),
    );
    expect(step.run).toContain("skip-auto-approve");
  });

  it("auto-approve step checks if PR is already approved", () => {
    const step = getSteps().find((s: any) =>
      String(s.name).includes("Auto-approve PR"),
    );
    expect(step.run).toContain("APPROVED");
    expect(step.run).toContain("already");
  });

  it("auto-approve step is gated on all prior conditions", () => {
    const step = getSteps().find((s: any) =>
      String(s.name).includes("Auto-approve PR"),
    );
    const cond = String(step.if);
    expect(cond).toContain("dedup");
    expect(cond).toContain("loop-limit");
    expect(cond).toContain("analyze");
    expect(cond).toContain("verify-clean");
    expect(cond).toContain("ci-wait");
    expect(cond).toContain("ci_passed");
  });

  it("auto-approve steps come after analyze and before auto-resolve", () => {
    const steps = getSteps();
    const analyzeIdx = steps.findIndex((s: any) =>
      String(s.name).includes("Analyze Review"),
    );
    const verifyIdx = steps.findIndex((s: any) => s.id === "verify-clean");
    const ciWaitIdx = steps.findIndex((s: any) => s.id === "ci-wait");
    const approveIdx = steps.findIndex((s: any) =>
      String(s.name).includes("Auto-approve PR"),
    );
    const resolveIdx = steps.findIndex((s: any) =>
      String(s.name).includes("Auto-resolve threads"),
    );
    expect(verifyIdx).toBeGreaterThan(analyzeIdx);
    expect(ciWaitIdx).toBeGreaterThan(verifyIdx);
    expect(approveIdx).toBeGreaterThan(ciWaitIdx);
    expect(resolveIdx).toBeGreaterThan(approveIdx);
  });

  it("auto-approve step handles self-approval failure gracefully", () => {
    const step = getSteps().find((s: any) =>
      String(s.name).includes("Auto-approve PR"),
    );
    expect(step.run).toContain("::warning::");
    expect(step.run).toContain("self-approval");
  });
});

// ---------------------------------------------------------------------------
// Group 12: auto-merge-sub-pr job — disabled (handled by sub-pr-auto-merge.yml)
// ---------------------------------------------------------------------------
describe("auto-merge-sub-pr job — disabled in recursive loop", () => {
  it("auto-merge-sub-pr job is commented out", () => {
    expect(workflow.jobs["auto-merge-sub-pr"]).toBeUndefined();
  });

  it("workflow file still contains commented-out auto-merge-sub-pr reference", () => {
    const content = readText(WORKFLOW_PATH);
    expect(content).toContain("# auto-merge-sub-pr:");
    expect(content).toContain("DISABLED");
    expect(content).toContain("sub-pr-auto-merge.yml");
  });
});
