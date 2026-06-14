import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { UserClaims } from '@ubi/types';
import { api, homeFor, setSession } from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

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
        <div className="hint">
          <b>Offline-ready:</b> after the first online sign-in this device keeps a secure session for field
          use. Demo: <code>ceo@ubi.ph/ceo123</code> · <code>vpo@ubi.ph/vpo123</code> ·{' '}
          <code>pm@ubi.ph/pm123</code> · <code>pe@ubi.ph/pe123</code>
          <div style={{ marginTop: 7 }}>
            IT problem, no account? <Link to="/helpdesk">File a helpdesk ticket — no sign-in needed →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
