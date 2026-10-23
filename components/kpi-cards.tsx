"use client";

import type { BalancePoint, FlowPoint, Summary } from "@/lib/aggregates";
import { fmtDay, kesSigned, kesWhole, pctChange } from "@/lib/format";
import { Card } from "./bits";

function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 3) return <span className="h-7 w-16" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values
    .map((v, i) => `${((i * 64) / (values.length - 1)).toFixed(0)},${(26 - ((v - min) / (max - min || 1)) * 22).toFixed(0)}`)
    .join(" ");
  return (
    <svg width="64" height="28" viewBox="0 0 64 28" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Tone = "good" | "bad" | "flat";
const TONE: Record<Tone, string> = {
  good: "bg-brand-soft text-brand-deep",
  bad: "bg-[#fdecea] text-bad",
  flat: "bg-chip text-[#4b574f]",
};

function Delta({ text, tone }: { text: string; tone: Tone }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${TONE[tone]}`}>{text}</span>;
}

function pct(cur: number, prev: number, upIsGood: boolean): { text: string; tone: Tone } | null {
  const p = pctChange(cur, prev);
  if (p === null) return null;
  const rounded = Math.round(p * 10) / 10;
  if (rounded === 0) return { text: "0%", tone: "flat" };
  const good = upIsGood ? rounded > 0 : rounded < 0;
  return { text: `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}%`, tone: good ? "good" : "bad" };
}

function Kpi({
  label,
  value,
  valueClass = "",
  delta,
  spark,
  sub,
}: {
  label: string;
  value: string;
  valueClass?: string;
  delta?: { text: string; tone: Tone } | null;
  spark?: React.ReactNode;
  sub?: string;
}) {
  return (
    <Card className="!p-4">
      <div className="text-[13px] text-mute">{label}</div>
      <div className={`mb-2.5 mt-1.5 text-[22px] font-bold tracking-tight tabular-nums ${valueClass}`}>{value}</div>
      <div className="flex min-h-7 items-center justify-between gap-2">
        {delta ? <Delta text={delta.text} tone={delta.tone} /> : sub ? <span className="text-xs text-mute">{sub}</span> : <span />}
        {spark}
      </div>
    </Card>
  );
}

export function KpiCards({
  summary,
  prev,
  flow,
  balance,
  asOf,
}: {
  summary: Summary;
  prev: Summary | null;
  flow: FlowPoint[];
  balance: BalancePoint[];
  asOf: string | null;
}) {
  const s = summary;
  const netDelta = prev ? s.net - prev.net : null;
  const countDelta = prev ? s.count - prev.count : null;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Kpi
        label="Money in"
        value={kesWhole(s.moneyIn)}
        valueClass="text-pos"
        delta={prev ? pct(s.moneyIn, prev.moneyIn, true) : null}
        spark={<Spark values={flow.map((f) => f.in)} color="#0E7C4A" />}
      />
      <Kpi
        label="Money out"
        value={kesWhole(s.moneyOut)}
        valueClass="text-neg"
        delta={prev ? pct(s.moneyOut, prev.moneyOut, false) : null}
        spark={<Spark values={flow.map((f) => f.out)} color="#E39A4B" />}
      />
      <Kpi
        label="Net (after fees)"
        value={kesSigned(s.net)}
        delta={netDelta === null ? null : { text: kesSigned(netDelta), tone: netDelta >= 0 ? "good" : "bad" }}
        spark={<Spark values={flow.map((f) => f.in - f.out)} color="#0E7C4A" />}
      />
      <Kpi label="Fees paid" value={kesWhole(s.fees)} delta={prev ? pct(s.fees, prev.fees, false) : null} />
      <Kpi
        label="Transactions"
        value={s.count.toLocaleString("en-US")}
        delta={countDelta === null ? null : { text: `${countDelta >= 0 ? "+" : ""}${countDelta.toLocaleString("en-US")}`, tone: "flat" }}
      />
      <Kpi
        label="Balance, end of period"
        value={s.endBalance === null ? "–" : kesWhole(s.endBalance)}
        sub={asOf ? `As of ${fmtDay(asOf)}` : undefined}
        spark={<Spark values={balance.map((b) => b.balance)} color="#0E7C4A" />}
      />
    </div>
  );
}
