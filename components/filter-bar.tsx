"use client";

import { useMemo } from "react";
import { dateBounds } from "@/lib/aggregates";
import { ALL_CATEGORIES, resolveRange, useFilters, type Direction, type Preset } from "@/lib/filters";
import { fmtRange } from "@/lib/format";
import type { Category, Transaction } from "@/lib/types";
import { Button, FIELD, Icon, Seg } from "./bits";

type Chip = { id: string; label: string; remove: () => void };

/**
 * Filter controls shared by both tabs. Everything reads and writes the same
 * filter state (kept in the page address), so every widget agrees.
 * `full` adds the amount range used on the Transactions tab.
 */
export function FilterBar({ txs, full = false }: { txs: Transaction[]; full?: boolean }) {
  const { filters: f, set, reset, hasActive } = useFilters();
  const bounds = useMemo(() => dateBounds(txs), [txs]);
  const present = useMemo(() => {
    const s = new Set(txs.map((t) => t.category));
    return ALL_CATEGORIES.filter((c) => s.has(c));
  }, [txs]);
  const range = resolveRange(f, bounds);

  const cpName = useMemo(() => {
    if (!f.cp) return null;
    return txs.find((t) => t.counterpartyKey === f.cp)?.counterparty ?? f.cp;
  }, [txs, f.cp]);

  const chips: Chip[] = [];
  if (f.preset === "custom" && f.from && f.to) {
    chips.push({ id: "date", label: fmtRange(f.from, f.to), remove: () => set({ preset: "all", from: null, to: null }) });
  }
  if (f.dir !== "all") {
    chips.push({ id: "dir", label: f.dir === "in" ? "Money in" : "Money out", remove: () => set({ dir: "all" }) });
  }
  for (const c of f.cats) {
    chips.push({ id: `cat-${c}`, label: `Category: ${c}`, remove: () => set({ cats: f.cats.filter((x) => x !== c) }) });
  }
  if (f.cp) chips.push({ id: "cp", label: `With: ${cpName}`, remove: () => set({ cp: null }) });
  if (f.q) chips.push({ id: "q", label: `Search: “${f.q}”`, remove: () => set({ q: "" }) });
  if (f.min !== null) chips.push({ id: "min", label: `At least KES ${f.min}`, remove: () => set({ min: null }) });
  if (f.max !== null) chips.push({ id: "max", label: `At most KES ${f.max}`, remove: () => set({ max: null }) });

  const setDate = (which: "from" | "to", v: string) => {
    const from = which === "from" ? v : (range.from ?? bounds.earliest);
    const to = which === "to" ? v : (range.to ?? bounds.latest);
    if (!from || !to) return;
    set(from <= to ? { preset: "custom", from, to } : { preset: "custom", from: to, to: from });
  };

  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-3">
        <Seg<Preset>
          label="Date range"
          value={f.preset}
          onChange={(p) => set({ preset: p, from: null, to: null })}
          options={[
            { value: "1m", label: "1M" },
            { value: "3m", label: "3M" },
            { value: "1y", label: "1Y" },
            { value: "all", label: "All" },
          ]}
        />
        <label className="flex items-center gap-2 text-[13px] text-mute">
          From
          <input
            type="date"
            className={FIELD}
            value={range.from ?? bounds.earliest ?? ""}
            min={bounds.earliest ?? undefined}
            max={bounds.latest ?? undefined}
            onChange={(e) => e.target.value && setDate("from", e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-mute">
          To
          <input
            type="date"
            className={FIELD}
            value={range.to ?? bounds.latest ?? ""}
            min={bounds.earliest ?? undefined}
            max={bounds.latest ?? undefined}
            onChange={(e) => e.target.value && setDate("to", e.target.value)}
          />
        </label>
        <select
          aria-label="Direction"
          className={FIELD}
          value={f.dir}
          onChange={(e) => set({ dir: e.target.value as Direction })}
        >
          <option value="all">All money</option>
          <option value="in">Money in</option>
          <option value="out">Money out</option>
        </select>
        <select
          aria-label="Category"
          className={FIELD}
          value={f.cats[0] ?? ""}
          onChange={(e) => set({ cats: e.target.value ? [e.target.value as Category] : [] })}
        >
          <option value="">All categories</option>
          {present.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="search"
          aria-label="Search by name, details or receipt"
          placeholder="Search name or receipt"
          className={`${FIELD} w-full sm:w-64`}
          value={f.q}
          onChange={(e) => set({ q: e.target.value })}
        />
        {full ? (
          <>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              aria-label="Minimum amount in KES"
              placeholder="Min KES"
              className={`${FIELD} w-28`}
              value={f.min ?? ""}
              onChange={(e) => set({ min: e.target.value === "" ? null : Number(e.target.value) })}
            />
            <input
              type="number"
              inputMode="decimal"
              min={0}
              aria-label="Maximum amount in KES"
              placeholder="Max KES"
              className={`${FIELD} w-28`}
              value={f.max ?? ""}
              onChange={(e) => set({ max: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </>
        ) : null}
      </div>
      {hasActive ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm" aria-label="Active filters">
          <span className="text-mute">Active filters:</span>
          {chips.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-[#cbd3cc] bg-white py-1 pl-3 pr-1 text-[13px]">
              {c.label}
              <button
                type="button"
                aria-label={`Remove filter: ${c.label}`}
                onClick={c.remove}
                className="flex size-6 items-center justify-center rounded-full hover:bg-chip"
              >
                <Icon name="x" size={14} />
              </button>
            </span>
          ))}
          <Button variant="ghost" className="!min-h-8 !px-2" onClick={reset}>
            Reset all
          </Button>
        </div>
      ) : null}
    </div>
  );
}
