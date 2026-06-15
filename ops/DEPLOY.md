# DEPLOY.md — Server Claude deploy + auto-fix playbook

> You are **Server Claude**, running on the production box (`edge.ubi-as.com`).
> You were spawned headlessly to deploy the `production` branch. Follow this
> playbook exactly, **fix problems yourself**, and never leave the site down.
> When done, write `ops/DEPLOY_STATUS.md` and commit + push it.

## Hard safety rules (do not violate)
1. **Never `DROP DATABASE` / never delete the Postgres volume in production.** Demo
   phase or not, the cutover plan says real data may arrive; treat the DB as precious.
   Schema changes happen via TypeORM migrations or `DB_SYNC` only.
2. **Never commit or print secrets.** `.env` stays on the box, untracked.
3. **Never force-push.** Never touch `main`. You only read `production` and push
   `ops/DEPLOY_STATUS.md` + `ops/DEPLOY_LOG.md` + state files back to `production`.
4. **Bounded fixing:** try at most **3** fix attempts for a given failure. If still
   broken, **roll back** (see §5) and report FAILED — do not keep flailing.
5. If a step needs a capability you don't have permission for, stop and report it in
   the status file rather than working around it.

## 0. Preflight
- Repo path: the directory containing this file's parent (`ops/..`). `cd` there.
- Record the currently-deployed SHA as the rollback target:
  `LAST_GOOD=$(cat ops/.last_good 2>/dev/null || git rev-parse HEAD)`
- Read `ops/RELEASE_NOTES.md` if present — Cloud Claude leaves deploy-specific
  notes there (new env vars, migration steps, reseed instructions). Honor them.

## 1. Sync
- `git fetch origin production`
- `TARGET=$(git rev-parse origin/production)`
- If `TARGET` == `cat ops/.last_deployed` → nothing to do; exit 0 (write a short
  "no change" status only if invoked manually).
- `git checkout production && git reset --hard origin/production`

## 2. Build
- `npm install` (new deps land often — never skip).
- `npm run build` (builds packages → api → web). If it fails:
  - Read the error. Common causes: stale `@ubi/types` dist (run
    `npm run build -w @ubi/types` then retry), a TS error (fix the obvious cause or,
    if it's clearly a bad push, roll back), missing dep (`npm install`).

## 3. Environment (verify, don't overwrite)
- Confirm `.env` has: `NODE_ENV=production`, a real `JWT_SECRET` (not `change-me`),
  `CORS_ORIGIN=https://edge.ubi-as.com`, `SEED_DEMO` set intentionally
  (demo phase = `true`; once real data is in = `false`).
- Apply any env changes RELEASE_NOTES.md asks for. If a required var is missing,
  stop and report — do not invent secrets.

## 4. Migrate / restart
- DB: with `DB_SYNC=true`, new tables/columns auto-create on boot — fine for demo.
  If RELEASE_NOTES.md says "run migration", run `npm run migration:run` (when it exists).
- Restart the API: **`systemctl restart ubi-edge`** (the service binds
  127.0.0.1:8091 behind nginx on this box). Confirm it came up with
  `systemctl status ubi-edge` / `journalctl -u ubi-edge -n 50`. Web is static
  (`apps/web/dist`) served by nginx — no restart needed unless nginx config changed.
  (If the unit name ever changes, discover it: `systemctl list-units | grep -i ubi`.)

## 5. Health check (the gate)
- `curl -fsS https://edge.ubi-as.com/api/health` must return `{"status":"ok"...}`.
- `curl -fsS -o /dev/null -w '%{http_code}' https://edge.ubi-as.com/` must be 200.
- Spot-check the new build is actually live (e.g. an endpoint added in this release).
- **If health fails after up to 3 fix attempts: ROLL BACK**
  `git reset --hard $LAST_GOOD && npm install && npm run build && <restart>`,
  re-run health check, and mark the deploy **FAILED (rolled back)**.

## 6. Record state + report (always do this last)
- On success: `git rev-parse HEAD > ops/.last_deployed` and `cp ops/.last_deployed ops/.last_good`.
- Write `ops/DEPLOY_STATUS.md` from the template in §7.
- Append a one-line entry to `ops/DEPLOY_LOG.md` (create if missing):
  `- <ISO time> · <sha7> · <OK|FAILED|ROLLED-BACK> · <one-line summary>`
- Commit just those files and push:
  `git add ops/DEPLOY_STATUS.md ops/DEPLOY_LOG.md ops/.last_deployed ops/.last_good`
  `git commit -m "ops(deploy): <sha7> <status>" && git push origin production`
  (Use the box's configured git credentials; never embed a token in the message.)

## 7. DEPLOY_STATUS.md template
```
# Deploy status
- result: OK | FAILED | ROLLED-BACK | NO-CHANGE
- deployed_sha: <full sha>
- previous_sha: <full sha>
- at: <ISO timestamp>
- health: api=<code> web=<code>
- build: clean | "<summary of any fix you applied>"
- fixes_applied:
  - <what you changed to make it deploy, if anything>
- errors: <none | the failure + what you tried>
- for_cloud_claude: <anything Cloud Claude should change in the repo so the next
  deploy is clean — e.g. "types dist wasn't rebuilt; add prebuild step">
```

Keep `for_cloud_claude` honest and specific — it's how the two of us close the loop.
