import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { QuantityRollup } from '@ubi/types';
import { api } from '../api';
import { Chainage, Loader, SheetBar } from '../ui';

const peso = (n: number) => '₱' + (n / 1e6).toFixed(2) + 'M';
function weekEnding(): string {
  const d = new Date();
  const diff = 6 - d.getDay();
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Dead-simple weekly accomplishment entry for Quantity Engineers onsite.
 *  One number per project per week → auto-rolls into the monthly report. */
export default function QuantityEntry() {
  const [rows, setRows] = useState<QuantityRollup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<QuantityRollup | null>(null);
  const [weekOf, setWeekOf] = useState(weekEnding());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  const refresh = () => api<QuantityRollup[]>('/quantity/rollup').then((r) => setRows(r.filter((x) => x.inhouseAmount > 0))).catch((e: Error) => setError(e.message));
  useEffect(() => { void refresh(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!sel || !amount) return;
    await api('/quantity/entry', { method: 'POST', body: JSON.stringify({ projectId: sel.projectId, weekOf, amount: Number(amount), note: note || undefined }) });
    setAmount(''); setNote(''); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    await refresh();
    setSel((s) => (s ? (rows?.find((r) => r.projectId === s.projectId) ?? s) : s));
  }

  if (error) return <><SheetBar sheet="QTY-WK" title="Quantity — weekly entry" /><div className="err">{error}</div></>;
  if (!rows) return <><SheetBar sheet="QTY-WK" title="Quantity — weekly entry" /><Loader label="Loading your projects" /></>;

  return (
    <>
      <SheetBar sheet="QTY-WK" title="Quantity — weekly accomplishment entry" note="One number per project per week · auto-rolls into the monthly cost-accomplishment report" />
      <div className="spread mb">
        <Link to="/quantity/projection" className="btn sm">Monthly projection & materials →</Link>
        <Link to="/quantity/head" className="btn sm">Quantity head dashboard →</Link>
      </div>

      <div className="deptgrid">
        <div className="card">
          <div className="ph"><b>Your projects — accomplishment to date</b><span className="src">SRC · engineering.quantity</span></div>
          <table className="tbl">
            <thead><tr><th>Project</th><th>PE</th><th>In-house</th><th>Progress</th><th>This month</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.projectId} onClick={() => setSel(r)} style={{ cursor: 'pointer', background: sel?.projectId === r.projectId ? 'rgba(194,65,12,0.06)' : undefined }}>
                  <td><b>{r.code}</b><div className="muted" style={{ fontSize: 10 }}>{r.name}</div></td>
                  <td>{r.pe}</td>
                  <td>{peso(r.inhouseAmount)}</td>
                  <td><Chainage pct={r.pct * 100} tone={r.pct < 0.85 ? 'orange' : 'teal'} /></td>
                  <td>{peso(r.thisMonth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="ph"><b>Log this week</b>{sel && <span className="src">{sel.code}</span>}</div>
          {!sel ? (
            <div className="muted">Pick a project on the left, then enter what you accomplished this week.</div>
          ) : (
            <form onSubmit={submit}>
              {saved && <div className="hint" style={{ marginTop: 0, marginBottom: 12 }}>✓ Logged — running to-date updated.</div>}
              <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                {sel.name} · to-date <b>{(sel.pct * 100).toFixed(1)}%</b> ({peso(sel.toDate)} of {peso(sel.inhouseAmount)})
              </div>
              <label className="field"><span>Week ending</span>
                <input type="date" value={weekOf} onChange={(e) => setWeekOf(e.target.value)} required />
              </label>
              <label className="field"><span>Accomplishment this week (₱, in-house basis)</span>
                <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 2500000" required />
              </label>
              <label className="field"><span>Note (optional)</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. PCCP pours STA 4+200–4+600" />
              </label>
              <button className="btn pri" style={{ width: '100%' }}>Log accomplishment</button>
              {amount && Number(amount) > 0 && (
                <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
                  → projected to-date {(((sel.toDate + Number(amount)) / sel.inhouseAmount) * 100).toFixed(1)}%
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </>
  );
}
