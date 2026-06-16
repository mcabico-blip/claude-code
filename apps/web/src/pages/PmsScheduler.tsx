import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Loader, SheetBar } from '../ui';

type PmsStatus = 'scheduled' | 'in-progress' | 'done';
interface Pms {
  id: string; assetQr: string; assetType: string; category: string;
  quarter: string; dueOn: string; status: PmsStatus; tech: string | null; completedOn: string | null;
}
interface Cat { category: string; count: number }

const YEAR = new Date().getFullYear();
const QUARTERS = [1, 2, 3, 4];
const Q_MONTHS: Record<number, [number, number, number]> = { 1: [0, 1, 2], 2: [3, 4, 5], 3: [6, 7, 8], 4: [9, 10, 11] };
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COLS: { key: PmsStatus; label: string }[] = [
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'done', label: 'Done' },
];
const stTone = (s: PmsStatus) => (s === 'done' ? 'st-ok' : s === 'in-progress' ? 'st-warn' : 'st-info');

export default function PmsScheduler() {
  const [q, setQ] = useState(Math.floor(new Date().getMonth() / 3) + 1);
  const [view, setView] = useState<'list' | 'kanban' | 'calendar'>('list');
  const [items, setItems] = useState<Pms[] | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const quarter = `${YEAR}-Q${q}`;

  const load = useCallback(() => {
    setItems(null);
    api<Pms[]>(`/it/pms?quarter=${quarter}`).then(setItems).catch((e: Error) => setError(e.message));
  }, [quarter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api<Cat[]>('/it/pms/categories').then(setCats).catch(() => {}); }, []);

  async function generate() {
    setBusy(true);
    try {
      await api('/it/pms/generate', { method: 'POST', body: JSON.stringify({ quarter, categories: [...picked] }) });
      load();
    } catch (e) { setError(e instanceof Error ? e.message : 'failed'); } finally { setBusy(false); }
  }

  async function advance(it: Pms) {
    const next: PmsStatus = it.status === 'scheduled' ? 'in-progress' : it.status === 'in-progress' ? 'done' : 'scheduled';
    const tech = next === 'done' && !it.tech ? prompt('Tech who completed it?') ?? it.tech : it.tech;
    await api(`/it/pms/${it.id}/status`, { method: 'POST', body: JSON.stringify({ status: next, tech: tech ?? undefined }) });
    load();
  }

  async function setTech(it: Pms, tech: string) {
    await api(`/it/pms/${it.id}/status`, { method: 'POST', body: JSON.stringify({ status: it.status, tech }) });
    load();
  }

  const done = useMemo(() => (items ?? []).filter((i) => i.status === 'done').length, [items]);

  return (
    <>
      <SheetBar sheet="IT-PMS" title="IT — Preventive Maintenance Scheduler" note="Pull Property assets by category → quarterly PMS · list · kanban · calendar" />
      <div className="spread mb">
        <Link to="/it" className="btn sm">← IT control room</Link>
        <span className="muted">{quarter}: {items?.length ?? 0} scheduled · {done} done</span>
      </div>

      {/* quarter tabs */}
      <div className="tabs">
        {QUARTERS.map((n) => (
          <button key={n} className={`tab${q === n ? ' on' : ''}`} onClick={() => setQ(n)}>
            Q{n} <span className="tab-sub">{MONTH[Q_MONTHS[n][0]]}–{MONTH[Q_MONTHS[n][2]]}</span>
          </button>
        ))}
      </div>

      {/* generate by category */}
      <div className="card mb">
        <div className="ph"><b>Generate {quarter} from Property assets</b><span className="src">SRC · property.assets → it.pms</span></div>
        <div className="spread">
          {cats.map((c) => {
            const on = picked.has(c.category);
            return (
              <button key={c.category} className={`chip${on ? ' on' : ''}`} onClick={() => {
                const next = new Set(picked);
                on ? next.delete(c.category) : next.add(c.category);
                setPicked(next);
              }}>
                {on ? '✓ ' : ''}{c.category} <span className="muted">({c.count})</span>
              </button>
            );
          })}
          <button className="btn pri sm" disabled={busy} onClick={() => void generate()}>
            {busy ? 'Generating…' : picked.size ? `Generate ${picked.size} categor${picked.size > 1 ? 'ies' : 'y'}` : 'Generate all'}
          </button>
        </div>
      </div>

      {/* view switcher */}
      <div className="spread mb">
        {(['list', 'kanban', 'calendar'] as const).map((v) => (
          <button key={v} className={`btn sm${view === v ? ' navy' : ''}`} onClick={() => setView(v)}>{v}</button>
        ))}
      </div>

      {error && <div className="err">{error}</div>}
      {!items ? <Loader label={`Loading ${quarter} schedule`} /> : items.length === 0 ? (
        <div className="card muted">No PMS for {quarter} yet — pick categories above and Generate.</div>
      ) : view === 'list' ? (
        <div className="card">
          <table className="tbl">
            <thead><tr><th>Asset</th><th>Type</th><th>Category</th><th>Due</th><th>Tech</th><th>Status</th><th>Completed</th><th /></tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td><code>{it.assetQr}</code></td><td>{it.assetType}</td><td>{it.category}</td><td>{it.dueOn}</td>
                  <td><input className="tin" style={{ minWidth: 120, padding: '4px 8px' }} defaultValue={it.tech ?? ''} placeholder="assign…" onBlur={(e) => e.target.value !== (it.tech ?? '') && void setTech(it, e.target.value)} /></td>
                  <td><span className={`st ${stTone(it.status)}`}>{it.status}</span></td>
                  <td>{it.completedOn ?? <span className="muted">—</span>}</td>
                  <td><button className="btn sm" onClick={() => void advance(it)}>advance →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : view === 'kanban' ? (
        <div className="kanban">
          {COLS.map((col) => (
            <div key={col.key} className="kcol">
              <div className="kcol-h">{col.label} <span className="muted">{items.filter((i) => i.status === col.key).length}</span></div>
              {items.filter((i) => i.status === col.key).map((it) => (
                <div key={it.id} className="kcard" onClick={() => void advance(it)} title="click to advance">
                  <div className="kcard-t"><code>{it.assetQr}</code><span className={`st ${stTone(it.status)}`}>{it.category}</span></div>
                  <div className="kcard-b">{it.assetType}</div>
                  <div className="kcard-f"><span className="muted">due {it.dueOn}</span><span>{it.tech ?? 'unassigned'}</span></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid2">
          {Q_MONTHS[q].map((m) => {
            const first = new Date(YEAR, m, 1).getDay();
            const days = new Date(YEAR, m + 1, 0).getDate();
            const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
            const onDay = (d: number) => items.filter((i) => new Date(i.dueOn).getMonth() === m && new Date(i.dueOn).getDate() === d);
            return (
              <div key={m} className="card">
                <div className="ph"><b>{MONTH[m]} {YEAR}</b></div>
                <div className="cal">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="cal-dow">{d}</div>)}
                  {cells.map((d, i) => (
                    <div key={i} className={`cal-cell${d ? '' : ' empty'}`}>
                      {d && <span className="cal-d">{d}</span>}
                      {d && onDay(d).map((it) => (
                        <span key={it.id} className={`cal-dot ${stTone(it.status)}`} title={`${it.assetQr} ${it.assetType} (${it.status})`} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
