# PRE-PRODUCTION AUDIT CHECKLIST

> Surfaced before any **real production launch** (referenced from `CLAUDE.md §0`).
> The suite is in POC/pilot mode with intentional shortcuts; clear these first.
> When the owner says "audit before production," walk this top to bottom.

## 🔴 Secrets to rotate (all exposed during the pilot)
- [ ] **Cartrack API key** — `CARTRACK_PASS` (admin, read+write) is in git history
      (`ops/RELEASE_NOTES.md`) and chat. Rotate in Fleetweb → ideally issue a
      **read-only / standard** API user for the suite. Update on box + RELEASE_NOTES.
      Consider purging it from git history (filter-repo) since both repos hold it.
- [ ] **GitHub PAT** — pasted in chat repeatedly during the session. Rotate.
- [ ] **Shared password `Ulticon1`** — every account uses it. Set strong, unique
      per-account passwords (regenerate `apps/api/src/seed/credentials.ts`).
- [ ] Move box secrets OUT of `ops/RELEASE_NOTES.md` (committed) into the box
      `.env` / a real secret store; clear the committed values.

## 🟠 Data & hardening
- [ ] **TypeORM migrations** — replace `DB_SYNC=true` with real migrations, then
      set `DB_SYNC=false` (before any data you can't recreate).
- [ ] **`SEED_DEMO=false`** on prod once real data is in; disable/remove demo
      accounts (ceo@ubi.ph etc.) and the demo-seed data.
- [ ] **helmet** security headers on the API.
- [ ] **Backups** — Postgres + `uploads/` (and a tested restore).
- [ ] **Clinic** module — separate encrypted DB / field-level encryption (per spec;
      currently only an aggregate stub) before any real medical data.
- [ ] **Turnstile** keys live for the public helpdesk if exposed more widely.
- [ ] Re-enable / verify search-engine block stays until intended public launch.

## 🟡 Access & review
- [ ] Review RBAC claims per real user; remove pilot blanket access.
- [ ] Confirm clinic data is aggregate-only everywhere it surfaces (CEO/DOLE).
- [ ] Rate-limit + abuse review on public endpoints (helpdesk, login).
- [ ] Audit-log review (who can see physical-location index, etc.).
