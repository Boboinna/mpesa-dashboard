"use client";

import { useMemo, useState } from "react";
import {
  balanceSeries,
  byCategory,
  cashFlow,
  dateBounds,
  previousRange,
  summarize,
  type Bucket,
  type FlowPoint,
} from "@/lib/aggregates";
import { applyFilters, resolveRange, useFilters } from "@/lib/filters";
import { addDays, dayNum, fmtRange, monthRange } from "@/lib/format";
import { useStore } from "@/lib/store";
import { Button, Card, CardHead, Icon } from "./bits";
import { BalanceCard, CashFlowCard, CategoryCard } from "./charts";
import {
  CoverageStrip,
  FeesCard,
  LargestCard,
  LoansCard,
  RecurringCard,
  TopCounterpartiesCard,
  WeekdayCard,
} from "./cards";
import { FilterBar } from "./filter-bar";
import { KpiCards } from "./kpi-cards";

function autoBucket(days: number): Bucket {
  return days <= 62 ? "day" : days <= 200 ? "week" : "month";
}

export function Dashboard() {
  const { activeTransactions: all, coverage, state } = useStore();
  const { filters, set, reset } = useFilters();
  const [bucketPick, setBucketPick] = useState<Bucket | null>(null);
  const [balancePick, setBalancePick] = useState<"daily" | "monthly" | null>(null);

  const bounds = useMemo(() => dateBounds(all), [all]);
  const filtered = useMemo(() => applyFilters(all, filters, bounds), [all, filters, bounds]);
  const range = resolveRange(filters, bounds);
  const from = range.from ?? bounds.earliest;
  const to = range.to ?? bounds.latest;
  const span = from && to ? dayNum(to) - dayNum(from) + 1 : 0;
  const bucket = bucketPick ?? autoBucket(span);
  const balanceMode = balancePick ?? (span > 400 ? "monthly" : "daily");

  const summary = useMemo(() => summarize(filtered), [filtered]);
  const prev = useMemo(() => {
    if (!from || !to) return null;
    const p = previousRange(from, to);
    const s = summarize(applyFilters(all, { ...filters, preset: "custom", from: p.from, to: p.to }, bounds));
    return s.count > 0 ? s : null;
  }, [all, filters, bounds, from, to]);

  const flow = useMemo(() => cashFlow(filtered, bucket), [filtered, bucket]);
  const monthly = useMemo(() => cashFlow(filtered, "month"), [filtered]);
  const balance = useMemo(() => balanceSeries(filtered, balanceMode), [filtered, balanceMode]);
  const balanceMonthly = useMemo(() => balanceSeries(filtered, "monthly"), [filtered]);
  const categories = useMemo(() => byCategory(filtered), [filtered]);
  const asOf = useMemo(() => dateBounds(filtered).latest, [filtered]);

  const imports = state.imports.filter((i) => i.accountId === state.activeAccountId);
  const unverified = imports.filter((i) => i.verification !== "verified").length;

  const selectBucket = (p: FlowPoint) => {
    const r =
      bucket === "month" ? monthRange(p.key) : bucket === "week" ? { from: p.key, to: addDays(p.key, 6) } : { from: p.key, to: p.key };
    set({ preset: "custom", from: r.from, to: r.to });
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-10">
      <FilterBar txs={all} />

      {coverage.missing.length > 0 || unverified > 0 ? (
        <div className="mb-5 flex flex-col gap-2 rounded-xl border border-[#f2c58b] bg-[#fff8ee] p-4 text-sm" role="note">
          {coverage.missing.length > 0 ? (
            <p className="flex gap-2">
              <Icon name="alert" size={16} />
              <span>
                Missing statement dates: {coverage.missing.map((r) => fmtRange(r.from, r.to)).join(", ")}. Totals for those
                dates will look low.
              </span>
            </p>
          ) : null}
          {unverified > 0 ? (
            <p className="flex gap-2">
              <Icon name="alert" size={16} />
              <span>
                {unverified} saved {unverified === 1 ? "statement" : "statements"} didn’t fully verify, so some totals may be
                slightly off.
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <Card className="text-center">
          <CardHead title="Nothing matches these filters" />
          <p className="mb-4 text-sm text-mute">Try a wider date range or remove a filter.</p>
          <Button variant="primary" onClick={reset}>
            Reset all filters
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <KpiCards summary={summary} prev={prev} flow={monthly} balance={balanceMonthly} asOf={asOf} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <CashFlowCard className="lg:col-span-8" data={flow} bucket={bucket} onBucket={setBucketPick} onSelect={selectBucket} />
            <CategoryCard className="lg:col-span-4" rows={categories} onSelect={(c) => set({ cats: [c] })} />
            <BalanceCard className="lg:col-span-8" points={balance} mode={balanceMode} onMode={setBalancePick} />
            <TopCounterpartiesCard className="lg:col-span-4" txs={filtered} onSelect={(key) => set({ cp: key })} />
            <WeekdayCard className="lg:col-span-4" txs={filtered} />
            <FeesCard className="lg:col-span-4" txs={filtered} />
            <LoansCard className="lg:col-span-4" txs={filtered} />
            <RecurringCard className="lg:col-span-6" txs={filtered} />
            <LargestCard className="lg:col-span-6" txs={filtered} />
            <Card className="lg:col-span-12">
              <CardHead title="Statement coverage" subtitle="Which dates your saved statements cover" />
              <CoverageStrip coverage={coverage} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
