# Git & Branching Strategy — Jules White style

> Full rationale lives in `UBI-Construction-Suite-CONTEXT.md` §11. This is the
> quick reference.

## Layers
- `main` — protected, always-releasable. PR-only.
- **module branch** — one per module/pillar: `engineering`, `it`, `pillar-auth`, …
- **feature branch** — `<module>_<submodule>_<featurename>`

## Feature branch naming
`<module>_<submodule>_<featurename>`  (underscores between parts, hyphens inside the name)

Examples:
- `engineering_billing_monthly-dpwh`
- `procurement_receiving_dr-ai-encode`
- `it_capacity_storage-forecast`
- `property_qr_custodian-attestation`

## Flow
feature → PR → module branch → PR → `main`

## Commits (conventional, scoped)
`feat(engineering/billing): ...` · `fix(it/capacity): ...` · `chore(pillar-auth): ...`

## Rules
- One Claude Code session = one feature branch, kept small.
- No secrets, no binaries in git (`uploads/`, `.env*` ignored).
- Tag releases on `main`: `v0.1.0-pillars`, `v0.2.0-engineering`, …

## Module / pillar branches
pillar-auth · pillar-doc-tracking · pillar-ai-layer · engineering · procurement ·
operations · survey · mqc · audit · it · records · clinic · admin · hr · property ·
finance · ceo
