"use client";

// Lightweight SVG charts for the org reports page — no external deps.
// All text/labels are Persian; numbers rendered through the fa helpers by callers.

import { useState } from "react";
import { cn } from "@/lib";

/* ── helpers ─────────────────────────────────────────────── */

function niceMax(v: number): number {
  if (v <= 5) return 5;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / mag) * mag;
}

/* ── Line/area chart — daily trend ───────────────────────── */

export type TrendPoint = { label: string; sub?: string; value: number };

export function TrendChart({ points, unit = "جلسه" }: { points: TrendPoint[]; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 220, PAD = { t: 14, r: 10, b: 26, l: 34 };
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const n = points.length;
  if (n === 0) return <p className="py-8 text-center text-[12px] text-ink-faint">داده‌ای برای نمایش نیست</p>;

  const max = niceMax(Math.max(...points.map((p) => p.value), 1));
  const x = (i: number) => PAD.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${(PAD.t + ih).toFixed(1)} L${x(0).toFixed(1)},${(PAD.t + ih).toFixed(1)} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const labelEvery = Math.max(1, Math.ceil(n / 8));

  return (
    <div className="relative w-full" dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="stroke-black/10" strokeWidth="1" strokeDasharray={t === 0 ? "" : "3 4"} />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" className="fill-black/40" fontSize="10">{t}</text>
          </g>
        ))}
        <path d={area} className="fill-accent/10" />
        <path d={line} className="stroke-accent" strokeWidth="2.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r={hover === i ? 5 : 3} className={cn(hover === i ? "fill-accent" : "fill-accent/70", "stroke-white")} strokeWidth="1.5" />
            <rect
              x={x(i) - iw / Math.max(n, 1) / 2} y={PAD.t} width={Math.max(iw / Math.max(n, 1), 8)} height={ih}
              fill="transparent" className="cursor-pointer"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            />
            {i % labelEvery === 0 && (
              <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-black/40" fontSize="10">{p.label}</text>
            )}
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute -top-1 right-2 rounded-md border border-line bg-white px-2.5 py-1.5 text-[11px] shadow-sm" dir="rtl">
          <span className="font-medium">{points[hover].sub ?? points[hover].label}</span>
          <span className="mx-1 text-ink-faint">·</span>
          <span className="text-accent">{points[hover].value.toLocaleString("fa-IR")} {unit}</span>
        </div>
      )}
    </div>
  );
}

/* ── Donut chart — branch share ──────────────────────────── */

export type SliceItem = { label: string; value: number };

const DONUT_COLORS = ["#1f2937", "#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316"];

export function DonutChart({ items, unit = "جلسه" }: { items: SliceItem[]; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = items.reduce((a, b) => a + b.value, 0);
  if (total === 0) return <p className="py-8 text-center text-[12px] text-ink-faint">داده‌ای برای نمایش نیست</p>;

  const R = 54, C = 2 * Math.PI * R;
  let acc = 0;
  const arcs = items.map((it, i) => {
    const frac = it.value / total;
    const seg = { it, i, dash: frac * C, offset: acc, frac };
    acc += frac * C;
    return seg;
  });
  const hovered = hover !== null ? arcs[hover] : null;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <div className="relative shrink-0" dir="ltr">
        <svg viewBox="0 0 140 140" className="h-40 w-40">
          <circle cx="70" cy="70" r={R} fill="none" className="stroke-black/5" strokeWidth="18" />
          {arcs.map((a) => (
            <circle
              key={a.i}
              cx="70" cy="70" r={R} fill="none"
              stroke={DONUT_COLORS[a.i % DONUT_COLORS.length]}
              strokeWidth={hover === a.i ? 22 : 18}
              strokeDasharray={`${a.dash} ${C - a.dash}`}
              strokeDashoffset={-a.offset}
              transform="rotate(-90 70 70)"
              className="cursor-pointer transition-all"
              onMouseEnter={() => setHover(a.i)} onMouseLeave={() => setHover(null)}
            />
          ))}
          <text x="70" y="66" textAnchor="middle" className="fill-black/50" fontSize="11">{hovered ? hovered.it.label.slice(0, 14) : "جمع کل"}</text>
          <text x="70" y="84" textAnchor="middle" className="fill-black font-bold" fontSize="16">
            {(hovered ? hovered.it.value : total).toLocaleString("fa-IR")}
          </text>
        </svg>
      </div>
      <ul className="w-full max-w-56 space-y-1.5" dir="rtl">
        {arcs.map((a) => (
          <li
            key={a.i}
            className={cn("flex cursor-pointer items-center justify-between rounded px-2 py-1 text-[12px] transition-colors", hover === a.i ? "bg-paper-soft" : "")}
            onMouseEnter={() => setHover(a.i)} onMouseLeave={() => setHover(null)}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[a.i % DONUT_COLORS.length] }} />
              <span className="truncate">{a.it.label}</span>
            </span>
            <span className="shrink-0 text-ink-soft">{a.it.value.toLocaleString("fa-IR")} {unit} · ٪{Math.round(a.frac * 100).toLocaleString("fa-IR")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Horizontal weighted bars — room utilization ─────────── */

export function BarList({ items, unit }: { items: { label: string; sub?: string; value: number; valueLabel: string }[]; unit?: string }) {
  if (items.length === 0) return <p className="py-8 text-center text-[12px] text-ink-faint">داده‌ای برای نمایش نیست</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-3" dir="rtl">
      {items.map((it) => (
        <div key={it.label + (it.sub ?? "")}>
          <div className="mb-1 flex items-center justify-between text-[12px]">
            <span className="font-medium">
              {it.label}
              {it.sub && <span className="mr-1.5 text-[10px] text-ink-faint">({it.sub})</span>}
            </span>
            <span className="text-ink-soft">{it.valueLabel}{unit ? ` · ${unit}` : ""}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-paper-soft">
            <div
              className="h-2 rounded-full bg-accent transition-all"
              style={{ width: `${Math.max(3, (it.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
