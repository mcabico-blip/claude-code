# ops/ — Claude-driven deployment

**Goal:** Cloud Claude (in the web/CLI session) pushes a reviewed release; **Server
Claude** (a headless `claude -p` run on `edge.ubi-as.com`) deploys it and *fixes
deployment issues itself*. Status flows back through a committed markdown file.

Claude does the deploy — not a script — so it can diagnose and repair failures.
The only scripts here are the dumb trigger and a rollback safety net.

## The flow
1. **Cloud side (here):** when you say *"build production"*, Cloud Claude
   fast-forwards the **`production`** branch to the reviewed commit and pushes it,
   updating `ops/RELEASE_NOTES.md` if the deploy needs special steps.
2. **Trigger (on the box):** either the **webhook** (instant) or the **timer**
   (~1 min) notices `production` changed and runs `ops/wake-claude-deploy.sh`.
3. **Server Claude:** `claude -p "Read ops/DEPLOY.md and execute it"` — pulls,
   builds, restarts, health-checks, **fixes or rolls back**, then writes & pushes
   `ops/DEPLOY_STATUS.md`.
4. **Cloud side:** next session, Cloud Claude reads `ops/DEPLOY_STATUS.md` and acts
   on `for_cloud_claude:` (e.g. fix a build step so the next deploy is clean).

```
build production ─▶ push `production` ─▶ trigger ─▶ claude -p DEPLOY.md ─▶ DEPLOY_STATUS.md ─▶ read back
```

## Files
| File | Who | Purpose |
|------|-----|---------|
| `DEPLOY.md` | Server Claude | The deploy + auto-fix + rollback playbook it executes |
| `wake-claude-deploy.sh` | trigger | Detects change, spawns headless Claude (`--force` from webhook) |
| `webhook-receiver.mjs` | Option A | GitHub push→deploy listener (HMAC-verified) |
| `systemd/ubi-deploy.{service,timer}` | Option B | Poll `production` every minute |
| `systemd/ubi-webhook.service` | Option A | Keep the webhook receiver running |
| `deploy-box.settings.json` | box | Copy to `<repo>/.claude/settings.json` — tool allowlist |
| `RELEASE_NOTES.md` | Cloud Claude | Per-release instructions (env, migrations) |
| `DEPLOY_STATUS.md` | Server Claude | Result of the last deploy (read by Cloud Claude) |
| `DEPLOY_LOG.md` | Server Claude | Append-only one-line history |

## One-time setup on the box
```bash
# 0. checkout + deploy user (example path /srv/ubi, user `deploy`)
sudo -u deploy git clone <repo-url> /srv/ubi && cd /srv/ubi
git checkout production
cp ops/deploy-box.settings.json .claude/settings.json   # tool allowlist
# ensure `claude` is installed & authenticated for the deploy user, `node`/`npm` on PATH

# Option B — polling timer (simplest, no inbound port):
sudo cp ops/systemd/ubi-deploy.{service,timer} /etc/systemd/system/
sudo systemctl enable --now ubi-deploy.timer

# Option A — instant webhook (the box already serves HTTPS):
echo 'GH_WEBHOOK_SECRET=<random>' | sudo tee /etc/ubi-webhook.env && sudo chmod 600 /etc/ubi-webhook.env
sudo cp ops/systemd/ubi-webhook.service /etc/systemd/system/
sudo systemctl enable --now ubi-webhook
# nginx: proxy_pass /ubi-deploy-hook → http://127.0.0.1:8787 ;
# GitHub repo → Settings → Webhooks → https://edge.ubi-as.com/ubi-deploy-hook,
#   content-type application/json, secret = GH_WEBHOOK_SECRET, event = "push" only.
```
Run **both** if you like: webhook for instant deploys, timer as a safety net that
catches any missed event.

## Recommendation
Start with **Option B (timer)** — zero inbound surface, matches your "check every
minute" idea, works today. Add **Option A (webhook)** once you want instant deploys;
same `DEPLOY.md` brain, so nothing else changes.

## Why not cloud Routines / plain GitHub Actions?
- **Routines** run on Anthropic infra — they can't restart services on your box, so
  they can't be the deployer (could only *trigger* the box's webhook).
- **GitHub Actions** would run Claude in a runner, not on the prod box; you'd need a
  self-hosted runner *on* the box to restart services. The timer/webhook + `claude -p`
  is simpler and keeps the deciding Claude where the services live.

## Safety
- Tool allowlist (`deploy-box.settings.json`) + `--max-turns` bound what can happen.
- `DEPLOY.md` forbids dropping the DB, force-push, touching `main`, printing secrets.
- Failed health check → automatic rollback to `ops/.last_good` SHA.
- `flock` prevents overlapping deploys.
