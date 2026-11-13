import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Badge, Text, tokens } from '@fluentui/react-components';

export type LiveSample = { t: number; values: Record<string, number> };

/** Append a sample when its timestamp or values change. Keeps the last `capacity` points. */
export function useLiveSamples(point: LiveSample | null, capacity = 60): LiveSample[] {
  const [points, setPoints] = useState<LiveSample[]>([]);
  const seen = useRef('');
  useEffect(() => {
    if (!point) return;
    const sig = `${point.t}|${Object.keys(point.values).sort().map(k => point.values[k]).join(',')}`;
    if (seen.current === sig) return;
    seen.current = sig;
    setPoints(prev => {
      const next = [...prev, point];
      return next.length > capacity ? next.slice(next.length - capacity) : next;
    });
  }, [point, capacity]);
  return points;
}

export type ChartSeries = {
  id: string;
  label: string;
  color: string;
  values: number[];
  format?: (n: number) => string;
};

function pathFor(values: number[], min: number, span: number, w: number, h: number, padL: number, padB: number) {
  if (values.length === 0) return '';
  const innerW = Math.max(1, w - padL - 8);
  const innerH = Math.max(1, h - padB - 10);
  return values.map((v, i) => {
    const x = padL + (values.length === 1 ? innerW : (i / (values.length - 1)) * innerW);
    const y = 8 + innerH - ((v - min) / span) * innerH;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

export function LiveChart({
  title,
  subtitle,
  series,
  height = 168,
  yMax,
  yMin = 0,
  unit,
}: {
  title: string;
  subtitle?: string;
  series: ChartSeries[];
  height?: number;
  yMax?: number;
  yMin?: number;
  unit?: string;
}) {
  const gid = useId().replace(/:/g, '');
  const longest = Math.max(1, ...series.map(s => s.values.length));
  const flat = series.flatMap(s => s.values);
  const dataMax = flat.length ? Math.max(...flat) : 0;
  const dataMin = flat.length ? Math.min(...flat) : 0;
  const max = yMax ?? Math.max(dataMax, yMin + 1);
  const min = Math.min(yMin, dataMin);
  const span = max - min || 1;
  const w = 640;
  const padL = 46;
  const padB = 18;
  const ticks = [max, min + span / 2, min];

  const geometry = useMemo(() => series.map(s => {
    const line = pathFor(s.values, min, span, w, height, padL, padB);
    const innerW = Math.max(1, w - padL - 8);
    const lastX = padL + (s.values.length <= 1 ? innerW : innerW);
    const last = s.values.at(-1);
    const innerH = Math.max(1, height - padB - 10);
    const lastY = last == null ? 0 : 8 + innerH - ((last - min) / span) * innerH;
    const baseY = 8 + innerH;
    const area = line && s.values.length > 1
      ? `${line} L${lastX.toFixed(1)},${baseY.toFixed(1)} L${padL},${baseY.toFixed(1)} Z`
      : '';
    return { ...s, line, area, lastX, lastY, last };
  }), [series, min, span, height]);

  const fmt = (n: number) => {
    if (unit === '%') return `${n.toFixed(n >= 10 ? 0 : 1)}%`;
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}G`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000) return `${(n / 1000).toFixed(0)}k`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n >= 10 ? n.toFixed(0) : n.toFixed(1);
  };

  return (
    <figure className="fg-chart">
      <figcaption className="fg-chart-head">
        <div>
          <Text weight="semibold">{title}</Text>
          {subtitle && <div className="fg-chart-sub">{subtitle}</div>}
        </div>
        <div className="fg-chart-legend">
          {geometry.map(s => (
            <Badge key={s.id} appearance="outline" color="informative">
              <span className="fg-swatch" style={{ background: s.color }} />
              {s.label} {s.last == null ? '—' : (s.format ? s.format(s.last) : fmt(s.last))}
            </Badge>
          ))}
        </div>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${height}`} role="img" aria-label={title} className="fg-chart-svg">
        {ticks.map((tick, i) => {
          const innerH = Math.max(1, height - padB - 10);
          const y = 8 + innerH - ((tick - min) / span) * innerH;
          return (
            <g key={i}>
              <line x1={padL} x2={w - 8} y1={y} y2={y} className="fg-gridline" />
              <text x={padL - 6} y={y + 3} textAnchor="end" className="fg-axis">{fmt(tick)}</text>
            </g>
          );
        })}
        <text x={padL} y={height - 2} className="fg-axis">−{Math.max(1, Math.round((longest * 3) / 60))}m</text>
        <text x={w - 8} y={height - 2} textAnchor="end" className="fg-axis">now</text>
        {geometry.map(s => (
          <g key={s.id}>
            {s.area && <path d={s.area} fill={`url(#${gid}-${s.id})`} />}
            {s.line && <path d={s.line} fill="none" stroke={s.color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />}
            {s.last != null && s.values.length > 0 && <circle cx={s.lastX} cy={s.lastY} r={3.2} fill={s.color} />}
          </g>
        ))}
        <defs>
          {geometry.map(s => (
            <linearGradient key={s.id} id={`${gid}-${s.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>
      </svg>
      {longest < 2 && <div className="fg-chart-wait" style={{ color: tokens.colorNeutralForeground3 }}>Collecting samples… the trace fills as the 3-second poll arrives.</div>}
    </figure>
  );
}
