import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { UserClaims } from '@ubi/types';
import { api, homeFor, setSession } from '../api';

const EXEC = [
  ['ceo@ubi.ph', 'ceo123', 'CEO'],
  ['vpo@ubi.ph', 'vpo123', 'VPO'],
  ['admin@ubi.ph', 'admin123', 'Admin'],
  ['pm@ubi.ph', 'pm123', 'PM'],
  ['pe@ubi.ph', 'pe123', 'PE (field)'],
] as const;

const DEPT_HEADS = [
  'engineering', 'procurement', 'operations', 'survey', 'mqc', 'audit',
  'it', 'records', 'clinic', 'admin', 'hr', 'property', 'finance',
];

// Demo autofill chips advertise working credentials — never show them on a
// production login page. Dev shows them; prod only if explicitly opted in.
const SHOW_DEMOS = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_LOGINS === 'true';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  function fill(em: string, pw: string) {
    setEmail(em);
    setPassword(pw);
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string; user: UserClaims }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setSession(res.token, res.user);
      navigate(homeFor(res.user.claims));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="loginwrap">
      <div className="login">
        <div className="fieldcopy">FIELD COPY<br />REV A</div>
        <div className="sheet">
          <div className="brand">
            <div className="slogo">U</div>
            <div>
              <h1>UBI Construction Suite</h1>
              <div className="sub">Ulticon Builders · Omega Asia</div>
            </div>
          </div>
          {error && <div className="err">{error}</div>}
          <form onSubmit={submit}>
            <label className="field">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
            </label>
            <label className="field">
              <span>Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <button className="btn navy" style={{ width: '100%' }} disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <button type="button" className="btn" style={{ width: '100%', marginTop: 10 }} title="Optional Workspace sign-in lands in pillar-auth follow-up" disabled>
              Continue with Google — soon
            </button>
          </form>
          <div className="titleblock">
            <div>Sheet<b>LOGIN-01</b></div>
            <div>Drawn by<b>UBI / IT</b></div>
            <div>Scale<b>NTS</b></div>
            <div>Rev<b>A</b></div>
          </div>
        </div>
        {SHOW_DEMOS && (
        <div className="demos">
          <div className="demos-h">Tap to autofill a demo login</div>
          <div className="demos-row">
            {EXEC.map(([em, pw, label]) => (
              <button key={em} type="button" className="demo-chip" onClick={() => fill(em, pw)}>{label}</button>
            ))}
          </div>
          <div className="demos-row">
            <select
              className="demo-select"
              defaultValue=""
              onChange={(e) => { if (e.target.value) fill(`head-${e.target.value}@ubi.ph`, 'head123'); }}
            >
              <option value="" disabled>Department head…</option>
              {DEPT_HEADS.map((d) => <option key={d} value={d}>{d} head</option>)}
            </select>
          </div>
        </div>
        )}

        <div className="hint">
          <b>Offline-ready:</b> after the first online sign-in this device keeps a secure session for field use.
          <div style={{ marginTop: 7 }}>
            IT problem, no account? <Link to="/helpdesk">File a helpdesk ticket — no sign-in needed →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
