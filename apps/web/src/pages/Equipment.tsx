import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project } from '@ubi/types';
import { api } from '../api';
import { Loader, SheetBar, Stamp } from '../ui';

interface Line { activity: string; equipment: string; qty: number; unit: string; fromDate: string; toDate: string }
interface Schedule { id: string; projectId: string; weekOf: string; lines: Line[]; status: 'draft' | 'submitted' | 'pushed'; omegaRef: string | null; pushedAt: string | null }

const EQUIP = ['Transit mixer', 'Vibratory roller', 'Dump truck', 'Backhoe loader', 'Motor grader', 'Crane', 'Concrete vibrator', 'Generator'];
const blank = (): Line => ({ activity: '', equipment: EQUIP[0], qty: 1, unit: 'units', fromDate: '', toDate: '' });

/** Weekly machinery/activity schedule → pushed to Omega (OAEC) via API. */
export default function Equipment() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pid, setPid] = useState('');
  const [weekOf, setWeekOf] = useState('');
  const [lines, setLines] = useState<Line[]>([blank()]);

  const refresh = () => api<Schedule[]>('/equipment/schedules').then(setSchedules).catch((e: Error) => setError(e.message));
  useEffect(() => {
    api<Project[]>('/engineering/projects').then((p) => { setProjects(p); if (p[0]) setPid(p[0].id); }).catch(() => {});
    void refresh();
  }, []);

  function setLine(i: number, patch: Partial<Line>) { setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l))); }

  async function create() {
    const clean = lines.filter((l) => l.activity && l.equipment);
    if (!pid || !weekOf || !clean.length) return;
    const created = await api<Schedule>('/equipment/schedules', { method: 'POST', body: JSON.stringify({ projectId: pid, weekOf, lines: clean }) });
    await api(`/equipment/schedules/${created.id}/submit`, { method: 'POST', body: JSON.stringify({}) });
    setLines([blank()]); setWeekOf('');
    await refresh();
  }

  async function push(id: string) {
    await api(`/equipment/schedules/${id}/push`, { method: 'POST', body: JSON.stringify({}) });
    await refresh();
  }

  const code = (id: string) => projects.find((p) => p.id === id)?.code ?? id.slice(0, 6);
  if (error) return <><SheetBar sheet="EQ-SCH" title="Equipment schedule" /><div className="err">{error}</div></>;
  if (!schedules) return <><SheetBar sheet="EQ-SCH" title="Equipment schedule" /><Loader label="Loading equipment schedules" /></>;

  return (
    <>
      <SheetBar sheet="EQ-SCH" title="Equipment / Machinery Schedule → Omega" note="Activities needing machinery, by week · submitted to Omega (OAEC) via API" />
      <div className="spread mb"><Link to="/quantity" className="btn sm">Quantity weekly entry →</Link></div>

      <div className="card mb">
        <div className="ph"><b>New weekly equipment schedule</b><span className="src">→ OAEC (Omega fleet)</span></div>
        <div className="spread mb">
          <select className="tin" value={pid} onChange={(e) => setPid(e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
          <label className="muted" style={{ fontSize: 11 }}>Week ending <input className="tin" type="date" value={weekOf} onChange={(e) => setWeekOf(e.target.value)} /></label>
        </div>
        <table className="tbl">
          <thead><tr><th>Activity (requires machinery)</th><th>Equipment</th><th>Qty</th><th>Unit</th><th>From</th><th>To</th><th /></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td><input className="tin" style={{ minWidth: 220 }} value={l.activity} onChange={(e) => setLine(i, { activity: e.target.value })} placeholder="e.g. PCCP pouring STA 4+200" /></td>
                <td><select className="tin" value={l.equipment} onChange={(e) => setLine(i, { equipment: e.target.value })}>{EQUIP.map((x) => <option key={x}>{x}</option>)}</select></td>
                <td><input className="tin" style={{ width: 60 }} type="number" value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} /></td>
                <td><input className="tin" style={{ width: 70 }} value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} /></td>
                <td><input className="tin" style={{ width: 130 }} type="date" value={l.fromDate} onChange={(e) => setLine(i, { fromDate: e.target.value })} /></td>
                <td><input className="tin" style={{ width: 130 }} type="date" value={l.toDate} onChange={(e) => setLine(i, { toDate: e.target.value })} /></td>
                <td>{lines.length > 1 && <button className="btn sm" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>×</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="spread" style={{ marginTop: 10 }}>
          <button className="btn sm" onClick={() => setLines((ls) => [...ls, blank()])}>+ add activity</button>
          <button className="btn pri sm" onClick={() => void create()}>Submit schedule</button>
        </div>
      </div>

      <div className="card">
        <div className="ph"><b>Schedules</b><span className="src">SRC · engineering.equipment-schedule</span></div>
        {schedules.length === 0 ? <div className="muted">None yet.</div> : schedules.map((s) => (
          <div key={s.id} className="mb" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
            <div className="spread">
              <b>{code(s.projectId)} · wk {s.weekOf}</b>
              <span className="muted">{s.lines.length} activities</span>
              {s.status === 'pushed' ? <Stamp kind="ok">pushed to omega</Stamp> : s.status === 'submitted' ? <Stamp kind="warn">submitted</Stamp> : <span className="st st-info">draft</span>}
              {s.omegaRef && <span className="st st-ok">OAEC ref {s.omegaRef}</span>}
              <span className="right">{s.status !== 'pushed' && <button className="btn pri sm" onClick={() => void push(s.id)}>Push to Omega →</button>}</span>
            </div>
            <table className="tbl" style={{ marginTop: 6 }}>
              <tbody>
                {s.lines.map((l, i) => (
                  <tr key={i}><td>{l.activity}</td><td><b>{l.equipment}</b> ×{l.qty} {l.unit}</td><td className="muted">{l.fromDate} → {l.toDate}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </>
  );
}
