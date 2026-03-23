/**
 * Push With Scan Wait Script Tests
 *
 * Validates the structure and presence of .github/scripts/push-with-scan-wait.sh
 * and that all workflow files use it instead of bare `git push`.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SCRIPT_PATH = path.join(
  ROOT,
  ".github/scripts/push-with-scan-wait.sh"
);
const WORKFLOWS_DIR = path.join(ROOT, ".github/workflows");

describe("push-with-scan-wait.sh script", () => {
  it("script file exists", () => {
    expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
  });

  it("script is executable", () => {
    if (process.platform === "win32") return;
    const stats = fs.statSync(SCRIPT_PATH);
    // Check owner execute bit (0o100)
    expect(stats.mode & 0o100).toBeTruthy();
  });

  it("script uses set -euo pipefail for safety", () => {
    const content = fs.readFileSync(SCRIPT_PATH, "utf-8");
    expect(content).toContain("set -euo pipefail");
  });

  it("script polls GitHub API for CodeQL check runs", () => {
    const content = fs.readFileSync(SCRIPT_PATH, "utf-8");
    expect(content).toContain("check-runs");
    expect(content).toContain("GITHUB_TOKEN");
  });

  it("script implements retry with exponential backoff for push", () => {
    const content = fs.readFileSync(SCRIPT_PATH, "utf-8");
    expect(content).toContain("MAX_PUSH_RETRIES");
    expect(content).toContain("delay=$((delay * 2))");
  });

  it("script supports --skip-scan-wait flag", () => {
    const content = fs.readFileSync(SCRIPT_PATH, "utf-8");
    expect(content).toContain("--skip-scan-wait");
  });

  it("script has a configurable timeout", () => {
    const content = fs.readFileSync(SCRIPT_PATH, "utf-8");
    expect(content).toContain("SCAN_WAIT_TIMEOUT");
  });

  it("script uses temp branch strategy to bypass CodeQL push block", () => {
    const content = fs.readFileSync(SCRIPT_PATH, "utf-8");
    expect(content).toContain("temp/scan-wait");
    expect(content).toContain("TEMP_BRANCH");
  });

  it("script cleans up temp branch after push", () => {
    const content = fs.readFileSync(SCRIPT_PATH, "utf-8");
    expect(content).toContain("--delete");
    expect(content).toContain("Cleaning up temp branch");
  });

  it("script tries direct push first before temp branch strategy", () => {
    const content = fs.readFileSync(SCRIPT_PATH, "utf-8");
    const directPushIdx = content.indexOf("Attempting direct push");
    const tempBranchIdx = content.indexOf("Pushing to temp branch");
    expect(directPushIdx).toBeGreaterThan(-1);
    expect(tempBranchIdx).toBeGreaterThan(-1);
    expect(directPushIdx).toBeLessThan(tempBranchIdx);
  });

  it("script has valid bash syntax", () => {
    if (process.platform === "win32") return;
    try {
      execSync("bash --version", { stdio: "ignore" });
    } catch {
      return; // bash not available, skip
    }
    const result = execSync(`bash -n "${SCRIPT_PATH}" 2>&1`, {
      encoding: "utf-8",
    });
    expect(result).toBe("");
  });
});

describe("workflow files use push-with-scan-wait instead of bare git push", () => {
  const workflowFiles = fs
    .readdirSync(WORKFLOWS_DIR)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

  for (const file of workflowFiles) {
    const filePath = path.join(WORKFLOWS_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");

    // Only test workflows that contain push-related operations
    if (
      content.includes("git commit") &&
      (content.includes("git push") ||
        content.includes("push-with-scan-wait"))
    ) {
      it(`${file} uses push-with-scan-wait.sh instead of bare git push`, () => {
        // Should not contain bare "git push" (only as part of push-with-scan-wait.sh)
        const lines = content.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === "git push" || trimmed === "git push;") {
            throw new Error(
              `${file} contains bare 'git push' — use push-with-scan-wait.sh instead`
            );
          }
        }
      });
    }
  }
});
