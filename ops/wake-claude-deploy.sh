#!/usr/bin/env bash
# Thin trigger — the ONLY script in the deploy path. It does not deploy; it wakes
# Server Claude, which deploys + fixes (see ops/DEPLOY.md). Used by both the
# systemd timer (polling) and the webhook receiver (event-driven).
set -euo pipefail

REPO="${UBI_REPO:-/srv/ubi}"           # set UBI_REPO to your checkout path
BRANCH="production"
cd "$REPO"

# Prevent overlapping deploys.
exec 9>/tmp/ubi-deploy.lock
flock -n 9 || { echo "deploy already running"; exit 0; }

git fetch origin "$BRANCH" --quiet
TARGET="$(git rev-parse "origin/$BRANCH")"
LAST="$(cat ops/.last_deployed 2>/dev/null || echo none)"

# --force (from webhook) skips the equality check; timer relies on it.
if [ "${1:-}" != "--force" ] && [ "$TARGET" = "$LAST" ]; then
  exit 0   # nothing new — stay quiet
fi

echo "$(date -Is) waking Server Claude to deploy $TARGET (was $LAST)"

# Headless one-shot. Allowlist keeps it to deploy-shaped actions; --max-turns
# bounds the agentic loop; JSON output lets us detect harness-level failure.
# Tune --permission-mode / --allowedTools to your settings.json (see deploy-box.settings.json).
set +e
claude -p "Read ops/DEPLOY.md and execute it now to deploy the production branch. Fix any issues, roll back if you cannot, then write and push ops/DEPLOY_STATUS.md." \
  --output-format json \
  --max-turns 40 \
  --permission-mode acceptEdits \
  --allowedTools "Read" "Edit" "Write" "Bash" \
  > /tmp/ubi-deploy-last.json 2>/tmp/ubi-deploy-last.err
rc=$?
set -e

if [ $rc -ne 0 ]; then
  # Claude itself failed to run (not a deploy failure). Leave a breadcrumb; the
  # timer will retry next tick because .last_deployed is unchanged.
  echo "$(date -Is) · claude run exited $rc — see /tmp/ubi-deploy-last.err" >> ops/DEPLOY_LOG.md 2>/dev/null || true
fi
exit 0
