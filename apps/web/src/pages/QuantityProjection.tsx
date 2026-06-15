import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { QuantityRollup } from '@ubi/types';
import { api } from '../api';
import { Loader, SheetBar } from '../ui';

/** Canonical DPWH material catalog (from the Monthly Projection sheet). */
const MATERIALS_CATALOG: ReadonlyArray<{ name: string; unit: string }> = [
  { name: 'Cement Bulk', unit: 'bulk' },
  { name: 'Cement Tonner', unit: 'tonner bags' },
  { name: 'Cement 40kg', unit: '40kg' },
  { name: 'Ready Mix Concrete 4000 PSI', unit: 'cu.m' },
  { name: 'Steel sheet Pile (pc)', unit: 'pcs' },
  { name: 'Steel sheet Pile (lm)', unit: 'lm' },
  { name: 'Washed Sand', unit: 'cu.m' },
  { name: 'Coarse Sand', unit: 'cu.m' },
  { name: 'Gravel 3/4', unit: 'cu.m' },
  { name: 'Gravel G1', unit: 'cu.m' },
  { name: 'Item 200', unit: 'cu.m' },
  { name: 'Item 300', unit: 'cu.m' },
  { name: 'Boulders', unit: 'cu.m' },
  { name: 'Borrow Materials', unit: 'cu.m' },
  { name: 'Mountain Mix/Earthfill', unit: 'cu.m' },
  { name: 'Reinforcing Steel 12mmØ x 12 m', unit: 'pcs' },
  { name: 'Reinforcing Steel 16mmØ x 12 m', unit: 'pcs' },
  { name: 'Reinforcing Steel 20mmØ x 12 m', unit: 'pcs' },
  { name: 'Reinforcing Steel 25mmØ x 12 m', unit: 'pcs' },
  { name: 'Reinforcing Steel Bar G40 (kg)', unit: 'kg' },
];

interface Projection { projectId: string; month: string; projectedAmount: number }
interface Material { projectId: string; month: string; material: string; unit: string; qty: number }

function nextMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 1; i <= n; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() + i, 1);
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}
const label = (m: string) => new Date(m + '-01').toLocaleString('en', { month: 'short', year: '2-digit' });

/** On-platform replacement for the Google-Drive "Monthly Projection of
 *  Accomplishment & Material Requirements" sheet — one platform for all edges. */
export default function QuantityProjection() {
  const [projects, setProjects] = useState<QuantityRollup[]>([]);
  const [pid, setPid] = useState('');
  const [proj, setProj] = useState<Record<string, number>>({});
  const [mats, setMats] = useState<Record<string, number>>({}); // key `${month}|${material}`
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const months = useMemo(() => nextMonths(6), []);

  useEffect(() => {
    api<QuantityRollup[]>('/quantity/rollup')
      .then((r) => { const f = r.filter((x) => x.inhouseAmount > 0); setProjects(f); if (f[0]) setPid(f[0].projectId); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!pid) return;
    Promise.all([
      api<Projection[]>(`/quantity/projections?projectId=${pid}`),
      api<Material[]>(`/quantity/materials?projectId=${pid}`),
    ]).then(([ps, ms]) => {
      setProj(Object.fromEntries(ps.map((p) => [p.month, p.projectedAmount])));
      setMats(Object.fromEntries(ms.map((m) => [`${m.month}|${m.material}`, m.qty])));
    }).catch((e: Error) => setError(e.message));
  }, [pid]);

  async function saveProjection(month: string, val: number) {
    await api('/quantity/projection', { method: 'POST', body: JSON.stringify({ projectId: pid, month, projectedAmount: val }) });
    setProj((p) => ({ ...p, [month]: val }));
  }
  async function saveMaterial(month: string, material: string, unit: string, val: number) {
    await api('/quantity/material', { method: 'POST', body: JSON.stringify({ projectId: pid, month, material, unit, qty: val }) });
    setMats((m) => ({ ...m, [`${month}|${material}`]: val }));
  }

  if (error) return <><SheetBar sheet="QTY-PJ" title="Quantity — projection" /><div className="err">{error}</div></>;
  if (loading) return <><SheetBar sheet="QTY-PJ" title="Quantity — projection" /><Loader label="Loading projection" /></>;

  return (
    <>
      <SheetBar sheet="QTY-PJ" title="Monthly Projection of Accomplishment & Material Requirements" note="On-platform replacement for the GDrive sheet — feeds ManCom forecast + Procurement" />
      <div className="spread mb">
        <Link to="/quantity" className="btn sm">← Weekly entry</Link>
        <select className="tin" value={pid} onChange={(e) => setPid(e.target.value)}>
          {projects.map((p) => <option key={p.projectId} value={p.projectId}>{p.code} — {p.name}</option>)}
        </select>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="ph"><b>Projection grid</b><span className="src">SRC · engineering.material-reqs · type to save</span></div>
        <table className="tbl pgrid">
          <thead>
            <tr>
              <th style={{ minWidth: 200 }}>Particular</th><th>Unit</th>
              {months.map((m) => <th key={m} style={{ textAlign: 'right' }}>{label(m)}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="prow">
              <td><b>PROJECTED MONTHLY ACCOMP.</b></td><td>₱</td>
              {months.map((m) => (
                <td key={m}>
                  <input className="gcell" type="number" defaultValue={proj[m] ?? ''} placeholder="0"
                    onBlur={(e) => { const v = Number(e.target.value || 0); if (v !== (proj[m] ?? 0)) void saveProjection(m, v); }} />
                </td>
              ))}
            </tr>
            {MATERIALS_CATALOG.map((mat) => (
              <tr key={mat.name}>
                <td>{mat.name}</td><td className="muted">{mat.unit}</td>
                {months.map((m) => {
                  const k = `${m}|${mat.name}`;
                  return (
                    <td key={m}>
                      <input className="gcell" type="number" defaultValue={mats[k] ?? ''} placeholder="·"
                        onBlur={(e) => { const v = Number(e.target.value || 0); if (v !== (mats[k] ?? 0)) void saveMaterial(m, mat.name, mat.unit, v); }} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
