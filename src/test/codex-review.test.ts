import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { parse } from "yaml";

const WORKFLOW_PATH = resolve(import.meta.dirname, "../../.github/workflows/codex-review.yml");

function loadWorkflow(filePath: string) {
  const content = readFileSync(filePath, "utf-8");
  return parse(content) as Record<string, unknown>;
}

describe("codex-review workflow", () => {
  it("workflow file exists at .github/workflows/codex-review.yml", () => {
    expect(existsSync(WORKFLOW_PATH)).toBe(true);
  });

  describe("triggers", () => {
    let workflow: Record<string, unknown>;
    beforeEach(() => {
      workflow = loadWorkflow(WORKFLOW_PATH);
    });

    it("triggers on pull_request_review submitted event", () => {
      const on = workflow.on as Record<string, unknown>;
      const prReview = on["pull_request_review"] as Record<string, unknown>;
      expect(prReview).toBeDefined();
      expect(prReview.types).toContain("submitted");
    });

    it("does NOT trigger on push or other CI events", () => {
      const on = workflow.on as Record<string, unknown>;
      expect(on["push"]).toBeUndefined();
      expect(on["workflow_run"]).toBeUndefined();
    });
  });

  describe("job structure", () => {
    let workflow: Record<string, unknown>;
    beforeEach(() => {
      workflow = loadWorkflow(WORKFLOW_PATH);
    });

    it("has a codex-review job", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      expect(jobs["codex-review"]).toBeDefined();
    });

    it("codex-review job only runs for human (non-bot) reviews", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      expect(String(job.if)).toContain("user.type");
      expect(String(job.if)).toContain("User");
      expect(String(job.if)).toContain("review.state");
      expect(String(job.if)).toContain("approved");
      expect(String(job.if)).toContain("copilot");
    });

    it("has a step that checks for unfixed suggestions", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const checkStep = steps.find(s => s.name === "Check for unfixed Copilot suggestions");
      expect(checkStep).toBeDefined();
      expect(checkStep!.id).toBe("check-suggestions");
    });

    it("Codex install step is gated on has_suggestions output", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const installStep = steps.find(
        s => typeof s.run === "string" && s.run.includes("@openai/codex")
      );
      expect(installStep).toBeDefined();
      expect(String(installStep!.if)).toContain("has_suggestions");
      expect(String(installStep!.if)).toContain("true");
    });

    it("Codex apply step is gated on has_suggestions output", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const applyStep = steps.find(s => s.name === "Apply unfixed suggestions with Codex");
      expect(applyStep).toBeDefined();
      expect(String(applyStep!.if)).toContain("has_suggestions");
    });

    it("Codex apply step uses --dangerously-bypass-approvals-and-sandbox", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const applyStep = steps.find(s => s.name === "Apply unfixed suggestions with Codex");
      expect(String(applyStep!.run)).toContain("codex exec --dangerously-bypass-approvals-and-sandbox");
    });

    it("Codex apply step reads prompt from /tmp/codex-prompt.txt (not inline text)", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const applyStep = steps.find(s => s.name === "Apply unfixed suggestions with Codex");
      const run = String(applyStep!.run);
      // Prompt must come from the file written by the check step, not inline
      expect(run).toContain("/tmp/codex-prompt.txt");
      expect(run).not.toContain("review each suggestion and apply it");
    });

    it("Codex apply step fails fast when CODEX_API_KEY is missing", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const applyStep = steps.find(s => s.name === "Apply unfixed suggestions with Codex");
      const run = String(applyStep!.run);
      expect(run).toContain("exit 1");
      expect(run).not.toContain("exit 0");
    });

    it("check-suggestions step writes structured JSON to /tmp/copilot-suggestions.json", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const checkStep = steps.find(s => s.name === "Check for unfixed Copilot suggestions");
      const script = String((checkStep!.with as Record<string, unknown>).script);
      expect(script).toContain("/tmp/copilot-suggestions.json");
    });

    it("check-suggestions step writes targeted prompt to /tmp/codex-prompt.txt", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const checkStep = steps.find(s => s.name === "Check for unfixed Copilot suggestions");
      const script = String((checkStep!.with as Record<string, unknown>).script);
      expect(script).toContain("/tmp/codex-prompt.txt");
    });

    it("check-suggestions step includes file path and line range in the prompt", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const checkStep = steps.find(s => s.name === "Check for unfixed Copilot suggestions");
      const script = String((checkStep!.with as Record<string, unknown>).script);
      // Prompt directives reference file and line information
      expect(script).toContain("t.file");
      expect(script).toContain("t.startLine");
      expect(script).toContain("t.endLine");
    });

    it("check-suggestions step extracts replacement code from suggestion blocks", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const checkStep = steps.find(s => s.name === "Check for unfixed Copilot suggestions");
      const script = String((checkStep!.with as Record<string, unknown>).script);
      // Must parse suggestion fences, not pass raw markdown to Codex
      expect(script).toContain("```suggestion");
      expect(script).toContain("replacementCode");
      expect(script).toContain("t.replacementCode");
    });

    it("commit step is gated on has_suggestions output", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const commitStep = steps.find(s => s.name === "Commit and push applied suggestions");
      expect(commitStep).toBeDefined();
      expect(String(commitStep!.if)).toContain("has_suggestions");
    });

    it("does not have continue-on-error (fails fast)", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      expect(job["continue-on-error"]).toBeUndefined();
    });

    it("check-suggestions step fetches the PR diff from the GitHub API", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const checkStep = steps.find(s => s.name === "Check for unfixed Copilot suggestions");
      const script = String((checkStep!.with as Record<string, unknown>).script);
      expect(script).toMatch(/pulls\.get|git diff/);
    });

    it("check-suggestions step includes PR diff in the prompt", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const checkStep = steps.find(s => s.name === "Check for unfixed Copilot suggestions");
      const script = String((checkStep!.with as Record<string, unknown>).script);
      expect(script).toContain("prDiff");
      expect(script).toContain("SECTION A");
    });

    it("check-suggestions step processes free-text review comments", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const checkStep = steps.find(s => s.name === "Check for unfixed Copilot suggestions");
      const script = String((checkStep!.with as Record<string, unknown>).script);
      expect(script).toContain("freeTextComments");
      expect(script).toContain("SECTION C");
    });

    it("check-suggestions step ignores known automation approval messages", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const checkStep = steps.find(s => s.name === "Check for unfixed Copilot suggestions");
      const script = String((checkStep!.with as Record<string, unknown>).script);
      expect(script).toContain("isAutomationNoise");
      expect(script).toContain("Auto-approved:");
      expect(script).toContain("sub-PR merged by automation");
    });

    it("check-suggestions step includes free-text comments as fix directives", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const checkStep = steps.find(s => s.name === "Check for unfixed Copilot suggestions");
      const script = String((checkStep!.with as Record<string, unknown>).script);
      expect(script).toContain("The reviewer said");
      expect(script).toContain("investigate and fix");
    });

    it("check-suggestions step always outputs has_suggestions=true for human reviews", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const checkStep = steps.find(s => s.name === "Check for unfixed Copilot suggestions");
      const script = String((checkStep!.with as Record<string, unknown>).script);
      expect(script).not.toContain("core.setOutput('has_suggestions', 'false')");
      expect(script).toContain("core.setOutput('has_suggestions', 'true')");
    });

    it("check-suggestions prompt has all four required sections", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const checkStep = steps.find(s => s.name === "Check for unfixed Copilot suggestions");
      const script = String((checkStep!.with as Record<string, unknown>).script);
      expect(script).toContain("SECTION A");
      expect(script).toContain("SECTION B");
      expect(script).toContain("SECTION C");
      expect(script).toContain("SECTION D");
    });

    it("does NOT have a step to assign Copilot to PR", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const sweStep = steps.find(s => String(s.name || "").toLowerCase().includes("assign copilot"));
      expect(sweStep).toBeUndefined();
    });

    it("job condition explicitly excludes copilot bot reviews", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["codex-review"] as Record<string, unknown>;
      const condition = String(job.if);
      // Exclude generic bot accounts (anything ending with [bot])
      expect(condition).toContain("!endsWith(github.event.review.user.login, '[bot]')");
      // Exclude Copilot-related reviewers explicitly
      expect(condition).toContain("!contains(github.event.review.user.login, 'copilot')");
      expect(condition).toContain("github.event.review.user.login != 'Copilot'");
      // Exclude GitHub Actions or other automation actors
      expect(condition).toContain("!contains(github.event.review.user.login, 'github-actions')");
    });
  });
});
