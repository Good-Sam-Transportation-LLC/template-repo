/**
 * Auto-generated workflow validation tests
 * Workflow: cleanup-branches.yml
 */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { parse } from "yaml";

const ROOT = path.resolve(import.meta.dirname, "../..");
const WORKFLOW_PATH = path.join(ROOT, ".github/workflows/cleanup-branches.yml");
const readText = (p: string) => fs.readFileSync(p, "utf-8");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let workflow: Record<string, any> = {};

beforeAll(() => {
  if (!fs.existsSync(WORKFLOW_PATH)) {
    throw new Error(`Workflow file not found: ${WORKFLOW_PATH}. All tests in this suite require the workflow file to be present.`);
  }
  const rawYaml = readText(WORKFLOW_PATH);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workflow = parse(rawYaml) as Record<string, any>;
});

describe("cleanup-branches workflow", () => {
  it("workflow file exists", () => {
    expect(fs.existsSync(WORKFLOW_PATH)).toBe(true);
  });

  it('is named "Cleanup branches"', () => {
    expect(workflow.name).toBe("Cleanup branches");
  });

  it("workflow has the expected triggers", () => {
    expect(workflow.on).toBeDefined();

    const triggers = workflow.on;

    if (Array.isArray(triggers)) {
      // When triggers are defined as an array
      expect(triggers).toContain("workflow_dispatch");
      expect(triggers).not.toContain("push");
    } else if (typeof triggers === "object" && triggers !== null) {
      // When triggers are defined as a mapping
      expect(Object.prototype.hasOwnProperty.call(triggers, "workflow_dispatch")).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(triggers, "push")).toBe(false);
    } else {
      // Any other shape is considered invalid for our expectations
      throw new Error("workflow.on has an unexpected shape");
    }
  });

  it("workflow defines at least one job", () => {
    expect(workflow.jobs).toBeDefined();
    expect(Object.keys(workflow.jobs).length).toBeGreaterThan(0);
  });

  it("all jobs run on ubuntu-latest", () => {
    expect(workflow.jobs).toBeDefined();
    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((job as any)["runs-on"], `job "${jobName}" should run on ubuntu-latest`).toBe("ubuntu-latest");
    }
  });

  it("keeps all claude/* branches via pattern match", () => {
    const steps = workflow.jobs["delete-branches"].steps || [];
    const runStep = steps.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => typeof s.run === "string" && s.run.includes("claude/")
    );
    expect(runStep, "should have a step that matches claude/* branches").toBeDefined();
    expect(runStep.run).toContain('claude/*');
  });

  it("hardcodes main and master in KEEP_BRANCHES", () => {
    const steps = workflow.jobs["delete-branches"].steps || [];
    const runStep = steps.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => typeof s.run === "string" && s.run.includes("KEEP_BRANCHES=")
    );
    expect(runStep, "should have a step that sets KEEP_BRANCHES").toBeDefined();
    expect(runStep.run).toContain('"main master');
    expect(runStep.run).not.toContain("DEFAULT_BRANCH");
  });

  it("all jobs use actions/checkout@v4", () => {
    expect(workflow.jobs).toBeDefined();
    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const steps = (job as any).steps || [];
      const hasCheckout = steps.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s: any) => typeof s.uses === "string" && s.uses.startsWith("actions/checkout@v4")
      );
      expect(hasCheckout, `job "${jobName}" should use actions/checkout@v4`).toBe(true);
    }
  });
});
