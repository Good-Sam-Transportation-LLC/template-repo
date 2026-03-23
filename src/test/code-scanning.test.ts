/**
 * Code Scanning & Dependency Management Validation Tests
 *
 * These tests verify that the CodeQL workflow, Dependabot configuration,
 * and security integration in the CI pipeline are correctly configured.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parse } from "yaml";

const ROOT = path.resolve(import.meta.dirname, "../..");
const readText = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf-8");

const codeqlYaml = readText(".github/workflows/codeql.yml");
const codeql = parse(codeqlYaml);

const dependabotYaml = readText(".github/dependabot.yml");
const dependabot = parse(dependabotYaml);

const ciYaml = readText(".github/workflows/ci.yml");
const ci = parse(ciYaml);

// ---------------------------------------------------------------------------
// Group 1: CodeQL Workflow Validation
// ---------------------------------------------------------------------------
describe("CodeQL workflow validation", () => {
  it("CodeQL workflow file exists at .github/workflows/codeql.yml", () => {
    expect(fs.existsSync(path.join(ROOT, ".github/workflows/codeql.yml"))).toBe(true);
  });

  it("CodeQL workflow name is CodeQL", () => {
    expect(codeql.name).toBe("CodeQL");
  });

  it("CodeQL triggers on push to all branches", () => {
    expect(codeql.on.push.branches).toContain("**");
  });

  it("CodeQL triggers on pull_request to all branches", () => {
    expect(codeql.on.pull_request.branches).toContain("**");
  });

  it("CodeQL has a weekly schedule", () => {
    expect(Array.isArray(codeql.on.schedule)).toBe(true);
    expect(codeql.on.schedule.length).toBeGreaterThanOrEqual(1);
  });

  it("CodeQL analyzes javascript-typescript", () => {
    expect(codeql.jobs.analyze.strategy.matrix.language).toContain("javascript-typescript");
  });

  it("CodeQL uses codeql-action init, autobuild, and analyze steps", () => {
    const steps = codeql.jobs.analyze.steps;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usesValues = steps.map((s: any) => s.uses).filter(Boolean);
    expect(usesValues.some((u: string) => u.includes("codeql-action/init"))).toBe(true);
    expect(usesValues.some((u: string) => u.includes("codeql-action/autobuild"))).toBe(true);
    expect(usesValues.some((u: string) => u.includes("codeql-action/analyze"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group 2: Dependabot Configuration
// ---------------------------------------------------------------------------
describe("Dependabot configuration", () => {
  it("Dependabot config exists at .github/dependabot.yml", () => {
    expect(fs.existsSync(path.join(ROOT, ".github/dependabot.yml"))).toBe(true);
  });

  it("Dependabot config version is 2", () => {
    expect(dependabot.version).toBe(2);
  });

  it("Dependabot monitors npm ecosystem", () => {
    const ecosystems = dependabot.updates.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (u: any) => u["package-ecosystem"],
    );
    expect(ecosystems).toContain("npm");
  });

  it("Dependabot monitors github-actions ecosystem", () => {
    const ecosystems = dependabot.updates.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (u: any) => u["package-ecosystem"],
    );
    expect(ecosystems).toContain("github-actions");
  });

  it("Dependabot schedules weekly updates", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const entry of dependabot.updates as any[]) {
      expect(entry.schedule.interval).toBe("weekly");
    }
  });
});

// ---------------------------------------------------------------------------
// Group 3: Security Integration in CI
// ---------------------------------------------------------------------------
describe("Security integration in CI", () => {
  it("CI workflow has a security audit job", () => {
    expect(ci.jobs.security).toBeDefined();
  });

  it("security job runs npm audit", () => {
    const steps = ci.jobs.security.steps;
    const hasAudit = steps.some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => typeof s.run === "string" && s.run.includes("npm audit"),
    );
    expect(hasAudit).toBe(true);
  });

  it("build job depends on security job passing", () => {
    const needs = ci.jobs.build.needs;
    expect(needs).toContain("security");
  });
});

// ---------------------------------------------------------------------------
// Group 4: Security Autofix
// ---------------------------------------------------------------------------
describe("Security autofix", () => {
  it("security-autofix.yml workflow exists", () => {
    expect(fs.existsSync(path.join(ROOT, ".github/workflows/security-autofix.yml"))).toBe(true);
  });

  it("security-autofix triggers on CI and CodeQL workflow failures", () => {
    const content = readText(".github/workflows/security-autofix.yml");
    const parsed = parse(content);
    expect(parsed.on).toHaveProperty("workflow_run");
    const workflows = parsed.on.workflow_run.workflows;
    expect(workflows).toContain("CI");
    expect(workflows).toContain("CodeQL");
  });

  it("security-autofix runs on a daily schedule", () => {
    const content = readText(".github/workflows/security-autofix.yml");
    const parsed = parse(content);
    expect(parsed.on).toHaveProperty("schedule");
  });

  it("security-autofix has npm audit fix job", () => {
    const content = readText(".github/workflows/security-autofix.yml");
    expect(content).toContain("npm audit fix");
  });

  it("security-autofix has CodeQL findings fix job", () => {
    const content = readText(".github/workflows/security-autofix.yml");
    expect(content).toContain("codeScanning");
    expect(content).toContain("@openai/codex");
  });

  it("security-autofix commits fixes automatically", () => {
    const content = readText(".github/workflows/security-autofix.yml");
    expect(content).toContain("git commit");
    expect(content).toContain("security:");
  });

  it("security-autofix has write permissions for contents", () => {
    const content = readText(".github/workflows/security-autofix.yml");
    const parsed = parse(content);
    expect(parsed.permissions.contents).toBe("write");
  });

  it("CI security job attempts auto-fix on failure", () => {
    const securityJob = ci.jobs.security;
    const allRuns = securityJob.steps
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((s: any) => s.run)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((s: any) => s.run)
      .join("\n");
    expect(allRuns).toContain("npm audit fix");
  });

  it("CI security job commits fixes automatically", () => {
    const securityJob = ci.jobs.security;
    const allRuns = securityJob.steps
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((s: any) => s.run)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((s: any) => s.run)
      .join("\n");
    expect(allRuns).toContain("git commit");
  });

  it("security-autofix uses iterative npm audit fix loop", () => {
    const content = readText(".github/workflows/security-autofix.yml");
    expect(content).toContain("MAX_ATTEMPTS=3");
    expect(content).toContain("Iterative npm audit fix");
  });

  it("security-autofix validates dependency compatibility and rolls back if broken", () => {
    const content = readText(".github/workflows/security-autofix.yml");
    expect(content).toContain("npm ls");
    expect(content).toContain("rolling back");
    expect(content).toContain("git checkout -- package.json package-lock.json");
  });
});
