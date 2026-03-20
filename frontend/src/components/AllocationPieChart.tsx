import { useMemo } from "react";

export type PieSegment = {
  key: string;
  label: string;
  fraction: number;
};

const DEFAULT_COLORS = [
  "var(--accent)",
  "var(--accent2)",
  "#a08bd6",
  "#e8a049",
  "#5b9bd5",
  "#6eb589",
  "#e878a8",
  "#8ab8e0",
];

function polar(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function wedgePath(cx: number, cy: number, r: number, startRad: number, endRad: number): string {
  const sweep = endRad - startRad;
  if (sweep <= 1e-6) return "";
  if (sweep >= 2 * Math.PI - 1e-6) return "";
  const p0 = polar(cx, cy, r, startRad);
  const p1 = polar(cx, cy, r, endRad);
  const largeArc = sweep > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${largeArc} 1 ${p1.x} ${p1.y} Z`;
}

function normalizeSegments(segments: PieSegment[]): PieSegment[] {
  const positive = segments.map((s) => ({
    ...s,
    fraction: Math.max(0, Number.isFinite(s.fraction) ? s.fraction : 0),
  }));
  const sum = positive.reduce((a, s) => a + s.fraction, 0);
  if (sum <= 1e-9) return [];
  return positive
    .map((s) => ({ ...s, fraction: s.fraction / sum }))
    .filter((s) => s.fraction > 1e-5);
}

type Props = {
  segments: PieSegment[];
  title?: string;
  size?: number;
  className?: string;
};

export function AllocationPieChart({ segments, title, size = 176, className = "" }: Props) {
  const normalized = useMemo(() => normalizeSegments(segments), [segments]);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const innerR = size * 0.2;

  const slices = useMemo(() => {
    if (normalized.length === 0) return [];
    let angle = -Math.PI / 2;
    return normalized.map((seg, i) => {
      const sweep = seg.fraction * 2 * Math.PI;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      return { seg, start, end, i, color: DEFAULT_COLORS[i % DEFAULT_COLORS.length] };
    });
  }, [normalized]);

  const singleFull =
    normalized.length === 1 && normalized[0] != null && normalized[0].fraction >= 1 - 1e-6;

  if (normalized.length === 0) {
    return (
      <div className={`allocation-pie allocation-pie--empty ${className}`.trim()}>
        {title ? <div className="allocation-pie__title">{title}</div> : null}
        <p className="muted small mono allocation-pie__empty">No weights to chart</p>
      </div>
    );
  }

  return (
    <div className={`allocation-pie ${className}`.trim()}>
      {title ? <div className="allocation-pie__title">{title}</div> : null}
      <div className="allocation-pie__inner">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="allocation-pie__svg"
          role="img"
          aria-label={title ?? "Allocation chart"}
        >
          {singleFull ? (
            <>
              <circle cx={cx} cy={cy} r={r} fill={DEFAULT_COLORS[0]} />
              <circle cx={cx} cy={cy} r={innerR} fill="var(--bg1)" />
            </>
          ) : (
            <>
              {slices.map(({ seg, start, end, color }) => {
                const d = wedgePath(cx, cy, r, start, end);
                if (!d) return null;
                return (
                  <path
                    key={seg.key}
                    d={d}
                    fill={color}
                    stroke="var(--bg1)"
                    strokeWidth={1.25}
                    opacity={0.96}
                  />
                );
              })}
              <circle cx={cx} cy={cy} r={innerR} fill="var(--bg1)" />
            </>
          )}
        </svg>
        <ul className="allocation-pie__legend">
          {normalized.map((seg, i) => (
            <li key={seg.key} className="allocation-pie__legend-row">
              <span
                className="allocation-pie__swatch"
                style={{ background: DEFAULT_COLORS[i % DEFAULT_COLORS.length] }}
                aria-hidden
              />
              <span className="allocation-pie__legend-label">{seg.label}</span>
              <span className="mono sm allocation-pie__legend-pct">{(seg.fraction * 100).toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
