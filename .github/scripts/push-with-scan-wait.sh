#!/usr/bin/env bash
# push-with-scan-wait.sh
#
# Pushes commits while satisfying repository rules that require CodeQL results.
#
# Strategy: Push to a temporary branch first (bypasses the rule), wait for
# CodeQL to scan the commit on that branch, then push to the real target
# branch (CodeQL results now exist for the commit SHA). Clean up the temp
# branch afterwards.
#
# This solves the chicken-and-egg problem where GitHub rejects the push
# because CodeQL hasn't scanned the new commit yet, but CodeQL can't scan
# it until it's on GitHub.
#
# Usage: bash .github/scripts/push-with-scan-wait.sh [--skip-scan-wait]
#
# Required env vars (auto-set in GitHub Actions):
#   GITHUB_TOKEN       — auth token for API calls and push
#   GITHUB_REPOSITORY  — owner/repo
#
# Optional:
#   SCAN_WAIT_TIMEOUT  — max seconds to wait for scanning (default: 600)
#   SCAN_POLL_INTERVAL — seconds between polls (default: 30)

set -euo pipefail

SKIP_SCAN_WAIT=false
if [[ "${1:-}" == "--skip-scan-wait" ]]; then
  SKIP_SCAN_WAIT=true
fi

TIMEOUT="${SCAN_WAIT_TIMEOUT:-600}"
POLL_INTERVAL="${SCAN_POLL_INTERVAL:-30}"
MAX_PUSH_RETRIES=4
REPO="${GITHUB_REPOSITORY:-}"
TARGET_BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT_SHA=$(git rev-parse HEAD)
SHORT_SHA="${COMMIT_SHA:0:7}"
TEMP_BRANCH="temp/scan-wait/${TARGET_BRANCH}/${SHORT_SHA}"

# --- Helper: push with retry + exponential backoff ---
push_with_retry() {
  local refspec="$1"
  local label="$2"
  local delay=2

  for attempt in $(seq 1 $MAX_PUSH_RETRIES); do
    echo "  ${label} — attempt ${attempt} of ${MAX_PUSH_RETRIES}..."
    if git push origin "$refspec" 2>&1; then
      echo "  ${label} — succeeded on attempt ${attempt}."
      return 0
    fi

    if (( attempt < MAX_PUSH_RETRIES )); then
      echo "  ${label} — failed. Retrying in ${delay}s..."
      sleep "$delay"
      delay=$((delay * 2))
    fi
  done

  echo "  ${label} — failed after ${MAX_PUSH_RETRIES} attempts."
  return 1
}

# --- Helper: wait for CodeQL check runs to complete for a commit ---
wait_for_codeql() {
  local sha="$1"
  local elapsed=0

  echo "Waiting for CodeQL to complete for commit ${sha:0:7}..."

  # Grace period: CodeQL check runs may take a few seconds to be created
  sleep 10

  while (( elapsed < TIMEOUT )); do
    response=$(curl -s -w "\n%{http_code}" \
      -H "Authorization: Bearer $GITHUB_TOKEN" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/repos/${REPO}/commits/${sha}/check-runs?check_name=Analyze&per_page=100" \
    ) || true

    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | sed '$d')

    if [[ "$http_code" != "200" ]]; then
      echo "Warning: GitHub API returned HTTP $http_code — skipping scan wait."
      return 0
    fi

    total_count=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total_count', 0))" 2>/dev/null || echo "0")

    if [[ "$total_count" == "0" ]]; then
      echo "No CodeQL check runs found — proceeding."
      return 0
    fi

    pending=$(echo "$body" | python3 -c "
import sys, json
data = json.load(sys.stdin)
runs = data.get('check_runs', [])
pending = [r for r in runs if r.get('status') != 'completed']
print(len(pending))
" 2>/dev/null || echo "0")

    if [[ "$pending" == "0" ]]; then
      echo "All CodeQL check runs completed for ${sha:0:7}."
      return 0
    fi

    echo "  ${pending} CodeQL check run(s) still in progress... waiting ${POLL_INTERVAL}s (${elapsed}s/${TIMEOUT}s elapsed)"
    sleep "$POLL_INTERVAL"
    elapsed=$((elapsed + POLL_INTERVAL))
  done

  echo "Warning: Timed out after ${TIMEOUT}s waiting for CodeQL. Proceeding anyway."
  return 0
}

# --- Main logic ---
echo "Target branch: ${TARGET_BRANCH}"
echo "Commit SHA:    ${SHORT_SHA}"

# Try direct push first — may work if CodeQL results already exist or rule doesn't apply
echo ""
echo "=== Step 1: Attempting direct push ==="
if push_with_retry "HEAD:refs/heads/${TARGET_BRANCH}" "Direct push"; then
  exit 0
fi

# Direct push failed — use temp branch strategy
if [[ "$SKIP_SCAN_WAIT" == "true" ]]; then
  echo "Scan wait skipped (--skip-scan-wait flag). Direct push failed."
  exit 1
fi

if [[ -z "$REPO" || -z "${GITHUB_TOKEN:-}" ]]; then
  echo "Error: GITHUB_REPOSITORY or GITHUB_TOKEN not set. Cannot use temp branch strategy."
  exit 1
fi

echo ""
echo "=== Step 2: Pushing to temp branch ${TEMP_BRANCH} ==="
if ! push_with_retry "HEAD:refs/heads/${TEMP_BRANCH}" "Temp branch push"; then
  echo "Error: Could not push to temp branch either."
  exit 1
fi

echo ""
echo "=== Step 3: Waiting for CodeQL to scan commit on temp branch ==="
wait_for_codeql "$COMMIT_SHA"

echo ""
echo "=== Step 4: Pushing to target branch ${TARGET_BRANCH} ==="
if ! push_with_retry "HEAD:refs/heads/${TARGET_BRANCH}" "Target branch push"; then
  echo "Error: Push to target branch failed even after CodeQL completed."
  # Clean up temp branch before exiting
  echo "Cleaning up temp branch..."
  git push origin --delete "${TEMP_BRANCH}" 2>/dev/null || true
  exit 1
fi

echo ""
echo "=== Step 5: Cleaning up temp branch ==="
git push origin --delete "${TEMP_BRANCH}" 2>/dev/null || echo "Warning: Could not delete temp branch ${TEMP_BRANCH}"

echo ""
echo "Push completed successfully."
exit 0
