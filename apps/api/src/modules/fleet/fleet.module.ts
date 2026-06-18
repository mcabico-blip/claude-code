import { Body, Controller, Get, Injectable, Module, OnModuleInit, Param, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReadModelRegistry } from '../../pillars/ai-layer/read-model.registry';

/**
 * Cartrack Fleet API client (HTTP Basic auth, regional base URL).
 * Credentials come from env — NEVER committed:
 *   CARTRACK_REGION (e.g. ph), CARTRACK_USER, CARTRACK_PASS
 * Base: https://fleetapi-<region>.cartrack.com/rest
 */
@Injectable()
export class CartrackClient {
  private readonly region: string;
  private readonly user?: string;
  private readonly pass?: string;
  private readonly base: string;

  constructor(config: ConfigService) {
    this.region = config.get<string>('CARTRACK_REGION', 'ph');
    this.user = config.get<string>('CARTRACK_USER');
    this.pass = config.get<string>('CARTRACK_PASS');
    // KE/SA are on karooooo.com; everyone else cartrack.com.
    const host = ['ke', 'sa'].includes(this.region) ? 'karooooo.com' : 'cartrack.com';
    this.base = `https://fleetapi-${this.region}.${host}/rest`;
  }

  get configured(): boolean {
    return Boolean(this.user && this.pass);
  }

  private authHeader(): string {
    return 'Basic ' + Buffer.from(`${this.user}:${this.pass}`).toString('base64');
  }

  /** GET a Cartrack path (relative to /rest). Returns parsed JSON or throws. */
  async get<T = unknown>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    const qs = query
      ? '?' + Object.entries(query).filter(([, v]) => v != null).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
      : '';
    const res = await fetch(`${this.base}${path}${qs}`, {
      headers: { Accept: 'application/json', Authorization: this.authHeader() },
    });
    if (!res.ok) throw new Error(`Cartrack ${path} -> ${res.status} ${res.statusText}`);
    return (await res.json()) as T;
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: this.authHeader() },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Cartrack POST ${path} -> ${res.status} ${res.statusText}`);
    return (await res.json()) as T;
  }

  /** Try several candidate paths (Cartrack has both /vehicles/status and /vehicle/status/location). */
  async getFirst<T = unknown>(paths: string[]): Promise<T> {
    let lastErr: unknown;
    for (const p of paths) {
      try {
        return await this.get<T>(p);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr ?? new Error('no candidate path succeeded');
  }
}

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
  /** true when this row is demo data because credentials aren't set. */
  demo?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0, 0, 0, 0); return fmt(d); };
const todayMidnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return fmt(d); };

@Injectable()
export class FleetService implements OnModuleInit {
  constructor(
    private readonly cartrack: CartrackClient,
    private readonly registry: ReadModelRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      { key: 'fleet.live', module: 'property', title: 'Fleet — live vehicle positions (Cartrack)', description: 'Real-time GPS position/speed/ignition per vehicle.' },
      () => this.live(),
    );
    this.registry.register(
      { key: 'fleet.vehicles', module: 'property', title: 'Fleet — vehicle register (Cartrack)', description: 'All tracked vehicles with current status.' },
      () => this.vehicles(),
    );
    this.registry.register(
      { key: 'fleet.events', module: 'property', title: 'Fleet — driver-behaviour events', description: 'Harsh braking / speeding / harsh acceleration.' },
      () => this.events({}),
    );
    this.registry.register(
      { key: 'fleet.summary', module: 'property', title: 'Fleet — moving/stopped summary', description: 'Vehicle counts: total / moving / stopped / no-fix.' },
      () => this.summary(),
    );
  }

  status(): { configured: boolean; region: string } {
    return { configured: this.cartrack.configured, region: process.env.CARTRACK_REGION ?? 'ph' };
  }

  /** Demo fleet (PH coords) shown until CARTRACK_USER/PASS are set. */
  private demoFleet(): LiveVehicle[] {
    const now = new Date().toISOString();
    const v = (id: string, registration: string, lat: number, lng: number, speed: number, ignition: boolean, address: string): LiveVehicle =>
      ({ id, registration, name: registration, lat, lng, speed, heading: 0, ignition, odometerKm: 100000, fuelPct: 60, driver: null, address, at: now, demo: true });
    return [
      v('D1', 'UBI-DT-114', 8.4542, 124.6319, 42, true, 'Cagayan de Oro — Daang Maharlika'),
      v('D2', 'UBI-DT-118', 8.228, 124.2452, 0, false, 'Iligan — PKG-02 site yard'),
      v('D3', 'UBI-SV-09', 7.1907, 125.4553, 67, true, 'Davao — Mawab-Maco bypass'),
      v('D4', 'UBI-BH-21', 8.15, 125.1278, 0, false, 'Bukidnon — PKG-11 yard'),
    ];
  }

  private toNum(v: unknown): number | null {
    const n = typeof v === 'string' ? parseFloat(v) : (v as number);
    return Number.isFinite(n) ? n : null;
  }

  /** Normalize Cartrack's /vehicles/status payload. Position is nested under
   *  `location` (latitude/longitude/position_description/updated). */
  private normalize(rows: Array<Record<string, unknown>>): LiveVehicle[] {
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
        ignition: typeof r.ignition === 'boolean' ? r.ignition : r.ignition === 'ON' ? true : r.ignition === 'OFF' ? false : null,
        odometerKm: odoM != null ? Math.round(odoM / 1000) : null,
        fuelPct: this.toNum(fuel.precentage_left ?? fuel.percentage_left ?? fuel.level),
        driver: driverName || null,
        address: (loc.position_description ?? r.address ?? null) as string | null,
        at: (loc.updated ?? r.event_ts ?? r.gps_time ?? null) as string | null,
      };
    });
  }

  private rows(data: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
    const d = (data as { data?: unknown })?.data;
    return Array.isArray(d) ? (d as Array<Record<string, unknown>>) : [];
  }

  async live(): Promise<LiveVehicle[]> {
    if (!this.cartrack.configured) return this.demoFleet();
    const data = await this.cartrack.get('/vehicles/status');
    return this.normalize(this.rows(data));
  }

  /** KPI summary for ManCom / Property dashboard. */
  async summary(): Promise<{ configured: boolean; total: number; moving: number; stopped: number; noFix: number }> {
    const live = await this.live();
    return {
      configured: this.cartrack.configured,
      total: live.length,
      moving: live.filter((v) => v.ignition === true && (v.speed ?? 0) > 0).length,
      stopped: live.filter((v) => !v.ignition || (v.speed ?? 0) === 0).length,
      noFix: live.filter((v) => v.lat == null).length,
    };
  }

  async locate(id: string): Promise<unknown> {
    if (!this.cartrack.configured) return { demo: true, message: 'set CARTRACK_USER/PASS to request a live fix' };
    return this.cartrack.post(`/vehicle/${id}/locate`);
  }

  async vehicles(): Promise<Array<Record<string, unknown>>> {
    if (!this.cartrack.configured) return this.demoFleet() as unknown as Array<Record<string, unknown>>;
    return this.rows(await this.cartrack.get('/vehicles'));
  }

  async trips(params: { from?: string; to?: string }): Promise<Array<Record<string, unknown>>> {
    if (!this.cartrack.configured) return [];
    const data = await this.cartrack.get('/trips', {
      start_timestamp: params.from ?? daysAgo(2),
      end_timestamp: params.to ?? fmt(new Date()),
    });
    return this.rows(data);
  }

  /** Driver-behaviour events. Cartrack requires end_timestamp <= today 00:00:00. */
  async events(params: { from?: string; to?: string }): Promise<Array<Record<string, unknown>>> {
    if (!this.cartrack.configured) return [];
    const data = await this.cartrack.get('/vehicles/events', {
      start_timestamp: params.from ?? daysAgo(7),
      end_timestamp: params.to ?? todayMidnight(),
    });
    return this.rows(data);
  }

  /** Alert notifications (geofence/ignition/panic/etc.) — bracket-keyed date filter. */
  async notifications(params: { from?: string; to?: string }): Promise<Array<Record<string, unknown>>> {
    if (!this.cartrack.configured) return [];
    const data = await this.cartrack.get('/alerts/notifications', {
      'filter[date_from]': params.from ?? daysAgo(2),
      'filter[date_to]': params.to ?? fmt(new Date()),
    });
    return this.rows(data);
  }

  async geofences(): Promise<Array<Record<string, unknown>>> {
    if (!this.cartrack.configured) return [];
    return this.rows(await this.cartrack.get('/geofences'));
  }

  async drivers(): Promise<Array<Record<string, unknown>>> {
    if (!this.cartrack.configured) return [];
    return this.rows(await this.cartrack.get('/drivers'));
  }

  /** Maintenance/reminders derived from the vehicle register (is_under_maintenance,
   *  licence expiry) — the dedicated /maintenance path 500s on this account. */
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
}

@Controller('fleet')
export class FleetController {
  constructor(private readonly svc: FleetService) {}

  @Get('status') status(): { configured: boolean; region: string } { return this.svc.status(); }
  @Get('summary') summary(): ReturnType<FleetService['summary']> { return this.svc.summary(); }
  @Get('live') live(): Promise<LiveVehicle[]> { return this.svc.live(); }
  @Get('vehicles') vehicles(): Promise<unknown> { return this.svc.vehicles(); }
  @Get('geofences') geofences(): Promise<unknown> { return this.svc.geofences(); }
  @Get('drivers') drivers(): Promise<unknown> { return this.svc.drivers(); }
  @Get('maintenance') maintenance(): Promise<unknown> { return this.svc.maintenance(); }
  @Get('events') events(@Query('from') from?: string, @Query('to') to?: string): Promise<unknown> { return this.svc.events({ from, to }); }
  @Get('notifications') notifications(@Query('from') from?: string, @Query('to') to?: string): Promise<unknown> { return this.svc.notifications({ from, to }); }
  @Get('trips') trips(@Query('from') from?: string, @Query('to') to?: string): Promise<unknown> { return this.svc.trips({ from, to }); }
  @Post('vehicles/:id/locate') locate(@Param('id') id: string): Promise<unknown> { return this.svc.locate(id); }
}

@Module({
  controllers: [FleetController],
  providers: [CartrackClient, FleetService],
  exports: [FleetService],
})
export class FleetModule {}
