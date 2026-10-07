#!/usr/bin/env bash
# Usage: ci-report.sh <job-name> <success|failure> [logfile]
# Writes <job-name>.txt (status + last 300 log lines) to the `ci-status` branch so build
# results can be read without GitHub API access.
set -u
NAME="$1"; STATUS="$2"; LOG="${3:-}"
REMOTE="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
TMP="$(mktemp -d)"
for attempt in 1 2 3 4; do
  rm -rf "$TMP/r"; mkdir -p "$TMP/r"; cd "$TMP/r"
  git init -q -b ci-status
  git config user.name "converge-bot"; git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  git remote add origin "$REMOTE"
  if git fetch -q --depth=1 origin ci-status 2>/dev/null; then git reset -q --hard origin/ci-status; fi
  {
    echo "job: $NAME"
    echo "status: $STATUS"
    echo "time: $(date -u +%FT%TZ)"
    echo "commit: ${GITHUB_SHA:-}"
    echo "run: ${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID:-}"
    echo "----"
    if [ -n "$LOG" ] && [ -f "$LOG" ]; then tail -n 300 "$LOG"; fi
  } > "$NAME.txt"
  git add "$NAME.txt"
  git commit -qm "$NAME: $STATUS" || exit 0
  if git push -q origin ci-status; then exit 0; fi
  sleep $((attempt * 5))
done
echo "could not push status" >&2
