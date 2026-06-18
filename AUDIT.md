# Feature Audit vs Original Spec — updated 2026-06-16

> Tracks modules against `CLAUDE.md` Part II.

## Legend
✅ built · 🟡 stub / read-surface only · ❌ not started

---

## Production hardening (CLAUDE.md §0 item 1)
| Item | Status | Notes |
|---|---|---|
| Helmet security headers | ✅ | added to `main.ts` — all responses get standard security headers |
| TypeORM migration infrastructure | ✅ | `data-source.ts` + `migration:generate/run/revert` scripts in `apps/api/package.json`; **DB_SYNC must be set false and migrations run before production** |
| TypeORM initial migration file | ❌ | run `npm run migration:generate` against a live DB once to capture the current schema |
| Nginx/systemd/deploy docs | ✅ | `ops/nginx.sample.conf`, `ops/systemd/`, `ops/DEPLOY.md`, `ops/INSTALL-AUTOMATION.md` |
| Postgres + uploads backups | ❌ | not started — add a cron/systemd timer calling `pg_dump` + rsync uploads/ |
| Pre-prod audit checklist | ✅ | `ops/PRE-PROD-AUDIT.md` — rotate secrets, disable demo seed, verify RBAC |

---

## Survey module — ✅ real (this session)
| Spec feature | Status | Notes |
|---|---|---|
| Monthly volume feed to ManCom | ✅ | `survey.volumes` read-model pulls from real `survey_measurement` table |
| Cross-section data capture | ✅ | `survey_cross_section` entity + endpoints |
| Station/chainage indexing | ✅ | `station_start` / `station_end` in STA 0+000 format |
| As-built / original-ground / stakeout types | ✅ | `type` field on each measurement |
| Web page | ✅ | `/survey` — volume trend chart, measurement table by project, submit form |
| Demo seed | ✅ | 8 measurements for PKG-02 (PCCP) and PKG-05 (subbase) |

## MQC module — ✅ real (this session)
| Spec feature | Status | Notes |
|---|---|---|
| DPWH minimum testing rules | ✅ | `DPWH_TEST_RULES` table for items 311(1)a/b/c, 200, 201, 301; `GET /mqc/rules/:payItemNo` |
| QC test results | ✅ | `mqc_test` entity + endpoints; `mqc.certs` read-model (pending = blocking billing) |
| Pour logs (standardised form) | ✅ | `mqc_pour_log` — station, mix design, volume, slump, air content |
| Material certificates | ✅ | `mqc_material_cert` entity + issue endpoint; `billingRef` links to Engineering billing |
| Web page | ✅ | `/mqc` — DPWH rules panel, test results tab, pour logs tab, submit forms |
| Demo seed | ✅ | 5 test results + 2 pour logs for PKG-02 / PKG-05 |

---

## IT module
| Spec feature | Status | Notes |
|---|---|---|
| AI Helpdesk (landing, queue) | ✅ | Public no-signin form + Turnstile gate; feeds shared ticketing |
| Capacity planning & controls | 🟡 | Read-model with storage/transfer/DB/UPS rows + thresholds (DB-backed stubs) |
| SNMP device monitoring + map | ❌ | Device list is real; live polling / topology map not started |
| DeskGuard v2 (client OCR + KPIs) | ❌ | Not started |
| Maintenance scheduler (PMS) | ✅ | Auto-generated from Property assets; web page at `/it/pms` |
| Environmental monitoring (DHT22/ESP32) | ❌ | Not started |

## Property module — ✅ real QR EAM
`asset` + `asset_movement` + `custodian_attestation` tables. Scan endpoint, monthly attestation, history. Tools at `/property`.

## Records module — ✅ real
`vehicle_doc` + expiry engine + `physical_location` index (access-gated by claim). Tools at `/records`.

## Department dashboards — ✅ all 14
Standard KPI band + dept Pillar-3 read model + CCTV tile. CCTV goes live when `CCTV_BASE_URL` is set.

## Fleet (Cartrack) — ✅ integrated
Live GPS map (Leaflet), vehicle list, trips/events/geofences/drivers/fuel/maintenance proxy. ManCom live-fleet card.

## Engineering — ✅ core + quantity
Projects, DPWH pay-item library, weekly materials schedule (AI-prefilled), PE→PM→VPO approvals, quantity entry/projection/head pages.

---

## Still stub / not started
- Audit, Clinic, Admin, HR, Finance — read-surface stubs only (render in dept dashboards; deep workflows pending)
- IT SNMP live polling + topology map
- IT DeskGuard v2
- Engineering: SWA/billing tables — `engineering.swa` needs real persistence
- Field photo capture pipeline (GPS + timestamp + <500 KB compress + offline queue)
- Google OAuth
- Offline cached login (field PWA grace)
- TypeORM initial migration file (needs live DB to generate)
- Postgres + uploads backup script

## Suggested next build order
1. **Engineering SWA + billing** — real `weekly_swa` and `billing_batch` tables; SWA feeds ManCom volumes.
2. **Audit module** — findings register + exception tracker (directly feeds AI Insights).
3. **IT SNMP live polling** — SNMP-trap / polling worker + topology map.
4. **Field photo pipeline** — client-side compress + GPS/timestamp + offline queue service worker.
5. **Google OAuth** — layer on top of standalone auth.
6. **Postgres + uploads backup script** — cron/systemd timer + pg_dump + rsync.
