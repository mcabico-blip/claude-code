import { useEffect, useState } from 'react';
import { api } from '../api';
import { Loader, SheetBar } from '../ui';

interface Device { id: string; name: string; kind: string; ip: string; status: string; detail: string | null }
interface Pms { id: string; assetQr: string; assetType: string; quarter: string; dueOn: string; status: string }
interface Env { id: string; sensor: string; tempC: number; humidity: number | null }
interface Desk { id: string; person: string; topApp: string; kpiActivity: string; keystrokes: number; mouse: number; activeMinutes: number }

const dtone = (s: string) => (s === 'up' ? 'st-ok' : s === 'warn' ? 'st-warn' : 'st-bad');

export default function It() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [pms, setPms] = useState<Pms[]>([]);
  const [env, setEnv] = useState<Env[]>([]);
  const [desk, setDesk] = useState<Desk[]>([]);
  const [consent, setConsent] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Device[]>('/it/devices').then(setDevices),
      api<Pms[]>('/it/pms').then(setPms),
      api<Env[]>('/it/env').then(setEnv),
      api<Desk[]>('/it/deskguard').then(setDesk),
      api<{ consent: string }>('/it/deskguard/policy').then((p) => setConsent(p.consent)),
    ]).then(() => setReady(true)).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <><SheetBar sheet="IT-T" title="IT" /><div className="err">{error}</div></>;
  if (!ready) return <><SheetBar sheet="IT-T" title="IT" /><Loader label="Loading IT control room" /></>;

  return (
    <>
      <SheetBar sheet="IT-T" title="IT — control room" note="SNMP devices · PMS scheduler · DeskGuard v2 · environmental" />

      <div className="grid2">
        <div className="card">
          <div className="ph"><b>Monitored devices</b><span className="src">SRC · it.devices</span></div>
          <table className="tbl">
            <thead><tr><th>Device</th><th>Kind</th><th>IP</th><th>Status</th></tr></thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}<div className="muted" style={{ fontSize: 10 }}>{d.detail}</div></td>
                  <td>{d.kind}</td><td><code>{d.ip}</code></td>
                  <td><span className={`st ${dtone(d.status)}`}>{d.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="ph"><b>Environmental</b><span className="src">SRC · it.env</span></div>
          <table className="tbl">
            <thead><tr><th>Sensor</th><th>Temp °C</th><th>Humidity</th></tr></thead>
            <tbody>
              {env.map((e) => (
                <tr key={e.id}>
                  <td>{e.sensor}</td>
                  <td><span className={`st ${e.tempC > 27 ? 'st-bad' : e.tempC > 25 ? 'st-warn' : 'st-ok'}`}>{e.tempC}°</span></td>
                  <td>{e.humidity != null ? `${e.humidity}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mb">
        <div className="ph"><b>Preventive maintenance (PMS)</b><span className="src">SRC · it.pms · auto-built from Property assets</span></div>
        <table className="tbl">
          <thead><tr><th>Asset</th><th>Type</th><th>Quarter</th><th>Due</th><th>Status</th></tr></thead>
          <tbody>
            {pms.map((p) => (
              <tr key={p.id}>
                <td><code>{p.assetQr}</code></td><td>{p.assetType}</td><td>{p.quarter}</td><td>{p.dueOn}</td>
                <td><span className={`st ${p.status === 'done' ? 'st-ok' : 'st-info'}`}>{p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="ph"><b>DeskGuard v2 — activity (self-report)</b><span className="src">SRC · it.deskguard</span></div>
        <div className="err" style={{ background: '#fff7f3', border: '1.5px dashed var(--orange)', color: '#7a3414' }}>
          ⚠ {consent}
        </div>
        <table className="tbl">
          <thead><tr><th>Person</th><th>Top app</th><th>KPI activity</th><th>Keystrokes</th><th>Mouse</th><th>Active min</th></tr></thead>
          <tbody>
            {desk.map((d) => (
              <tr key={d.id}>
                <td>{d.person}</td><td>{d.topApp}</td><td>{d.kpiActivity}</td>
                <td>{d.keystrokes.toLocaleString()}</td><td>{d.mouse.toLocaleString()}</td><td>{d.activeMinutes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
