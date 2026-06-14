# Feature Audit vs Original Spec — 2026-06-14

> **Update (build-all pass):** Property, Records and IT promoted from stubs to
> real DB-backed modules — see "Build-all results" at the bottom.


Measured against `CLAUDE.md` Part II. Status of the modules you asked about
first (IT, Property, Records/Doc-Tracking), plus the cross-cutting
department-dashboard layer added this session.

> **Live-site note:** `edge.ubi-as.com` was running an **older build** at audit
> time — `POST /api/public/helpdesk` returned 404, so the public helpdesk +
> Turnstile work was not yet deployed. Pull `kickoff-build` and rebuild on the
> box to get everything below.

## Legend
✅ built · 🟡 stub / read-surface only · ❌ not started

## IT module
| Spec feature | Status | Notes |
|---|---|---|
| AI Helpdesk (landing, queue) | ✅ | Public no-signin form + Turnstile gate; feeds shared ticketing; IT dept dashboard shows the queue |
| Capacity planning & controls | 🟡 | `it.capacity` read-model with storage/transfer/DB/UPS rows + amber/red thresholds (stub data) |
| SNMP device monitoring + map | ❌ | not started |
| DeskGuard v2 (client OCR + KPIs) | ❌ | not started |
| Maintenance scheduler (PMS) | ❌ | not started |
| Environmental monitoring (DHT22/ESP32) | ❌ | not started |

## Property module
| Spec feature | Status | Notes |
|---|---|---|
| Asset custody read surface | 🟡 | `property.assets` stub rows (QR, type, custodian, location, status) |
| QR scan → location/status/custodian update | ❌ | no scan flow, no `asset_movement` table |
| Monthly custodian attestation | ❌ | not started |
| Feed IT PMS scheduler | ❌ | depends on PMS |

## Records / Document Tracking
| Spec feature | Status | Notes |
|---|---|---|
| Document tracking (Pillar 2) | ✅ | QR codes, scan transmit/receive, where-is + full history — real |
| Expiry/renewal reminders | ✅ | shared `ExpiryModule`; `records.expiry` read-model |
| Vehicle reg/insurance/stamp registry | ❌ | no `vehicle_doc` entity yet |
| Physical-location index (access-gated) | ❌ | not started |

## Cross-cutting: Department dashboards (NEW this session)
| Capability | Status | Notes |
|---|---|---|
| Department-head accounts | ✅ | `head-<dept>@ubi.ph` / `head123`, claims `role:manager` + `dept:<slug>` (demo seed) |
| Standard KPI dashboard (uniform all depts) | ✅ | 4 cards: Monitored items · Reporting · Open approvals · Needs attention — same shape everywhere |
| Per-dept field monitoring | ✅ | renders that dept's Pillar-3 read-model |
| CCTV thumbnail per dept | ✅ | tile per `CAM-<DEPT>-01`; live snapshot when `CCTV_BASE_URL` set, else honest NO-SIGNAL placeholder |
| RBAC isolation | ✅ | dept head sees only their dept (403 otherwise); CEO/VPO/admin cross-cutting |

Endpoint: `GET /api/dept/:slug/dashboard` · registry in
`apps/api/src/modules/dept/dept.module.ts`.

## Suggested next build order
1. **Property QR EAM** — `asset` + `asset_movement` + scan endpoints + monthly
   attestation (branch `property`).
2. **Records** — `vehicle_doc` registry + access-gated physical-location index
   (branch `records`).
3. **IT depth** — PMS scheduler (pulls Property assets), then SNMP map, then
   DeskGuard v2 (branch `it`).
4. **CCTV** — set `CCTV_BASE_URL` to the Hikvision NVR snapshot base so every
   dept tile goes live.

---

## Build-all results — 2026-06-14 (this session)

### Property — ✅ real QR EAM
`asset` + `asset_movement` + `custodian_attestation` tables. Endpoints:
scan (`POST /property/assets/:qr/scan` — updates location/status/custodian +
logs movement), monthly attestation, full movement history. Tools page
`/property`. Active assets feed the IT PMS scheduler.

### Records — ✅ real
`vehicle_doc` registry (reg/insurance/stamp) auto-mirrors into the shared
expiry engine; `records.expiry` now DB-backed. `physical_location` index is
**access-gated per row** — restricted titles (e.g. land titles → `role:legal`)
are masked unless the caller holds the claim (verified: records head sees
dept rows, legal row stays locked; IT head sees all locked). Tools page
`/records`.

### IT — ✅ depth added
`it_device` (SNMP targets: UPS/switch/NVR/firewall), `it_pms` (quarterly,
**auto-generated from Property assets**), `deskguard_entry` (self-report +
mandatory consent banner surfaced in UI), `env_reading` (DHT22/IPMI temp).
Read-models: it.capacity, it.devices, it.pms, it.deskguard, it.env. Control
room page `/it`.

### Cross-cutting
- 21 Pillar-3 read-models registered (was 15) — all flow into dept dashboards,
  ManCom and Ask AI.
- Login page: clickable demo-login chips (autofill) + dept-head selector.

### Still stub / not started
- IT SNMP **live polling** + topology map (device list is real, polling is not).
- Survey, MQC, Audit, Clinic, Admin, HR, Finance remain read-surface stubs
  (render in dept dashboards; deep workflows pending per module branch).
- CCTV needs `CCTV_BASE_URL` → Hikvision NVR to go live.
