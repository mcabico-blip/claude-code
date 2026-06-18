import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { Loader, SheetBar } from '../ui';

interface Expiry { title: string; kind: string; expiresOn: string; daysLeft: number }
interface IndexRow { title: string; cabinet: string; drawer: string; sensitive: boolean; access: string }

export default function Records() {
  const [expiry, setExpiry] = useState<Expiry[] | null>(null);
  const [index, setIndex] = useState<IndexRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vd, setVd] = useState({ plate: '', kind: 'registration', refNo: '', expiresOn: '' });

  const refresh = () =>
    Promise.all([
      api<Expiry[]>('/records/expiry').then(setExpiry),
      api<IndexRow[]>('/records/physical-index').then(setIndex),
    ]).catch((e: Error) => setError(e.message));
  useEffect(() => { void refresh(); }, []);

  async function addVehicle(e: FormEvent) {
    e.preventDefault();
    await api('/records/vehicle-docs', { method: 'POST', body: JSON.stringify(vd) });
    setVd({ plate: '', kind: 'registration', refNo: '', expiresOn: '' });
    await refresh();
  }

  if (error) return <><SheetBar sheet="REC-T" title="Records" /><div className="err">{error}</div></>;
  if (!expiry || !index) return <><SheetBar sheet="REC-T" title="Records" /><Loader label="Loading records" /></>;

  return (
    <>
      <SheetBar sheet="REC-T" title="Records — registry, expiry & physical index" note="Vehicle docs feed the expiry engine · physical index is access-gated" />

      <div className="grid2">
        <div className="card">
          <div className="ph"><b>Expiring ≤60 days</b><span className="src">SRC · records.expiry</span></div>
          <table className="tbl">
            <thead><tr><th>Document</th><th>Kind</th><th>Expires</th><th>Days</th></tr></thead>
            <tbody>
              {expiry.map((r, i) => (
                <tr key={i}>
                  <td>{r.title}</td><td>{r.kind}</td><td>{r.expiresOn}</td>
                  <td><span className={`st ${r.daysLeft <= 10 ? 'st-bad' : r.daysLeft <= 30 ? 'st-warn' : 'st-info'}`}>{r.daysLeft}d</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <form className="spread" style={{ marginTop: 12 }} onSubmit={addVehicle}>
            <input className="tin" style={{ minWidth: 110 }} placeholder="plate" value={vd.plate} onChange={(e) => setVd({ ...vd, plate: e.target.value })} required />
            <select className="tin" value={vd.kind} onChange={(e) => setVd({ ...vd, kind: e.target.value })}>
              <option value="registration">registration</option><option value="insurance">insurance</option><option value="stamp">stamp</option>
            </select>
            <input className="tin" style={{ minWidth: 110 }} placeholder="ref no" value={vd.refNo} onChange={(e) => setVd({ ...vd, refNo: e.target.value })} required />
            <input className="tin" type="date" value={vd.expiresOn} onChange={(e) => setVd({ ...vd, expiresOn: e.target.value })} required />
            <button className="btn pri sm">Add vehicle doc</button>
          </form>
        </div>

        <div className="card">
          <div className="ph"><b>Physical location index</b><span className="src">SRC · records.physical-index · access-gated</span></div>
          <table className="tbl">
            <thead><tr><th>Document</th><th>Cabinet</th><th>Drawer</th><th>Access</th></tr></thead>
            <tbody>
              {index.map((r, i) => (
                <tr key={i}>
                  <td>{r.sensitive && '🔒 '}{r.title}</td><td>{r.cabinet}</td><td>{r.drawer}</td>
                  <td><span className={`st ${r.access === 'visible' ? 'st-ok' : 'st-bad'}`}>{r.access}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>Restricted rows are hidden unless you hold the required claim (e.g. land titles need <code>role:legal</code>).</div>
        </div>
      </div>
    </>
  );
}
