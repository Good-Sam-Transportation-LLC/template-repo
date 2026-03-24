/**
 * Auto-generated workflow validation tests
 * Workflow: dependabot-auto-merge.yml
 */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { parse } from "yaml";

const ROOT = path.resolve(import.meta.dirname, "../..");
const WORKFLOW_PATH = path.join(ROOT, ".github/workflows/dependabot-auto-merge.yml");
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

describe("dependabot-auto-merge workflow", () => {
  it("workflow file exists", () => {
    expect(fs.existsSync(WORKFLOW_PATH)).toBe(true);
  });

  it("workflow has a name", () => {
    expect(workflow.name).toBeDefined();
  });

  it("workflow has triggers defined", () => {
    expect(workflow.on).toBeDefined();
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

  it("auto-merge job uses dependabot/fetch-metadata", () => {
    const steps = workflow.jobs["auto-merge"]?.steps || [];
    const hasFetchMetadata = steps.some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => typeof s.uses === "string" && s.uses.startsWith("dependabot/fetch-metadata@")
    );
    expect(hasFetchMetadata, "auto-merge job should use dependabot/fetch-metadata").toBe(true);
  });
});
