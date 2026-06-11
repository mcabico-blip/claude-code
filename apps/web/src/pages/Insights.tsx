import { useEffect, useState } from 'react';
import type { Insight } from '@ubi/types';
import { api } from '../api';

export default function Insights() {
  const [items, setItems] = useState<Insight[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    api<Insight[]>('/ceo/insights').then(setItems).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div className="err">{error}</div>;
  if (!items) return <div className="muted">Loading insights…</div>;
  const shown = items.filter((i) => filter === 'all' || i.severity === filter);
  const counts = (sev: string) => items.filter((i) => i.severity === sev).length;

  return (
    <>
      <div className="top">
        <h1>AI Insights</h1>
        <div className="right">
          <span className="asof"><i /> generated off-box · posted via /api/ai/insights</span>
        </div>
      </div>
      <div className="spread mb">
        {(['all', 'critical', 'warning', 'positive'] as const).map((f) => (
          <button key={f} className={`btn sm${filter === f ? ' navy' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? `All (${items.length})` : `${f} (${counts(f)})`}
          </button>
        ))}
      </div>
      {shown.map((ins) => (
        <div key={ins.id} className={`ins ${ins.severity} mb`} style={{ borderLeftWidth: 5 }}>
          <div className="spread">
            <span className={`st ${ins.severity === 'critical' ? 'st-bad' : ins.severity === 'warning' ? 'st-warn' : 'st-ok'}`}>
              {ins.severity.toUpperCase()}
            </span>
            <b style={{ fontSize: 14 }}>{ins.title}</b>
          </div>
          <p style={{ maxWidth: 700, fontSize: 13 }}>{ins.body}</p>
          <div className="evi" style={{ marginBottom: 8 }}>
            {ins.evidence.map((e) => <i key={e}>{e}</i>)}
          </div>
          <div className="spread">
            {ins.actions.map((a) => (
              <button key={a} className="btn sm" title="routes into existing workflows — wired in refine pass">
                {a.replace(/-/g, ' ')}
              </button>
            ))}
          </div>
          <div className="gen">
            generated {new Date(ins.generatedAt).toLocaleString()} by {ins.generatedBy}
          </div>
        </div>
      ))}
    </>
  );
}
