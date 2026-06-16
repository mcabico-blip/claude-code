import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { Loader, Stamp, SheetBar } from '../ui';

interface QcTest {
  id: string;
  projectId: string;
  payItemNo: string;
  testType: string;
  result: string;
  certId: string | null;
  labRef: string | null;
  testDate: string | null;
  billingRef: string | null;
}

interface PourLog {
  id: string;
  station: string | null;
  pourDate: string;
  mixDesign: string | null;
  volumeM3: number;
  slumpMm: number | null;
  airContentPct: number | null;
}

interface DpwhRule { test: string; per: string; qty: number }

const PROJECTS = ['PKG-02', 'PKG-05', 'PKG-11', 'PKG-03', 'PKG-07', 'PKG-09'];
const PAY_ITEMS = ['311(1)a', '311(1)b', '311(1)c', '200', '201', '301'];
const RESULTS = ['pending', 'passed', 'failed'];

function stColor(r: string): 'ok' | 'warn' | 'bad' {
  return r === 'passed' ? 'ok' : r === 'failed' ? 'bad' : 'warn';
}

export default function Mqc() {
  const [project, setProject] = useState('PKG-02');
  const [payItem, setPayItem] = useState('311(1)c');
  const [tests, setTests] = useState<QcTest[] | null>(null);
  const [pours, setPours] = useState<PourLog[] | null>(null);
  const [rules, setRules] = useState<DpwhRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<'tests' | 'pours'>('tests');

  const [testForm, setTestForm] = useState({
    payItemNo: '311(1)c', testType: 'Concrete beam (7-day)', result: 'pending',
    billingRef: '', certId: '', labRef: '', testDate: '',
  });
  const [pourForm, setPourForm] = useState({
    station: '', pourDate: new Date().toISOString().slice(0, 10),
    mixDesign: 'Class A 40.7 MPa', volumeM3: '', slumpMm: '', airContentPct: '',
    payItemNo: '311(1)c',
  });

  const refresh = () =>
    Promise.all([
      api<QcTest[]>(`/mqc/projects/${project}/tests`).then(setTests),
      api<PourLog[]>(`/mqc/projects/${project}/pours`).then(setPours),
      api<{ requirements: DpwhRule[] }>(`/mqc/rules/${encodeURIComponent(payItem)}`).then((r) => setRules(r.requirements)),
    ]).catch((e: Error) => setError(e.message));

  useEffect(() => { void refresh(); }, [project]);

  useEffect(() => {
    api<{ requirements: DpwhRule[] }>(`/mqc/rules/${encodeURIComponent(payItem)}`)
      .then((r) => setRules(r.requirements))
      .catch(() => {});
  }, [payItem]);

  async function submitTest(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api(`/mqc/projects/${project}/tests`, {
        method: 'POST',
        body: JSON.stringify(testForm),
      });
      setTestForm({ payItemNo: '311(1)c', testType: 'Concrete beam (7-day)', result: 'pending', billingRef: '', certId: '', labRef: '', testDate: '' });
      setTests(null);
      await api<QcTest[]>(`/mqc/projects/${project}/tests`).then(setTests);
    } catch (e2) { setError((e2 as Error).message); }
    finally { setSubmitting(false); }
  }

  async function submitPour(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api(`/mqc/projects/${project}/pours`, {
        method: 'POST',
        body: JSON.stringify({ ...pourForm, volumeM3: Number(pourForm.volumeM3), slumpMm: pourForm.slumpMm ? Number(pourForm.slumpMm) : null, airContentPct: pourForm.airContentPct ? Number(pourForm.airContentPct) : null }),
      });
      setPourForm({ station: '', pourDate: new Date().toISOString().slice(0, 10), mixDesign: 'Class A 40.7 MPa', volumeM3: '', slumpMm: '', airContentPct: '', payItemNo: '311(1)c' });
      setPours(null);
      await api<PourLog[]>(`/mqc/projects/${project}/pours`).then(setPours);
    } catch (e2) { setError((e2 as Error).message); }
    finally { setSubmitting(false); }
  }

  const pendingCount = tests?.filter((t) => t.result === 'pending').length ?? 0;

  if (error) return <><SheetBar sheet="MQC-T" title="MQC" /><div className="err">{error}</div></>;
  if (!tests || !pours) return <><SheetBar sheet="MQC-T" title="MQC" /><Loader label="Loading MQC data" /></>;

  return (
    <>
      <SheetBar
        sheet="MQC-T"
        title="MQC — Materials Quality Control"
        note="DPWH minimum testing · pour logs · certs attach to billings"
      />

      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="lab">Tests on file</div>
          <div className="val">{tests.length}</div>
          <div className="sub">project {project}</div>
          <div className={`kpi-bar tone-${tests.length > 0 ? 'ok' : 'info'}`} />
        </div>
        <div className="kpi">
          <div className="lab">Pending certs</div>
          <div className="val">{pendingCount}</div>
          <div className="sub">{pendingCount > 0 ? 'blocking billing' : 'none blocking'}</div>
          <div className={`kpi-bar tone-${pendingCount > 0 ? 'bad' : 'ok'}`} />
        </div>
        <div className="kpi">
          <div className="lab">Pour logs</div>
          <div className="val">{pours.length}</div>
          <div className="sub">project {project}</div>
          <div className="kpi-bar tone-info" />
        </div>
        <div className="kpi">
          <div className="lab">Project</div>
          <div className="val">
            <select className="tin" value={project} onChange={(e) => { setProject(e.target.value); setTests(null); setPours(null); }}>
              {PROJECTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="sub">&nbsp;</div>
          <div className="kpi-bar tone-info" />
        </div>
      </div>

      {/* DPWH requirements panel */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="ph">
          <b>DPWH minimum testing requirements</b>
          <select className="tin" value={payItem} onChange={(e) => setPayItem(e.target.value)}>
            {PAY_ITEMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        {rules && rules.length > 0
          ? <table className="tbl">
              <thead><tr><th>Test</th><th>Frequency</th><th>Qty</th></tr></thead>
              <tbody>
                {rules.map((r, i) => (
                  <tr key={i}>
                    <td>{r.test}</td><td>{r.per}</td><td>{r.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          : <div className="muted">No DPWH rules on file for this pay item.</div>
        }
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab-btn${tab === 'tests' ? ' on' : ''}`} onClick={() => setTab('tests')}>
          Test results {pendingCount > 0 && <span className="badge-warn">{pendingCount}</span>}
        </button>
        <button className={`tab-btn${tab === 'pours' ? ' on' : ''}`} onClick={() => setTab('pours')}>
          Pour logs
        </button>
      </div>

      {tab === 'tests' && (
        <>
          <div className="card">
            <div className="ph"><b>Test results — {project}</b><span className="src">SRC · mqc.certs</span></div>
            <table className="tbl">
              <thead>
                <tr><th>Cert ID</th><th>Pay item</th><th>Test</th><th>Date</th><th>Lab ref</th><th>Result</th><th>Billing</th></tr>
              </thead>
              <tbody>
                {tests.length === 0
                  ? <tr><td colSpan={7} className="muted ta-c">No test results yet.</td></tr>
                  : tests.map((t) => (
                      <tr key={t.id}>
                        <td className="mono">{t.certId ?? '—'}</td>
                        <td>{t.payItemNo}</td>
                        <td>{t.testType}</td>
                        <td>{t.testDate ? t.testDate.slice(0, 10) : '—'}</td>
                        <td className="mono">{t.labRef ?? '—'}</td>
                        <td><Stamp kind={stColor(t.result)}>{t.result.toUpperCase()}</Stamp></td>
                        <td className="muted">{t.billingRef ?? '—'}</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="ph"><b>Record test result — {project}</b></div>
            <form className="spread" style={{ flexWrap: 'wrap', gap: 8 }} onSubmit={submitTest}>
              <label className="field">
                <span>Pay item</span>
                <input className="tin mono" value={testForm.payItemNo} onChange={(e) => setTestForm({ ...testForm, payItemNo: e.target.value })} required />
              </label>
              <label className="field" style={{ flexGrow: 1 }}>
                <span>Test type</span>
                <input className="tin" value={testForm.testType} onChange={(e) => setTestForm({ ...testForm, testType: e.target.value })} required />
              </label>
              <label className="field">
                <span>Result</span>
                <select className="tin" value={testForm.result} onChange={(e) => setTestForm({ ...testForm, result: e.target.value })}>
                  {RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Test date</span>
                <input className="tin" type="date" value={testForm.testDate} onChange={(e) => setTestForm({ ...testForm, testDate: e.target.value })} />
              </label>
              <label className="field">
                <span>Cert ID</span>
                <input className="tin mono" placeholder="MQC-2026-XXXX" value={testForm.certId} onChange={(e) => setTestForm({ ...testForm, certId: e.target.value })} />
              </label>
              <label className="field">
                <span>Lab ref</span>
                <input className="tin mono" placeholder="LAB-XXXX" value={testForm.labRef} onChange={(e) => setTestForm({ ...testForm, labRef: e.target.value })} />
              </label>
              <label className="field" style={{ flexGrow: 1 }}>
                <span>Billing ref</span>
                <input className="tin" placeholder="Billing No. 7 / PKG-02" value={testForm.billingRef} onChange={(e) => setTestForm({ ...testForm, billingRef: e.target.value })} />
              </label>
              <button className="btn pri sm" disabled={submitting}>{submitting ? 'Saving…' : 'Record test'}</button>
            </form>
          </div>
        </>
      )}

      {tab === 'pours' && (
        <>
          <div className="card">
            <div className="ph"><b>Pour logs — {project}</b></div>
            <table className="tbl">
              <thead>
                <tr><th>Date</th><th>Station</th><th>Pay item</th><th>Mix design</th><th className="ta-r">Volume (m³)</th><th>Slump (mm)</th><th>Air %</th></tr>
              </thead>
              <tbody>
                {pours.length === 0
                  ? <tr><td colSpan={7} className="muted ta-c">No pour logs yet.</td></tr>
                  : pours.map((p) => (
                      <tr key={p.id}>
                        <td>{p.pourDate.slice(0, 10)}</td>
                        <td className="mono">{p.station ?? '—'}</td>
                        <td>{(p as unknown as { payItemNo?: string }).payItemNo ?? '—'}</td>
                        <td>{p.mixDesign ?? '—'}</td>
                        <td className="ta-r">{Number(p.volumeM3).toLocaleString()}</td>
                        <td>{p.slumpMm ?? '—'}</td>
                        <td>{p.airContentPct ?? '—'}</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="ph"><b>Log a pour — {project}</b></div>
            <form className="spread" style={{ flexWrap: 'wrap', gap: 8 }} onSubmit={submitPour}>
              <label className="field">
                <span>Pour date</span>
                <input className="tin" type="date" value={pourForm.pourDate} onChange={(e) => setPourForm({ ...pourForm, pourDate: e.target.value })} required />
              </label>
              <label className="field">
                <span>Station</span>
                <input className="tin mono" placeholder="STA 2+720" value={pourForm.station} onChange={(e) => setPourForm({ ...pourForm, station: e.target.value })} />
              </label>
              <label className="field">
                <span>Pay item</span>
                <input className="tin mono" value={pourForm.payItemNo} onChange={(e) => setPourForm({ ...pourForm, payItemNo: e.target.value })} required />
              </label>
              <label className="field" style={{ flexGrow: 1 }}>
                <span>Mix design</span>
                <input className="tin" value={pourForm.mixDesign} onChange={(e) => setPourForm({ ...pourForm, mixDesign: e.target.value })} />
              </label>
              <label className="field">
                <span>Volume (m³)</span>
                <input className="tin" type="number" step="0.001" placeholder="180.5" value={pourForm.volumeM3} onChange={(e) => setPourForm({ ...pourForm, volumeM3: e.target.value })} required />
              </label>
              <label className="field">
                <span>Slump (mm)</span>
                <input className="tin" type="number" placeholder="75" value={pourForm.slumpMm} onChange={(e) => setPourForm({ ...pourForm, slumpMm: e.target.value })} />
              </label>
              <label className="field">
                <span>Air content %</span>
                <input className="tin" type="number" step="0.1" placeholder="5.2" value={pourForm.airContentPct} onChange={(e) => setPourForm({ ...pourForm, airContentPct: e.target.value })} />
              </label>
              <button className="btn pri sm" disabled={submitting}>{submitting ? 'Saving…' : 'Log pour'}</button>
            </form>
          </div>
        </>
      )}
    </>
  );
}
