import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { Loader, SheetBar } from '../ui';

/** Breadth-first department pages: render the module's read surface as-is.
 *  Deep workflows land per module branch (see CLAUDE.md §11). */
const endpoints: Record<string, { title: string; path: string; src: string }> = {
  procurement: { title: 'Procurement — supplier performance', path: '/procurement/supplier-performance', src: 'procurement.supplier-performance' },
  operations: { title: 'Operations — VPO control tower', path: '/operations/health', src: 'operations.health' },
  survey: { title: 'Survey — monthly volumes', path: '/survey/volumes', src: 'survey.volumes' },
  mqc: { title: 'MQC — certificate queue', path: '/mqc/certs', src: 'mqc.certs' },
  audit: { title: 'Audit — exception register', path: '/audit/exceptions', src: 'audit.exceptions' },
  it: { title: 'IT — capacity planning & controls', path: '/it/capacity', src: 'it.capacity' },
  records: { title: 'Records — expiring documents', path: '/records/expiry', src: 'records.expiry' },
  clinic: { title: 'Clinic — aggregate summary (isolated)', path: '/clinic/aggregate', src: 'clinic.aggregate' },
  admin: { title: 'Admin / OHS — inquiries (shared ticketing)', path: '/tickets?source=admin', src: 'admin.tickets' },
  hr: { title: 'HR — hours computation runs', path: '/hr/hours', src: 'hr.hours' },
  property: { title: 'Property — asset custody (QR EAM)', path: '/property/assets', src: 'property.assets' },
  finance: { title: 'Finance — documents in motion', path: '/finance/doc-flow', src: 'finance.doc-flow' },
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

export default function Dept() {
  const { slug = '' } = useParams();
  const meta = endpoints[slug];
  const [data, setData] = useState<unknown>(null);
  const [tickets, setTickets] = useState<Array<Record<string, unknown>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setTickets(null);
    setError(null);
    if (meta) api<unknown>(meta.path).then(setData).catch((e: Error) => setError(e.message));
    if (slug === 'it') {
      api<Array<Record<string, unknown>>>('/tickets?source=it').then(setTickets).catch(() => {});
    }
  }, [slug]);

  if (!meta) return <div className="err">Unknown department: {slug}</div>;

  return (
    <>
      <SheetBar sheet={`${slug.slice(0, 3).toUpperCase()}-RM`} title={meta.title} note={`Read surface · ${meta.src} · deep workflows land on the ${slug} branch`} />
      {error && <div className="err">{error}</div>}
      {!error && data == null && <Loader label={`Querying ${meta.src}`} />}
      {Array.isArray(data) && <div className="card"><AutoTable rows={data as Array<Record<string, unknown>>} /></div>}
      {!Array.isArray(data) && data != null && typeof data === 'object' && (
        <div className="card">
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
        </div>
      )}
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
