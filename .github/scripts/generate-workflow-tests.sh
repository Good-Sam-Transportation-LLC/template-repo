#!/usr/bin/env bash
set -euo pipefail

# Generate Workflow Tests
# Scans .github/workflows/ for YAML files and generates Vitest test files
# for any workflow that lacks a corresponding test.
# Usage: ./generate-workflow-tests.sh

ROOT="$(git rev-parse --show-toplevel)"
WORKFLOWS_DIR="${ROOT}/.github/workflows"
TESTS_DIR="${ROOT}/src/test"
GENERATED=0

if [ ! -d "$WORKFLOWS_DIR" ]; then
  echo "No workflows directory found."
  exit 0
fi

for workflow_file in "${WORKFLOWS_DIR}"/*.yml; do
  [ -f "$workflow_file" ] || continue

  basename_file=$(basename "$workflow_file")
  name="${basename_file%.yml}"

  # Check if any test file references this workflow
  if grep -rl "${basename_file}" "${TESTS_DIR}/"*.test.ts 2>/dev/null | head -1 > /dev/null 2>&1; then
    echo "COVERED: ${basename_file} (test exists)"
    continue
  fi

  # Generate a test file
  test_file="${TESTS_DIR}/${name}-workflow.test.ts"

  if [ -f "$test_file" ]; then
    echo "SKIP: ${test_file} already exists"
    continue
  fi

  cat > "$test_file" << 'TESTEOF'
/**
 * Auto-generated workflow validation tests
 * Workflow: WORKFLOW_FILENAME
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parse } from "yaml";

const ROOT = path.resolve(import.meta.dirname, "../..");
const readText = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf-8");

const workflowPath = "WORKFLOW_PATH";
const workflowYaml = readText(workflowPath);
const workflow = parse(workflowYaml);

describe("WORKFLOW_NAME workflow", () => {
  it("workflow file exists", () => {
    expect(fs.existsSync(path.join(ROOT, workflowPath))).toBe(true);
  });

  it("workflow has a name", () => {
    expect(workflow.name).toBeDefined();
    expect(typeof workflow.name).toBe("string");
  });

  it("workflow has triggers defined", () => {
    expect(workflow.on).toBeDefined();
  });

  it("workflow defines at least one job", () => {
    expect(Object.keys(workflow.jobs).length).toBeGreaterThan(0);
  });

  it("all jobs run on ubuntu-latest", () => {
    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      expect((job as any)["runs-on"], `job "${jobName}" should run on ubuntu-latest`).toBe("ubuntu-latest");
    }
  });

  it("all jobs use actions/checkout@v4", () => {
    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      const steps = (job as any).steps || [];
      const hasCheckout = steps.some(
        (s: any) => typeof s.uses === "string" && s.uses.startsWith("actions/checkout")
      );
      expect(hasCheckout, `job "${jobName}" should use actions/checkout`).toBe(true);
    }
  });
});
TESTEOF

  # Replace placeholders
  sed -i "s|WORKFLOW_FILENAME|${basename_file}|g" "$test_file"
  sed -i "s|WORKFLOW_PATH|.github/workflows/${basename_file}|g" "$test_file"
  sed -i "s|WORKFLOW_NAME|${name}|g" "$test_file"

  echo "GENERATED: ${test_file}"
  GENERATED=$((GENERATED + 1))
done

echo ""
echo "Generated ${GENERATED} workflow test file(s)."
