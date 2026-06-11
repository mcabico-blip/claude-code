import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ManComSnapshot } from '@ubi/types';
import { api } from '../api';
import { BarsChart, Sparkline, TrendChart } from '../charts';
import { Chainage, SheetBar } from '../ui';

const peso = (centavos: number) => `₱${(centavos / 100 / 1_000_000).toFixed(1)}M`;

export default function ManCom() {
  const [snap, setSnap] = useState<ManComSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState(() => localStorage.getItem('ubi.project') !== 'off');

  useEffect(() => {
    api<ManComSnapshot>('/ceo/mancom').then(setSnap).catch((e: Error) => setError(e.message));
  }, []);

  function toggle() {
    setProject((p) => {
      localStorage.setItem('ubi.project', p ? 'off' : 'on');
      return !p;
    });
  }

  if (error) return <div className="err">{error}</div>;
  if (!snap) return <div className="muted">Loading ManCom…</div>;
  const k = snap.kpis;

  return (
    <>
      <SheetBar sheet="MC-01" title="ManCom — Management Committee" note="Consolidated from every department via Pillar-3 read-models" />
      <div className="top">
        <span className={`toggle${project ? ' on' : ''}`} onClick={toggle} role="switch" aria-checked={project}>
          <span className="tg" /> Project trends forward
        </span>
        <div className="right">
          <span className="asof">
            <i /> live · as of {new Date(snap.asOf).toLocaleTimeString()}
          </span>
        </div>
      </div>

      <div className="mancom">
        <div>
          <div className="kpis">
            <div className="kpi">
              <div className="lab">Active projects</div>
              <div className="val">
                {k.activeProjects} <span className="mchip mc-bad">{k.flaggedProjects} ⚑</span>
              </div>
              <div className="sub">DPWH packages · flags pre-vetted by Operations</div>
            </div>
            <div className="kpi">
              <div className="lab">Billings — month</div>
              <div className="val">
                {peso(k.billingsMonthCentavos)} <span className="d-up">▲ {k.billingsDeltaPct}%</span>
              </div>
              <Chainage
                pct={(k.billingDraftsSubmitted / k.billingDraftsTotal) * 100}
                label={`${k.billingDraftsSubmitted}/${k.billingDraftsTotal} drafts`}
              />
            </div>
            <div className="kpi">
              <div className="lab">Avg slippage</div>
              <div className="val">
                {k.avgSlippagePct}%
                {project && k.projectedSlippagePct != null && (
                  <span className="mchip mc-proj">→ {k.projectedSlippagePct}% next mo.</span>
                )}
              </div>
              <div className="sub">across active packages</div>
            </div>
            <div className="kpi">
              <div className="lab">Open exceptions</div>
              <div className="val">
                {k.openExceptions} <span className="mchip mc-bad">{k.escalatedExceptions} escalated</span>
              </div>
              <div className="sub">Audit investigation tracker</div>
            </div>
          </div>

          <div className="grid2">
            <div className="card">
              <div className="ph">
                <b>Accomplishment vs plan — cumulative ₱M</b>
                <span className="src">SRC · engineering.swa</span>
              </div>
              <TrendChart data={snap.accomplishment} project={project} unit="₱M" />
            </div>
            <div className="card">
              <div className="ph">
                <b>Survey volumes — monthly m³ ×1000</b>
                <span className="src">SRC · survey.volumes</span>
              </div>
              <BarsChart data={snap.surveyVolumes} project={project} unit="m³ ×1000" />
            </div>
          </div>

          <div className="grid2">
            <div className="card">
              <div className="ph">
                <b>Flagged projects</b>
                <span className="src">SRC · operations.health</span>
              </div>
              <table className="tbl">
                <thead>
                  <tr><th>Project</th><th>PE / PM</th><th>Slip</th><th>Trend</th><th>Proj.</th></tr>
                </thead>
                <tbody>
                  {snap.flagged.map((f) => (
                    <tr key={f.projectCode}>
                      <td>{f.projectCode} · {f.projectName}</td>
                      <td>{f.pe} / {f.pm}</td>
                      <td className={f.slippagePct < 0 ? 'neg' : 'pos'}>{f.slippagePct}%</td>
                      <td><Sparkline points={f.trend} /></td>
                      <td>
                        {project && f.projectedPct != null ? (
                          <span className={`st ${f.projectedPct < -3 ? 'st-bad' : f.projectedPct < 0 ? 'st-warn' : 'st-ok'}`}>
                            {f.projectedPct}%
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="ph">
                <b>Department report feed</b>
                <span className="src">SRC · *.report-status</span>
              </div>
              <table className="tbl">
                <tbody>
                  {snap.reportFeed.map((r) => (
                    <tr key={`${r.module}-${r.report}`}>
                      <td><b style={{ textTransform: 'capitalize' }}>{r.module}</b> — {r.report}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span
                          className={`st ${
                            r.status === 'on-time' || r.status === 'received'
                              ? 'st-ok'
                              : r.status === 'late'
                                ? 'st-bad'
                                : r.status === 'aggregate-only'
                                  ? 'st-info'
                                  : 'st-warn'
                          }`}
                        >
                          {r.detail ?? r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rail">
          <div className="railh">
            AI Insights <Link to="/insights">view all →</Link>
          </div>
          {snap.topInsights.map((ins) => (
            <div key={ins.id} className={`ins ${ins.severity}`}>
              <div className="sev">● {ins.severity.toUpperCase()}</div>
              <p><b>{ins.title}.</b> {ins.body.slice(0, 110)}{ins.body.length > 110 ? '…' : ''}</p>
              <div className="evi">
                {ins.evidence.slice(0, 3).map((e) => <i key={e}>{e}</i>)}
              </div>
            </div>
          ))}
          <div className="card">
            <div className="railh" style={{ marginBottom: 8 }}>Ask AI</div>
            <Link to="/ask" className="btn" style={{ display: 'block', textAlign: 'center', color: 'inherit' }}>
              “What's happening?” →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
