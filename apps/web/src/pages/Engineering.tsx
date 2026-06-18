import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MaterialsSchedule, PayItem, Project } from '@ubi/types';
import { api, getUser, hasClaim } from '../api';
import { SheetBar } from '../ui';

export default function Engineering() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [payItems, setPayItems] = useState<PayItem[]>([]);
  const [schedules, setSchedules] = useState<MaterialsSchedule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const user = getUser();
  const canPrepare = hasClaim(user, 'role:pe') || hasClaim(user, 'role:pm');

  const refresh = () =>
    Promise.all([
      api<Project[]>('/engineering/projects').then(setProjects),
      api<PayItem[]>('/engineering/pay-items').then(setPayItems),
      api<MaterialsSchedule[]>('/engineering/materials-schedules').then(setSchedules),
    ]).catch((e: Error) => setError(e.message));

  useEffect(() => { void refresh(); }, []);

  /** CEO-priority flow: AI prefills, PE adjusts, submit → PM → VPO. */
  async function draftThisWeek(projectId: string) {
    setBusy(true);
    try {
      const lines = await api<MaterialsSchedule['lines']>(`/engineering/materials-schedules/prefill/${projectId}`);
      const weekOf = new Date().toISOString().slice(0, 10);
      const created = await api<MaterialsSchedule>('/engineering/materials-schedules', {
        method: 'POST',
        body: JSON.stringify({ projectId, weekOf, lines }),
      });
      await api(`/engineering/materials-schedules/${created.id}/submit`, { method: 'POST', body: JSON.stringify({}) });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SheetBar sheet="ENG-06" title="Engineering — projects · pay items · schedules" note="AI pre-fills the weekly schedule; PE adjusts → PM → VPO → Procurement" />
      <div className="spread mb">
        <Link to="/quantity" className="btn sm pri">Quantity — weekly entry →</Link>
        <Link to="/quantity/head" className="btn sm">Quantity head dashboard →</Link>
        <Link to="/quantity/projection" className="btn sm">Projection & materials →</Link>
        <Link to="/equipment" className="btn sm">Equipment schedule → Omega</Link>
        <Link to="/procurement" className="btn sm">Procurement intake →</Link>
      </div>
      {error && <div className="err">{error}</div>}

      <div className="grid2">
        <div className="card">
          <div className="ph"><b>Projects (DPWH packages)</b></div>
          <table className="tbl">
            <thead><tr><th>Code</th><th>Name</th><th>Contract</th><th>Slip</th>{canPrepare && <th />}</tr></thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.code}</b></td>
                  <td>{p.name}</td>
                  <td><code>{p.contractNo}</code></td>
                  <td className={p.slippagePct < 0 ? 'neg' : 'pos'}>{p.slippagePct}%</td>
                  {canPrepare && (
                    <td>
                      <button className="btn sm pri" disabled={busy} onClick={() => void draftThisWeek(p.id)}>
                        AI-draft schedule
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="ph"><b>Pay-item library (DPWH Blue Book)</b></div>
          <table className="tbl">
            <thead><tr><th>Item</th><th>Description</th><th>Unit</th></tr></thead>
            <tbody>
              {payItems.map((i) => (
                <tr key={i.id}><td><code>{i.itemNo}</code></td><td>{i.description}</td><td>{i.unit}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="ph"><b>Weekly materials schedules</b><span className="src">PE → PM → VPO → Procurement</span></div>
        {schedules.length === 0 && <div className="muted">None yet — draft one from a project row (AI prefills the lines).</div>}
        <table className="tbl">
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id}>
                <td>wk of <b>{s.weekOf}</b> · {s.lines.length} lines ({s.lines.filter((l) => l.aiSuggested).length} AI-suggested)</td>
                <td>{s.preparedBy}</td>
                <td style={{ textAlign: 'right' }}>
                  <span className={`st ${s.status === 'vpo-approved' ? 'st-ok' : s.status === 'returned' ? 'st-bad' : 'st-warn'}`}>{s.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
