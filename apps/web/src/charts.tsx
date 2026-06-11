import type { TrendPoint } from '@ubi/types';

/** Chart convention (design language): grey = plan, teal solid = actual,
 *  orange dashed = projected. Projection series renders only when `project`. */
export function TrendChart({ data, project, unit }: { data: TrendPoint[]; project: boolean; unit: string }) {
  const w = 460;
  const h = 180;
  const px = 38;
  const py = 16;
  const plotW = w - px - 10;
  const plotH = h - py - 28;

  const values = data.flatMap((d) => [d.plan, d.actual, project ? d.projected : null]).filter((v): v is number => v != null);
  const max = Math.max(...values, 1);
  const x = (i: number) => px + (i / Math.max(data.length - 1, 1)) * plotW;
  const y = (v: number) => py + plotH - (v / max) * plotH;

  const line = (pick: (d: TrendPoint) => number | null) =>
    data
      .map((d, i) => ({ v: pick(d), i }))
      .filter((p): p is { v: number; i: number } => p.v != null)
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`)
      .join(' ');

  const lastActualIdx = data.reduce((acc, d, i) => (d.actual != null ? i : acc), -1);
  // Bridge actual → projection so the dashed line continues the solid one.
  const projSeries = data.map((d, i) => (i === lastActualIdx ? d.actual : project ? d.projected : null));
  const projPath = line((d) => projSeries[data.indexOf(d)]);

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
        <line x1={px} y1={py + plotH} x2={w - 10} y2={py + plotH} stroke="#e3e8ee" />
        <line x1={px} y1={py + plotH / 2} x2={w - 10} y2={py + plotH / 2} stroke="#eef2f5" />
        <text x={px - 6} y={py + plotH + 3} textAnchor="end" fontSize="9" fill="#5b6b7a">0</text>
        <text x={px - 6} y={py + plotH / 2 + 3} textAnchor="end" fontSize="9" fill="#5b6b7a">{Math.round(max / 2)}</text>
        <text x={px - 6} y={py + 3} textAnchor="end" fontSize="9" fill="#5b6b7a">{Math.round(max)}</text>
        {lastActualIdx >= 0 && (
          <>
            <line x1={x(lastActualIdx)} y1={py} x2={x(lastActualIdx)} y2={py + plotH} stroke="#b9c6d1" strokeDasharray="3 3" />
            <text x={x(lastActualIdx)} y={py - 4} textAnchor="middle" fontSize="8" fill="#5b6b7a" fontFamily="ui-monospace,monospace">
              TODAY
            </text>
          </>
        )}
        <path d={line((d) => d.plan)} fill="none" stroke="#9aa9b6" strokeWidth="2" />
        <path d={line((d) => d.actual)} fill="none" stroke="#0e7490" strokeWidth="2.6" />
        {project && <path d={projPath} fill="none" stroke="#c2410c" strokeWidth="2.4" strokeDasharray="6 4" />}
        {data.map((d, i) => (
          <text key={d.period} x={x(i)} y={h - 8} textAnchor="middle" fontSize="9" fill="#5b6b7a">
            {d.period}
          </text>
        ))}
      </svg>
      <div className="lgnd">
        <span><i className="lk" style={{ borderColor: '#9aa9b6' }} /> plan</span>
        <span><i className="lk" style={{ borderColor: '#0e7490' }} /> actual ({unit})</span>
        {project && <span><i className="lk" style={{ borderColor: '#c2410c', borderTopStyle: 'dashed' }} /> projected (trend)</span>}
      </div>
    </div>
  );
}

export function BarsChart({ data, project, unit }: { data: TrendPoint[]; project: boolean; unit: string }) {
  const w = 460;
  const h = 180;
  const px = 38;
  const py = 16;
  const plotW = w - px - 10;
  const plotH = h - py - 28;
  const shown = data.filter((d) => d.actual != null || (project && d.projected != null));
  const values = shown.map((d) => d.actual ?? d.projected ?? 0);
  const max = Math.max(...values, 1);
  const bw = Math.min(40, (plotW / Math.max(shown.length, 1)) * 0.62);

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
        <line x1={px} y1={py + plotH} x2={w - 10} y2={py + plotH} stroke="#e3e8ee" />
        <text x={px - 6} y={py + plotH + 3} textAnchor="end" fontSize="9" fill="#5b6b7a">0</text>
        <text x={px - 6} y={py + 3} textAnchor="end" fontSize="9" fill="#5b6b7a">{Math.round(max)}</text>
        {shown.map((d, i) => {
          const cx = px + ((i + 0.5) / shown.length) * plotW;
          const v = d.actual ?? d.projected ?? 0;
          const bh = (v / max) * plotH;
          const isProj = d.actual == null;
          return (
            <g key={d.period}>
              {isProj ? (
                <rect x={cx - bw / 2} y={py + plotH - bh} width={bw} height={bh} fill="none" stroke="#c2410c" strokeWidth="1.8" strokeDasharray="5 3" />
              ) : (
                <rect x={cx - bw / 2} y={py + plotH - bh} width={bw} height={bh} fill="#0e7490" opacity="0.85" />
              )}
              <text x={cx} y={h - 8} textAnchor="middle" fontSize="9" fill="#5b6b7a">{d.period}</text>
            </g>
          );
        })}
      </svg>
      <div className="lgnd">
        <span><i className="lk" style={{ borderColor: '#0e7490' }} /> reported ({unit})</span>
        {project && <span><i className="lk" style={{ borderColor: '#c2410c', borderTopStyle: 'dashed' }} /> projected</span>}
      </div>
    </div>
  );
}

export function Sparkline({ points }: { points: number[] }) {
  if (!points.length) return null;
  const w = 64;
  const h = 18;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const path = points
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(2 + (i / (points.length - 1)) * (w - 4)).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`)
    .join(' ');
  const rising = points[points.length - 1] >= points[0];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={path} fill="none" stroke={rising ? '#15803d' : '#b91c1c'} strokeWidth="1.7" />
    </svg>
  );
}
