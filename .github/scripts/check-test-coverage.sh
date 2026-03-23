#!/usr/bin/env bash
set -euo pipefail

# PR Test Coverage Check
# Verifies that new/changed source files have corresponding test files.
# Usage: ./check-test-coverage.sh [base-ref]
#   base-ref defaults to GITHUB_BASE_REF (set by GitHub Actions) or "main"

BASE_REF="${GITHUB_BASE_REF:-${1:-main}}"

# Ensure base ref is available
git fetch origin "$BASE_REF" --depth=1 2>/dev/null || true

# Get changed/added .ts/.tsx files under src/
CHANGED_FILES=$(git diff --name-only --diff-filter=ACM "origin/${BASE_REF}...HEAD" | grep -E '^src/.*\.(ts|tsx)$' || true)

if [ -z "$CHANGED_FILES" ]; then
  echo "No source files changed. Nothing to check."
  exit 0
fi

MISSING=()
CHECKED=0

while IFS= read -r file; do
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

  # Derive expected test path
  dir=$(dirname "$file")
  basename=$(basename "$file")
  name="${basename%.*}"
  ext="${basename##*.}"
  expected_test="${dir}/__tests__/${name}.test.${ext}"
  alt_test="${dir}/__tests__/${name}.test.ts"

  CHECKED=$((CHECKED + 1))

  if [ -f "$expected_test" ]; then
    echo "OK: $file"
  elif [ "$ext" = "tsx" ] && [ -f "$alt_test" ]; then
    echo "OK (found .test.ts): $file"
  else
    MISSING+=("$file -> $expected_test")
    echo "MISSING: $file"
    echo "  Expected test at: $expected_test"
  fi
done <<< "$CHANGED_FILES"

echo ""
echo "Checked $CHECKED source file(s) for test coverage."

if [ ${#MISSING[@]} -gt 0 ]; then
  echo ""
  echo "FAIL: ${#MISSING[@]} file(s) missing tests:"
  for m in "${MISSING[@]}"; do
    echo "  - $m"
  done
  exit 1
else
  echo "PASS: All changed source files have corresponding tests."
  exit 0
fi
