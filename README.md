# UBI Construction Suite

Full construction-management suite for **Ulticon Builders, Inc.** and **Omega Asia**,
covering everything outside the Acumatica ERP. This repo currently holds the
**kickoff context** for Claude Code to build from.

## Contents
- **`CLAUDE.md`** — the single kickoff context (auto-loaded by Claude Code).
  Part I: stack, hard rules, three pillars, shared services, conventions,
  module index, phasing, capacity, **and Git strategy (§11)**.
  Part II: the three pillars in full + all 14 module specs.
- **`GIT.md`** — branching quick reference (Jules White style).
- **`diagrams.html`** — functional & data-flow diagrams (open in a browser;
  Print → Save as PDF for a PDF copy).
- **`mockups.html`** — annotated UI mockups for the CEO / Office of the
  President module: ManCom dashboard, trend-projection toggle, AI Insights,
  Ask AI, Agentic-view host shell, mobile ManCom, and the
  widget→read-model contract table. Open in a browser; Print → PDF to share.
- **`.gitignore`** — Node/TS monorepo ignores; keeps secrets/binaries out.

## Branching (see `GIT.md` / `CLAUDE.md` §11)
`main` ← module branch (`engineering`, `it`, `pillar-auth`, …) ← feature branch
`<module>_<submodule>_<featurename>`.

## Status
Breadth-first build is live: monorepo (NestJS API + React PWA + Postgres +
StorageProvider), the three pillars working (auth/RBAC, doc tracking,
AI-queryable read-model registry), shared engines (approvals, ticketing,
notifications, expiry), Engineering core (pay-item library, AI-prefilled
weekly materials schedule → PM → VPO chain), CEO ManCom dashboard wired
end-to-end, and read-surface stubs for every other department. Refinement
happens per module branch.

## Run locally
```bash
cp .env.example .env        # endpoints externalized — hard rule 6
docker compose -f docker-compose.dev.yml up -d   # postgres + redis (or use your own)
npm install
npm run dev:api             # NestJS on :3000 (seeds demo data on first boot)
npm run dev:web             # Vite PWA on :5173 (proxies /api)
```
Demo logins: `ceo@ubi.ph/ceo123` · `vpo@ubi.ph/vpo123` · `pm@ubi.ph/pm123`
· `pe@ubi.ph/pe123` · `admin@ubi.ph/admin123`.

## Open items to confirm
- Cement-delivery **receiver role**.
- IT module **suggested additions** (asset inventory, license/warranty expiry,
  uptime/bandwidth, backup dashboard, change/access log) — keep/drop.
- HR **hours-computation** (OT/ND) rules.
- Agentic AI page — detailed design (separate session).
