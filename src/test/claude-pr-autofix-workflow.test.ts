/**
 * Claude PR Auto-Fix Workflow Tests
 *
 * Validates the structure and configuration of .github/workflows/claude-pr-autofix.yml
 */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { parse } from "yaml";

const ROOT = path.resolve(import.meta.dirname, "../..");
const WORKFLOW_PATH = path.join(ROOT, ".github/workflows/claude-pr-autofix.yml");
const readText = (p: string) => fs.readFileSync(p, "utf-8");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workflow = parse(readText(WORKFLOW_PATH)) as Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const autoFixJob = workflow.jobs?.["auto-fix"] as Record<string, any>;

describe("Claude PR Auto-Fix workflow file structure", () => {
  it("workflow file exists", () => {
    expect(fs.existsSync(WORKFLOW_PATH)).toBe(true);
  });

  it('is named "Claude PR Auto-Fix"', () => {
    expect(workflow.name).toBe("Claude PR Auto-Fix");
  });

  it("only triggers after Autonomous AI Loop workflow completes (not on pull_request_review)", () => {
    expect(workflow.on).not.toHaveProperty("pull_request_review");
  });

  it("triggers after Autonomous AI Loop workflow completes", () => {
    expect(workflow.on).toHaveProperty("workflow_run");
    expect(workflow.on.workflow_run.workflows).toContain(
      "Autonomous AI Loop: Review ➔ Fix"
    );
    expect(workflow.on.workflow_run.types).toContain("completed");
  });

  it("only triggers after a single workflow (Autonomous AI Loop)", () => {
    expect(workflow.on.workflow_run.workflows).toHaveLength(1);
  });

  it("has contents:write permission", () => {
    expect(workflow.permissions?.contents).toBe("write");
  });

  it("has pull-requests:write permission", () => {
    expect(workflow.permissions?.["pull-requests"]).toBe("write");
  });

  it("has actions:read permission for workflow_run", () => {
    expect(workflow.permissions?.actions).toBe("read");
  });

  it("defines an auto-fix job", () => {
    expect(workflow.jobs).toHaveProperty("auto-fix");
  });
});

describe("Claude PR Auto-Fix job configuration", () => {
  it("runs on ubuntu-latest", () => {
    expect(autoFixJob["runs-on"]).toBe("ubuntu-latest");
  });

  it("only runs workflow_run when trigger workflow succeeded", () => {
    const condition = String(autoFixJob.if);
    expect(condition).toContain("workflow_run");
    expect(condition).toContain("success");
  });

  it("has a check-loop-done gate step that detects terminal loop states", () => {
    const gateStep = autoFixJob.steps.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s.id === "check-loop-done"
    );
    expect(gateStep).toBeDefined();
    expect(gateStep.uses).toContain("actions/github-script");
  });

  it("gate step checks for Copilot approval as terminal state", () => {
    const gateStep = autoFixJob.steps.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s.id === "check-loop-done"
    );
    expect(gateStep.with.script).toContain("APPROVED");
    expect(gateStep.with.script).toContain("listReviews");
  });

  it("gate step checks for loop-complete and loop-stopped comment markers", () => {
    const gateStep = autoFixJob.steps.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s.id === "check-loop-done"
    );
    expect(gateStep.with.script).toContain("Auto-fix loop complete!");
    expect(gateStep.with.script).toContain("Auto-fix loop stopped");
  });

  it("gate step compares terminal marker time against SWE invocation time", () => {
    const gateStep = autoFixJob.steps.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s.id === "check-loop-done"
    );
    expect(gateStep.with.script).toContain("The Copilot Code Reviewer found issues");
    expect(gateStep.with.script).toContain("latestSweTime > latestTerminalTime");
  });

  it("gate step skips when loop is mid-cycle", () => {
    const gateStep = autoFixJob.steps.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s.id === "check-loop-done"
    );
    expect(gateStep.with.script).toContain("loop is mid-cycle");
  });

  it("check-loop-done gate step proceeds when terminal state detected", () => {
    const gateStep = autoFixJob.steps.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s.id === "check-loop-done"
    );
    // Gate step should set proceed output
    expect(gateStep.with.script).toContain("core.setOutput('proceed', 'true');");
  });

  it("checks for ANTHROPIC_API_KEY before running", () => {
    const checkStep = autoFixJob.steps.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s.id === "check-key"
    );
    expect(checkStep).toBeDefined();
    expect(checkStep.run).toContain("ANTHROPIC_API_KEY");
  });

  it("includes actions/checkout@v4 step", () => {
    const checkoutStep = autoFixJob.steps.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => typeof s.uses === "string" && s.uses.startsWith("actions/checkout@v4")
    );
    expect(checkoutStep).toBeDefined();
  });

  it("includes actions/setup-node with npm cache", () => {
    const setupNode = autoFixJob.steps.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => typeof s.uses === "string" && s.uses.startsWith("actions/setup-node@")
    );
    expect(setupNode).toBeDefined();
    expect(setupNode.with?.cache).toBe("npm");
  });

  it("applies fixes via github-script step", () => {
    const applyStep = autoFixJob.steps.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s.id === "apply-fixes"
    );
    expect(applyStep).toBeDefined();
    expect(applyStep.uses).toContain("actions/github-script");
  });

  it("apply-fixes step uses ANTHROPIC_API_KEY from secrets", () => {
    const applyStep = autoFixJob.steps.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s.id === "apply-fixes"
    );
    expect(String(applyStep?.env?.ANTHROPIC_API_KEY)).toContain("secrets.ANTHROPIC_API_KEY");
  });

  it("commits and pushes applied fixes", () => {
    const commitStep = autoFixJob.steps.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => typeof s.run === "string" && s.run.includes("git commit") && s.run.includes("push-with-scan-wait")
    );
    expect(commitStep).toBeDefined();
  });

  it("commit step only runs when changes were applied", () => {
    const commitStep = autoFixJob.steps.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => typeof s.run === "string" && s.run.includes("git commit") && s.run.includes("push-with-scan-wait")
    );
    expect(String(commitStep?.if)).toContain("apply-fixes.outputs.changed");
  });

  it("uses COPILOT_PAT for checkout to trigger downstream workflows", () => {
    const checkoutStep = autoFixJob.steps.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => typeof s.uses === "string" && s.uses.startsWith("actions/checkout@v4")
    );
    expect(String(checkoutStep?.with?.token)).toContain("secrets.COPILOT_PAT");
  });

  it("uses COPILOT_PAT for commit and push step", () => {
    const commitStep = autoFixJob.steps.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => typeof s.run === "string" && s.run.includes("git commit") && s.run.includes("push-with-scan-wait")
    );
    expect(String(commitStep?.env?.GITHUB_TOKEN)).toContain("secrets.COPILOT_PAT");
  });
});
