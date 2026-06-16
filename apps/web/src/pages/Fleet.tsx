import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api';
import { Loader, SheetBar } from '../ui';

interface LiveVehicle {
  id: string; registration: string; lat: number | null; lng: number | null;
  speed: number | null; heading: number | null; ignition: boolean | null;
  address: string | null; at: string | null; demo?: boolean;
}

function FitBounds({ pts }: { pts: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (pts.length) map.fitBounds(pts as [number, number][], { padding: [40, 40], maxZoom: 11 });
  }, [pts, map]);
  return null;
}

export default function Fleet() {
  const [vehicles, setVehicles] = useState<LiveVehicle[] | null>(null);
  const [cfg, setCfg] = useState<{ configured: boolean; region: string } | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number>();

  const load = () => api<LiveVehicle[]>('/fleet/live').then(setVehicles).catch((e: Error) => setError(e.message));

  useEffect(() => {
    api<{ configured: boolean; region: string }>('/fleet/status').then(setCfg).catch(() => {});
    void load();
    // live refresh every 20s
    timer.current = window.setInterval(load, 20000);
    return () => window.clearInterval(timer.current);
  }, []);

  const located = useMemo(() => (vehicles ?? []).filter((v) => v.lat != null && v.lng != null), [vehicles]);
  const pts = useMemo(() => located.map((v) => [v.lat!, v.lng!] as [number, number]), [located]);
  const center: [number, number] = pts[0] ?? [10.3, 123.9]; // PH default

  if (error) return <><SheetBar sheet="FLT-01" title="Fleet" /><div className="err">{error}</div></>;
  if (!vehicles) return <><SheetBar sheet="FLT-01" title="Fleet" /><Loader label="Locating vehicles (Cartrack)" /></>;

  return (
    <>
      <SheetBar sheet="FLT-01" title="Fleet — live vehicle tracking (Cartrack)" note={cfg?.configured ? `Live · region ${cfg.region}` : 'DEMO data — set CARTRACK_USER/PASS for live GPS'} />
      {cfg && !cfg.configured && (
        <div className="hint" style={{ marginTop: 0 }}>
          Showing demo vehicles. Add <code>CARTRACK_USER</code> + <code>CARTRACK_PASS</code> (region <code>{cfg.region}</code>) to go live — the map then plots real positions.
        </div>
      )}

      <div className="fleetgrid">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <MapContainer center={center} zoom={9} style={{ height: 460, width: '100%' }} scrollWheelZoom>
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds pts={pts} />
            {located.map((v) => (
              <CircleMarker
                key={v.id}
                center={[v.lat!, v.lng!]}
                radius={9}
                pathOptions={{ color: '#102536', weight: 2, fillColor: v.ignition ? '#15803d' : '#b45309', fillOpacity: 0.9 }}
                eventHandlers={{ click: () => setSel(v.id) }}
              >
                <Popup>
                  <b>{v.registration}</b><br />
                  {v.ignition ? 'moving' : 'stopped'} · {v.speed ?? 0} km/h<br />
                  {v.address ?? `${v.lat!.toFixed(4)}, ${v.lng!.toFixed(4)}`}<br />
                  <span style={{ color: '#5b6b7a' }}>{v.at ? new Date(v.at).toLocaleString() : ''}</span>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        <div className="card">
          <div className="ph"><b>Vehicles</b><span className="src">SRC · fleet.live</span></div>
          <table className="tbl">
            <thead><tr><th>Reg</th><th>Status</th><th>Speed</th><th>Where</th></tr></thead>
            <tbody>
              {(vehicles ?? []).map((v) => (
                <tr key={v.id} onClick={() => setSel(v.id)} style={{ cursor: 'pointer', background: sel === v.id ? 'rgba(194,65,12,0.06)' : undefined }}>
                  <td><b>{v.registration}</b></td>
                  <td><span className={`st ${v.ignition ? 'st-ok' : 'st-warn'}`}>{v.ignition ? 'moving' : 'stopped'}</span></td>
                  <td>{v.speed ?? 0} km/h</td>
                  <td className="muted" style={{ fontSize: 11 }}>{v.address ?? (v.lat != null ? `${v.lat.toFixed(3)}, ${v.lng!.toFixed(3)}` : 'no fix')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="muted" style={{ fontSize: 10, marginTop: 8 }}>Auto-refreshes every 20s · {located.length}/{vehicles.length} located</div>
        </div>
      </div>
    </>
  );
}
