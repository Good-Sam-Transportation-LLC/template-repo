import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { parse } from "yaml";

const WORKFLOW_PATH = resolve(import.meta.dirname, "../../.github/workflows/auto-test-generation.yml");
const TEMPLATE_WORKFLOW_PATH = resolve(
  import.meta.dirname,
  "../../template/.github/workflows/auto-test-generation.yml"
);

function loadWorkflow(filePath: string) {
  const content = readFileSync(filePath, "utf-8");
  return parse(content) as Record<string, unknown>;
}

describe("auto-test-generation workflow", () => {
  it("workflow file exists", () => {
    expect(existsSync(WORKFLOW_PATH)).toBe(true);
  });

  it("template workflow file exists and matches the main workflow", () => {
    expect(existsSync(TEMPLATE_WORKFLOW_PATH)).toBe(true);
    const main = readFileSync(WORKFLOW_PATH, "utf-8");
    const template = readFileSync(TEMPLATE_WORKFLOW_PATH, "utf-8");
    expect(template).toBe(main);
  });

  describe("workflow structure", () => {
    let workflow: Record<string, unknown>;

    beforeAll(() => {
      workflow = loadWorkflow(WORKFLOW_PATH);
    });

    it('is named "Auto Test Generation"', () => {
      expect(workflow.name).toBe("Auto Test Generation");
    });

    it("triggers on push to all branches", () => {
      const on = workflow.on as Record<string, unknown>;
      expect(on).toHaveProperty("push");
      const push = on.push as Record<string, unknown>;
      expect(push.branches).toEqual(["**"]);
    });

    it("requests contents:write and pull-requests:write permissions", () => {
      const perms = workflow.permissions as Record<string, string>;
      expect(perms.contents).toBe("write");
      expect(perms["pull-requests"]).toBe("write");
    });

    it("has a generate-tests job", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      expect(jobs).toHaveProperty("generate-tests");
    });

    it("job has a conditional that checks for bot-authored commits only", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["generate-tests"] as Record<string, unknown>;
      const condition = String(job.if);
      // Should only match bot authors, not commit message content
      expect(condition).toContain("github-actions[bot]");
      expect(condition).toContain("copilot[bot]");
      // Should NOT have broad message-based checks that match human commits
      expect(condition).not.toContain("'copilot'");
      expect(condition).not.toContain("'codex'");
      expect(condition).not.toContain("'auto-fix'");
    });

    it("runs on ubuntu-latest", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["generate-tests"] as Record<string, unknown>;
      expect(job["runs-on"]).toBe("ubuntu-latest");
    });

    it("checks out code with fetch-depth: 0", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["generate-tests"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const checkout = steps.find((s) => s.uses === "actions/checkout@v4");
      expect(checkout).toBeDefined();
      const withObj = checkout!.with as Record<string, unknown>;
      expect(withObj["fetch-depth"]).toBe(0);
    });

    it("sets up Node.js 20 with npm cache", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["generate-tests"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const setup = steps.find((s) =>
        String(s.uses || "").startsWith("actions/setup-node@")
      );
      expect(setup).toBeDefined();
      const withObj = setup!.with as Record<string, unknown>;
      expect(withObj["node-version"]).toBe(20);
      expect(withObj.cache).toBe("npm");
    });

    it("runs npm ci to install dependencies", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["generate-tests"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const npmCi = steps.find((s) => s.run === "npm ci");
      expect(npmCi).toBeDefined();
    });

    it("has a find-missing step that identifies changed files without tests", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["generate-tests"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const findMissing = steps.find((s) => s.id === "find-missing");
      expect(findMissing).toBeDefined();
      const script = String(findMissing!.run);
      expect(script).toContain("git diff --name-only HEAD~1 HEAD");
      expect(script).toContain("__tests__");
      // Skips UI components, test files, type defs, main.tsx
      expect(script).toContain("src/components/ui/*");
      expect(script).toContain("src/test/*");
      expect(script).toContain("*.test.ts");
      expect(script).toContain("src/main.tsx");
      expect(script).toContain("src/vite-env.d.ts");
    });

    it("installs Codex CLI conditionally when missing tests are found", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["generate-tests"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const installCodex = steps.find(
        (s) => s.name === "Install OpenAI Codex CLI"
      );
      expect(installCodex).toBeDefined();
      expect(String(installCodex!.if)).toContain("find-missing");
      expect(String(installCodex!.run)).toContain("@openai/codex");
    });

    it("generates tests with Codex using dangerously-bypass-approvals-and-sandbox", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["generate-tests"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const genTests = steps.find(
        (s) => s.name === "Generate tests with Codex"
      );
      expect(genTests).toBeDefined();
      const script = String(genTests!.run);
      expect(script).toContain("codex exec --dangerously-bypass-approvals-and-sandbox");
      expect(script).toContain("Vitest");
      expect(script).toContain("@testing-library/react");
      // Uses CODEX_API_KEY secret
      const env = genTests!.env as Record<string, string>;
      expect(env.CODEX_API_KEY).toContain("secrets.CODEX_API_KEY");
    });

    it("runs tests after generation without continue-on-error (fails fast)", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["generate-tests"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const runTests = steps.find((s) => s.name === "Run generated tests");
      expect(runTests).toBeDefined();
      expect(runTests!.run).toBe("npm test");
      expect(runTests!["continue-on-error"]).toBeUndefined();
    });

    it("commits and pushes generated tests as github-actions[bot]", () => {
      const jobs = workflow.jobs as Record<string, unknown>;
      const job = jobs["generate-tests"] as Record<string, unknown>;
      const steps = job.steps as Array<Record<string, unknown>>;
      const commitStep = steps.find(
        (s) => s.name === "Commit generated tests"
      );
      expect(commitStep).toBeDefined();
      const script = String(commitStep!.run);
      expect(script).toContain('git config user.name "github-actions[bot]"');
      expect(script).toContain("git add");
      expect(script).toContain("git diff --cached --quiet");
      expect(script).toContain("Auto-generate test suite for recent fixes");
      expect(script).toContain("push-with-scan-wait");
    });
  });
});
