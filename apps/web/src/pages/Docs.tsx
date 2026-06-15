import { FormEvent, useEffect, useState } from 'react';
import type { TrackedDocument, WhereIsAnswer } from '@ubi/types';
import { api } from '../api';
import { SheetBar } from '../ui';

export default function Docs() {
  const [docs, setDocs] = useState<TrackedDocument[]>([]);
  const [code, setCode] = useState('');
  const [answer, setAnswer] = useState<WhereIsAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [to, setTo] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [nw, setNw] = useState({ type: 'Transmittal', title: '', location: '' });

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

  async function createDoc(e: FormEvent) {
    e.preventDefault();
    if (!nw.title.trim()) return;
    try {
      const doc = await api<TrackedDocument>('/docs', { method: 'POST', body: JSON.stringify(nw) });
      setShowNew(false);
      setNw({ type: 'Transmittal', title: '', location: '' });
      await refresh();
      setCode(doc.code);
      await lookup(doc.code); // open it so you can transmit immediately
    } catch (err) {
      setError(err instanceof Error ? err.message : 'create failed');
    }
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
      <SheetBar sheet="DOC-04" title="Document Tracking — transmittal registry" note="Pillar 2 backbone · register → scan to transmit → scan to receive" />

      <div className="spread mb">
        <form className="askrow" style={{ flex: 1 }} onSubmit={submit}>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Where is… (scan or type a code, e.g. DOC-2026-00001)" />
          <button className="btn pri">Find</button>
        </form>
        <button className="btn navy" onClick={() => setShowNew((s) => !s)}>{showNew ? 'Cancel' : '+ New transmittal'}</button>
      </div>

      {showNew && (
        <form className="card mb" onSubmit={createDoc}>
          <div className="ph"><b>Register a new document / transmittal</b><span className="src">gets a QR code + tracking id</span></div>
          <div className="spread">
            <label className="muted" style={{ fontSize: 11 }}>Type
              <select className="tin" value={nw.type} onChange={(e) => setNw({ ...nw, type: e.target.value })}>
                {['Transmittal', 'Payment request', 'Billing attachment', 'Purchase request', 'Correspondence', 'Controlled document'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <input className="tin" style={{ flex: 1, minWidth: 240 }} value={nw.title} onChange={(e) => setNw({ ...nw, title: e.target.value })} placeholder="Title, e.g. Billing No. 8 — attachments batch (PKG-02)" required />
            <input className="tin" value={nw.location} onChange={(e) => setNw({ ...nw, location: e.target.value })} placeholder="Origin location (optional)" />
            <button className="btn pri sm">Register</button>
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>You become the current holder; then transmit it to the next department below.</div>
        </form>
      )}

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
            <input className="tin" value={to} onChange={(e) => setTo(e.target.value)} placeholder="transmit to… (e.g. Finance — Cashier)" />
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
