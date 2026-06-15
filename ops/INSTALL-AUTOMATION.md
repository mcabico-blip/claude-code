# INSTALL-AUTOMATION.md — stand up Claude-driven CD on the box

> Server Claude: install **both** triggers — the **webhook** (instant) and the
> **timer** (1-min backstop). Both call the same `ops/wake-claude-deploy.sh`,
> which spawns a headless `claude -p` deploy session (`ops/DEPLOY.md`). Report
> back in `ops/DEPLOY_STATUS.md` when done.

Assumes: repo at `/srv/ubi`, deploy user `deploy` (adjust paths/user to match this
box — the live API unit is `ubi-edge`). `claude`, `node`, `npm`, `git` on PATH for
that user, and `claude` already authenticated for it.

## 0. Permissions (so headless runs don't hang on prompts)
```bash
cd /srv/ubi
cp ops/deploy-box.settings.json .claude/settings.json   # tool allowlist (ubi-edge restart, git, npm, psql, curl)
```
The wake script uses `--permission-mode acceptEdits --allowedTools ...`; the
allowlist must cover everything `DEPLOY.md` needs. If a deploy is denied a command,
add it to the allowlist and note it in `for_cloud_claude:`.

## 1. Timer (backstop, zero inbound surface)
```bash
sudo cp ops/systemd/ubi-deploy.{service,timer} /etc/systemd/system/
# edit the unit: set User=, WorkingDirectory=/srv/ubi, UBI_REPO, PATH to match this box
sudo systemctl daemon-reload
sudo systemctl enable --now ubi-deploy.timer
systemctl list-timers ubi-deploy.timer      # confirm it's scheduled
```

## 2. Webhook (instant, primary)
```bash
# a) secret + env file (chmod 600 so only root/deploy reads it)
SECRET=$(openssl rand -hex 32)
printf 'GH_WEBHOOK_SECRET=%s\n' "$SECRET" | sudo tee /etc/ubi-webhook.env >/dev/null
sudo chmod 600 /etc/ubi-webhook.env
echo "SECRET for GitHub: $SECRET"          # you'll paste this into GitHub

# b) run the receiver (binds 127.0.0.1:8787 — never exposed directly)
sudo cp ops/systemd/ubi-webhook.service /etc/systemd/system/
# edit unit: User=, WorkingDirectory, UBI_REPO, PATH
sudo systemctl daemon-reload
sudo systemctl enable --now ubi-webhook
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8787   # 405 to GET = up

# c) nginx route (see ops/nginx.sample.conf): add inside the edge.ubi-as.com server
#    location = /ubi-deploy-hook { proxy_pass http://127.0.0.1:8787; }
sudo nginx -t && sudo systemctl reload nginx
```
Then in **GitHub → repo → Settings → Webhooks → Add webhook**:
- Payload URL: `https://edge.ubi-as.com/ubi-deploy-hook`
- Content type: `application/json`
- Secret: the `$SECRET` printed above
- Events: **Just the push event**
- Active: yes

(Optional hardening: restrict the nginx location to GitHub's hook source ranges
from `https://api.github.com/meta` → `.hooks[]`.)

## 3. Verify end-to-end
- Ask the owner (Cloud Claude) to **"build production"** with a trivial change.
- Webhook path: GitHub shows a green delivery; `journalctl -u ubi-webhook -f`
  logs "waking deploy"; a new `ops/DEPLOY_STATUS.md` is pushed within ~1–2 min.
- Timer path (disable webhook to test): within 1 min of a `production` change,
  `journalctl -u ubi-deploy.service` shows a run.
- Both: `git log origin/production` shows your `ops(deploy): <sha> OK` commit.

## 4. Guardrails (already in place — confirm)
- `flock` in the wake script prevents overlapping deploys (webhook + timer can't collide).
- `DEPLOY.md`: never drops DB, never force-pushes, rolls back on failed health check.
- Receiver verifies HMAC; rejects unsigned/forged payloads (401).
- If anything can't be installed safely, stop and report in `DEPLOY_STATUS.md`.
