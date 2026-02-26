#!/usr/bin/env bash
# verify-push.sh — Wait for CI to complete after a git push, report pass/fail
#
# Usage: ./scripts/verify-push.sh [branch] [--fix]
#   branch: defaults to current branch
#   --fix:  if CI fails, pull logs and suggest fixes
#
# Requires: gh CLI authenticated

set -euo pipefail

BRANCH="${1:-$(git branch --show-current)}"
FIX_MODE="${2:-}"
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
MAX_WAIT=300  # 5 minutes max
POLL_INTERVAL=15

echo "=== KATHA CI Verification ==="
echo "Repo:   $REPO"
echo "Branch: $BRANCH"
echo ""

# Wait for the run to appear
echo "Waiting for CI run to start..."
RUN_ID=""
for i in $(seq 1 20); do
  RUN_ID=$(gh run list --branch "$BRANCH" --limit 1 --json databaseId,status -q '.[0].databaseId' 2>/dev/null || true)
  if [ -n "$RUN_ID" ]; then
    break
  fi
  sleep 5
done

if [ -z "$RUN_ID" ]; then
  echo "❌ No CI run found for branch $BRANCH after 100s"
  echo "   Check: Is the workflow file committed? Is GitHub Actions enabled?"
  exit 1
fi

echo "CI Run ID: $RUN_ID"
echo "Watching: https://github.com/$REPO/actions/runs/$RUN_ID"
echo ""

# Poll until complete
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
  STATUS=$(gh run view "$RUN_ID" --json status,conclusion -q '.status')
  CONCLUSION=$(gh run view "$RUN_ID" --json conclusion -q '.conclusion')

  if [ "$STATUS" = "completed" ]; then
    break
  fi

  echo "  ⏳ Status: $STATUS (${ELAPSED}s elapsed)"
  sleep $POLL_INTERVAL
  ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

if [ "$STATUS" != "completed" ]; then
  echo "❌ CI timed out after ${MAX_WAIT}s"
  echo "   Check manually: https://github.com/$REPO/actions/runs/$RUN_ID"
  exit 1
fi

echo ""

# Report results
if [ "$CONCLUSION" = "success" ]; then
  echo "✅ CI PASSED — all jobs green"
  echo ""
  gh run view "$RUN_ID" --json jobs -q '.jobs[] | "  ✅ " + .name + " (" + .conclusion + ")"'
  exit 0
else
  echo "❌ CI FAILED"
  echo ""
  gh run view "$RUN_ID" --json jobs -q '.jobs[] | (if .conclusion == "success" then "  ✅ " else "  ❌ " end) + .name + " (" + .conclusion + ")"'
  echo ""

  # Show failed job logs
  echo "=== Failed Job Logs ==="
  FAILED_JOBS=$(gh run view "$RUN_ID" --json jobs -q '.jobs[] | select(.conclusion == "failure") | .databaseId')
  for JOB_ID in $FAILED_JOBS; do
    echo ""
    echo "--- Job $JOB_ID ---"
    gh run view "$RUN_ID" --log-failed 2>/dev/null | tail -50
    break  # Only show first failed job to keep output manageable
  done

  if [ "$FIX_MODE" = "--fix" ]; then
    echo ""
    echo "=== Fix Mode ==="
    echo "Failed log output above. Feed this to Claude with:"
    echo '  "Fix the CI failure. Here are the logs: <paste logs>"'
  fi

  exit 1
fi
