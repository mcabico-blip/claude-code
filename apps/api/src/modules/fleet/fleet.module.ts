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
      ? '?' + Object.entries(query).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
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
  lat: number | null;
  lng: number | null;
  speed: number | null;
  heading: number | null;
  ignition: boolean | null;
  address: string | null;
  at: string | null;
  /** true when this row is demo data because credentials aren't set. */
  demo?: boolean;
}

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
      () => this.events(),
    );
  }

  status(): { configured: boolean; region: string } {
    return { configured: this.cartrack.configured, region: process.env.CARTRACK_REGION ?? 'ph' };
  }

  /** Demo fleet (PH coords) shown until CARTRACK_USER/PASS are set. */
  private demoFleet(): LiveVehicle[] {
    const now = new Date().toISOString();
    return [
      { id: 'D1', registration: 'UBI-DT-114', lat: 8.4542, lng: 124.6319, speed: 42, heading: 90, ignition: true, address: 'Cagayan de Oro — Daang Maharlika', at: now, demo: true },
      { id: 'D2', registration: 'UBI-DT-118', lat: 8.2280, lng: 124.2452, speed: 0, heading: 0, ignition: false, address: 'Iligan — PKG-02 site yard', at: now, demo: true },
      { id: 'D3', registration: 'UBI-SV-09', lat: 7.1907, lng: 125.4553, speed: 67, heading: 180, ignition: true, address: 'Davao — Mawab-Maco bypass', at: now, demo: true },
      { id: 'D4', registration: 'UBI-BH-21', lat: 8.1500, lng: 125.1278, speed: 0, heading: 0, ignition: false, address: 'Bukidnon — PKG-11 yard', at: now, demo: true },
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
      return {
        id: String(r.vehicle_id ?? r.id ?? r.terminal_id ?? i),
        registration: String(r.registration ?? r.reg ?? r.plate ?? '—'),
        lat: this.toNum(loc.latitude ?? r.latitude ?? r.lat),
        lng: this.toNum(loc.longitude ?? r.longitude ?? r.lng ?? r.lon),
        speed: this.toNum(r.speed ?? r.velocity),
        heading: this.toNum(r.bearing ?? r.heading ?? r.direction),
        ignition: typeof r.ignition === 'boolean' ? r.ignition : r.ignition === 'ON' ? true : r.ignition === 'OFF' ? false : null,
        address: (loc.position_description ?? r.address ?? null) as string | null,
        at: (loc.updated ?? r.event_ts ?? r.gps_time ?? null) as string | null,
      };
    });
  }

  async live(): Promise<LiveVehicle[]> {
    if (!this.cartrack.configured) return this.demoFleet();
    const data = await this.cartrack.getFirst<unknown>(['/vehicles/status', '/vehicle/status/location', '/vehicle/status']);
    const rows = Array.isArray(data) ? data : ((data as { data?: unknown[] })?.data ?? []);
    return this.normalize(rows as Array<Record<string, unknown>>);
  }

  async locate(id: string): Promise<unknown> {
    if (!this.cartrack.configured) return { demo: true, message: 'set CARTRACK_USER/PASS to request a live fix' };
    return this.cartrack.post(`/vehicle/${id}/locate`);
  }

  async vehicles(): Promise<unknown> {
    if (!this.cartrack.configured) return this.demoFleet();
    return this.cartrack.get('/vehicles');
  }

  async trips(params: { from?: string; to?: string; vehicle?: string }): Promise<unknown> {
    if (!this.cartrack.configured) return { demo: true, trips: [] };
    return this.cartrack.get('/trips', { start_date: params.from, end_date: params.to, vehicle_id: params.vehicle });
  }

  async events(): Promise<unknown> {
    if (!this.cartrack.configured) return [{ demo: true, type: 'harsh-braking', registration: 'UBI-DT-114', at: new Date().toISOString() }];
    return this.cartrack.get('/vehicle/events');
  }

  async geofences(): Promise<unknown> {
    if (!this.cartrack.configured) return { demo: true, geofences: [] };
    return this.cartrack.get('/geofences');
  }

  async drivers(): Promise<unknown> {
    if (!this.cartrack.configured) return { demo: true, drivers: [] };
    return this.cartrack.get('/drivers');
  }

  async maintenance(): Promise<unknown> {
    if (!this.cartrack.configured) return { demo: true, maintenance: [] };
    return this.cartrack.get('/maintenance');
  }

  async fuel(): Promise<unknown> {
    if (!this.cartrack.configured) return { demo: true, fuel: [] };
    return this.cartrack.get('/fuel');
  }
}

@Controller('fleet')
export class FleetController {
  constructor(private readonly svc: FleetService) {}

  @Get('status') status(): { configured: boolean; region: string } { return this.svc.status(); }
  @Get('live') live(): Promise<LiveVehicle[]> { return this.svc.live(); }
  @Get('vehicles') vehicles(): Promise<unknown> { return this.svc.vehicles(); }
  @Get('events') events(): Promise<unknown> { return this.svc.events(); }
  @Get('geofences') geofences(): Promise<unknown> { return this.svc.geofences(); }
  @Get('drivers') drivers(): Promise<unknown> { return this.svc.drivers(); }
  @Get('maintenance') maintenance(): Promise<unknown> { return this.svc.maintenance(); }
  @Get('fuel') fuel(): Promise<unknown> { return this.svc.fuel(); }
  @Get('trips') trips(@Query('from') from?: string, @Query('to') to?: string, @Query('vehicle') vehicle?: string): Promise<unknown> {
    return this.svc.trips({ from, to, vehicle });
  }
  @Post('vehicles/:id/locate') locate(@Param('id') id: string): Promise<unknown> { return this.svc.locate(id); }
}

@Module({
  controllers: [FleetController],
  providers: [CartrackClient, FleetService],
  exports: [FleetService],
})
export class FleetModule {}
