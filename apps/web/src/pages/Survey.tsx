import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { TrendChart } from '../charts';
import { Loader, SheetBar } from '../ui';

interface Measurement {
  id: string;
  projectId: string;
  period: string;
  stationStart: string;
  stationEnd: string;
  payItemNo: string;
  volumeM3: number;
  type: string;
}

import type { TrendPoint } from '@ubi/types';

const PROJECTS = ['PKG-02', 'PKG-05', 'PKG-11', 'PKG-03', 'PKG-07', 'PKG-09'];
const TYPES = ['cross-section', 'original-ground', 'stakeout', 'as-built'];

export default function Survey() {
  const [trend, setTrend] = useState<TrendPoint[] | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[] | null>(null);
  const [project, setProject] = useState('PKG-02');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    stationStart: '', stationEnd: '', payItemNo: '311(1)c',
    volumeM3: '', type: 'cross-section', period: new Date().toISOString().slice(0, 7),
    notes: '',
  });

  const refresh = () =>
    Promise.all([
      api<TrendPoint[]>('/survey/volumes').then(setTrend),
      api<Measurement[]>(`/survey/projects/${project}`).then(setMeasurements),
    ]).catch((e: Error) => setError(e.message));

  useEffect(() => { void refresh(); }, [project]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api(`/survey/projects/${project}/measurements`, {
        method: 'POST',
        body: JSON.stringify({ ...form, volumeM3: Number(form.volumeM3) }),
      });
      setForm({ stationStart: '', stationEnd: '', payItemNo: '311(1)c', volumeM3: '', type: 'cross-section', period: new Date().toISOString().slice(0, 7), notes: '' });
      await refresh();
    } catch (e2) { setError((e2 as Error).message); }
    finally { setSubmitting(false); }
  }

  if (error) return <><SheetBar sheet="SRV-T" title="Survey" /><div className="err">{error}</div></>;
  if (!trend || !measurements) return <><SheetBar sheet="SRV-T" title="Survey" /><Loader label="Loading survey data" /></>;

  return (
    <>
      <SheetBar
        sheet="SRV-T"
        title="Survey — Measurements & Volumes"
        note="Station/chainage indexed · cross-sections · monthly ManCom volumes"
      />

      <div className="grid2">
        <div className="card">
          <div className="ph"><b>Monthly volume trend (m³)</b><span className="src">SRC · survey.volumes</span></div>
          {trend.length === 0
            ? <div className="muted">No measurements recorded yet.</div>
            : <TrendChart data={trend} project={false} unit="m³" />
          }
        </div>

        <div className="card">
          <div className="ph">
            <b>Measurements — project</b>
            <select className="tin" value={project} onChange={(e) => { setProject(e.target.value); setMeasurements(null); }}>
              {PROJECTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <table className="tbl">
            <thead>
              <tr><th>Period</th><th>Station</th><th>Pay item</th><th>Type</th><th className="ta-r">Volume (m³)</th></tr>
            </thead>
            <tbody>
              {measurements.length === 0
                ? <tr><td colSpan={5} className="muted ta-c">No measurements for this project yet.</td></tr>
                : measurements.map((m) => (
                    <tr key={m.id}>
                      <td>{m.period}</td>
                      <td className="mono">{m.stationStart} → {m.stationEnd}</td>
                      <td>{m.payItemNo}</td>
                      <td><span className="st st-info">{m.type}</span></td>
                      <td className="ta-r">{Number(m.volumeM3).toLocaleString()}</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="ph"><b>Submit measurement — {project}</b></div>
        <form className="spread" style={{ flexWrap: 'wrap', gap: 8 }} onSubmit={submit}>
          <label className="field">
            <span>Period (YYYY-MM)</span>
            <input className="tin" type="month" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} required />
          </label>
          <label className="field">
            <span>Station start</span>
            <input className="tin mono" placeholder="STA 0+000" value={form.stationStart} onChange={(e) => setForm({ ...form, stationStart: e.target.value })} required />
          </label>
          <label className="field">
            <span>Station end</span>
            <input className="tin mono" placeholder="STA 0+480" value={form.stationEnd} onChange={(e) => setForm({ ...form, stationEnd: e.target.value })} required />
          </label>
          <label className="field">
            <span>Pay item</span>
            <input className="tin mono" placeholder="311(1)c" value={form.payItemNo} onChange={(e) => setForm({ ...form, payItemNo: e.target.value })} required />
          </label>
          <label className="field">
            <span>Type</span>
            <select className="tin" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Volume (m³)</span>
            <input className="tin" type="number" step="0.001" placeholder="44200" value={form.volumeM3} onChange={(e) => setForm({ ...form, volumeM3: e.target.value })} required />
          </label>
          <label className="field" style={{ flexGrow: 1 }}>
            <span>Notes</span>
            <input className="tin" placeholder="optional" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          <button className="btn pri sm" disabled={submitting}>{submitting ? 'Saving…' : 'Record measurement'}</button>
        </form>
      </div>
    </>
  );
}
