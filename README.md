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
Pre-code. Next: monorepo scaffold (API + PWA + Postgres + StorageProvider +
the three pillars stubbed), built on the module branches per the phasing.

## Open items to confirm
- Cement-delivery **receiver role**.
- IT module **suggested additions** (asset inventory, license/warranty expiry,
  uptime/bandwidth, backup dashboard, change/access log) — keep/drop.
- HR **hours-computation** (OT/ND) rules.
- Agentic AI page — detailed design (separate session).
