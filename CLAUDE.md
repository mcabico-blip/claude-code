# UBI Construction Suite — Master Context (CLAUDE.md)

> **Single-file kickoff context — read top to bottom.** Part I defines the stack,
> the three cross-cutting pillars, the hard rules, and the conventions. Part II
> contains the three pillars in full plus all 14 module specs. When any single
> module's spec grows large during the build, split just that one out into its
> own file and leave a pointer here.

---

## 0. CURRENT BUILD STATE — START HERE (updated 2026-06-16)

> **For Claude Code sessions:** the suite is **no longer pre-code**. A working
> breadth-first build lives on PR #1 → `main` (branch `claude/magical-darwin-dulx3f`
> or `claude/gifted-heisenberg-inxyvn` — both are the same tip).
> A deployment is live at `edge.ubi-as.com`.

**What exists and runs**
- Monorepo: `apps/api` (NestJS + Helmet), `apps/web` (React+Vite PWA),
  `packages/types`, `packages/storage`.
- **Pillars working:** auth (JWT + claims RBAC + entity scope, field-role
  grace), doc tracking (QR codes, scan transmit/receive, where-is + history),
  AI layer (read-model registry — 21+ surfaces, `/api/ai/ask`, off-box insight
  postback at `/api/ai/insights`).
- **Shared engines:** approvals (PE→PM→VPO chains), ticketing (IT+Admin),
  notifications, expiry reminders, RBAC-gated `/api/files/:id` over
  `StorageProvider` (LocalDisk).
- **Real modules:** Engineering core (projects, DPWH pay-item library,
  AI-prefilled weekly materials schedule → approvals), Procurement DR capture,
  Operations control tower, CEO ManCom consolidation, **Survey** (measurements +
  cross-sections + station/chainage), **MQC** (DPWH test rules, QC tests, pour
  logs, material certs), Property (QR EAM), Records (vehicle doc registry,
  physical-location index), IT (SNMP device list, PMS scheduler, DeskGuard
  consent, env monitoring), Fleet (Cartrack GPS/trips/events).
- **Web:** "drawing comes alive" design system. Pages: login, ManCom, AI
  Insights, Ask AI, Documents, Approvals, Engineering, Quantity, Equipment,
  Survey, MQC, Property, Records, IT (+ PMS), Fleet, per-department read surfaces.

**Run locally** — see README. Short: `cp .env.example .env` → Postgres+Redis
up → `npm install` → `npm run dev:api` (:3000; seeds demo data only when
`SEED_DEMO=true` and DB is empty) → `npm run dev:web` (:5173).

**Production env (edge.ubi-as.com):** `JWT_SECRET` is **required** (boot
fails on the dev default), `SEED_DEMO` must be unset/false, set
`CORS_ORIGIN=https://edge.ubi-as.com`. Before production: run TypeORM
migrations (`npm run migration:generate` then `migration:run`) and set
`DB_SYNC=false`. See `ops/PRE-PROD-AUDIT.md`.

**Next work, in order**
1. **Postgres + uploads backup script** — cron/systemd + `pg_dump` + rsync.
2. **Engineering SWA + billing** — real `weekly_swa` and `billing_batch`
   tables; SWA feeds ManCom volumes.
3. **Audit module** — findings register + exception tracker feeds AI Insights.
4. **IT SNMP live polling** — actual SNMP worker + topology map.
5. **Field photo pipeline** — client-side compress + GPS/timestamp + offline
   queue service worker.
6. **Google OAuth** — layer on top of standalone auth.

Micro-commits, conventional scopes per §11.

> **⚠️ Before any real production launch: read `ops/PRE-PROD-AUDIT.md`** and walk
> it. Pilot shortcuts to clear — rotate the Cartrack admin key (in git history),
> the GitHub PAT, and the shared `Ulticon1` password; migrations; backups; etc.
> If the owner mentions "audit before production," raise that checklist.

### Deploying (Claude-driven CD — see `ops/README.md`)
- Dev happens on the feature branch (e.g. `claude/magical-darwin-dulx3f`) → push
  to that branch → **to deploy: push the same commit to `production`**.
- **`production` branch IS the deploy signal.** Server Claude on the box
  (`edge.ubi-as.com`) polls `production` via a 1-min systemd timer
  (`ubi-deploy.timer`) **and** a GitHub push webhook (`/ubi-deploy-hook`).
  Either triggers `ops/wake-claude-deploy.sh` → headless `claude -p` →
  reads `ops/DEPLOY.md` → `git pull` → `npm install` → `npm run build` →
  `systemctl restart ubi-edge` → health check → pushes `ops/DEPLOY_STATUS.md`.
- **"build production"** = Cloud Claude fast-forwards `production` to the current
  feature branch tip: `git push origin HEAD:production` (note any env/migration
  steps in `ops/RELEASE_NOTES.md` first).
- At session start, Cloud Claude should read `ops/DEPLOY_STATUS.md` and act on
  its `for_cloud_claude:` line.

---

## 1. What this is

A **full construction management suite for Ulticon Builders, Inc. (UBI)** that
covers everything the **Acumatica ERP cannot** do. Acumatica remains the
financial/ERP system of record. This suite owns field capture, departmental
workflows, document movement, and executive visibility — and **integrates** with
Acumatica rather than duplicating it.

- **Entities:** two — **UBI** and **Omega Asia Equipment Leasing Corp**. All data
  is entity-scoped from day one. Some flows cross entities (Omega leases
  equipment to UBI).
- **Projects:** 100+ active, **all DPWH government contracts**, **standard DPWH
  Blue Book pay items** (Item 100s clearing, 200s subbase, 300s/311 PCCP, 400s
  structures, SPL items). One master pay-item library, reused everywhere.
- **Users:** ~500 total, **~50 concurrent**. Field-heavy. Mobile-first.
- **Primary output:** the **ManCom dashboard** for the CEO/President — every
  department ultimately feeds it.

---

## 2. The stack (locked — do not improvise)

| Layer            | Choice                                                        |
| ---------------- | ------------------------------------------------------------- |
| Language         | **TypeScript end-to-end**                                     |
| Backend          | **Node.js** (NestJS — modular monolith)                       |
| Frontend         | **React + Vite, PWA**, mobile-first, offline-capable for field|
| Database         | **PostgreSQL**                                                |
| Cache/queue      | **Redis** (sessions, BullMQ job queue)                        |
| Reverse proxy    | **Nginx**                                                     |
| Host             | AWS Lightsail Ubuntu — **4 vCPU / 16 GB / 320 GB SSD**         |

**Architecture:** a **modular monolith**, not microservices. One deployable Node
app with clean internal module boundaries. Small team; one language everywhere.

**The box is pure API/backend.** All AI agents run **off-box** (head-office HCI
or workstations) and call into the API. The box never runs local AI inference or
local OCR.

> OAEC (Omega's existing system) now shares this stack (Node/Ubuntu). Capture,
> sync, and AI-encode patterns are shared concepts; the equipment-schedule flow
> from UBI integrates to OAEC via API.

---

## 3. HARD RULES (these are architectural constraints, not suggestions)

1. **No AI inference on the API box.** All vision/OCR/LLM work happens on
   off-box agents (HCI/workstations) or the Anthropic API. The box stores and
   serves results only.
2. **DeskGuard OCR is client-side.** Agents on company PCs extract screen text +
   keystroke/mouse counts locally and POST small JSON. Screenshots are optional,
   sampled, and compressed.
3. **Binaries never live in Postgres.** Postgres stores **metadata + path/id
   only**. Files go through a **swappable `StorageProvider` interface**
   (LocalDisk now → Drive/S3/HCI later, no rewrite).
4. **Files are served through the API with RBAC** (`/files/:id`), never via raw
   filesystem paths or public links. Access control is enforced at fetch time.
5. **Edge compression is mandatory.** Field photos compressed **client-side to
   <500 KB** (resize longest edge ~1600px, JPEG q~75, **keep EXIF GPS +
   timestamp**). DeskGuard screenshots **<200 KB**, sampled only.
6. **Externalize stateful endpoints from line one.** DB, Redis, and storage are
   configured as external endpoints even while co-located on one box, so the
   stack splits cleanly later (and re-points at HCI in the hybrid phase) via
   config, not code.
7. **Run heavy migrations/builds off-hours.** Lightsail CPU is burstable;
   sustained CPU during business-critical windows (billing/payroll cutoffs)
   must be avoided.

---

## 4. The three pillars (cross-cutting cores — build before modules)

Every module depends on these. They are not features of any one department.

### Pillar 1 — Identity & Access (see Part II)
- Standalone auth (app owns the user table + RBAC) as the base.
- **Sign in with Google** (OAuth) as an optional method layered on top, for
  Workspace users. Email/username + password for everyone else. Accounts can
  link both.
- **No LDAP** as primary (head-office only, unreachable from cloud/sites).
  Revisit only in the hybrid phase if ever needed.
- **Offline cached login** for field PWAs: after first online login, device
  caches an encrypted session + profile with a long offline grace window. Field
  roles get extended grace; sensitive office roles (Finance, HR, Clinic) get
  short sessions.
- **Entity-scoped** (UBI/Omega) + RBAC: `dept:*`, `role:manager`,
  `scope:project-<id>`. CEO/VPO see across; managers see their dept.

### Pillar 2 — Document Tracking & Transmittal (see Part II)
**The backbone of the suite.** Huge volume of paper moves between departments.
- Every physical document gets an **ID + QR label + current holder + location +
  full movement history**.
- **Scan to transmit / scan to receive.** Answer "where is this document right
  now?" instantly.
- Used by **every** department: transmittals, PRs, payment requests, billing
  attachments, doc batches to cashier, incoming from Records, etc.
- Interim reality: paper-first with scan-and-route + transmittal tracking →
  end-state digital forms.

### Pillar 3 — AI-Queryable Data Layer (see Part II)
- **Every module exposes its data through a consistent, queryable surface** so
  the CEO chat, AI insights, and ManCom consolidation work across all modules.
- Design every module's read model with this in mind from the start.
- Off-box agents consume this surface; the **agentic ManCom iframe** and
  **CEO conversational AI** are clients of it.

---

## 5. Shared services (build once, reuse everywhere)

| Service                     | Used by                                              |
| --------------------------- | ---------------------------------------------------- |
| **StorageProvider**         | all modules with photos/files (LocalDisk first)      |
| **Photo-capture pipeline**  | DR/receiving, progress, billing photos, QR scans     |
| (GPS + timestamp + compress + queue + sync; OAEC/ZeroType pattern) |                |
| **Approvals engine**        | materials schedule, subcontracts, PRs, etc.          |
| **Ticketing engine**        | IT helpdesk **and** Admin inquiries (one engine)     |
| **Expiry/Renewal reminders**| Records (vehicle reg, insurance), Admin, Property, IT |
| **Notification service**    | approvals, expiries, alerts, ManCom flags            |

---

## 6. External systems

| System       | Role                                   | Integration                          |
| ------------ | -------------------------------------- | ------------------------------------ |
| **Acumatica**| ERP system of record (GL, AP/AR, PO)   | REST/OData; AI-encoded DR/receiving flows **into** it |
| **Ezacctg**  | Payroll/201/statutory SoR (on-prem)    | File/DB exchange. We add the **hours-computation layer** it lacks, feed clean totals back |
| **OAEC**     | Omega fleet system (Node/Ubuntu)       | API — receives UBI equipment schedule |
| **BSmart**   | Fuel dispensers                        | (fuel domain; pairs with OAEC later) |

**Never duplicate financial truth.** Each module must state explicitly what
lives in the suite vs. what syncs to Acumatica.

---

## 7. Conventions

- **Monorepo.** `apps/api` (NestJS), `apps/web` (React PWA), `packages/*` for
  shared libs (storage, capture, auth-client, ui, types).
- **TypeScript strict.** Shared types in `packages/types` — API and web import
  the same contracts.
- **Every table is entity-scoped** (`entity_id`) and carries `created_by`,
  `created_at`, `updated_at`, soft-delete where audit matters.
- **Pay items are a shared reference** (`pay_item` master) — Quantity, Billing,
  MQC, SWA, Survey all reference item numbers.
- **All writes that matter are auditable** (Audit module reads across).
- **PWA offline:** queue-and-sync for all field captures; never block the user
  on connectivity.
- **Secrets via env vars only.** Never commit secrets.

---

## 8. Module index

Office/desktop + field/mobile per module. Full specs are in Part II below.

| Module                         | Context file                          |
| ------------------------------ | ------------------------------------- |
| Engineering (Bidding, Financial Planning, Quantity, Billing, Contracts, Archiving) | see Part II |
| Procurement                    | see Part II             |
| Operations (VPO control tower) | see Part II              |
| Survey                         | see Part II                  |
| MQC (Materials Quality Control)| see Part II                     |
| Audit (+ Exception register)   | see Part II                   |
| IT (SNMP, DeskGuard v2, Helpdesk, PMS, Env) | see Part II         |
| Records (+ physical index, expiry) | see Part II             |
| Clinic (isolated, encrypted)   | see Part II                  |
| Admin / OHS (site gateway)     | see Part II                   |
| HR (thin — hours engine)       | see Part II                      |
| Property (QR EAM)              | see Part II                |
| Finance (doc-tracking consumer)| see Part II                 |
| CEO / Office of the President  | see Part II                     |

---

## 9. Phasing (suggested build order — dependency-driven)

1. **Pillars first:** Auth → Document Tracking → AI-Queryable layer scaffold +
   StorageProvider + capture pipeline.
2. **Engineering** (projects, pay-item library, financial planning, quantity,
   SWA, billing) — defines the data everything references.
3. **Field capture** (materials schedule, DR/receiving with AI encode,
   progress photos) + **Procurement** + **Operations** approvals.
4. **Survey + MQC** (feed SWA, ManCom volumes, billing certs).
5. **Property** (QR EAM) + **Records** + **Admin/OHS** + **Clinic**.
6. **IT module** (helpdesk, SNMP map, DeskGuard v2, PMS, env monitoring).
7. **HR hours engine** → Ezacctg.
8. **CEO / ManCom dashboard** (live consolidation + AI insights + agentic
   iframe + trend projection) — last, sits over everything.

---

## 10. Capacity note

50 concurrent on transactional load is comfortable on this box **because** AI is
off-box, OCR is client-side, files are compressed + served lean, and Postgres
holds only structured data + metadata. Scale-out trigger: fleet-wide DeskGuard +
all field modules live → split Postgres to its own instance, then add a standby
(month-6 conversation). The externalized-endpoints rule (HARD RULE 6) makes that
a config change.

---

## 11. Git & branching strategy (Jules White style)

**Repo:** `github.com/mcabico-blip/ubi-construction-suite`

**Principle:** isolate work by module, keep AI-session branches small and
short-lived, merge upward through clean PRs. This mirrors the phasing — pillars
first, then modules — and keeps history readable.

### Branch layers
1. **`main`** — protected, always-releasable. No direct commits; merge via PR only.
2. **One long-lived branch per module/pillar**, named by the module:
   `pillar-auth`, `pillar-doc-tracking`, `pillar-ai-layer`,
   `engineering`, `procurement`, `operations`, `survey`, `mqc`, `audit`,
   `it`, `records`, `clinic`, `admin`, `hr`, `property`, `finance`, `ceo`.
3. **Feature / sub-branches** off the module branch, named:
   **`<module>_<submodule>_<featurename>`** (lowercase; hyphens inside the
   feature name, underscores between the three parts).

### Naming examples
- `engineering_billing_monthly-dpwh`
- `engineering_materials_weekly-schedule-ai`
- `procurement_receiving_dr-ai-encode`
- `it_capacity_storage-forecast`
- `it_deskguard_clientside-ocr`
- `property_qr_custodian-attestation`
- `ceo_mancom_trend-projection`

### Flow
`<module>_<submodule>_<feature>` → PR into its **module branch** → when the
module reaches a stable slice → PR module branch → **`main`**.

### Commits (conventional, scoped)
- `feat(engineering/billing): monthly DPWH billing draft`
- `fix(it/capacity): correct storage trend forecast`
- `chore(pillar-auth): add offline session cache`

### Rules
- **One Claude Code working session = one feature branch.** Keep it small.
- Never commit secrets or binaries — files go through `StorageProvider`, not git
  (see HARD RULES). `uploads/` and `.env*` are git-ignored.
- Tag releases on `main`: `v0.1.0-pillars`, `v0.2.0-engineering`, etc.

---

# PART II — PILLARS & MODULE SPECS

> The sections below were previously separate context files. Merged here for
> kickoff. If a single module's spec grows large during the build, split just
> that one out into its own file and leave a pointer here.


---

## Pillar 1 — Identity & Access

### Model
- App owns the **user table + RBAC** (standalone is the base, the RBAC anchor).
- **Sign in with Google** (OAuth) layered on top for Workspace users; email/
  username + password for everyone else. One account can link both. Admins can
  later enforce Google-only for office staff.
- **No LDAP as primary** (head-office only, unreachable from cloud/sites).
  Revisit only in hybrid phase.

### Offline cached login (field PWAs)
- After first **online** login, device caches an **encrypted session + profile**.
- Long offline grace for **field roles**; short sessions for **Finance, HR,
  Clinic** (sensitive).
- User opens app offline, works, queues captures; everything syncs under the
  cached identity when signal returns.

### Scoping & roles
- **Entity-scoped:** UBI / Omega on every record.
- Roles/claims: `dept:<name>`, `role:manager`, `scope:project-<id>`.
- CEO/VPO: cross-cutting read. Managers: their dept. Field: their project scope.


---

## Pillar 2 — Document Tracking & Transmittal (BACKBONE)

The single most-used service in the suite. Lots of paper moves between depts.

### Core
- Every physical document = **ID + QR label + current holder + location +
  movement history**.
- **Scan to transmit / scan to receive** (mobile, edge).
- Instant answer to **"where is this document right now?"** for CEO/VPO.

### Consumers (everyone)
- Engineering transmittals, PRs, payment requests, billing attachments.
- Finance: doc batches/boxes to cashier; incoming from Records + other depts.
- Records: incoming/outgoing correspondence, controlled docs.
- Property/Admin/etc.: any routed paper.

### Phases
- **Now:** paper-first — scan-and-route + transmittal tracking + soft-copy
  attachments where possible.
- **End-state:** digital forms replace paper where feasible.

### Data
- `document` (id, entity_id, type, title, current_holder, current_location,
  qr_code, status), `document_movement` (doc_id, from, to, by, at, note),
  `document_attachment` (file via StorageProvider).


---

## Pillar 3 — AI-Queryable Data Layer

### Goal
Every module exposes a **consistent, queryable read surface** so that:
- **CEO conversational AI** ("what's happening?") can answer across all modules.
- **AI insights** (delays, good/poor performance, bottlenecks) auto-surface.
- **ManCom consolidation** pulls from every department uniformly.

### Design rules
- Each module ships a **read model / query endpoint** designed for agent
  consumption (stable shapes, documented, RBAC-aware).
- Off-box agents (HCI/workstations) are the consumers — they call the API, do
  the reasoning off-box, and post results back.
- The **agentic ManCom iframe** and **CEO chat** are clients of this layer.

### Agentic ManCom iframe (host contract)
- The CEO "agentic view" is a **sandboxed iframe** whose **HTML is generated
  externally by an AI agent** and auto-loaded ("statically dynamic").
- Host shell defines: how the agent HTML is fetched/refreshed, which data
  endpoints the iframe may read, and a strict sandbox (no arbitrary network,
  RBAC-scoped data only). Maximum design flexibility, safely contained.


---

## Engineering Module

Covers: Bidding, Financial Planning, Quantity, Billing, Contracts, Archiving.
The technical office and the heart of the contractor. Defines projects + pay
items that the whole suite references.

### Project lifecycle
1. **Bidding** — projects usually known prior to bidding (sourcing from DPWH
   site is a later AI-agent nicety, not core). Prepare bid → DPWH process → NTP.
2. **Financial Planning** — after NTP:
   - **Office budget** (Engineering) and **field budget** (PE on site).
   - Variance = **savings / deleted items**, tracked **per pay item**.
3. **Execution** — QE requests materials (see Materials flow), weekly SWA,
   weekly progress photos.
4. **Billing** — monthly billing to DPWH.

### Materials flow (CEO priority)
- **PE prepares the weekly materials schedule.** UI must be **dead-simple for
  older engineers** and **AI-assisted** (AI pre-fills from program of work +
  remaining quantities; PE adjusts).
- Approval chain: **PE → PM (approve) → VPO**.
- Approved schedule → **Procurement**.
- Separate **weekly equipment schedule** → submitted to **Omega (OAEC via API)**.

### SWA & progress
- QE submits **weekly SWA / measurements**, consolidated for reports.
- QE captures **weekly geotagged progress photos** (phone, edge, <500 KB) — these
  are **reused by Billing**.

### Billing
- **Billing keeps its own SWA** (may reference/suggest from QE SWA but is
  distinct).
- **Billing cycle is monthly** (QE SWA is weekly) — reconcile internally; the
  DPWH report/billing is its own artifact, separate from the weekly internal SWA.
- **Photos are the real anchor** for billing; QE progress photos feed billing
  photos. Billing also pulls MQC certs (see MQC).

### Pay items
- **Master DPWH Blue Book pay-item library** (shared reference). Quantity,
  Billing, MQC, SWA, Survey all reference item numbers.

### Acumatica boundary
- PO, expenses, payment requests live in **Acumatica**. Engineering produces the
  requests/quantities; financial truth stays in Acumatica.

### Archiving
- Project document archive; integrates with Document Tracking (Pillar 2) and
  Records physical-location index.


---

## Procurement Module

### Role
- Receives **approved weekly materials schedules** from Engineering (via
  Operations/VPO approval).
- **Monitors supplier delivery performance / efficiency** from receiving data
  (see receiving flow below).
- PO/expenses themselves live in **Acumatica**.

### Receiving (edge, AI-encoded — OAEC/ZeroType pattern)
- **Materials inspectors at site** capture **DR photo + details** on phone
  (edge, GPS + timestamp, <500 KB).
- **AI agent (off-box) encodes the capture into Acumatica** — same concept as
  OAEC fuel: photo → AI encode → sync. GPS + time stamped.
- Procurement reads this stream to score **delivery performance** per supplier.
- **Cement deliveries** flagged for monitoring; assign an explicit **receiver
  role** (TBD with UBI) — currently unclear who receives.

### Data
- `materials_schedule`, `delivery_receipt` (photo, supplier, items, gps, ts,
  acumatica_ref), `supplier_performance` (derived).


---

## Operations Module — VPO Control Tower

Operations = the **VPO's office**, the head-office counterpart where field ops
connects up. NOT a data-entry module — an **approvals inbox + project-health
dashboard + subcontract registry**, sitting between field modules and the CEO.

### Responsibilities
- **Approvals concentrate here**: materials schedules, subcontracts, etc.
- **Subcontract management** (registry + contracts).
- **Procurement follow-ups** — CC'd on everything procurement.
- **Standards-setting**; **document + project performance monitoring**.
- **First-stop rectification** of issues before anything reaches the CEO. Most
  reports to the CEO pass through here first.

### Build as
- Approvals engine client + project health dashboard (consumes Engineering,
  Procurement, Survey, MQC read models) + subcon registry.


---

## Survey Module

Separate department from MQC.

### Deliverables (all in scope)
- **Original ground**, **stakeout**, **cross-sections for quantities**,
  **as-built**.
- Indexing by **stations / chainage** for road construction (STA 0+000 format).
- **Monthly volume for the ManCom report** — Survey volumes feed ManCom
  consolidation.

### Notes
- Capture + document/data, tagged by station for indexing.
- Cross-section quantities can inform SWA/billing references (pay-item linked).


---

## MQC Module — Materials Quality Control

Separate department from Survey. Follows **DPWH minimum testing requirements**.

### Scope
- **DPWH minimum testing requirements per pay item**, with **lab results**.
- Encode testing rules per item (e.g., quantity of Item 311 → required number of
  concrete beam tests).
- **Pouring logs** (standardize the form).
- **Issues materials certs** that **attach to billings** (feed Engineering
  Billing).

### Data
- `qc_test` (project, pay_item, type, result, lab_ref, cert_id),
  `pour_log`, `material_cert` (attached to billing via Document Tracking).


---

## Audit Module

### Scope (all in)
- **Findings/observations register**, **follow-up tracking**, **compliance
  checklists**.
- **Oversight read-access** across modules.

### Exception register (Investigation Tracker)
- Items that **fail a check but need deeper investigation** are raised as
  **exceptions/flags**: assigned → investigated → resolved or escalated, with a
  **full audit trail**.

### Data
- `audit_finding`, `audit_followup`, `compliance_checklist`,
  `audit_exception` (status: raised/investigating/resolved/escalated).


---

## IT Module (Marvin's home turf — expect heavy iteration)

### 1. Centralized monitoring
- **SNMP** monitoring of devices: APC/Ablerex UPS, H3C core switches, Hikvision
  NVR, Sangfor (HCI/NGAF/Endpoint).
- **Device map / topology view** (map view of devices).
- **Consolidated firewall + endpoint status** from Sangfor NGAF/Endpoint.

### 2. DeskGuard v2 (activity agent — evolved)
- Old version: logged window-title switches only (screenshot as support).
- **New version philosophy shift:** from pure backend surveillance →
  **self-reporting productivity tool** (Time Doctor / oDesk style).
- Agent captures: **OCR of screen text (CLIENT-SIDE)** + window title +
  **keystroke/mouse-stroke counts** → POST small JSON to API.
- **Screenshots optional, sampled, compressed <200 KB** (text already extracted
  client-side, so screenshot is just evidence).
- User picks **activity from a KPI dropdown** + notes.
- **End-of-day personal dashboard:** top apps, hours spent, key activity,
  KPI-hours.
- **MANDATORY policy/consent layer:** visible notice that activity capture is
  **for official use on company-owned assets only**; staff reminded to avoid
  personal activity on company devices. Role-scoped access to captured data.
  Flag + notification on this banner.

### 3. AI Helpdesk
- Ticket **landing + Kanban**.
- **Auto-assign by tech location ↔ ticket location**.
- **Per-tech ticket charts**, target **3 tickets/tech/day**.
- Shares the **Ticketing engine** with Admin inquiries.

### 4. Maintenance scheduler (PMS)
- Pulls **active properties from Property module**.
- **Auto-generates quarterly PMS** schedules; **auto-closes when done**.

### 5. Environmental monitoring
- Server-room + ambient **temperature** via **DHT22 + ESP32**, live running
  charts. Ingest **SNMP/IPMI temperature where devices expose it**, ESP32
  sensors where not.

### 6. Capacity Planning & Controls
The IT control room for resource headroom — forecast exhaustion before it bites,
and enforce the architectural scaling triggers from `CLAUDE.md`.

- **Resource utilization tracking** (trended over time):
  - **Storage** — disk usage vs the 320 GB box; **forecast "disk full" date** by
    trend (directly governs the photo-storage strategy).
  - **Data transfer** — outbound vs the Lightsail 6 TB/month allowance (overage
    alarms).
  - **Compute/DB** — CPU burst headroom, PostgreSQL growth.
  - **UPS load** — actual load vs **rated capacity** (APC/Ablerex), runtime
    headroom.
  - **Network bandwidth per site**; **license/seat counts**.
- **Forecasting** — extend each trend to its limit and flag the projected
  breach date (same trend-projection idea as the ManCom view).
- **Controls / thresholds** — green/amber/red thresholds per resource with
  alerts; tracks the **scaling triggers** (e.g., "split Postgres," "move photos
  to object storage") as live, owned action items.
- **Change controls** — record capacity-affecting changes (new agents deployed,
  new modules enabled) so a utilization jump has a traceable cause.
- Feeds the **CEO/IT visibility** layer.

### Suggested additions (confirm keep/drop with Marvin)
- IT **asset inventory** (source of truth for company devices + installed
  DeskGuard agents; ties to Property).
- **License/subscription/warranty expiry** (→ Expiry Reminder service).
- **Network/internet uptime + bandwidth per site**.
- **Backup status dashboard**.
- **Change/access log** (admin-rights grants, on/off-boarding provisioning).

> Marvin noted "lots more here — this is mine." Treat IT as the most
> iteratively-expanded module.


---

## Records Module

### Scope
- Company-wide **document registry** (incoming/outgoing correspondence,
  transmittals, controlled docs) — the home of **Document Tracking (Pillar 2)**.
- **Vehicle registrations & expiry, insurance, document stamps** — with
  **expiry alarms/notifications** (→ shared Expiry/Renewal Reminder service).
- **Physical location index**: e.g., "Land Title X is in Steel Cabinet 3,
  Drawer B." **AI-searchable but HARD-GATED by user access** — sensitive docs
  (titles, etc.) only visible to authorized roles.

### Data
- `record_doc`, `vehicle_doc` (reg/insurance/stamp + expiry),
  `physical_location` (cabinet/drawer index, access-controlled).


---

## Clinic Module (isolated + encrypted)

Org-wise sits **under Admin**, but data is strictly isolated.

### Hard requirements
- **Separate database**, **encrypted at rest** (field-level encryption for
  medical data).
- **Strict role isolation** — only clinic staff see individual records.
- **CEO/DOLE visibility is AGGREGATE only** (injury rates, medical-exam
  completion, incident counts) — never individual medical detail.

### Scope (all in)
- Pre-employment / annual **medicals**, **site clinic visits / medicine
  issuance**, **injury/incident reports**, **DOLE compliance**.


---

## Admin / OHS Module — Site Gateway

Broad hub. The **human bridge connecting HR ↔ site**, plus the **safety/OHS hub**.

### Sub-areas
- **OHS:** safety trainings, health/awareness seminars, schedules, **toolbox
  meeting logs**.
- **Clinic** sits under Admin org-wise (but keeps its isolated encrypted DB).
- **Dispensing**: safety gear (PPE) + medicine.
- **Admin Officers' portal** + **timekeepers** — gateway of HR to site;
  inquiries/requests routing (shares **Ticketing engine** with IT helpdesk).
- **Building admin:** conference room **booking/reservations**, facilities.

### Shared touchpoints (don't rebuild)
- PPE/medicine dispensing overlaps **Property**.
- Timekeeping overlaps **HR**.


---

## HR Module (thin)

### Boundary
- **Ezacctg is the system of record** for 201 files, payroll, statutory
  (SSS/PhilHealth/Pag-IBIG). Almost complete — **except hours computation**.
- The suite does **NOT** rebuild HR.

### What the suite adds (later phase)
- **Hours-computation engine**: compute hours/OT/ND from raw attendance logs,
  push clean totals to Ezacctg (patches the missing Ezacctg function).

### Attendance reality (today)
- Tablets at sites: **photo + employee PIN**, syncs to Ezacctg. (Tablets are the
  BSmart-adjacent hardware? No — BSmart = fuel dispensers; attendance tablets
  are separate.)
- **Phase 2:** centralized **Face ID** on existing tablets (edge-app pattern).

### DTR
- All under payroll → record DTRs.


---

## Property Module (QR-based lightweight EAM)

### Scope (all in)
- Equipment/asset **custody & accountability**: PAR/MR receipts (who holds what),
  warehouse materials custody, tool issuance/return at sites.
- UBI's own non-fleet assets (tools, IT equipment, office assets). Omega fleet is
  OAEC's domain; cross-reference where leased to UBI.

### QR mobile tracking
- Property's **label printer generates QR codes**.
- **Mobile app scans QR** to: log **location + status**, **update custodian**.
- **Monthly custodian attestation**: each custodian confirms/updates equipment
  issued to them → audit trail of who-held-what over time.

### Feeds
- Active assets feed **IT PMS scheduler** (quarterly maintenance).

### Data
- `asset` (qr, type, status, location, custodian), `asset_movement`,
  `custodian_attestation` (monthly).


---

## Finance Module

### Boundary
- **No new build now** beyond document tracking. Acumatica does GL/AP/AR, PO,
  payment requests.

### What it needs (heavy Document-Tracking consumer)
- **Batching/boxing** documents transported to **cashier**.
- **Receiving incoming docs** from Records and other departments.
- This is a primary reason Document Tracking (Pillar 2) is a backbone service —
  Finance lives on "where is this paper now?"


---

## CEO / Office of the President Module

The endpoint. Sits over everything. Build last.

### Main dashboard = ManCom
- **Live ManCom report view** — consolidated from all departments (Survey
  monthly volumes, Engineering SWA/billing, MQC, Operations health, etc.).
- **Trend projection toggle (checkbox):** extrapolate current trajectory —
  e.g., "this project trends to **negative slippage** next month" — by extending
  charts forward on recent trend (accrual/forecast).

### AI Insights view
- Auto-surfaced: **delayed reports, good/poor performance, bottlenecks**.

### Conversational AI
- CEO chats **"what's happening?"** → answers across the whole suite (agentic,
  reads the AI-Queryable Data Layer / Pillar 3).

### Agentic AI view (special)
- A page hosting a **sandboxed iframe** whose **HTML is generated externally by
  an AI agent** and auto-loads ("statically dynamic" — design changes with the
  agent). See `_pillar-ai-layer.md` for the host contract. Detailed design is a
  separate future session.

### Access
- CEO/VPO: cross-cutting visibility. Clinic data only ever **aggregate** here.

