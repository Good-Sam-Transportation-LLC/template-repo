/**
 * CI Pipeline Validation Tests
 *
 * These tests verify that the GitHub Actions CI workflow is correctly
 * configured with proper job definitions, dependency graph, script
 * references, environment settings, and artifact configuration.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parse } from "yaml";

const ROOT = path.resolve(import.meta.dirname, "../..");
const readText = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const readJson = (rel: string) => JSON.parse(readText(rel));

const ciYaml = readText(".github/workflows/ci.yml");
const ci = parse(ciYaml);
const pkg = readJson("package.json");

// Jobs that require Node.js setup (setup-node, npm ci, etc.)
const NODE_JOBS = ["lint-and-typecheck", "test", "security", "build"];

// ---------------------------------------------------------------------------
// Group 1: Workflow File Structure
// ---------------------------------------------------------------------------
describe("Workflow file structure", () => {
  it("CI workflow file exists at .github/workflows/ci.yml", () => {
    expect(fs.existsSync(path.join(ROOT, ".github/workflows/ci.yml"))).toBe(true);
  });

  it("workflow name is CI", () => {
    expect(ci.name).toBe("CI");
  });

  it("triggers on push to all branches", () => {
    expect(ci.on.push.branches).toContain("**");
  });

  it("triggers on pull_request to all branches", () => {
    expect(ci.on.pull_request.branches).toContain("**");
  });

  it("pull_request trigger includes labeled event type", () => {
    expect(ci.on.pull_request.types).toContain("labeled");
  });

  it("defines exactly seven jobs", () => {
    expect(Object.keys(ci.jobs).length).toBe(7);
  });

  it("defines the expected job IDs: diagnose, lint-and-typecheck, test, security, test-coverage-check, build, copilot-deployment", () => {
    const jobIds = new Set(Object.keys(ci.jobs));
    const expected = new Set(["diagnose", "lint-and-typecheck", "test", "security", "test-coverage-check", "build", "copilot-deployment"]);
    expect(jobIds).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// Group 1b: Dependabot Skip Conditions
// ---------------------------------------------------------------------------
describe("Dependabot skip conditions", () => {
  const DEPENDABOT_CONDITION = "github.actor != 'dependabot[bot]'";

  it("every job in CI skips when actor is dependabot[bot]", () => {
    for (const [jobName, job] of Object.entries(ci.jobs)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jobIf = (job as any).if as string | undefined;
      expect(
        jobIf,
        `job "${jobName}" is missing an if condition`,
      ).toBeDefined();
      expect(
        jobIf,
        `job "${jobName}" should skip dependabot`,
      ).toContain(DEPENDABOT_CONDITION);
    }
  });
});

// ---------------------------------------------------------------------------
// Group 2: Job Dependency Graph and Execution Order
// ---------------------------------------------------------------------------
describe("Job dependency graph and execution order", () => {
  it("lint-and-typecheck job has no dependencies", () => {
    expect(ci.jobs["lint-and-typecheck"].needs).toBeUndefined();
  });

  it("test job has no dependencies", () => {
    expect(ci.jobs["test"].needs).toBeUndefined();
  });

  it("security job has no dependencies", () => {
    expect(ci.jobs["security"].needs).toBeUndefined();
  });

  it("test-coverage-check job has no dependencies", () => {
    expect(ci.jobs["test-coverage-check"].needs).toBeUndefined();
  });

  it("test-coverage-check uses step-level conditions for ready-to-merge label", () => {
    const job = ci.jobs["test-coverage-check"];
    // Job-level if only contains the dependabot skip; ready-to-merge guard is at step level
    expect(job.if).toContain("dependabot[bot]");
    const steps = job.steps;
    const hasReadyToMergeCondition = steps.some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (step: any) => typeof step.if === "string" && step.if.includes("ready-to-merge"),
    );
    expect(hasReadyToMergeCondition).toBe(true);
  });

  it("build job depends on lint-and-typecheck, test, and security", () => {
    const needs = ci.jobs["build"].needs;
    expect(needs).toHaveLength(3);
    expect(needs).toContain("lint-and-typecheck");
    expect(needs).toContain("test");
    expect(needs).toContain("security");
  });

  it("all jobs run on ubuntu-latest", () => {
    for (const [name, job] of Object.entries(ci.jobs)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((job as any)["runs-on"], `job "${name}" should run on ubuntu-latest`).toBe("ubuntu-latest");
    }
  });

  it("every Node job runs checkout before setup-node", () => {
    for (const jobName of NODE_JOBS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const steps = (ci.jobs[jobName] as any).steps;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const checkoutIndex = steps.findIndex((s: any) => s.uses?.startsWith("actions/checkout"));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const setupNodeIndex = steps.findIndex((s: any) => s.uses?.startsWith("actions/setup-node"));
      expect(checkoutIndex).toBeGreaterThanOrEqual(0);
      expect(setupNodeIndex).toBeGreaterThanOrEqual(0);
      expect(checkoutIndex).toBeLessThan(setupNodeIndex);
    }
  });

  it("every Node job runs npm ci before any npm run command", () => {
    for (const jobName of NODE_JOBS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const steps = (ci.jobs[jobName] as any).steps;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const npmCiIndex = steps.findIndex((s: any) => s.run === "npm ci");
      const npmRunIndices = steps
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((s: any, i: number) => (s.run && s.run.startsWith("npm run") ? i : -1))
        .filter((i: number) => i !== -1);

      expect(npmCiIndex).toBeGreaterThanOrEqual(0);
      for (const runIndex of npmRunIndices) {
        expect(npmCiIndex).toBeLessThan(runIndex);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Group 3: Script References and Environment Consistency
// ---------------------------------------------------------------------------
describe("Script references and environment consistency", () => {
  it("all npm run scripts in CI exist in package.json", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allSteps = Object.values(ci.jobs).flatMap((job: any) => job.steps);
    const npmRunScripts: string[] = [];

    for (const step of allSteps) {
      if (typeof step.run === "string") {
        const match = step.run.match(/^npm run (\S+)$/);
        if (match) {
          npmRunScripts.push(match[1]);
        }
        if (step.run === "npm test") {
          npmRunScripts.push("test");
        }
      }
    }

    expect(npmRunScripts.length).toBeGreaterThan(0);
    for (const script of npmRunScripts) {
      expect(pkg.scripts, `missing script: ${script}`).toHaveProperty(script);
    }
  });

  it("npm test command in CI maps to an existing package.json script", () => {
    expect(pkg.scripts.test).toBeDefined();

    const testJob = ci.jobs.test;
    const hasNpmTest = testJob.steps.some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (step: any) => typeof step.run === "string" && step.run === "npm test",
    );
    expect(hasNpmTest).toBe(true);
  });

  it("all Node jobs use Node version 20", () => {
    for (const jobName of NODE_JOBS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const job = ci.jobs[jobName] as any;
      const setupNode = job.steps.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (step: any) =>
          typeof step.uses === "string" &&
          step.uses.startsWith("actions/setup-node@"),
      );
      expect(
        setupNode,
        `job "${jobName}" is missing setup-node step`,
      ).toBeDefined();
      expect(setupNode.with["node-version"]).toBe(20);
    }
  });

  it("Node version in CI matches package.json engines requirement", () => {
    const enginesNode = pkg.engines.node;
    expect(enginesNode).toBe(">=20");

    const ciNodeVersion = 20;
    const minVersion = parseInt(enginesNode.replace(">=", ""), 10);
    expect(ciNodeVersion).toBeGreaterThanOrEqual(minVersion);
  });

  it("all Node jobs enable npm caching", () => {
    for (const jobName of NODE_JOBS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const job = ci.jobs[jobName] as any;
      const setupNode = job.steps.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (step: any) =>
          typeof step.uses === "string" &&
          step.uses.startsWith("actions/setup-node@"),
      );
      expect(
        setupNode,
        `job "${jobName}" is missing setup-node step`,
      ).toBeDefined();
      expect(setupNode.with.cache).toBe("npm");
    }
  });

  it("CI uses actions/checkout@v4 in all jobs that need source code", () => {
    const JOBS_WITHOUT_CHECKOUT = ["diagnose"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const [jobName, job] of Object.entries(ci.jobs) as [string, any][]) {
      if (JOBS_WITHOUT_CHECKOUT.includes(jobName)) continue;
      const checkoutStep = job.steps.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (step: any) =>
          typeof step.uses === "string" &&
          step.uses.startsWith("actions/checkout@v4"),
      );
      expect(
        checkoutStep,
        `job "${jobName}" is missing actions/checkout@v4`,
      ).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Group 4: Artifact Configuration and CI Stage Coverage
// ---------------------------------------------------------------------------
describe("Artifact configuration and CI stage coverage", () => {
  const buildJob = ci.jobs.build;
  const uploadStep = buildJob.steps.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: any) => s.uses && s.uses.startsWith("actions/upload-artifact@v4"),
  );

  it("build job uploads artifact with name dist", () => {
    expect(uploadStep).toBeDefined();
    expect(uploadStep.with.name).toBe("dist");
  });

  it("build artifact path is dist/", () => {
    expect(uploadStep.with.path).toBe("dist/");
  });

  it("build artifact retention is set to 7 days", () => {
    expect(uploadStep.with["retention-days"]).toBe(7);
  });

  it("build-verification.test.ts is excluded from default vitest config", () => {
    const vitestCfg = readText("vitest.config.ts");
    expect(vitestCfg).toContain("build-verification.test.ts");
  });

  it("build-verification.test.ts is included in vitest.build.config.ts", () => {
    const buildCfg = readText("vitest.build.config.ts");
    expect(buildCfg).toContain("build-verification");
  });

  it("CI pipeline covers all required stages: lint, typecheck, test, build, build-verify", () => {
    const allRuns: string[] = [];
    for (const jobKey of Object.keys(ci.jobs)) {
      const job = ci.jobs[jobKey];
      for (const step of job.steps) {
        if (step.run) {
          allRuns.push(step.run);
        }
      }
    }
    const combined = allRuns.join("\n");
    expect(combined).toContain("npm run lint");
    expect(combined).toContain("npm run typecheck");
    expect(combined).toContain("npm test");
    expect(combined).toContain("npm run build");
    expect(combined).toContain("npm run test:build");
  });

  it("CI pipeline includes security audit step", () => {
    const allRuns: string[] = [];
    for (const jobKey of Object.keys(ci.jobs)) {
      const job = ci.jobs[jobKey];
      for (const step of job.steps) {
        if (step.run) {
          allRuns.push(step.run);
        }
      }
    }
    const combined = allRuns.join("\n");
    expect(combined).toContain("npm audit");
  });

  it("CI pipeline runs test coverage check with step-level ready-to-merge guard", () => {
    const coverageJob = ci.jobs["test-coverage-check"];
    expect(coverageJob).toBeDefined();
    // Condition moved from job-level to step-level so the job always reports a status check
    const hasReadyToMergeStep = coverageJob.steps.some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (step: any) => typeof step.if === "string" && step.if.includes("ready-to-merge"),
    );
    expect(hasReadyToMergeStep).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group 5: Security Auto-Fix Configuration
// ---------------------------------------------------------------------------
describe("Security auto-fix configuration", () => {
  const securityJob = ci.jobs.security;

  it("security job is named 'Security Audit & Auto-Fix'", () => {
    expect(securityJob.name).toBe("Security Audit & Auto-Fix");
  });

  it("security job checks out with COPILOT_PAT for push access", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checkoutStep = securityJob.steps.find((s: any) =>
      s.uses?.startsWith("actions/checkout@v4")
    );
    expect(checkoutStep.with.token).toContain("secrets.COPILOT_PAT");
  });

  it("security job uses iterative audit fix loop", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iterStep = securityJob.steps.find((s: any) => s.name === "Iterative security audit and fix");
    expect(iterStep).toBeDefined();
    expect(iterStep.run).toContain("MAX_ATTEMPTS=3");
  });

  it("iterative fix loop runs npm audit --audit-level=high", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iterStep = securityJob.steps.find((s: any) => s.name === "Iterative security audit and fix");
    expect(iterStep.run).toContain("npm audit --audit-level=high");
  });

  it("iterative fix loop runs npm audit fix without --force", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iterStep = securityJob.steps.find((s: any) => s.name === "Iterative security audit and fix");
    expect(iterStep.run).toContain("npm audit fix");
    expect(iterStep.run).not.toContain("npm audit fix --force");
  });

  it("iterative fix loop prints attempt number", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iterStep = securityJob.steps.find((s: any) => s.name === "Iterative security audit and fix");
    expect(iterStep.run).toContain("Attempt $i of $MAX_ATTEMPTS");
  });

  it("iterative fix loop commits fixes after iterations", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iterStep = securityJob.steps.find((s: any) => s.name === "Iterative security audit and fix");
    expect(iterStep.run).toContain("git commit");
    expect(iterStep.run).toContain("github-actions[bot]");
  });

  it("iterative fix loop validates dependency compatibility and rolls back if broken", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iterStep = securityJob.steps.find((s: any) => s.name === "Iterative security audit and fix");
    expect(iterStep.run).toContain("npm ls");
    expect(iterStep.run).toContain("rolling back");
    expect(iterStep.run).toContain("git checkout -- package.json package-lock.json");
  });
});

// Note: codex-review was moved to .github/workflows/codex-review.yml
// It now triggers only on Copilot pull_request_review events with unfixed suggestions.
// See src/test/codex-review.test.ts for its tests.

// ---------------------------------------------------------------------------
// Amplify Build Spec Tests (Groups 6–7)
// ---------------------------------------------------------------------------

const amplifyConfig = parse(readText("amplify.yml"));
const preBuildCommands: string[] = amplifyConfig.frontend?.phases?.preBuild?.commands ?? [];
const buildCommands: string[] = amplifyConfig.frontend?.phases?.build?.commands ?? [];

// ---------------------------------------------------------------------------
// Group 6: Amplify Build Spec File Structure
// ---------------------------------------------------------------------------
describe("amplify.yml build spec", () => {
  it("amplify.yml file exists at the repository root", () => {
    expect(fs.existsSync(path.join(ROOT, "amplify.yml"))).toBe(true);
  });

  it("amplify.yml is valid YAML", () => {
    expect(() => parse(readText("amplify.yml"))).not.toThrow();
  });

  it("amplify.yml specifies version 1", () => {
    expect(amplifyConfig.version).toBe(1);
  });

  it("amplify.yml build command is npm run build", () => {
    expect(buildCommands).toContain("npm run build");
  });

  it("amplify.yml artifact baseDirectory is dist", () => {
    expect(amplifyConfig.frontend?.artifacts?.baseDirectory).toBe("dist");
  });

  it("amplify.yml caches node_modules", () => {
    const cachePaths: string[] = amplifyConfig.frontend?.cache?.paths ?? [];
    const combined = cachePaths.join("\n");
    expect(combined).toContain("node_modules");
  });
});

// ---------------------------------------------------------------------------
// Group 7: Amplify preBuild CI Gate
// ---------------------------------------------------------------------------
describe("amplify.yml preBuild CI gate", () => {
  it("preBuild installs dependencies with npm ci", () => {
    expect(preBuildCommands).toContain("npm ci");
  });

  it("preBuild runs lint before build", () => {
    expect(preBuildCommands).toContain("npm run lint");
  });

  it("preBuild runs typecheck before build", () => {
    expect(preBuildCommands).toContain("npm run typecheck");
  });

  it("preBuild runs tests before build", () => {
    expect(preBuildCommands).toContain("npm test");
  });

  it("npm ci runs before any CI checks", () => {
    const ciIndex = preBuildCommands.indexOf("npm ci");
    const lintIndex = preBuildCommands.indexOf("npm run lint");
    const typecheckIndex = preBuildCommands.indexOf("npm run typecheck");
    const testIndex = preBuildCommands.indexOf("npm test");
    expect(ciIndex).toBeLessThan(lintIndex);
    expect(ciIndex).toBeLessThan(typecheckIndex);
    expect(ciIndex).toBeLessThan(testIndex);
  });

  it("deploy.yml does not exist (Amplify handles deployment natively)", () => {
    expect(fs.existsSync(path.join(ROOT, ".github/workflows/deploy.yml"))).toBe(false);
  });
});
