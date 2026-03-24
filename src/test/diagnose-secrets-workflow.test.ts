import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { parse } from "yaml";

const WORKFLOW_PATH = resolve(
  import.meta.dirname,
  "../../.github/workflows/diagnose-secrets.yml",
);

function loadWorkflow(filePath: string) {
  const content = readFileSync(filePath, "utf-8");
  return parse(content) as Record<string, unknown>;
}

describe("diagnose-secrets workflow", () => {
  it("workflow file exists", () => {
    expect(existsSync(WORKFLOW_PATH)).toBe(true);
  });

  describe("workflow structure", () => {
    let workflow: Record<string, unknown>;

    beforeAll(() => {
      workflow = loadWorkflow(WORKFLOW_PATH);
    });

    it('is named "Diagnose Secrets"', () => {
      expect(workflow.name).toBe("Diagnose Secrets");
    });

    it("triggers on workflow_dispatch", () => {
      const on = workflow.on as Record<string, unknown>;
      expect(on).toHaveProperty("workflow_dispatch");
      expect(on).not.toHaveProperty("push");
    });

    it("defines a diagnose job", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      expect(jobs).toHaveProperty("diagnose");
    });

    it("diagnose job runs on ubuntu-latest", () => {
      const jobs = workflow.jobs as Record<string, { "runs-on": string }>;
      expect(jobs.diagnose["runs-on"]).toBe("ubuntu-latest");
    });

    it("checks COPILOT_PAT availability", () => {
      const content = readFileSync(WORKFLOW_PATH, "utf-8");
      expect(content).toContain("COPILOT_PAT");
      expect(content).toContain("APPROVER_PAT");
    });

    it("tests gh auth status", () => {
      const content = readFileSync(WORKFLOW_PATH, "utf-8");
      expect(content).toContain("gh auth status");
    });

    it("tests git ls-remote for repo access", () => {
      const content = readFileSync(WORKFLOW_PATH, "utf-8");
      expect(content).toContain("git ls-remote");
    });

    it("includes a summary step", () => {
      const jobs = workflow.jobs as Record<
        string,
        { steps: Array<{ name: string }> }
      >;
      const steps = jobs.diagnose.steps;
      const summaryStep = steps.find((s) => s.name === "Summary");
      expect(summaryStep).toBeDefined();
    });
  });
});
