import { FormEvent, useState } from 'react';
import type { AskAnswer } from '@ubi/types';
import { api, getUser } from '../api';

interface Turn {
  who: 'me' | 'ai';
  text: string;
  sources?: string[];
}

export default function Ask() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const user = getUser();

  async function send(question: string) {
    if (!question.trim() || busy) return;
    setTurns((t) => [...t, { who: 'me', text: question }]);
    setQ('');
    setBusy(true);
    try {
      const res = await api<AskAnswer>('/ai/ask', { method: 'POST', body: JSON.stringify({ question }) });
      setTurns((t) => [...t, { who: 'ai', text: res.answer, sources: res.sources }]);
    } catch (err) {
      setTurns((t) => [...t, { who: 'ai', text: `error: ${err instanceof Error ? err.message : 'failed'}` }]);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void send(q);
  }

  return (
    <>
      <div className="top">
        <h1>Ask AI</h1>
        <div className="right">
          <span className="st st-info">scope: {user?.claims.join(' · ')} · clinic aggregate-only</span>
        </div>
      </div>
      <div className="chat mb">
        {turns.length === 0 && (
          <div className="muted">
            Ask across the whole suite — answers cite the read-models they came from (Pillar 3).
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`bub ${t.who}`}>
            {t.text}
            {t.sources && (
              <div className="evi" style={{ marginTop: 8 }}>
                {t.sources.map((s) => <i key={s}>{s}</i>)}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="bub ai muted">thinking…</div>}
      </div>
      <div className="spread mb">
        {["What's happening?", 'Why is Package 5 slipping?', 'Which billings are at risk this month?'].map((s) => (
          <button key={s} className="btn sm" onClick={() => void send(s)}>{s}</button>
        ))}
      </div>
      <form className="askrow" onSubmit={submit}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask about any project or department…"
        />
        <button className="btn pri" disabled={busy}>➤</button>
      </form>
    </>
  );
}
