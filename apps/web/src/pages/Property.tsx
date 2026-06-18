import { useEffect, useState } from 'react';
import { api } from '../api';
import { Loader, SheetBar, Stamp } from '../ui';

interface Asset {
  id: string;
  qr: string;
  type: string;
  status: 'in-use' | 'idle' | 'maintenance' | 'retired';
  location: string;
  custodian: string;
}
interface Movement { id: string; kind: string; fromCustodian: string | null; toCustodian: string | null; location: string; status: string; by: string; note: string | null; createdAt: string; }

const STATUS = ['in-use', 'idle', 'maintenance', 'retired'] as const;
const tone = (s: string) => (s === 'in-use' ? 'st-ok' : s === 'maintenance' ? 'st-warn' : s === 'retired' ? 'st-bad' : 'st-info');

export default function Property() {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [sel, setSel] = useState<{ asset: Asset; history: Movement[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ status: '', location: '', custodian: '', note: '' });
  const month = new Date().toISOString().slice(0, 7);

  const refresh = () => api<Asset[]>('/property/assets').then(setAssets).catch((e: Error) => setError(e.message));
  useEffect(() => { void refresh(); }, []);

  async function open(qr: string) {
    setError(null);
    const data = await api<{ asset: Asset; history: Movement[] }>(`/property/assets/${qr}`);
    setSel(data);
    setForm({ status: data.asset.status, location: data.asset.location, custodian: data.asset.custodian, note: '' });
  }

  async function scan() {
    if (!sel) return;
    await api(`/property/assets/${sel.asset.qr}/scan`, {
      method: 'POST',
      body: JSON.stringify({ status: form.status, location: form.location, custodian: form.custodian, note: form.note || undefined }),
    });
    await open(sel.asset.qr);
    await refresh();
  }

  async function attest() {
    if (!sel) return;
    await api(`/property/assets/${sel.asset.qr}/attest`, { method: 'POST', body: JSON.stringify({ month, note: 'confirmed by custodian' }) });
    await open(sel.asset.qr);
  }

  if (error) return <><SheetBar sheet="PRP-T" title="Property — QR EAM" /><div className="err">{error}</div></>;
  if (!assets) return <><SheetBar sheet="PRP-T" title="Property — QR EAM" /><Loader label="Loading assets" /></>;

  return (
    <>
      <SheetBar sheet="PRP-T" title="Property — Asset custody (QR EAM)" note="Scan a QR to update location / status / custodian · monthly attestation" />
      <div className="deptgrid">
        <div className="card">
          <div className="ph"><b>Assets</b><span className="src">SRC · property.assets</span></div>
          <table className="tbl">
            <thead><tr><th>QR</th><th>Type</th><th>Custodian</th><th>Location</th><th>Status</th></tr></thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} onClick={() => void open(a.qr)} style={{ cursor: 'pointer' }}>
                  <td><code>{a.qr}</code></td><td>{a.type}</td><td>{a.custodian}</td><td>{a.location}</td>
                  <td><span className={`st ${tone(a.status)}`}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="ph"><b>Scan / update</b>{sel && <span className="src">{sel.asset.qr}</span>}</div>
          {!sel ? (
            <div className="muted">Pick an asset to scan, re-custody, or attest.</div>
          ) : (
            <>
              <label className="field"><span>Status</span>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="field"><span>Location</span>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </label>
              <label className="field"><span>Custodian (change = re-issue)</span>
                <input value={form.custodian} onChange={(e) => setForm({ ...form, custodian: e.target.value })} />
              </label>
              <label className="field"><span>Note</span>
                <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="optional" />
              </label>
              <div className="spread">
                <button className="btn pri sm" onClick={() => void scan()}>Save scan ↻</button>
                <button className="btn sm" onClick={() => void attest()}>Attest {month} ✓</button>
              </div>
              <div className="ph" style={{ marginTop: 14 }}><b>Movement history</b></div>
              <table className="tbl">
                <tbody>
                  {sel.history.map((m) => (
                    <tr key={m.id}>
                      <td><Stamp kind={m.kind === 'issue' ? 'warn' : m.kind === 'create' ? 'info' : 'ok'}>{m.kind}</Stamp></td>
                      <td>{m.toCustodian} · {m.location}</td>
                      <td className="muted">{new Date(m.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </>
  );
}
