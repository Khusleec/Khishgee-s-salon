'use client';

import { mnt, kmnt, type SeriesPoint } from './lib';
import { useIsMobile } from './ui';

/* =========================================================================
   График — хуучин admin.ts-ийн barChart/hbars-ийг React болгож буулгав
   ========================================================================= */

export function BarChart({ series, k = 'revenue' }: { series: SeriesPoint[]; k?: 'revenue' | 'orders' }) {
  // Утсанд viewBox-ыг нарийсгаж, бичиг жижгэрч уншигдахгүй болохоос сэргийлнэ
  const compact = useIsMobile();
  const W = compact ? 360 : 720;
  const H = compact ? 210 : 230;
  const padL = compact ? 42 : 52, padB = 24, padT = 12, padR = 8;
  const max = Math.max(1, ...series.map((s) => s[k]));
  const cw = (W - padL - padR) / series.length;
  const bw = Math.min(34, cw * 0.6);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Сүүлийн 14 хоногийн борлуулалт">
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9506e" /><stop offset="1" stopColor="#7b2e52" />
        </linearGradient>
      </defs>
      {(compact ? [0, .5, 1] : [0, .25, .5, .75, 1]).map((t) => {
        const v = max * t;
        const y = padT + (H - padT - padB) * (1 - t);
        return (
          <g key={t}>
            <line className="grid-line" x1={padL} y1={y} x2={W - padR} y2={y} />
            <text className="axis" x={padL - 8} y={y + 4} textAnchor="end">{kmnt(Math.round(v))}</text>
          </g>
        );
      })}
      {series.map((s, i) => {
        const h = Math.max(2, (H - padT - padB) * (s[k] / max));
        const x = padL + cw * i + (cw - bw) / 2;
        const y = H - padB - h;
        return (
          <g key={i}>
            <rect className="bar" x={x} y={y} width={bw} height={h} rx={5}>
              <title>{`${s.label}: ${mnt(s.revenue)} · ${s.orders} захиалга`}</title>
            </rect>
            <text className="axis" x={x + bw / 2} y={H - padB + 15} textAnchor="middle">{s.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function HBars({ rows }: { rows: { label: string; value: number; display: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <>
      {rows.map((r, i) => (
        <div className="hbar-row" key={i}>
          <span>{r.label}</span><b>{r.display}</b>
          <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(r.value / max * 100).toFixed(1)}%` }} /></div>
        </div>
      ))}
    </>
  );
}
