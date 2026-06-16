import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api';
import { Loader, SheetBar } from '../ui';

interface LiveVehicle {
  id: string; registration: string; name: string | null; lat: number | null; lng: number | null;
  speed: number | null; heading: number | null; ignition: boolean | null;
  odometerKm: number | null; fuelPct: number | null; driver: string | null;
  address: string | null; at: string | null; demo?: boolean;
}
type Row = Record<string, unknown>;
type Tab = 'live' | 'trips' | 'events' | 'alerts' | 'geofences' | 'maintenance';

const TABS: { key: Tab; label: string }[] = [
  { key: 'live', label: 'Live map' },
  { key: 'trips', label: 'Trips' },
  { key: 'events', label: 'Driver events' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'geofences', label: 'Geofences' },
  { key: 'maintenance', label: 'Maintenance' },
];
const COLS: Partial<Record<Tab, string[]>> = {
  trips: ['registration', 'start_timestamp', 'end_timestamp', 'trip_distance', 'trip_duration', 'start_location', 'end_location'],
  events: ['registration', 'event_description', 'event_type', 'event_ts', 'speed', 'position_description'],
  alerts: ['registration', 'name', 'trigger_description', 'notification_msg', 'event_ts', 'speed'],
  geofences: ['name', 'description', 'position_description', 'colour'],
  maintenance: ['registration', 'name', 'model', 'under_maintenance', 'licence_expiry'],
};

function FitBounds({ pts }: { pts: [number, number][] }) {
  const map = useMap();
  useEffect(() => { if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 11 }); }, [pts, map]);
  return null;
}

function Val({ v }: { v: unknown }) {
  if (v == null || v === '') return <span className="muted">—</span>;
  if (typeof v === 'boolean') return <span className={`st ${v ? 'st-warn' : 'st-ok'}`}>{v ? 'yes' : 'no'}</span>;
  if (typeof v === 'object') return <code>{JSON.stringify(v).slice(0, 40)}</code>;
  return <>{String(v)}</>;
}
function DataTable({ rows, cols }: { rows: Row[]; cols?: string[] }) {
  if (!rows.length) return <div className="muted">No records in this window.</div>;
  const keys = (cols ?? Object.keys(rows[0])).filter((k) => k in rows[0]);
  const show = keys.length ? keys : Object.keys(rows[0]).slice(0, 7);
  return (
    <table className="tbl">
      <thead><tr>{show.map((k) => <th key={k}>{k.replace(/_/g, ' ')}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{show.map((k) => <td key={k}><Val v={r[k]} /></td>)}</tr>)}</tbody>
    </table>
  );
}

export default function Fleet() {
  const [tab, setTab] = useState<Tab>('live');
  const [vehicles, setVehicles] = useState<LiveVehicle[] | null>(null);
  const [cfg, setCfg] = useState<{ configured: boolean; region: string } | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [data, setData] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number>();

  const loadLive = () => api<LiveVehicle[]>('/fleet/live').then(setVehicles).catch((e: Error) => setError(e.message));

  useEffect(() => {
    api<{ configured: boolean; region: string }>('/fleet/status').then(setCfg).catch(() => {});
    void loadLive();
    timer.current = window.setInterval(loadLive, 20000);
    return () => window.clearInterval(timer.current);
  }, []);

  useEffect(() => {
    if (tab === 'live') return;
    setData(null);
    api<Row[]>(`/fleet/${tab === 'alerts' ? 'notifications' : tab}`).then(setData).catch((e: Error) => setError(e.message));
  }, [tab]);

  const located = useMemo(() => (vehicles ?? []).filter((v) => v.lat != null && v.lng != null), [vehicles]);
  const pts = useMemo(() => located.map((v) => [v.lat!, v.lng!] as [number, number]), [located]);
  const center: [number, number] = pts[0] ?? [8.0, 125.0];

  async function locate(id: string) {
    await api(`/fleet/vehicles/${id}/locate`, { method: 'POST', body: '{}' }).catch(() => {});
    setTimeout(loadLive, 1500);
  }

  if (error) return <><SheetBar sheet="FLT-01" title="Fleet" /><div className="err">{error}</div></>;

  return (
    <>
      <SheetBar sheet="FLT-01" title="Fleet — Cartrack live management" note={cfg?.configured ? `LIVE · region ${cfg.region} · ${vehicles?.length ?? 0} vehicles` : 'DEMO — set CARTRACK_USER/PASS for live GPS'} />
      {cfg && !cfg.configured && (
        <div className="hint" style={{ marginTop: 0 }}>Demo fleet shown. Set <code>CARTRACK_USER</code>/<code>CARTRACK_PASS</code> (region <code>{cfg.region}</code>) for live GPS.</div>
      )}

      <div className="tabs">
        {TABS.map((t) => <button key={t.key} className={`tab${tab === t.key ? ' on' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>)}
      </div>

      {tab === 'live' ? (
        !vehicles ? <Loader label="Locating vehicles (Cartrack)" /> : (
          <div className="fleetgrid">
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <MapContainer center={center} zoom={8} style={{ height: 480, width: '100%' }} scrollWheelZoom>
                <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FitBounds pts={pts} />
                {located.map((v) => (
                  <CircleMarker key={v.id} center={[v.lat!, v.lng!]} radius={sel === v.id ? 12 : 9}
                    pathOptions={{ color: '#102536', weight: 2, fillColor: v.ignition && (v.speed ?? 0) > 0 ? '#15803d' : '#b45309', fillOpacity: 0.9 }}
                    eventHandlers={{ click: () => setSel(v.id) }}>
                    <Popup>
                      <b>{v.registration}</b> {v.name ? `· ${v.name}` : ''}<br />
                      {v.ignition && (v.speed ?? 0) > 0 ? 'moving' : 'stopped'} · {v.speed ?? 0} km/h · {v.odometerKm?.toLocaleString() ?? '—'} km<br />
                      {v.address ?? `${v.lat!.toFixed(4)}, ${v.lng!.toFixed(4)}`}<br />
                      <span style={{ color: '#5b6b7a' }}>{v.at ? new Date(v.at).toLocaleString() : ''}</span>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
            <div className="card">
              <div className="ph"><b>Vehicles</b><span className="src">SRC · fleet.live</span></div>
              <div style={{ maxHeight: 440, overflowY: 'auto' }}>
                <table className="tbl">
                  <thead><tr><th>Reg</th><th>Status</th><th>km/h</th><th /></tr></thead>
                  <tbody>
                    {(vehicles ?? []).map((v) => (
                      <tr key={v.id} onClick={() => setSel(v.id)} style={{ cursor: 'pointer', background: sel === v.id ? 'rgba(194,65,12,0.06)' : undefined }}>
                        <td><b>{v.registration}</b><div className="muted" style={{ fontSize: 10 }}>{(v.address ?? '').slice(0, 28)}</div></td>
                        <td><span className={`st ${v.ignition && (v.speed ?? 0) > 0 ? 'st-ok' : 'st-warn'}`}>{v.ignition && (v.speed ?? 0) > 0 ? 'moving' : 'stopped'}</span></td>
                        <td>{v.speed ?? 0}</td>
                        <td><button className="btn sm" onClick={(e) => { e.stopPropagation(); void locate(v.id); }} title="request a fresh GPS fix">locate</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="muted" style={{ fontSize: 10, marginTop: 6 }}>Auto-refresh 20s · {located.length}/{vehicles.length} located</div>
            </div>
          </div>
        )
      ) : (
        <div className="card">
          <div className="ph"><b>{TABS.find((t) => t.key === tab)!.label}</b><span className="src">SRC · fleet.{tab}</span></div>
          {!data ? <Loader label={`Loading ${tab}`} /> : <DataTable rows={data} cols={COLS[tab]} />}
        </div>
      )}
    </>
  );
}
