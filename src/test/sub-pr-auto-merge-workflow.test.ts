/**
 * Sub-PR Auto-Merge Workflow Tests
 *
 * Validates the structure and configuration of .github/workflows/sub-pr-auto-merge.yml
 */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { parse } from "yaml";

const ROOT = path.resolve(import.meta.dirname, "../..");
const WORKFLOW_PATH = path.join(ROOT, ".github/workflows/sub-pr-auto-merge.yml");
const readText = (p: string) => fs.readFileSync(p, "utf-8");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let workflow: Record<string, any> = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let job: Record<string, any> = {};

beforeAll(() => {
  if (!fs.existsSync(WORKFLOW_PATH)) {
    throw new Error(`Workflow file not found: ${WORKFLOW_PATH}. All tests in this suite require the workflow file to be present.`);
  }
  const rawYaml = readText(WORKFLOW_PATH);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workflow = parse(rawYaml) as Record<string, any>;

  // Validate that the expected job exists and is well-formed before running tests.
  const jobs = workflow.jobs;
  if (!jobs || typeof jobs !== "object") {
    throw new Error(
      "Expected `jobs` to be defined as an object in .github/workflows/sub-pr-auto-merge.yml"
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoMergeJob = (jobs["auto-merge-sub-pr"] ?? null) as Record<string, any> | null;
  if (!autoMergeJob || typeof autoMergeJob !== "object") {
    throw new Error(
      "Expected a job named `auto-merge-sub-pr` in .github/workflows/sub-pr-auto-merge.yml"
    );
  }

  if (!Array.isArray(autoMergeJob.steps)) {
    throw new Error(
      "Expected `auto-merge-sub-pr` job to define a `steps` array in .github/workflows/sub-pr-auto-merge.yml"
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  job = autoMergeJob as Record<string, any>;
});

describe("Sub-PR Auto-Merge workflow file structure", () => {
  it("workflow file exists", () => {
    const exists = fs.existsSync(WORKFLOW_PATH);
    if (!exists) {
      throw new Error(`Expected workflow file at ${WORKFLOW_PATH}, but none was found.`);
    }
    expect(exists).toBe(true);
  });

  it('is named "Sub-PR Auto-Merge"', () => {
    expect(workflow.name).toBe("Sub-PR Auto-Merge");
  });

  it("triggers on pull_request opened and reopened", () => {
    expect(workflow.on).toHaveProperty("pull_request");
    expect(workflow.on.pull_request.types).toContain("opened");
    expect(workflow.on.pull_request.types).toContain("reopened");
    expect(workflow.on.pull_request.types).not.toContain("synchronize");
  });

  it("does not trigger on push", () => {
    expect(workflow.on).not.toHaveProperty("push");
  });

  it("has contents:read permission", () => {
    expect(workflow.permissions?.contents).toBe("read");
  });

  it("has pull-requests:write permission", () => {
    expect(workflow.permissions?.["pull-requests"]).toBe("write");
  });

  it("defines an auto-merge-sub-pr job", () => {
    expect(workflow.jobs).toHaveProperty("auto-merge-sub-pr");
  });
});

describe("Sub-PR Auto-Merge job configuration", () => {
  it("runs on ubuntu-latest", () => {
    expect(job["runs-on"]).toBe("ubuntu-latest");
  });

  it("skips PRs targeting the default branch and requires a Bot PR author", () => {
    const condition = String(job.if);
    expect(condition).toContain("default_branch");
    expect(condition).toContain("user.type");
    expect(condition).toContain("Bot");
  });

  it("has a concurrency group using the PR number", () => {
    expect(job.concurrency?.group).toContain("sub-pr-automerge");
    expect(job.concurrency?.group).toContain("pull_request.number");
    expect(job.concurrency?.["cancel-in-progress"]).toBe(true);
  });

  it("uses COPILOT_PAT secret", () => {
    expect(readText(WORKFLOW_PATH)).toContain("secrets.COPILOT_PAT");
  });

  it("has a verify-parent step that detects sub-PRs", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = job.steps.find((s: any) => s.id === "verify-parent");
    expect(step).toBeDefined();
    expect(step.run).toContain("gh pr list");
    expect(step.run).toContain("has_parent");
    // Must filter by default branch to avoid selecting the wrong parent PR
    // when multiple open PRs share the same head branch name
    expect(step.run).toContain('--base "$DEFAULT_BRANCH"');
    expect(step.env).toHaveProperty("DEFAULT_BRANCH");
  });

  it("has a wait-for-finish step that detects completion via User-type review request", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = job.steps.find((s: any) => s.id === "wait-for-finish");
    expect(step).toBeDefined();
    expect(step.run).toContain("requested_reviewers");
    expect(step.run).toContain('.type == "User"');
    expect(step.run).toContain("POLL_INTERVAL=15");
    expect(step.run).toContain("MAX_WAIT=900");
  });

  it("wait-for-finish does NOT use 'finished work' text polling", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = job.steps.find((s: any) => s.id === "wait-for-finish");
    // The old "finished work" text-matching approach was replaced by .type == "User"
    // review-request detection (see commit c04dc8f). Do NOT revert.
    expect(step.run).not.toMatch(/select\(test\("finished work"/);
    expect(step.run).not.toContain("issues/$PR_NUMBER/timeline");
  });

  it("wait-for-finish uses only review-request detection, not text matching", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = job.steps.find((s: any) => s.id === "wait-for-finish");
    expect(step).toBeDefined();
    expect(step?.run).toContain("requested_reviewers");
    expect(step?.run).toContain('.type == "User"');
  });

  it("wait-for-finish does NOT use tostring on timeline objects", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = job.steps.find((s: any) => s.id === "wait-for-finish");
    expect(step.run).not.toContain("tostring");
  });

  it("wait-for-finish does not include debug logging", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = job.steps.find((s: any) => s.id === "wait-for-finish");
    expect(step.run).not.toContain("Debug:");
  });

  it("merge step is gated on parent verification and finish detection", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mergeStep = job.steps.find((s: any) =>
      typeof s.run === "string" && s.run.includes("gh pr merge")
    );
    expect(mergeStep).toBeDefined();
    expect(String(mergeStep.if)).toContain("verify-parent");
    expect(String(mergeStep.if)).toContain("wait-for-finish");
  });

  it("merge step checks if PR is already merged before proceeding", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mergeStep = job.steps.find((s: any) =>
      typeof s.run === "string" && s.run.includes("gh pr merge")
    );
    expect(mergeStep.run).toContain("PR_STATE=");
    expect(mergeStep.run).toContain("already");
  });

  it("merge step marks draft PRs as ready", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mergeStep = job.steps.find((s: any) =>
      typeof s.run === "string" && s.run.includes("gh pr merge")
    );
    expect(mergeStep.run).toContain("gh pr ready");
  });

  it("merge step dismisses Copilot reviews before merging", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mergeStep = job.steps.find((s: any) =>
      typeof s.run === "string" && s.run.includes("gh pr merge")
    );
    expect(mergeStep.run).toContain("dismiss_copilot_reviews");
    expect(mergeStep.run).toContain("CHANGES_REQUESTED");
  });

  it("merge step retries up to 3 times", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mergeStep = job.steps.find((s: any) =>
      typeof s.run === "string" && s.run.includes("gh pr merge")
    );
    expect(mergeStep.run).toContain("MAX_RETRIES=3");
  });
});
