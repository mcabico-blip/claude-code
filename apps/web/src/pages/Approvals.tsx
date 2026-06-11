import { useEffect, useState } from 'react';
import { api } from '../api';

interface ApprovalRow {
  id: string;
  subjectType: string;
  title: string;
  status: string;
  currentStep: number;
  chain: Array<{ step: string; actorClaim: string; status: string; by: string | null }>;
  createdBy: string | null;
  createdAt: string;
}

export default function Approvals() {
  const [rows, setRows] = useState<ApprovalRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => api<ApprovalRow[]>('/approvals').then(setRows).catch((e: Error) => setError(e.message));
  useEffect(() => { void refresh(); }, []);

  async function act(id: string, action: 'approve' | 'return') {
    await api(`/approvals/${id}/act`, { method: 'POST', body: JSON.stringify({ action }) });
    await refresh();
  }

  if (error) return <div className="err">{error}</div>;
  if (!rows) return <div className="muted">Loading approvals…</div>;

  return (
    <>
      <div className="top"><h1>Approvals</h1>
        <div className="right"><span className="src">SHARED ENGINE · PE → PM → VPO</span></div>
      </div>
      {rows.length === 0 && <div className="card muted">Inbox zero — nothing waits on you.</div>}
      {rows.map((a) => (
        <div key={a.id} className="card mb">
          <div className="spread">
            <span className="st st-info">{a.subjectType}</span>
            <b>{a.title}</b>
            <span className="right muted">by {a.createdBy} · {new Date(a.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="spread" style={{ margin: '10px 0' }}>
            {a.chain.map((s, i) => (
              <span key={s.step} className={`st ${s.status === 'approved' ? 'st-ok' : i === a.currentStep ? 'st-warn' : 'st-info'}`}>
                {s.step.toUpperCase()} {s.status === 'approved' ? '✓' : i === a.currentStep ? '· you' : ''}
              </span>
            ))}
          </div>
          <div className="spread">
            <button className="btn ok sm" onClick={() => void act(a.id, 'approve')}>Approve ✓</button>
            <button className="btn sm" onClick={() => void act(a.id, 'return')}>Return</button>
          </div>
        </div>
      ))}
    </>
  );
}
