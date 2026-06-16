import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { QuantityRollup } from '@ubi/types';
import { Chainage, Loader, SheetBar } from '../ui';
import { api } from '../api';

interface Head {
  projects: number; totalInhouse: number; totalToDate: number;
  overallPct: number; thisMonth: number; behind: number; rows: QuantityRollup[];
}
const peso = (n: number) => '₱' + (n / 1e6).toFixed(1) + 'M';

/** Quantity section head dashboard — rolls every QE's weekly entries up to a
 *  section view; the same numbers flow to the CEO ManCom. */
export default function QuantityHead() {
  const [h, setH] = useState<Head | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api<Head>('/quantity/head').then(setH).catch((e: Error) => setError(e.message)); }, []);

  if (error) return <><SheetBar sheet="QTY-DH" title="Quantity head" /><div className="err">{error}</div></>;
  if (!h) return <><SheetBar sheet="QTY-DH" title="Quantity head" /><Loader label="Rolling up section accomplishment" /></>;

  return (
    <>
      <SheetBar sheet="QTY-DH" title="Quantity Section — Head Dashboard" note="Weekly QE entries → section rollup → CEO ManCom" />
      <div className="spread mb"><Link to="/quantity" className="btn sm">Weekly entry →</Link><Link to="/quantity/projection" className="btn sm">Projection & materials →</Link></div>

      <div className="kpis">
        <div className="kpi"><div className="lab">Projects</div><div className="val">{h.projects}</div><div className="sub">with in-house amounts</div><div className="kpi-bar tone-info" /></div>
        <div className="kpi"><div className="lab">Overall accomplishment</div><div className="val">{(h.overallPct * 100).toFixed(1)}%</div><div className="sub">{peso(h.totalToDate)} of {peso(h.totalInhouse)}</div><div className={`kpi-bar tone-${h.overallPct < 0.85 ? 'warn' : 'ok'}`} /></div>
        <div className="kpi"><div className="lab">This month</div><div className="val">{peso(h.thisMonth)}</div><div className="sub">accomplishment logged</div><div className="kpi-bar tone-info" /></div>
        <div className="kpi"><div className="lab">Behind plan</div><div className="val">{h.behind}</div><div className="sub">below 85% to-date</div><div className={`kpi-bar tone-${h.behind ? 'bad' : 'ok'}`} /></div>
      </div>

      <div className="card">
        <div className="ph"><b>Per-project accomplishment</b><span className="src">SRC · engineering.quantity</span></div>
        <table className="tbl">
          <thead><tr><th>Project</th><th>PE</th><th>In-house</th><th>To-date</th><th>Progress</th><th>This month</th><th>Last entry</th></tr></thead>
          <tbody>
            {h.rows.filter((r) => r.inhouseAmount > 0).map((r) => (
              <tr key={r.projectId}>
                <td><b>{r.code}</b><div className="muted" style={{ fontSize: 10 }}>{r.name}</div></td>
                <td>{r.pe}</td>
                <td>{peso(r.inhouseAmount)}</td>
                <td>{peso(r.toDate)}</td>
                <td><Chainage pct={r.pct * 100} tone={r.pct < 0.85 ? 'orange' : 'teal'} /></td>
                <td>{peso(r.thisMonth)}</td>
                <td className="muted">{r.lastWeekOf ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
