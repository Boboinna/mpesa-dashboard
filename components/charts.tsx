"use client";

import { useId, useState, type MouseEvent } from "react";
import type { BalancePoint, Bucket, CategoryRow, FlowPoint } from "@/lib/aggregates";
import { compact, kes, kesWhole } from "@/lib/format";
import type { Category } from "@/lib/types";
import { Card, CardHead, EmptyNote, Seg } from "./bits";

// Hand-drawn SVG charts: no chart library, full control over click-to-filter.

/** Round axis ceiling and tick values (all in cents). */
function niceScale(maxCents: number, wanted = 4): { top: number; ticks: number[] } {
  const max = Math.max(maxCents, 100);
  const rough = max / wanted;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const f = rough / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-6; v += step) ticks.push(Math.round(v));
  return { top, ticks };
}

function svgX(e: MouseEvent<SVGSVGElement>, width: number): number {
  const r = e.currentTarget.getBoundingClientRect();
  return ((e.clientX - r.left) / (r.width || 1)) * width;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function Tooltip({ left, children }: { left: number; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-[10px] bg-ink px-3 py-2 text-xs text-white shadow-lg"
      style={{ left: `${clamp(left, 14, 86)}%` }}
    >
      {children}
    </div>
  );
}

// ---- cash flow ---------------------------------------------------------------

export function CashFlowCard({
  data,
  bucket,
  onBucket,
  onSelect,
  className = "",
}: {
  data: FlowPoint[];
  bucket: Bucket;
  onBucket: (b: Bucket) => void;
  onSelect: (p: FlowPoint) => void;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 760, H = 260, L = 50, R = 10, T = 12, B = 30;
  const plotW = W - L - R;
  const plotH = H - T - B;
  const n = data.length;
  const max = Math.max(0, ...data.flatMap((d) => [d.in, d.out]));
  const { top, ticks } = niceScale(max);
  const gw = n ? plotW / n : plotW;
  const bw = Math.max(2, Math.min(22, gw * 0.34));
  const y = (v: number) => T + plotH - (v / top) * plotH;
  const every = Math.max(1, Math.ceil(n / 12));
  const idx = (e: MouseEvent<SVGSVGElement>) => {
    const i = Math.floor((svgX(e, W) - L) / gw);
    return i >= 0 && i < n ? i : null;
  };
  const h = hover !== null ? data[hover] : null;

  return (
    <Card className={className}>
      <CardHead
        title="Cash flow"
        subtitle="Money in and out. Click a bar to filter."
        right={
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-3 text-[13px] text-mute">
              <span className="flex items-center gap-1.5"><i className="block size-2.5 rounded-sm bg-brand" />In</span>
              <span className="flex items-center gap-1.5"><i className="block size-2.5 rounded-sm bg-amber" />Out</span>
            </span>
            <Seg<Bucket>
              label="Group by"
              value={bucket}
              onChange={onBucket}
              options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]}
            />
          </div>
        }
      />
      {n === 0 ? (
        <EmptyNote>No money in or out for these filters.</EmptyNote>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            role="img"
            aria-label={`Money in and out by ${bucket}, ${n} periods`}
            className="cursor-pointer"
            onMouseMove={(e) => setHover(idx(e))}
            onMouseLeave={() => setHover(null)}
            onClick={(e) => {
              const i = idx(e);
              if (i !== null) onSelect(data[i]);
            }}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#E3E7E1" />
                <text x={L - 8} y={y(t) + 4} fontSize="12" fill="#5B665F" textAnchor="end">{compact(t)}</text>
              </g>
            ))}
            {hover !== null ? (
              <rect x={L + hover * gw} y={T} width={gw} height={plotH} rx="6" fill="#F1F5F2" />
            ) : null}
            {data.map((d, i) => {
              const cx = L + i * gw + gw / 2;
              return (
                <g key={d.key}>
                  {d.in > 0 ? <rect x={cx - bw - 1} y={y(d.in)} width={bw} height={y(0) - y(d.in)} rx={bw > 6 ? 3 : 1} fill="#0E7C4A" /> : null}
                  {d.out > 0 ? <rect x={cx + 1} y={y(d.out)} width={bw} height={y(0) - y(d.out)} rx={bw > 6 ? 3 : 1} fill="#E39A4B" /> : null}
                  {i % every === 0 ? (
                    <text x={cx} y={H - 10} fontSize="12" fill="#5B665F" textAnchor="middle">{d.label}</text>
                  ) : null}
                </g>
              );
            })}
          </svg>
          {h ? (
            <Tooltip left={((L + (hover! + 0.5) * gw) / W) * 100}>
              <div className="font-bold">{h.title}</div>
              <div className="text-[#7be0a6]">In {kesWhole(h.in)}</div>
              <div className="text-[#f2c58b]">Out {kesWhole(h.out)}</div>
            </Tooltip>
          ) : null}
        </div>
      )}
    </Card>
  );
}

// ---- balance over time ---------------------------------------------------------

export function BalanceCard({
  points,
  mode,
  onMode,
  className = "",
}: {
  points: BalancePoint[];
  mode: "daily" | "monthly";
  onMode: (m: "daily" | "monthly") => void;
  className?: string;
}) {
  const gid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 760, H = 250, L = 50, R = 14, T = 12, B = 30;
  const plotW = W - L - R;
  const plotH = H - T - B;
  const n = points.length;
  const lo = Math.min(0, ...points.map((p) => p.balance));
  const hi = Math.max(0, ...points.map((p) => p.balance));
  const { top, ticks } = niceScale(hi - lo);
  const floor = lo < 0 ? -niceScale(-lo).top : 0;
  const span = top - floor || 1;
  const y = (v: number) => T + plotH - ((v - floor) / span) * plotH;
  const x = (i: number) => (n === 1 ? L + plotW / 2 : L + (i * plotW) / (n - 1));
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`).join(" ");
  const tickVals = lo < 0 ? [...new Set([floor, ...ticks.map((t) => t + floor)])] : ticks;
  const labelEvery = Math.max(1, Math.ceil(n / 6));
  const h = hover !== null ? points[hover] : null;
  const nearest = (e: MouseEvent<SVGSVGElement>) => {
    if (n === 1) return 0;
    return clamp(Math.round(((svgX(e, W) - L) / plotW) * (n - 1)), 0, n - 1);
  };

  return (
    <Card className={className}>
      <CardHead
        title="Balance over time"
        subtitle="Running balance from your statement"
        right={
          <Seg<"daily" | "monthly">
            label="Balance detail"
            value={mode}
            onChange={onMode}
            options={[{ value: "daily", label: "Daily" }, { value: "monthly", label: "Monthly" }]}
          />
        }
      />
      {n === 0 ? (
        <EmptyNote>No balance data for these filters.</EmptyNote>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            role="img"
            aria-label={`Balance over time, ${n} points. Latest ${kes(points[n - 1].balance)}`}
            onMouseMove={(e) => setHover(nearest(e))}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#0E7C4A" stopOpacity="0.25" />
                <stop offset="1" stopColor="#0E7C4A" stopOpacity="0" />
              </linearGradient>
            </defs>
            {tickVals.map((t) => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#E3E7E1" />
                <text x={L - 8} y={y(t) + 4} fontSize="12" fill="#5B665F" textAnchor="end">{compact(t)}</text>
              </g>
            ))}
            {n > 1 ? <polygon points={`${x(0)},${y(floor)} ${line} ${x(n - 1)},${y(floor)}`} fill={`url(#${gid})`} /> : null}
            {n > 1 ? <polyline points={line} fill="none" stroke="#0E7C4A" strokeWidth="2.5" strokeLinejoin="round" /> : null}
            {points.map((p, i) =>
              i % labelEvery === 0 ? (
                <text key={p.key} x={x(i)} y={H - 10} fontSize="12" fill="#5B665F" textAnchor="middle">{p.label}</text>
              ) : null,
            )}
            {hover !== null ? (
              <>
                <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + plotH} stroke="#9AA6A0" strokeDasharray="3 3" />
                <circle cx={x(hover)} cy={y(points[hover].balance)} r="5" fill="#0E7C4A" stroke="#fff" strokeWidth="2" />
              </>
            ) : (
              <circle cx={x(n - 1)} cy={y(points[n - 1].balance)} r="5" fill="#0E7C4A" stroke="#fff" strokeWidth="2" />
            )}
          </svg>
          {h ? (
            <Tooltip left={(x(hover!) / W) * 100}>
              <div className="font-bold">{h.label}</div>
              <div>{kes(h.balance)}</div>
            </Tooltip>
          ) : null}
        </div>
      )}
    </Card>
  );
}

// ---- spending by category --------------------------------------------------------

const PALETTE = ["#0E7C4A", "#6FC79A", "#E39A4B", "#5B8DEF", "#A13A12", "#7A5BD1", "#9AA6A0", "#C9D6CD"];

export function CategoryCard({
  rows,
  onSelect,
  className = "",
}: {
  rows: CategoryRow[];
  onSelect: (c: Category) => void;
  className?: string;
}) {
  const total = rows.reduce((s, r) => s + r.total, 0);
  const r = 62;
  const C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <Card className={className}>
      <CardHead title="Where it went" subtitle="Spending by category. Loans and savings excluded." />
      {rows.length === 0 ? (
        <EmptyNote>No spending for these filters.</EmptyNote>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <svg viewBox="0 0 160 160" width="170" role="img" aria-label="Spending by category">
            <g transform="rotate(-90 80 80)" fill="none" strokeWidth="22">
              {rows.map((row, i) => {
                const len = (C * row.total) / (total || 1);
                const el = (
                  <circle
                    key={row.category}
                    cx="80"
                    cy="80"
                    r={r}
                    stroke={PALETTE[Math.min(i, PALETTE.length - 1)]}
                    strokeDasharray={`${Math.max(0, len - 2)} ${C - Math.max(0, len - 2)}`}
                    strokeDashoffset={-offset}
                    className="cursor-pointer"
                    onClick={() => onSelect(row.category)}
                  />
                );
                offset += len;
                return el;
              })}
            </g>
            <text x="80" y="76" textAnchor="middle" fontSize="12" fill="#5B665F">Total out</text>
            <text x="80" y="98" textAnchor="middle" fontSize="20" fontWeight="700" fill="#14211A">{compact(total)}</text>
          </svg>
          <ul className="w-full">
            {rows.map((row, i) => (
              <li key={row.category}>
                <button
                  type="button"
                  onClick={() => onSelect(row.category)}
                  className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left text-[13px] hover:bg-ground"
                >
                  <span className="flex items-center gap-2">
                    <i className="block size-2.5 rounded-[3px]" style={{ background: PALETTE[Math.min(i, PALETTE.length - 1)] }} />
                    {row.category}
                  </span>
                  <span className="text-mute">{Math.round(row.pct)}% · {kesWhole(row.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
