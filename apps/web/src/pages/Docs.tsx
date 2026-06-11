import { FormEvent, useEffect, useState } from 'react';
import type { TrackedDocument, WhereIsAnswer } from '@ubi/types';
import { api } from '../api';

export default function Docs() {
  const [docs, setDocs] = useState<TrackedDocument[]>([]);
  const [code, setCode] = useState('');
  const [answer, setAnswer] = useState<WhereIsAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [to, setTo] = useState('');

  const refresh = () => api<TrackedDocument[]>('/docs').then(setDocs).catch((e: Error) => setError(e.message));
  useEffect(() => { void refresh(); }, []);

  async function lookup(c: string) {
    setError(null);
    try {
      setAnswer(await api<WhereIsAnswer>(`/docs/where/${encodeURIComponent(c)}`));
    } catch (err) {
      setAnswer(null);
      setError(err instanceof Error ? err.message : 'lookup failed');
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void lookup(code);
  }

  async function transmit() {
    if (!answer || !to.trim()) return;
    await api(`/docs/${answer.document.code}/transmit`, { method: 'POST', body: JSON.stringify({ to }) });
    setTo('');
    await lookup(answer.document.code);
    await refresh();
  }

  async function receive() {
    if (!answer) return;
    await api(`/docs/${answer.document.code}/receive`, { method: 'POST', body: JSON.stringify({}) });
    await lookup(answer.document.code);
    await refresh();
  }

  return (
    <>
      <div className="top"><h1>Document Tracking</h1>
        <div className="right"><span className="src">PILLAR 2 · BACKBONE</span></div>
      </div>

      <form className="askrow mb" onSubmit={submit}>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Where is… (scan or type a code, e.g. DOC-2026-00001)" />
        <button className="btn pri">Find</button>
      </form>
      {error && <div className="err">{error}</div>}

      {answer && (
        <div className="card mb">
          <div className="spread">
            <b>{answer.document.title}</b>
            <code>{answer.document.code}</code>
            <span className={`st ${answer.document.status === 'in-transit' ? 'st-warn' : 'st-ok'}`}>{answer.document.status}</span>
            <span className="right muted">holder: <b>{answer.document.currentHolder}</b> · {answer.document.currentLocation}</span>
          </div>
          <table className="tbl" style={{ marginTop: 10 }}>
            <thead><tr><th>When</th><th>Movement</th><th>By</th><th>Note</th></tr></thead>
            <tbody>
              {answer.history.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.at).toLocaleString()}</td>
                  <td>{m.kind}: <b>{m.from}</b> → <b>{m.to}</b></td>
                  <td>{m.by}</td>
                  <td className="muted">{m.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="spread" style={{ marginTop: 10 }}>
            <input className="btn" style={{ cursor: 'text', fontWeight: 400 }} value={to} onChange={(e) => setTo(e.target.value)} placeholder="transmit to… (e.g. Finance — Cashier)" />
            <button className="btn pri sm" onClick={() => void transmit()}>Scan to transmit ↗</button>
            <button className="btn sm" onClick={() => void receive()}>Scan to receive ↘</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="ph"><b>Recent documents</b><span className="src">SRC · doc-tracking</span></div>
        <table className="tbl">
          <thead><tr><th>Code</th><th>Title</th><th>Holder</th><th>Status</th></tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} onClick={() => { setCode(d.code); void lookup(d.code); }} style={{ cursor: 'pointer' }}>
                <td><code>{d.code}</code></td>
                <td>{d.title}</td>
                <td>{d.currentHolder}</td>
                <td><span className={`st ${d.status === 'in-transit' ? 'st-warn' : 'st-ok'}`}>{d.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
