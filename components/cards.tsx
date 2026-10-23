"use client";

import { useMemo, useState } from "react";
import {
  byWeekday,
  feesBreakdown,
  largest,
  loansSummary,
  recurring,
  topCounterparties,
} from "@/lib/aggregates";
import { fmtDay, fmtDayShort, fmtRange, kes, kesSigned, kesWhole, monthShort, weekdayName } from "@/lib/format";
import type { Coverage } from "@/lib/merge";
import type { Transaction } from "@/lib/types";
import { Card, CardHead, EmptyNote, initials, Seg } from "./bits";

type CardProps = { txs: Transaction[]; className?: string };

// ---- top counterparties ------------------------------------------------------

export function TopCounterpartiesCard({
  txs,
  onSelect,
  className = "",
}: CardProps & { onSelect: (key: string) => void }) {
  const [dir, setDir] = useState<"out" | "in">("out");
  const rows = useMemo(() => topCounterparties(txs, dir, 5), [txs, dir]);
  return (
    <Card className={className}>
      <CardHead
        title="Top counterparties"
        subtitle="Click to filter"
        right={
          <Seg<"out" | "in">
            label="Direction"
            value={dir}
            onChange={setDir}
            options={[{ value: "out", label: "Paid out" }, { value: "in", label: "Received" }]}
          />
        }
      />
      {rows.length === 0 ? (
        <EmptyNote>Nobody to show for these filters.</EmptyNote>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.key} className="border-b border-[#eef1ed] last:border-0">
              <button type="button" onClick={() => onSelect(r.key)} className="block w-full py-2.5 text-left">
                <span className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-bold text-brand-deep">
                    {initials(r.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.name}</span>
                    <span className="block text-[13px] text-mute">{r.count} {r.count === 1 ? "payment" : "payments"}</span>
                  </span>
                  <strong className="tabular-nums">{kesWhole(r.total)}</strong>
                </span>
                <span className="ml-12 mt-2 block h-1 rounded-sm bg-chip">
                  <span className="block h-1 rounded-sm bg-brand" style={{ width: `${Math.max(3, r.pct)}%` }} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---- busiest days ---------------------------------------------------------------

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function WeekdayCard({ txs, className = "" }: CardProps) {
  const days = useMemo(() => byWeekday(txs), [txs]);
  const max = Math.max(0, ...days.map((d) => d.total));
  const topDow = days.findIndex((d) => d.total === max);
  return (
    <Card className={className}>
      <CardHead title="Busiest days" subtitle="Spending by day of week" />
      {max === 0 ? (
        <EmptyNote>No spending for these filters.</EmptyNote>
      ) : (
        <>
          <div className="flex h-[130px] items-end gap-2" role="img" aria-label={`Spending by weekday, highest on ${weekdayName(topDow)}`}>
            {DAY_ORDER.map((dow) => {
              const d = days[dow];
              return (
                <div key={dow} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${weekdayName(dow)}: ${kesWhole(d.total)}`}>
                  <div
                    className={`w-full rounded-md ${dow === topDow ? "bg-amber" : "bg-[#c9d6cd]"}`}
                    style={{ height: `${Math.max(3, (d.total / max) * 100)}px` }}
                  />
                  <span className="text-xs text-mute">{weekdayName(dow)}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[13px] text-mute">{weekdayName(topDow)} is your heaviest spending day.</p>
        </>
      )}
    </Card>
  );
}

// ---- fees -------------------------------------------------------------------------

function ListRow({ title, sub, value }: { title: string; sub?: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-[#eef1ed] py-2.5 last:border-0">
      <span className="min-w-0">
        <span className="block truncate font-medium">{title}</span>
        {sub ? <span className="block text-[13px] text-mute">{sub}</span> : null}
      </span>
      <strong className="shrink-0 tabular-nums">{value}</strong>
    </li>
  );
}

export function FeesCard({ txs, className = "" }: CardProps) {
  const rows = useMemo(() => feesBreakdown(txs), [txs]);
  const total = rows.reduce((s, r) => s + r.total, 0);
  return (
    <Card className={className}>
      <CardHead title="Fees and charges" subtitle={rows.length ? `${kes(total)} paid to Safaricom` : "What you paid Safaricom"} />
      {rows.length === 0 ? (
        <EmptyNote>No fees for these filters.</EmptyNote>
      ) : (
        <ul>
          {rows.map((r) => (
            <ListRow key={r.type} title={r.label} sub={`${r.count} ${r.count === 1 ? "charge" : "charges"}`} value={kes(r.total)} />
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---- loans (Fuliza and Hustler Fund) ---------------------------------------------------

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-xl bg-ground p-3">
      <div className="text-[13px] text-mute">{label}</div>
      <div className="text-[17px] font-bold tabular-nums">{value}</div>
    </div>
  );
}

export function LoansCard({ txs, className = "" }: CardProps) {
  const s = useMemo(() => loansSummary(txs), [txs]);
  return (
    <Card className={className}>
      <CardHead title="Fuliza and loans" subtitle="Not counted as money in or out" />
      {!s.hasAny ? (
        <EmptyNote>No Fuliza or Hustler Fund activity here.</EmptyNote>
      ) : (
        <div className="flex flex-col gap-3">
          {s.fuliza.times > 0 ? (
            <>
              <h3 className="text-[13px] font-semibold">Fuliza</h3>
              <div className="flex gap-3">
                <Stat label="Borrowed" value={kesWhole(s.fuliza.borrowed)} />
                <Stat label="Repaid" value={kesWhole(s.fuliza.repaid)} />
              </div>
              <div className="flex gap-3">
                <Stat label="Times used" value={String(s.fuliza.times)} />
                <Stat label="Spent with Fuliza" value={kesWhole(s.fuliza.spendVia)} />
              </div>
            </>
          ) : null}
          {s.hustler.borrowed > 0 || s.hustler.repaid > 0 ? (
            <>
              <h3 className="text-[13px] font-semibold">Hustler Fund</h3>
              <div className="flex gap-3">
                <Stat label="Borrowed" value={kesWhole(s.hustler.borrowed)} />
                <Stat label="Repaid" value={kesWhole(s.hustler.repaid)} />
              </div>
            </>
          ) : null}
        </div>
      )}
    </Card>
  );
}

// ---- recurring ----------------------------------------------------------------------------

export function RecurringCard({ txs, className = "" }: CardProps) {
  const rows = useMemo(() => recurring(txs), [txs]);
  return (
    <Card className={className}>
      <CardHead title="Likely recurring" subtitle="Same payee, regular timing, similar amount" />
      {rows.length === 0 ? (
        <EmptyNote>None detected for these filters.</EmptyNote>
      ) : (
        <ul>
          {rows.map((r) => (
            <ListRow key={r.key} title={r.name} sub={`${r.cadence} · last ${fmtDayShort(r.lastDay)}`} value={kesWhole(r.typical)} />
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---- largest ----------------------------------------------------------------------------------

export function LargestCard({ txs, className = "" }: CardProps) {
  const rows = useMemo(() => largest(txs, 5), [txs]);
  return (
    <Card className={className}>
      <CardHead title="Largest transactions" subtitle="In this period" />
      {rows.length === 0 ? (
        <EmptyNote>No transactions for these filters.</EmptyNote>
      ) : (
        <ul>
          {rows.map((t) => (
            <ListRow
              key={t.id}
              title={t.counterparty ?? t.details}
              sub={`${fmtDay(t.day)} · ${t.category}`}
              value={kesSigned(t.amount)}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---- coverage -------------------------------------------------------------------------------------

const STATUS_STYLE = { full: "bg-brand", partial: "bg-[#6fc79a]", none: "bg-[#f2c58b]" } as const;
const STATUS_WORD = { full: "fully covered", partial: "partly covered", none: "missing" } as const;

/** Which months the saved statements cover, with any holes called out. */
export function CoverageStrip({ coverage }: { coverage: Coverage }) {
  if (!coverage.from || !coverage.to) return null;
  const count = coverage.months.length;
  const step = Math.max(1, Math.ceil(count / 12)); // at most about 12 labels
  return (
    <div>
      <div className="flex gap-1" role="img" aria-label={`Coverage ${fmtRange(coverage.from, coverage.to)}`}>
        {coverage.months.map((m, i) => (
          <div key={m.month} className="min-w-0 flex-1 text-center" title={`${m.month}: ${STATUS_WORD[m.status]}`}>
            <div className={`h-3.5 rounded ${STATUS_STYLE[m.status]}`} />
            {i % step === 0 ? (
              <span className={`whitespace-nowrap text-xs text-mute ${count > 6 ? "hidden sm:block" : "block"}`}>
                {monthShort(m.month)}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[13px] leading-relaxed text-mute">
        {coverage.missing.length > 0
          ? `Missing: ${coverage.missing.map((r) => fmtRange(r.from, r.to)).join(", ")}. Totals for those dates will look low.`
          : `Covers ${fmtRange(coverage.from, coverage.to)} with no gaps.`}
      </p>
    </div>
  );
}
