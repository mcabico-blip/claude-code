import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { CctvThumb, KpiBand, Loader, SheetBar } from '../ui';

interface DeptDashboard {
  slug: string;
  label: string;
  head: { email: string; name: string };
  kpis: Array<{ label: string; value: string; sub: string; tone: 'ok' | 'warn' | 'bad' | 'info' }>;
  monitoring: { title: string; src: string; data: unknown };
  camera: { id: string; label: string; online: boolean; streamUrl: string | null };
}

/** Departments with a dedicated tools page (deep workflows). */
const TOOLS: Record<string, { path: string; label: string }> = {
  engineering: { path: '/engineering', label: 'Open Engineering tools — projects · materials schedule' },
  property: { path: '/property', label: 'Open Property tools — scan · re-custody · attest' },
  records: { path: '/records', label: 'Open Records tools — expiry · vehicle docs · physical index' },
  it: { path: '/it', label: 'Open IT control room — devices · PMS scheduler · DeskGuard · env' },
};

function Value({ v }: { v: unknown }) {
  if (v == null) return <span className="muted">—</span>;
  if (typeof v === 'boolean') return <span className={`st ${v ? 'st-ok' : 'st-warn'}`}>{String(v)}</span>;
  if (typeof v === 'object') return <code>{JSON.stringify(v)}</code>;
  return <>{String(v)}</>;
}

function AutoTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (!rows.length) return <div className="muted">No records yet.</div>;
  const keys = Object.keys(rows[0]).filter((k) => !['id', 'entity', 'createdBy', 'updatedAt', 'deletedAt'].includes(k));
  return (
    <table className="tbl">
      <thead><tr>{keys.map((k) => <th key={k}>{k}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{keys.map((k) => <td key={k}><Value v={r[k]} /></td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

function Monitoring({ data }: { data: unknown }) {
  if (Array.isArray(data)) return <AutoTable rows={data as Array<Record<string, unknown>>} />;
  if (data && typeof data === 'object') {
    return (
      <table className="tbl">
        <tbody>
          {Object.entries(data as Record<string, unknown>).map(([k, v]) => (
            <tr key={k}>
              <td style={{ width: 220 }}><b>{k}</b></td>
              <td>{Array.isArray(v) ? <AutoTable rows={v as Array<Record<string, unknown>>} /> : <Value v={v} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return <div className="muted">No data.</div>;
}

/** Standard department dashboard — same shape for every department:
 *  uniform KPI band · field monitoring (the dept's read-model) · CCTV thumbnail. */
export default function Dept() {
  const { slug = '' } = useParams();
  const [dash, setDash] = useState<DeptDashboard | null>(null);
  const [tickets, setTickets] = useState<Array<Record<string, unknown>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDash(null);
    setTickets(null);
    setError(null);
    api<DeptDashboard>(`/dept/${slug}/dashboard`).then(setDash).catch((e: Error) => setError(e.message));
    if (slug === 'it') api<Array<Record<string, unknown>>>('/tickets?source=it').then(setTickets).catch(() => {});
  }, [slug]);

  if (error) return <><SheetBar sheet="DEPT" title={slug} note="department dashboard" /><div className="err">{error}</div></>;
  if (!dash) return <><SheetBar sheet="DEPT" title={slug} note="department dashboard" /><Loader label={`Loading ${slug} dashboard`} /></>;

  return (
    <>
      <SheetBar
        sheet={`${slug.slice(0, 3).toUpperCase()}-DH`}
        title={`${dash.label} — Department Dashboard`}
        note={`Head: ${dash.head.name} · monitoring ${dash.monitoring.src}`}
      />

      {TOOLS[slug] && (
        <div className="spread mb">
          <Link to={TOOLS[slug].path} className="btn sm pri">{TOOLS[slug].label} →</Link>
        </div>
      )}

      <KpiBand kpis={dash.kpis} />

      <div className="deptgrid">
        <div className="card">
          <div className="ph">
            <b>Field monitoring — {dash.monitoring.title}</b>
            <span className="src">SRC · {dash.monitoring.src}</span>
          </div>
          <Monitoring data={dash.monitoring.data} />
        </div>

        <div className="card cctv-card">
          <div className="ph">
            <b>CCTV</b>
            <span className="src">{dash.camera.id}</span>
          </div>
          <CctvThumb label={dash.camera.label} online={dash.camera.online} streamUrl={dash.camera.streamUrl} />
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
            {dash.camera.online ? 'Live thumbnail from NVR.' : 'Set CCTV_BASE_URL to link the Hikvision NVR snapshot.'}
          </div>
        </div>
      </div>

      {slug === 'it' && tickets && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="ph">
            <b>Helpdesk queue</b>
            <span className="src">SRC · ticketing (it) · public form feeds this</span>
          </div>
          <AutoTable rows={tickets} />
        </div>
      )}
    </>
  );
}
