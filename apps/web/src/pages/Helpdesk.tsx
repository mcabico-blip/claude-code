import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Stamp } from '../ui';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (token: string) => void; 'expired-callback'?: () => void },
      ) => string;
    };
  }
}

/** Public IT helpdesk — no sign-in; Cloudflare Turnstile stands at the gate. */
export default function Helpdesk() {
  const [form, setForm] = useState({ name: '', email: '', location: '', category: 'Hardware', title: '', body: '' });
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string } | null>(null);
  const slot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SITE_KEY || !slot.current) return;
    const exists = document.getElementById('cf-turnstile-js');
    if (!exists) {
      const s = document.createElement('script');
      s.id = 'cf-turnstile-js';
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      document.head.appendChild(s);
    }
    const timer = setInterval(() => {
      if (window.turnstile && slot.current && !slot.current.hasChildNodes()) {
        window.turnstile.render(slot.current, {
          sitekey: SITE_KEY,
          callback: setToken,
          'expired-callback': () => setToken(null),
        });
        clearInterval(timer);
      }
    }, 250);
    return () => clearInterval(timer);
  }, []);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (SITE_KEY && !token) {
      setError('please complete the captcha first');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/public/helpdesk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email || undefined,
          location: form.location,
          category: form.category,
          title: form.title,
          body: form.body,
          turnstileToken: token ?? undefined,
        }),
      });
      const data = (await res.json()) as { id?: string; message?: string | string[] };
      if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : (data.message ?? 'failed'));
      setDone({ id: data.id! });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submit failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="loginwrap">
      <div className="login" style={{ width: 470 }}>
        <div className="fieldcopy">PUBLIC FORM<br />NO SIGN-IN</div>
        <div className="sheet">
          <div className="brand">
            <div className="slogo">U</div>
            <div>
              <h1>IT Helpdesk</h1>
              <div className="sub">Report an issue · Ulticon Builders · Omega Asia</div>
            </div>
          </div>

          {done ? (
            <div className="bigstamp">
              <Stamp kind="ok">Ticket logged</Stamp>
              <div>
                Reference: <code>TKT-{done.id.slice(0, 8).toUpperCase()}</code>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  IT receives this in the shared queue — keep the reference for follow-ups.
                </div>
              </div>
              <button className="btn" onClick={() => { setDone(null); setForm({ name: '', email: '', location: '', category: 'Hardware', title: '', body: '' }); }}>
                File another
              </button>
            </div>
          ) : (
            <>
              {error && <div className="err">{error}</div>}
              <form onSubmit={submit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                  <label className="field"><span>Your name</span>
                    <input value={form.name} onChange={set('name')} required minLength={2} autoFocus />
                  </label>
                  <label className="field"><span>Email (optional)</span>
                    <input type="email" value={form.email} onChange={set('email')} />
                  </label>
                  <label className="field"><span>Site / location</span>
                    <input value={form.location} onChange={set('location')} placeholder="e.g. HQ 2F · PKG-05 site office" required minLength={2} />
                  </label>
                  <label className="field"><span>Category</span>
                    <select value={form.category} onChange={set('category')}>
                      {['Hardware', 'Software', 'Network', 'Account / access', 'Other'].map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </label>
                </div>
                <label className="field"><span>What's wrong? (short)</span>
                  <input value={form.title} onChange={set('title')} required minLength={4} />
                </label>
                <label className="field"><span>Details</span>
                  <input value={form.body} onChange={set('body')} placeholder="what happened · since when · error shown" required minLength={4} />
                </label>
                <div className="captcha">
                  {SITE_KEY ? <div ref={slot} /> : <span className="devnote">captcha off — set VITE_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY</span>}
                </div>
                <button className="btn pri" style={{ width: '100%' }} disabled={busy}>
                  {busy ? 'Filing…' : 'File ticket'}
                </button>
              </form>
            </>
          )}

          <div className="titleblock" style={{ marginTop: 22 }}>
            <div>Sheet<b>HD-01</b></div>
            <div>Queue<b>IT · SHARED</b></div>
            <div>Gate<b>{SITE_KEY ? 'TURNSTILE' : 'DEV'}</b></div>
            <div>Rev<b>A</b></div>
          </div>
        </div>
        <div className="hint">
          Staff with accounts: <Link to="/login">sign in</Link> to track tickets, approvals and documents.
        </div>
      </div>
    </div>
  );
}
