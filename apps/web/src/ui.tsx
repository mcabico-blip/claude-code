import { useEffect, useRef, useState } from 'react';

/** Signature components of the "drawing comes alive" design language. */

/** Typewriter reveal for AI responses — pen-on-paper, not a text dump. */
export function Type({ text, speed = 12, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const [n, setN] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    setN(0);
    const id = setInterval(() => {
      setN((prev) => {
        const next = Math.min(prev + 2, text.length);
        if (next >= text.length) {
          clearInterval(id);
          doneRef.current?.();
        }
        return next;
      });
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span className="caret">▌</span>}
    </>
  );
}

/** Loading state drawn as hatched placeholder linework on a sheet. */
export function Loader({ label = 'Pulling read-models' }: { label?: string }) {
  return (
    <div className="card loader" role="status" aria-live="polite">
      <div className="hatch" style={{ width: '62%' }} />
      <div className="hatch" style={{ width: '88%' }} />
      <div className="hatch" style={{ width: '74%' }} />
      <div className="hatch" style={{ width: '41%' }} />
      <span className="loader-label">
        {label}<span className="dots"><i>.</i><i>.</i><i>.</i></span>
      </span>
    </div>
  );
}

/** Rubber-stamp status — rotated, double-ruled, ink-textured. */
export function Stamp({ kind, children }: { kind: 'ok' | 'warn' | 'bad' | 'info'; children: string }) {
  return <span className={`stamp stamp-${kind}`}>{children}</span>;
}

/** Chainage ruler — progress drawn as a survey station strip (STA 0+000 …). */
export function Chainage({ pct, label, tone = 'teal' }: { pct: number; label?: string; tone?: 'teal' | 'orange' }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const w = 220;
  const h = 30;
  const x = 4 + (clamped / 100) * (w - 8);
  const color = tone === 'orange' ? '#c2410c' : '#0e7490';
  return (
    <svg className="chainage" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <line x1="4" y1={h - 9} x2={w - 4} y2={h - 9} stroke="#102536" strokeWidth="1.6" />
      {Array.from({ length: 21 }, (_, i) => {
        const tx = 4 + (i / 20) * (w - 8);
        const major = i % 5 === 0;
        return <line key={i} x1={tx} y1={h - 9} x2={tx} y2={h - 9 - (major ? 7 : 4)} stroke="#102536" strokeWidth={major ? 1.4 : 0.8} opacity={major ? 1 : 0.55} />;
      })}
      <rect x="4" y={h - 11} width={x - 4} height="4" fill={color} opacity="0.9" />
      <path d={`M${x},${h - 11} l0,-10 l11,3.5 l-11,3.5`} fill={color} stroke="#102536" strokeWidth="0.8" />
      <text x={Math.min(x + 3, w - 46)} y={9} fontSize="8.5" fontFamily="'IBM Plex Mono',monospace" fontWeight="600" fill="#102536">
        {label ?? `${Math.round(clamped)}%`}
      </text>
      <text x="4" y={h - 0.5} fontSize="6.5" fontFamily="'IBM Plex Mono',monospace" fill="#5b6b7a">0+000</text>
      <text x={w - 4} y={h - 0.5} fontSize="6.5" fontFamily="'IBM Plex Mono',monospace" fill="#5b6b7a" textAnchor="end">0+100</text>
    </svg>
  );
}

/** CCTV thumbnail — a real-looking camera tile. Shows the live snapshot when
 *  an NVR stream is wired (camera.online), else an honest NO-SIGNAL placeholder. */
export function CctvThumb({
  label,
  online,
  streamUrl,
}: {
  label: string;
  online: boolean;
  streamUrl?: string | null;
}) {
  return (
    <div className={`cctv${online ? ' live' : ''}`}>
      <div className="cctv-top">
        <span className="cctv-rec">{online ? '● REC' : '○ NO SIGNAL'}</span>
        <span className="cctv-ts">{new Date().toLocaleString('en-PH', { hour12: false })}</span>
      </div>
      {online && streamUrl ? (
        <img className="cctv-feed" src={streamUrl} alt={label} />
      ) : (
        <div className="cctv-noise">
          <div className="cctv-cross" />
          <div className="cctv-offline">NVR NOT LINKED</div>
        </div>
      )}
      <div className="cctv-bot">
        <span>{label}</span>
        <span className="cctv-dot" />
      </div>
    </div>
  );
}

/** Standard KPI band — identical four-card shape on every dept dashboard. */
export function KpiBand({
  kpis,
}: {
  kpis: Array<{ label: string; value: string; sub: string; tone: 'ok' | 'warn' | 'bad' | 'info' }>;
}) {
  return (
    <div className="kpis">
      {kpis.map((k) => (
        <div className="kpi" key={k.label}>
          <div className="lab">{k.label}</div>
          <div className="val">
            {k.value} <span className={`mchip mc-${k.tone === 'bad' ? 'bad' : 'proj'}`} style={k.tone === 'ok' ? { display: 'none' } : undefined} />
          </div>
          <div className="sub">{k.sub}</div>
          <div className={`kpi-bar tone-${k.tone}`} />
        </div>
      ))}
    </div>
  );
}

/** Drawing title block — every page header reads like a sheet legend. */
export function SheetBar({ sheet, title, note }: { sheet: string; title: string; note?: string }) {
  return (
    <div className="sheetbar">
      <div className="cell code">
        <span>SHT</span>
        <b>{sheet}</b>
      </div>
      <div className="cell name">
        <span>TITLE</span>
        <b>{title}</b>
      </div>
      {note && (
        <div className="cell note">
          <span>NOTES</span>
          <b>{note}</b>
        </div>
      )}
      <div className="cell rev">
        <span>REV</span>
        <b>A</b>
      </div>
      <div className="cell date">
        <span>DATE</span>
        <b>{new Date().toLocaleDateString('en-PH', { year: '2-digit', month: 'short', day: '2-digit' }).toUpperCase()}</b>
      </div>
    </div>
  );
}
