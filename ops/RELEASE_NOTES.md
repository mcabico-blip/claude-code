# RELEASE_NOTES.md — Cloud Claude → Server Claude

> Cloud Claude writes deploy-specific instructions here when pushing `production`.
> Server Claude reads this in DEPLOY.md step 0 and honors it. Keep it current;
> clear stale notes after they're applied.

## Pending for next deploy
- (none)

## Standing notes
- Demo phase: `SEED_DEMO=true` and the DB is reseedable. When real on-prem data
  arrives, flip to `SEED_DEMO=false`, stop reseeding, and rotate demo passwords.
- New env vars introduced so far: `CORS_ORIGIN`, `TURNSTILE_SECRET_KEY` (optional),
  `CCTV_BASE_URL` (optional), `OAEC_BASE_URL` (optional — equipment push to Omega).
