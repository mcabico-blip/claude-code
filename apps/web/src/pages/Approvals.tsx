import { useEffect, useState } from 'react';
import { api } from '../api';
import { SheetBar, Stamp } from '../ui';

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
      <SheetBar sheet="APR-05" title="Approvals — chain inbox" note="Shared engine · PE → PM → VPO · acts on your current step only" />
      {rows.length === 0 && <div className="card muted">Inbox zero — nothing waits on you.</div>}
      {rows.map((a) => (
        <div key={a.id} className="card mb">
          <div className="spread">
            <span className="st st-info">{a.subjectType}</span>
            <b>{a.title}</b>
            <span className="right muted">by {a.createdBy} · {new Date(a.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="spread" style={{ margin: '12px 0' }}>
            {a.chain.map((s, i) =>
              s.status === 'approved' ? (
                <Stamp key={s.step} kind="ok">{`${s.step} ✓`}</Stamp>
              ) : i === a.currentStep ? (
                <Stamp key={s.step} kind="warn">{`${s.step} · you`}</Stamp>
              ) : (
                <span key={s.step} className="st st-info">{s.step}</span>
              ),
            )}
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
