import { FormEvent, useEffect, useRef, useState } from 'react';
import type { AskAnswer } from '@ubi/types';
import { api, getUser } from '../api';
import { SheetBar, Type } from '../ui';

interface Turn {
  who: 'me' | 'ai';
  text: string;
  sources?: string[];
  /** Typewriter finished — sources/meta appear only after the ink dries. */
  typed: boolean;
}

export default function Ask() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const user = getUser();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, busy]);

  function markTyped(index: number) {
    setTurns((t) => t.map((turn, i) => (i === index ? { ...turn, typed: true } : turn)));
  }

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
      <SheetBar sheet="ASK-03" title="Ask AI — conversational query" note={`Scope: ${user?.claims.join(' · ')} · clinic aggregate-only`} />
      <div className="chat mb">
        {turns.length === 0 && (
          <div className="muted">
            Ask across the whole suite — answers cite the read-models they came from (Pillar 3).
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`bub ${t.who}`}>
            {t.who === 'ai' && !t.typed ? <Type text={t.text} onDone={() => markTyped(i)} /> : t.text}
            {t.typed && t.sources && (
              <div className="evi" style={{ marginTop: 8 }}>
                {t.sources.map((s) => <i key={s}>{s}</i>)}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="bub ai thinking">
            Consulting read-models<span className="dots"><i>.</i><i>.</i><i>.</i></span>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="spread mb">
        {["What's happening?", 'Why is Package 5 slipping?', 'Which billings are at risk this month?'].map((s) => (
          <button key={s} className="btn sm" disabled={busy} onClick={() => void send(s)}>{s}</button>
        ))}
      </div>
      <form className="askrow" onSubmit={submit}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask about any project or department…"
          disabled={busy}
        />
        <button className="btn pri" disabled={busy}>➤</button>
      </form>
    </>
  );
}
