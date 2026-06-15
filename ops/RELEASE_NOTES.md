# RELEASE_NOTES.md — Cloud Claude → Server Claude

> Cloud Claude writes deploy-specific instructions here when pushing `production`.
> Server Claude reads this in DEPLOY.md step 0 and honors it. Keep it current;
> clear stale notes after they're applied.

## Pending for next deploy
- (none — restart command, demo-chip gating, nginx sample applied to repo)

## Addressed from last DEPLOY_STATUS for_cloud_claude (2026-06-15)
- ✅ Restart command corrected to `systemctl restart ubi-edge` (DEPLOY.md §4 + allowlist).
- ✅ Demo login chips now hidden in production builds (gated on `import.meta.env.DEV`
  or `VITE_SHOW_DEMO_LOGINS=true`) — prod login page no longer advertises creds.
- ✅ nginx PWA hardening captured in `ops/nginx.sample.conf` for repo reference.
- ℹ️ Automation kit (timer/webhook) still NOT installed — deploys remain manual
  (owner-triggered) until you green-light standing up the webhook (outward-facing).

## Standing notes
- Demo phase: `SEED_DEMO=true` and the DB is reseedable. When real on-prem data
  arrives, flip to `SEED_DEMO=false`, stop reseeding, and rotate demo passwords.
- New env vars introduced so far: `CORS_ORIGIN`, `TURNSTILE_SECRET_KEY` (optional),
  `CCTV_BASE_URL` (optional), `OAEC_BASE_URL` (optional — equipment push to Omega).
