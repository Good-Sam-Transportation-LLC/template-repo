#!/usr/bin/env bash
set -euo pipefail

# Generate Test Stubs
# Creates test file stubs for source files that don't have tests.
# Usage: ./generate-test-stubs.sh [file1.tsx file2.ts ...]
#   If no files given, checks all changed files vs HEAD~1

if [ $# -gt 0 ]; then
  FILES="$*"
else
  FILES=$(git diff --name-only HEAD~1 HEAD | grep -E '^src/.*\.(ts|tsx)$' || true)
fi

if [ -z "$FILES" ]; then
  echo "No source files to process."
  exit 0
fi

GENERATED=0

for file in $FILES; do
  # Skip files that don't need tests
  case "$file" in
    src/components/ui/*) continue ;;
    src/test/*) continue ;;
    *.test.ts|*.test.tsx) continue ;;
    *.spec.ts|*.spec.tsx) continue ;;
    *.d.ts) continue ;;
    src/main.tsx) continue ;;
    src/vite-env.d.ts) continue ;;
  esac

  dir=$(dirname "$file")
  basename_file=$(basename "$file")
  name="${basename_file%.*}"
  ext="${basename_file##*.}"
  test_dir="${dir}/__tests__"
  test_file="${test_dir}/${name}.test.${ext}"

  # Skip if test already exists
  if [ -f "$test_file" ]; then
    echo "SKIP: $file (test exists at $test_file)"
    continue
  fi

  mkdir -p "$test_dir"

  # Determine import path using @/ alias
  import_path="@/${file#src/}"
  import_path="${import_path%.*}"

  # Detect if it's a React component (TSX) or utility (TS)
  if [ "$ext" = "tsx" ]; then
    # Convert kebab-case name to PascalCase for use as a JS identifier
    # e.g. "use-mobile" -> "UseMobile", "my-component" -> "MyComponent"
    component_name=$(echo "$name" | awk 'BEGIN{FS="-"; OFS=""} {for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2); print}')
    # Generate React component test stub
    cat > "$test_file" << TESTEOF
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ${component_name} from "${import_path}";

describe("${component_name}", () => {
  it("renders without crashing", () => {
    render(<${component_name} />);
    expect(document.body).toBeTruthy();
  });

  it("renders expected content", () => {
    render(<${component_name} />);
    // TODO: Add assertions for expected content
    expect(screen.getByRole("generic")).toBeTruthy();
  });
});
TESTEOF
  else
    # Generate utility/hook test stub
    module_name=$(echo "$name" | awk 'BEGIN{FS="-"; OFS=""} {for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2); print}')
    cat > "$test_file" << TESTEOF
import { describe, it, expect } from "vitest";
import * as module from "${import_path}";

describe("${module_name}", () => {
  it("module exports are defined", () => {
    expect(module).toBeDefined();
  });

  it("has expected exports", () => {
    const exports = Object.keys(module);
    expect(exports.length).toBeGreaterThan(0);
    // TODO: Add specific tests for each export
  });
});
TESTEOF
  fi

  echo "GENERATED: $test_file"
  GENERATED=$((GENERATED + 1))
done

echo ""
echo "Generated $GENERATED test stub(s)."
