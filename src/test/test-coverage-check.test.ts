/**
 * Test Coverage Check Validation Tests
 *
 * These tests verify that the PR test coverage check script exists
 * with proper content and that the CI workflow integrates it correctly.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parse } from "yaml";

const ROOT = path.resolve(import.meta.dirname, "../..");
const readText = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf-8");

const ciYaml = readText(".github/workflows/ci.yml");
const ci = parse(ciYaml);

type CiJobStep = {
  if?: string;
  run?: string;
};

type CiJob = {
  if?: string;
  steps: CiJobStep[];
};

/**
 * Helper to check whether a job has any step with an `if` condition
 * that references the "ready-to-merge" label.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hasReadyToMergeStepCondition = (job: any): boolean =>
  Array.isArray(job.steps) &&
  job.steps.some(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (step: any) => typeof step.if === "string" && step.if.includes("ready-to-merge"),
  );

// ---------------------------------------------------------------------------
// Group 1: Shell Script Validation
// ---------------------------------------------------------------------------
describe("Shell script validation", () => {
  it("check-test-coverage.sh exists", () => {
    expect(fs.existsSync(path.join(ROOT, ".github/scripts/check-test-coverage.sh"))).toBe(true);
  });

  const scriptContent = readText(".github/scripts/check-test-coverage.sh");

  it("script has bash shebang", () => {
    expect(scriptContent).toContain("#!/usr/bin/env bash");
  });

  it("script uses git diff to find changed files", () => {
    expect(scriptContent).toContain("git diff");
  });

  it("script skips shadcn/ui components", () => {
    expect(scriptContent).toContain("src/components/ui");
  });

  it("script skips test infrastructure files", () => {
    expect(scriptContent).toContain("src/test");
  });

  it("script uses __tests__ directory convention", () => {
    expect(scriptContent).toContain("__tests__");
  });
});

// ---------------------------------------------------------------------------
// Group 2: CI Workflow Integration
// ---------------------------------------------------------------------------
describe("CI workflow integration", () => {
  it("CI workflow has a test-coverage-check job", () => {
    expect(ci.jobs["test-coverage-check"]).toBeDefined();
  });

  it("test-coverage-check uses step-level conditions for ready-to-merge label", () => {
    const job = ci.jobs["test-coverage-check"] as CiJob;
    // Job-level if only contains the dependabot skip; ready-to-merge guard is at step level
    expect(job.if).toContain("dependabot[bot]");
    const hasReadyToMergeCondition = hasReadyToMergeStepCondition(job);
    expect(hasReadyToMergeCondition).toBe(true);
  });

  it("test-coverage-check job runs the coverage script", () => {
    const job = ci.jobs["test-coverage-check"] as CiJob;
    const hasScript = job.steps.some((step: CiJobStep) =>
      typeof step.run === "string" && step.run.includes("check-test-coverage.sh"),
    );
    expect(hasScript).toBe(true);
  });
});
