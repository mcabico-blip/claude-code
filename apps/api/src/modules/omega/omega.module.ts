import {
  Body,
  Controller,
  Get,
  Injectable,
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Column, Entity, Index, LessThan, Repository } from 'typeorm';
import { BaseAppEntity } from '../../common/base.entity';
import { Claims } from '../../common/rbac';
import { ReadModelRegistry } from '../../pillars/ai-layer/read-model.registry';
import { AiLayerModule } from '../../pillars/ai-layer/ai-layer.module';

// ──────────────────────────── Cartrack HTTP client ─────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0, 0, 0, 0); return fmt(d); };
const todayMidnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return fmt(d); };

@Injectable()
export class CartrackClient {
  private readonly user?: string;
  private readonly pass?: string;
  readonly region: string;
  readonly base: string;

  constructor(config: ConfigService) {
    this.region = config.get<string>('CARTRACK_REGION', 'ph');
    this.user = config.get<string>('CARTRACK_USER');
    this.pass = config.get<string>('CARTRACK_PASS');
    const host = ['ke', 'sa'].includes(this.region) ? 'karooooo.com' : 'cartrack.com';
    this.base = `https://fleetapi-${this.region}.${host}/rest`;
  }

  get configured(): boolean { return Boolean(this.user && this.pass); }

  private auth(): string {
    return 'Basic ' + Buffer.from(`${this.user}:${this.pass}`).toString('base64');
  }

  async get<T = unknown>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    const qs = query
      ? '?' + Object.entries(query).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
      : '';
    const res = await fetch(`${this.base}${path}${qs}`, {
      headers: { Accept: 'application/json', Authorization: this.auth() },
    });
    if (!res.ok) throw new Error(`Cartrack ${path} → ${res.status}`);
    return (await res.json()) as T;
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: this.auth() },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Cartrack POST ${path} → ${res.status}`);
    return (await res.json()) as T;
  }
}

// ──────────────────────────── Entities ─────────────────────────────────────

/** Periodic position snapshot for analytics / history replay. */
@Entity('fleet_position_log')
export class FleetPositionLog extends BaseAppEntity {
  @Index() @Column({ name: 'vehicle_id', type: 'varchar' }) vehicleId: string;
  @Column({ name: 'registration', type: 'varchar' }) registration: string;
  @Column({ name: 'lat', type: 'numeric', precision: 10, scale: 6, nullable: true }) lat: number | null;
  @Column({ name: 'lng', type: 'numeric', precision: 10, scale: 6, nullable: true }) lng: number | null;
  @Column({ name: 'speed_kmh', type: 'numeric', precision: 6, scale: 1, nullable: true }) speedKmh: number | null;
  @Column({ name: 'heading', type: 'smallint', nullable: true }) heading: number | null;
  @Column({ name: 'ignition', type: 'boolean', nullable: true }) ignition: boolean | null;
  @Column({ name: 'odometer_km', type: 'int', nullable: true }) odometerKm: number | null;
  @Column({ name: 'fuel_pct', type: 'numeric', precision: 5, scale: 2, nullable: true }) fuelPct: number | null;
  @Column({ name: 'driver_name', type: 'varchar', nullable: true }) driverName: string | null;
  @Column({ name: 'address', type: 'varchar', nullable: true }) address: string | null;
  @Index() @Column({ name: 'polled_at', type: 'timestamptz' }) polledAt: Date;
}

/** Driver-behaviour events (harsh braking, speeding, harsh acceleration). */
@Entity('fleet_driver_event')
export class FleetDriverEvent extends BaseAppEntity {
  @Index() @Column({ name: 'vehicle_id', type: 'varchar' }) vehicleId: string;
  @Column({ name: 'registration', type: 'varchar' }) registration: string;
  @Column({ name: 'event_type', type: 'varchar', length: 64 }) eventType: string;
  @Column({ name: 'event_description', type: 'varchar', nullable: true }) eventDescription: string | null;
  @Column({ name: 'severity', type: 'varchar', length: 16, default: 'warning' }) severity: string;
  @Column({ name: 'speed_kmh', type: 'numeric', precision: 6, scale: 1, nullable: true }) speedKmh: number | null;
  @Column({ name: 'lat', type: 'numeric', precision: 10, scale: 6, nullable: true }) lat: number | null;
  @Column({ name: 'lng', type: 'numeric', precision: 10, scale: 6, nullable: true }) lng: number | null;
  @Column({ name: 'address', type: 'varchar', nullable: true }) address: string | null;
  @Index() @Column({ name: 'occurred_at', type: 'timestamptz' }) occurredAt: Date;
  @Column({ name: 'raw', type: 'jsonb', nullable: true }) raw: Record<string, unknown> | null;
}

/** Alerts / notifications (geofence, ignition, panic, speeding threshold, etc.). */
@Entity('fleet_alert')
export class FleetAlert extends BaseAppEntity {
  @Index() @Column({ name: 'vehicle_id', type: 'varchar', nullable: true }) vehicleId: string | null;
  @Column({ name: 'registration', type: 'varchar', nullable: true }) registration: string | null;
  @Column({ name: 'alert_type', type: 'varchar', length: 64, nullable: true }) alertType: string | null;
  @Column({ name: 'message', type: 'text', nullable: true }) message: string | null;
  @Column({ name: 'lat', type: 'numeric', precision: 10, scale: 6, nullable: true }) lat: number | null;
  @Column({ name: 'lng', type: 'numeric', precision: 10, scale: 6, nullable: true }) lng: number | null;
  @Index() @Column({ name: 'occurred_at', type: 'timestamptz' }) occurredAt: Date;
  @Column({ name: 'acknowledged', type: 'boolean', default: false }) acknowledged: boolean;
  @Column({ name: 'raw', type: 'jsonb', nullable: true }) raw: Record<string, unknown> | null;
}

/** Omega Asia equipment register — master list of OAEC-owned units. */
@Entity('omega_equipment')
export class OmegaEquipment extends BaseAppEntity {
  @Column({ name: 'unit_no', type: 'varchar', unique: true }) unitNo: string;
  @Column({ name: 'plate', type: 'varchar', nullable: true }) plate: string | null;
  @Column({ name: 'equipment_type', type: 'varchar', length: 64 }) equipmentType: string;
  @Column({ name: 'make', type: 'varchar', nullable: true }) make: string | null;
  @Column({ name: 'model', type: 'varchar', nullable: true }) model: string | null;
  @Column({ name: 'year', type: 'smallint', nullable: true }) year: number | null;
  /** Cartrack vehicle_id for linking live telemetry. */
  @Column({ name: 'cartrack_id', type: 'varchar', nullable: true }) cartrackId: string | null;
  /** active | maintenance | retired | standby */
  @Column({ type: 'varchar', length: 16, default: 'active' }) status: string;
  /** UBI project currently using this unit. */
  @Column({ name: 'assigned_project', type: 'varchar', nullable: true }) assignedProject: string | null;
  @Column({ name: 'notes', type: 'text', nullable: true }) notes: string | null;
}

// ──────────────────────────── Live vehicle shape ────────────────────────────

export interface LiveVehicle {
  id: string;
  registration: string;
  name: string | null;
  lat: number | null;
  lng: number | null;
  speed: number | null;
  heading: number | null;
  ignition: boolean | null;
  odometerKm: number | null;
  fuelPct: number | null;
  driver: string | null;
  address: string | null;
  at: string | null;
  demo?: boolean;
}

// ──────────────────────────── In-memory live cache ─────────────────────────

@Injectable()
export class FleetCache {
  private _positions: LiveVehicle[] = [];
  private _at: number = 0;

  set(positions: LiveVehicle[]): void { this._positions = positions; this._at = Date.now(); }
  get(): LiveVehicle[] { return this._positions; }
  ageMs(): number { return Date.now() - this._at; }
  fresh(): boolean { return this._at > 0 && this.ageMs() < 60_000; }
}

// ──────────────────────────── Normaliser ───────────────────────────────────

@Injectable()
export class FleetNormaliser {
  toNum(v: unknown): number | null {
    const n = typeof v === 'string' ? parseFloat(v) : (v as number);
    return Number.isFinite(n) ? n : null;
  }

  rows(data: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
    const d = (data as { data?: unknown })?.data;
    return Array.isArray(d) ? (d as Array<Record<string, unknown>>) : [];
  }

  normalize(rows: Array<Record<string, unknown>>): LiveVehicle[] {
    return rows.map((r, i) => {
      const loc = (r.location ?? {}) as Record<string, unknown>;
      const fuel = (r.fuel ?? {}) as Record<string, unknown>;
      const drv = (r.driver ?? {}) as Record<string, unknown>;
      const driverName = [drv.first_name, drv.last_name].filter(Boolean).join(' ').trim();
      const odoM = this.toNum(r.odometer);
      return {
        id: String(r.vehicle_id ?? r.id ?? r.terminal_id ?? i),
        registration: String(r.registration ?? r.reg ?? r.plate ?? '—'),
        name: (r.vehicle_name ?? r.client_vehicle_description ?? null) as string | null,
        lat: this.toNum(loc.latitude ?? r.latitude ?? r.lat),
        lng: this.toNum(loc.longitude ?? r.longitude ?? r.lng ?? r.lon),
        speed: this.toNum(r.speed ?? r.velocity),
        heading: this.toNum(r.bearing ?? r.heading ?? r.direction),
        ignition: r.ignition === true || r.ignition === 'ON' ? true : r.ignition === false || r.ignition === 'OFF' ? false : null,
        odometerKm: odoM != null ? Math.round(odoM / 1000) : null,
        fuelPct: this.toNum(fuel.precentage_left ?? fuel.percentage_left ?? fuel.level),
        driver: driverName || null,
        address: (loc.position_description ?? r.address ?? null) as string | null,
        at: (loc.updated ?? r.event_ts ?? r.gps_time ?? null) as string | null,
      };
    });
  }
}

// ──────────────────────────── Background poller ────────────────────────────

/** Pulls live positions every 10 s (cache) + stores a DB snapshot every 60 s.
 *  Pulls events + alerts from Cartrack every 10 min and stores to DB.
 *  All intervals cleared on shutdown so tests/restarts don't leak. */
@Injectable()
export class FleetPoller implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('FleetPoller');
  private liveTimer?: NodeJS.Timeout;
  private snapshotTimer?: NodeJS.Timeout;
  private analyticsTimer?: NodeJS.Timeout;
  private lastAnalyticsPull = 0;

  constructor(
    private readonly cartrack: CartrackClient,
    private readonly cache: FleetCache,
    private readonly norm: FleetNormaliser,
    @InjectRepository(FleetPositionLog) private readonly posLog: Repository<FleetPositionLog>,
    @InjectRepository(FleetDriverEvent) private readonly driverEvents: Repository<FleetDriverEvent>,
    @InjectRepository(FleetAlert) private readonly alerts: Repository<FleetAlert>,
  ) {}

  onModuleInit(): void {
    if (!this.cartrack.configured) {
      this.log.warn('CARTRACK_USER/PASS not set — poller inactive, demo data served');
      return;
    }
    // Kick off immediately, then on interval.
    void this.pollLive();
    this.liveTimer = setInterval(() => void this.pollLive(), 10_000);

    // DB snapshot every 60 s.
    this.snapshotTimer = setInterval(() => void this.saveSnapshot(), 60_000);

    // Analytics (events + alerts) every 10 min.
    void this.pollAnalytics();
    this.analyticsTimer = setInterval(() => void this.pollAnalytics(), 10 * 60_000);

    this.log.log('Fleet poller started (live 10s · snapshot 60s · analytics 10min)');
  }

  onModuleDestroy(): void {
    clearInterval(this.liveTimer);
    clearInterval(this.snapshotTimer);
    clearInterval(this.analyticsTimer);
  }

  async pollLive(): Promise<void> {
    try {
      const data = await this.cartrack.get('/vehicles/status');
      this.cache.set(this.norm.normalize(this.norm.rows(data)));
    } catch (e) {
      this.log.warn(`live poll failed: ${(e as Error).message}`);
    }
  }

  async saveSnapshot(): Promise<void> {
    const positions = this.cache.get();
    if (!positions.length) return;
    const now = new Date();
    await this.posLog.save(
      positions
        .filter((v) => v.lat != null && v.lng != null)
        .map((v) =>
          this.posLog.create({
            vehicleId: v.id,
            registration: v.registration,
            lat: v.lat,
            lng: v.lng,
            speedKmh: v.speed,
            heading: v.heading,
            ignition: v.ignition,
            odometerKm: v.odometerKm,
            fuelPct: v.fuelPct,
            driverName: v.driver,
            address: v.address,
            polledAt: now,
            createdBy: 'poller',
          }),
        ),
    );
    // Purge position log older than 30 days.
    const cutoff = new Date(Date.now() - 30 * 86_400_000);
    await this.posLog.delete({ polledAt: LessThan(cutoff) });
  }

  async pollAnalytics(): Promise<void> {
    const from = this.lastAnalyticsPull
      ? fmt(new Date(this.lastAnalyticsPull))
      : daysAgo(1);
    this.lastAnalyticsPull = Date.now();

    // Driver events.
    try {
      const raw = await this.cartrack.get<unknown>('/vehicles/events', {
        start_timestamp: from,
        end_timestamp: todayMidnight(),
      });
      const rows = this.norm.rows(raw);
      if (rows.length) {
        await this.driverEvents.save(
          rows.map((r) =>
            this.driverEvents.create({
              vehicleId: String(r.vehicle_id ?? r.id ?? ''),
              registration: String(r.registration ?? '—'),
              eventType: String(r.event_type ?? r.type ?? 'unknown'),
              eventDescription: (r.event_description ?? r.description ?? null) as string | null,
              severity: String(r.severity ?? 'warning'),
              speedKmh: this.norm.toNum(r.speed),
              lat: this.norm.toNum(r.latitude ?? r.lat),
              lng: this.norm.toNum(r.longitude ?? r.lng),
              address: (r.position_description ?? r.address ?? null) as string | null,
              occurredAt: new Date((r.event_ts ?? r.timestamp ?? Date.now()) as string | number),
              raw: r,
              createdBy: 'poller',
            }),
          ),
        );
        this.log.log(`analytics: stored ${rows.length} driver events`);
      }
    } catch (e) {
      this.log.warn(`events poll failed: ${(e as Error).message}`);
    }

    // Alerts / notifications.
    try {
      const raw = await this.cartrack.get<unknown>('/alerts/notifications', {
        'filter[date_from]': from,
        'filter[date_to]': fmt(new Date()),
      });
      const rows = this.norm.rows(raw);
      if (rows.length) {
        await this.alerts.save(
          rows.map((r) =>
            this.alerts.create({
              vehicleId: (r.vehicle_id ?? r.id ?? null) as string | null,
              registration: (r.registration ?? null) as string | null,
              alertType: (r.trigger_description ?? r.alert_type ?? null) as string | null,
              message: (r.notification_msg ?? r.message ?? null) as string | null,
              lat: this.norm.toNum(r.latitude ?? r.lat),
              lng: this.norm.toNum(r.longitude ?? r.lng),
              occurredAt: new Date((r.event_ts ?? r.timestamp ?? Date.now()) as string | number),
              raw: r,
              createdBy: 'poller',
            }),
          ),
        );
        this.log.log(`analytics: stored ${rows.length} alerts`);
      }
    } catch (e) {
      this.log.warn(`alerts poll failed: ${(e as Error).message}`);
    }
  }
}

// ──────────────────────────── Fleet service ────────────────────────────────

@Injectable()
export class FleetService implements OnModuleInit {
  constructor(
    private readonly cartrack: CartrackClient,
    private readonly cache: FleetCache,
    private readonly norm: FleetNormaliser,
    private readonly registry: ReadModelRegistry,
    @InjectRepository(FleetPositionLog) private readonly posLog: Repository<FleetPositionLog>,
    @InjectRepository(FleetDriverEvent) private readonly driverEvents: Repository<FleetDriverEvent>,
    @InjectRepository(FleetAlert) private readonly alerts: Repository<FleetAlert>,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      { key: 'fleet.live', module: 'omega', title: 'Fleet — live vehicle positions (Cartrack, 10s cache)', description: 'Server-cached GPS position/speed/ignition per vehicle.' },
      () => this.live(),
    );
    this.registry.register(
      { key: 'fleet.summary', module: 'omega', title: 'Fleet — moving/stopped summary', description: 'Vehicle counts: total / moving / stopped / no-fix.' },
      () => this.summary(),
    );
    this.registry.register(
      { key: 'fleet.events', module: 'omega', title: 'Fleet — driver behaviour events (DB)', description: 'Harsh braking / speeding / harsh acceleration, stored from 10-min poll.' },
      async () => this.driverEvents.find({ order: { occurredAt: 'DESC' }, take: 200 }),
    );
    this.registry.register(
      { key: 'fleet.alerts', module: 'omega', title: 'Fleet — alerts (DB)', description: 'Geofence / ignition / panic alerts, stored from 10-min poll.' },
      async () => this.alerts.find({ where: { acknowledged: false }, order: { occurredAt: 'DESC' }, take: 100 }),
    );
    this.registry.register(
      { key: 'fleet.fuel', module: 'omega', title: 'Fleet — fuel level summary', description: 'Current fuel % per vehicle from 10s cache; low (<20%) flagged for CEO/VPO.' },
      async () => {
        const live = await this.live();
        return live.map((v) => ({ id: v.id, registration: v.registration, fuelPct: v.fuelPct, low: v.fuelPct != null && v.fuelPct < 20 }));
      },
    );
  }

  private demoFleet(): LiveVehicle[] {
    const now = new Date().toISOString();
    const v = (id: string, reg: string, lat: number, lng: number, speed: number, ign: boolean, address: string): LiveVehicle =>
      ({ id, registration: reg, name: reg, lat, lng, speed, heading: 0, ignition: ign, odometerKm: 100_000, fuelPct: 60, driver: null, address, at: now, demo: true });
    return [
      v('D1', 'OAE-DT-114', 8.4542, 124.6319, 42, true, 'Cagayan de Oro — Daang Maharlika'),
      v('D2', 'OAE-DT-118', 8.228, 124.2452, 0, false, 'Iligan — PKG-02 site yard'),
      v('D3', 'OAE-SV-09', 7.1907, 125.4553, 67, true, 'Davao — Mawab-Maco bypass'),
      v('D4', 'OAE-BH-21', 8.15, 125.1278, 0, false, 'Bukidnon — PKG-11 yard'),
    ];
  }

  async live(): Promise<LiveVehicle[]> {
    if (!this.cartrack.configured) return this.demoFleet();
    // Serve from cache; if cache is stale (>30s, e.g. poller restart), fall back to direct call.
    if (this.cache.fresh()) return this.cache.get();
    const data = await this.cartrack.get('/vehicles/status');
    const positions = this.norm.normalize(this.norm.rows(data));
    this.cache.set(positions);
    return positions;
  }

  async summary() {
    const live = await this.live();
    return {
      configured: this.cartrack.configured,
      cacheAgeMs: this.cache.ageMs(),
      total: live.length,
      moving: live.filter((v) => v.ignition === true && (v.speed ?? 0) > 0).length,
      stopped: live.filter((v) => !v.ignition || (v.speed ?? 0) === 0).length,
      noFix: live.filter((v) => v.lat == null).length,
    };
  }

  async locate(id: string): Promise<unknown> {
    if (!this.cartrack.configured) return { demo: true, message: 'set CARTRACK_USER/PASS' };
    return this.cartrack.post(`/vehicle/${id}/locate`);
  }

  async vehicles(): Promise<Array<Record<string, unknown>>> {
    if (!this.cartrack.configured) return this.demoFleet() as unknown as Array<Record<string, unknown>>;
    return this.norm.rows(await this.cartrack.get('/vehicles'));
  }

  async trips(params: { from?: string; to?: string }): Promise<Array<Record<string, unknown>>> {
    if (!this.cartrack.configured) return [];
    return this.norm.rows(await this.cartrack.get('/trips', {
      start_timestamp: params.from ?? daysAgo(2),
      end_timestamp: params.to ?? fmt(new Date()),
    }));
  }

  async geofences(): Promise<Array<Record<string, unknown>>> {
    if (!this.cartrack.configured) return [];
    return this.norm.rows(await this.cartrack.get('/geofences'));
  }

  async drivers(): Promise<Array<Record<string, unknown>>> {
    if (!this.cartrack.configured) return [];
    return this.norm.rows(await this.cartrack.get('/drivers'));
  }

  async maintenance(): Promise<Array<Record<string, unknown>>> {
    const vs = await this.vehicles();
    return vs
      .map((v) => ({
        registration: v.registration,
        name: v.vehicle_name ?? v.client_vehicle_description,
        under_maintenance: v.is_under_maintenance ?? false,
        licence_expiry: v.licence_expiry_date ?? null,
        model: [v.manufacturer, v.model].filter(Boolean).join(' '),
      }))
      .filter((m) => m.under_maintenance || m.licence_expiry);
  }

  // ── Analytics from stored data ──────────────────────────────────────────

  async positionHistory(vehicleId: string, sinceHours = 24): Promise<FleetPositionLog[]> {
    const since = new Date(Date.now() - sinceHours * 3_600_000);
    return this.posLog.find({
      where: { vehicleId, polledAt: LessThan(new Date(Date.now())) },
      order: { polledAt: 'ASC' },
      take: 2000,
    }).then((rows) => rows.filter((r) => r.polledAt >= since));
  }

  async recentEvents(hours = 24): Promise<FleetDriverEvent[]> {
    const since = new Date(Date.now() - hours * 3_600_000);
    return this.driverEvents.createQueryBuilder('e')
      .where('e.occurred_at >= :since', { since })
      .orderBy('e.occurred_at', 'DESC')
      .take(500)
      .getMany();
  }

  async recentAlerts(unacknowledgedOnly = false): Promise<FleetAlert[]> {
    const qb = this.alerts.createQueryBuilder('a').orderBy('a.occurred_at', 'DESC').take(200);
    if (unacknowledgedOnly) qb.where('a.acknowledged = false');
    return qb.getMany();
  }

  async acknowledgeAlert(id: string): Promise<void> {
    await this.alerts.update(id, { acknowledged: true });
  }

  /** Fuel level trend per vehicle — most recent 48 snapshots (one per minute stored).
   *  Returns [{vehicleId, registration, snapshots:[{at, fuelPct}]}]. */
  async fuelTrend(hours = 8): Promise<Array<{ vehicleId: string; registration: string; snapshots: Array<{ at: Date; fuelPct: number | null }> }>> {
    const since = new Date(Date.now() - hours * 3_600_000);
    const rows = await this.posLog
      .createQueryBuilder('p')
      .select(['p.vehicle_id', 'p.registration', 'p.fuel_pct', 'p.polled_at'])
      .where('p.polled_at >= :since', { since })
      .orderBy('p.vehicle_id').addOrderBy('p.polled_at', 'ASC')
      .getRawMany() as Array<{ p_vehicle_id: string; p_registration: string; p_fuel_pct: string | null; p_polled_at: Date }>;

    const byVehicle = new Map<string, { registration: string; snapshots: Array<{ at: Date; fuelPct: number | null }> }>();
    for (const r of rows) {
      if (!byVehicle.has(r.p_vehicle_id)) byVehicle.set(r.p_vehicle_id, { registration: r.p_registration, snapshots: [] });
      byVehicle.get(r.p_vehicle_id)!.snapshots.push({ at: r.p_polled_at, fuelPct: r.p_fuel_pct != null ? Number(r.p_fuel_pct) : null });
    }
    return Array.from(byVehicle.entries()).map(([vehicleId, v]) => ({ vehicleId, ...v }));
  }
}

// ──────────────────────────── Omega equipment service ──────────────────────

@Injectable()
export class OmegaService implements OnModuleInit {
  constructor(
    @InjectRepository(OmegaEquipment) private readonly equipment: Repository<OmegaEquipment>,
    private readonly registry: ReadModelRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      { key: 'omega.equipment', module: 'omega', title: 'Omega — equipment register', description: 'All OAEC-owned units with Cartrack link, status, and project assignment.' },
      () => this.equipment.find({ order: { unitNo: 'ASC' }, take: 500 }),
    );
  }

  async list(): Promise<OmegaEquipment[]> {
    return this.equipment.find({ order: { unitNo: 'ASC' } });
  }

  async upsert(data: Partial<OmegaEquipment>, actor: string): Promise<OmegaEquipment> {
    const existing = data.unitNo ? await this.equipment.findOne({ where: { unitNo: data.unitNo } }) : null;
    const record = existing ? Object.assign(existing, data) : this.equipment.create({ ...data, entity: 'OMEGA', createdBy: actor });
    return this.equipment.save(record);
  }

  async seed(actor: string): Promise<void> {
    if ((await this.equipment.count()) > 0) return;
    const units = [
      { unitNo: 'OAE-DT-114', plate: 'OAE-DT-114', equipmentType: 'Dump Truck', make: 'Hino', model: '700', year: 2020, status: 'active', assignedProject: 'PKG-05' },
      { unitNo: 'OAE-DT-118', plate: 'OAE-DT-118', equipmentType: 'Dump Truck', make: 'Hino', model: '700', year: 2021, status: 'active', assignedProject: 'PKG-02' },
      { unitNo: 'OAE-SV-09', plate: 'OAE-SV-09', equipmentType: 'Service Vehicle', make: 'Toyota', model: 'Hilux', year: 2022, status: 'active', assignedProject: 'PKG-03' },
      { unitNo: 'OAE-BH-21', plate: 'OAE-BH-21', equipmentType: 'Backhoe', make: 'Komatsu', model: 'PC200', year: 2019, status: 'active', assignedProject: 'PKG-11' },
      { unitNo: 'OAE-EX-07', plate: null, equipmentType: 'Excavator', make: 'Caterpillar', model: '320', year: 2018, status: 'maintenance', assignedProject: null },
      { unitNo: 'OAE-GR-03', plate: null, equipmentType: 'Motor Grader', make: 'Caterpillar', model: '140M', year: 2017, status: 'standby', assignedProject: null },
    ];
    await this.equipment.save(units.map((u) => this.equipment.create({ ...u, entity: 'OMEGA', createdBy: actor })));
  }
}

// ──────────────────────────── Controllers ──────────────────────────────────

/** Fleet controller — keeps /api/fleet/... routes for web compat. */
@Controller('fleet')
export class FleetController {
  constructor(private readonly fleet: FleetService) {}

  @Get('status')
  status() { return { configured: this.fleet['cartrack'].configured, region: this.fleet['cartrack'].region }; }

  @Get('summary') summary() { return this.fleet.summary(); }

  /** Live positions — served from 10s server cache, NOT direct Cartrack call. */
  @Get('live') live(): Promise<LiveVehicle[]> { return this.fleet.live(); }

  @Get('vehicles') vehicles(): Promise<unknown> { return this.fleet.vehicles(); }
  @Get('geofences') geofences(): Promise<unknown> { return this.fleet.geofences(); }
  @Get('drivers') drivers(): Promise<unknown> { return this.fleet.drivers(); }
  @Get('maintenance') maintenance(): Promise<unknown> { return this.fleet.maintenance(); }

  @Get('trips')
  trips(@Query('from') from?: string, @Query('to') to?: string): Promise<unknown> { return this.fleet.trips({ from, to }); }

  /** Events and alerts now served from DB (10-min poll), not direct Cartrack. */
  @Get('events')
  events(@Query('hours') hours?: string): Promise<FleetDriverEvent[]> { return this.fleet.recentEvents(Number(hours ?? 24)); }

  @Get('notifications')
  alerts(@Query('unack') unack?: string): Promise<FleetAlert[]> { return this.fleet.recentAlerts(unack === 'true'); }

  @Post('notifications/:id/ack')
  @Claims('role:manager', 'dept:operations', 'dept:engineering')
  ack(@Param('id') id: string): Promise<void> { return this.fleet.acknowledgeAlert(id); }

  @Post('vehicles/:id/locate')
  locate(@Param('id') id: string): Promise<unknown> { return this.fleet.locate(id); }

  /** Position history for a single vehicle (from DB). */
  @Get('vehicles/:id/history')
  @Claims('role:manager', 'dept:operations', 'role:ceo', 'role:vpo')
  history(@Param('id') id: string, @Query('hours') hours?: string): Promise<FleetPositionLog[]> {
    return this.fleet.positionHistory(id, Number(hours ?? 24));
  }

  /** Fuel level trend for all vehicles — from stored position snapshots. */
  @Get('fuel/trend')
  @Claims('role:manager', 'dept:operations', 'role:ceo', 'role:vpo')
  fuelTrend(@Query('hours') hours?: string) {
    return this.fleet.fuelTrend(Number(hours ?? 8));
  }
}

/** Omega controller — equipment register at /api/omega/... */
@Controller('omega')
export class OmegaController {
  constructor(private readonly omega: OmegaService) {}

  @Get('equipment')
  @Claims('role:manager', 'dept:operations', 'role:ceo', 'role:vpo')
  list(): Promise<OmegaEquipment[]> { return this.omega.list(); }

  @Post('equipment')
  @Claims('dept:operations', 'role:manager')
  upsert(@Body() body: Partial<OmegaEquipment>): Promise<OmegaEquipment> {
    return this.omega.upsert(body, 'system');
  }
}

// ──────────────────────────── Module ───────────────────────────────────────

@Module({
  imports: [
    TypeOrmModule.forFeature([FleetPositionLog, FleetDriverEvent, FleetAlert, OmegaEquipment]),
    AiLayerModule,
  ],
  controllers: [FleetController, OmegaController],
  providers: [CartrackClient, FleetCache, FleetNormaliser, FleetPoller, FleetService, OmegaService],
  exports: [FleetService, OmegaService, CartrackClient],
})
export class OmegaModule {}
