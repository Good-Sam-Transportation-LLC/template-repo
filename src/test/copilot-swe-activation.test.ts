/**
 * Copilot SWE Agent Activation Tests
 *
 * Validates that the SWE agent is activated via a mentioning comment (@copilot)
 * in the evaluate-and-fix job of copilot-recursive-loop.yml.
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

const getEvalJob = () => {
  if (!workflow || typeof workflow !== "object") {
    throw new Error(
      `Workflow was not loaded from expected path: ${WORKFLOW_PATH}`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobs = (workflow as Record<string, any>).jobs;
  if (!jobs || typeof jobs !== "object") {
    throw new Error(
      "Workflow does not define any jobs. Ensure the workflow YAML has a top-level 'jobs' key.",
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = jobs["evaluate-and-fix"] as Record<string, any> | undefined;
  if (!job) {
    throw new Error(
      'Workflow job "evaluate-and-fix" was not found. Ensure the job name matches the test expectations.',
    );
  }

  return job;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSteps = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const steps = getEvalJob().steps as any;
  if (!Array.isArray(steps)) {
    throw new Error(
      'Workflow job "evaluate-and-fix" does not define a valid "steps" array.',
    );
  }
  return steps as any[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getCollectStep = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const step = getSteps().find((s: any) =>
    String(s.name).includes("Collect unresolved comments"),
  );
  if (!step) {
    throw new Error(
      'Step with name including "Collect unresolved comments" was not found in the "evaluate-and-fix" job.',
    );
  }
  return step;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getDebugStep = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const step = getSteps().find((s: any) =>
    String(s.name).includes("Debug"),
  );
  if (!step) {
    throw new Error(
      'Step with name including "Debug" was not found in the "evaluate-and-fix" job.',
    );
  }
  return step;
};

const getScript = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const collectStep = getCollectStep() as any;
  const script = collectStep?.with?.script;
  if (typeof script !== "string") {
    throw new Error(
      'The "Collect unresolved comments" step is missing a string "with.script" property.',
    );
  }
  return script as string;
};

// ---------------------------------------------------------------------------
// Group 2: Authentication — COPILOT_PAT required for bot activation
// ---------------------------------------------------------------------------
describe("SWE agent authentication", () => {
  it("uses COPILOT_PAT in the env block", () => {
    const step = getCollectStep();
    expect(String(step.env.GH_TOKEN)).toContain("COPILOT_PAT");
  });

  it("passes COPILOT_PAT as github-token to actions/github-script", () => {
    const step = getCollectStep();
    expect(String(step.with["github-token"])).toContain("COPILOT_PAT");
  });

  it("does not use GITHUB_TOKEN for the createComment call", () => {
    const step = getCollectStep();
    expect(String(step.with["github-token"])).not.toContain("GITHUB_TOKEN");
  });
});

// ---------------------------------------------------------------------------
// Group 3: Comment body content
// ---------------------------------------------------------------------------
describe("SWE agent comment body", () => {
  it("includes @copilot mention in the comment body template", () => {
    const script = getScript();
    // The body passed to createComment must reference @copilot
    const createCommentIdx = script.indexOf("issues.createComment");
    expect(createCommentIdx).toBeGreaterThan(-1);
    // @copilot must appear after the createComment call (inside its body argument)
    const afterCreate = script.substring(createCommentIdx);
    expect(afterCreate).toContain("@copilot");
  });

  it("references the review URL via REVIEW_URL env var", () => {
    const step = getCollectStep();
    expect(step.env).toHaveProperty("REVIEW_URL");
    const script = getScript();
    expect(script).toContain("REVIEW_URL");
  });

  it("includes the count of unresolved review comments", () => {
    const script = getScript();
    expect(script).toContain("fixItems.length");
    expect(script).toContain("unresolved review comment");
  });

  it("contains the magic phrase used for circuit breaker counting", () => {
    const script = getScript();
    expect(script).toContain("The Copilot Code Reviewer found issues");
  });

  it("instructs the SWE agent to push fixes to the branch", () => {
    const script = getScript();
    expect(script).toContain("push");
    expect(script).toContain("fixes");
  });
});

// ---------------------------------------------------------------------------
// Group 4: Step gating — only fires when needed
// ---------------------------------------------------------------------------
describe("SWE agent activation gating", () => {
  it("is gated on has_issues == true", () => {
    const cond = String(getCollectStep().if);
    expect(cond).toContain("has_issues");
    expect(cond).toContain("true");
  });

  it("is gated on circuit breaker not tripped (loop-limit stop == false)", () => {
    const cond = String(getCollectStep().if);
    expect(cond).toContain("loop-limit");
    expect(cond).toContain("false");
  });

  it("is gated on dedup guard (skip == false)", () => {
    const cond = String(getCollectStep().if);
    const expectedSkipCond = "steps.dedup.outputs.skip == 'false'";
    expect(cond).toContain(expectedSkipCond);
  });
});

// ---------------------------------------------------------------------------
// Group 5: Step sequencing — PR body update before comment, debug after
// ---------------------------------------------------------------------------
describe("SWE agent activation sequencing", () => {
  it("updates PR body with copilot-tasks section BEFORE creating the @copilot comment", () => {
    const script = getScript();
    const updateIdx = script.indexOf("pulls.update");
    const commentIdx = script.indexOf("issues.createComment");
    expect(updateIdx).toBeGreaterThan(-1);
    expect(commentIdx).toBeGreaterThan(-1);
    expect(commentIdx).toBeGreaterThan(updateIdx);
  });

  it("includes copilot-tasks markers in the PR body update", () => {
    const script = getScript();
    expect(script).toContain("copilot-tasks-start");
    expect(script).toContain("copilot-tasks-end");
  });

  it("debug verification step exists after the collect step", () => {
    const steps = getSteps();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collectIdx = steps.findIndex((s: any) =>
      String(s.name).includes("Collect unresolved comments"),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const debugIdx = steps.findIndex((s: any) =>
      String(s.name).includes("Debug"),
    );
    expect(debugIdx).toBeGreaterThan(-1);
    expect(debugIdx).toBeGreaterThan(collectIdx);
  });

  it("debug step verifies SWE agent activation", () => {
    const debugStep = getDebugStep();
    expect(debugStep).toBeDefined();
    expect(debugStep.run).toContain("Copilot SWE agent activated");
  });

  it("debug step checks for @copilot comments on the PR", () => {
    const debugStep = getDebugStep();
    expect(debugStep.run).toContain("@copilot");
  });
});
