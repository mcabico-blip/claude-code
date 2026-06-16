import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AskAnswer } from '@ubi/types';
import { api } from './api';
import { Type } from './ui';

interface Turn { who: 'me' | 'ai'; text: string; sources?: string[]; typed: boolean }

/** Persistent icon-only AI assistant, docked bottom-right on every page. */
export default function AssistantFab() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) endRef.current?.scrollIntoView({ block: 'end' }); }, [turns, busy, open]);

  async function send(question: string) {
    if (!question.trim() || busy) return;
    setTurns((t) => [...t, { who: 'me', text: question, typed: true }]);
    setQ('');
    setBusy(true);
    try {
      const res = await api<AskAnswer>('/ai/ask', { method: 'POST', body: JSON.stringify({ question }) });
      setTurns((t) => [...t, { who: 'ai', text: res.answer, sources: res.sources, typed: false }]);
    } catch (err) {
      setTurns((t) => [...t, { who: 'ai', text: `error: ${err instanceof Error ? err.message : 'failed'}`, typed: false }]);
    } finally { setBusy(false); }
  }
  function submit(e: FormEvent) { e.preventDefault(); void send(q); }
  const markTyped = (i: number) => setTurns((t) => t.map((x, j) => (j === i ? { ...x, typed: true } : x)));

  return (
    <>
      {open && (
        <div className="assistant-panel">
          <div className="ap-head">
            <span className="ap-dot" /> Ask AI
            <Link to="/ask" className="ap-expand" title="Open full page" onClick={() => setOpen(false)}>⤢</Link>
            <button className="ap-x" onClick={() => setOpen(false)} aria-label="close">✕</button>
          </div>
          <div className="ap-body">
            {turns.length === 0 && (
              <div className="ap-empty">
                Ask across the suite — answers cite their read-models.
                <div className="ap-sugg">
                  {["What's happening?", 'Approvals older than 3 days', 'Which billings are at risk?'].map((s) => (
                    <button key={s} onClick={() => void send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className={`bub ${t.who}`}>
                {t.who === 'ai' && !t.typed ? <Type text={t.text} speed={10} onDone={() => markTyped(i)} /> : t.text}
                {t.typed && t.sources && (
                  <div className="evi" style={{ marginTop: 6 }}>{t.sources.slice(0, 4).map((s) => <i key={s}>{s}</i>)}</div>
                )}
              </div>
            ))}
            {busy && <div className="bub ai thinking">Consulting read-models<span className="dots"><i>.</i><i>.</i><i>.</i></span></div>}
            <div ref={endRef} />
          </div>
          <form className="ap-input" onSubmit={submit}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything…" disabled={busy} autoFocus />
            <button className="btn pri sm" disabled={busy}>➤</button>
          </form>
        </div>
      )}
      <button className={`fab${open ? ' on' : ''}`} onClick={() => setOpen((o) => !o)} aria-label="Ask AI" title="Ask AI">
        {open ? (
          <span style={{ fontSize: 20, lineHeight: 1 }}>✕</span>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9 9 0 0 1-4-1L3 20l1-3.5a8.38 8.38 0 0 1-1-4A8.5 8.5 0 0 1 11.5 4 8.38 8.38 0 0 1 21 11.5z" />
            <circle cx="8.5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="15.5" cy="12" r="1" fill="currentColor" />
          </svg>
        )}
      </button>
    </>
  );
}
