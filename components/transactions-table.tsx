"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { dateBounds, newestFirst } from "@/lib/aggregates";
import { applyFilters, toQuery, useFilters } from "@/lib/filters";
import { amount, fmtDateTime } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Transaction } from "@/lib/types";
import { Button, Card, Icon } from "./bits";
import { FilterBar } from "./filter-bar";

const PAGE_SIZE = 50;

type SortKey = "date" | "amount" | "balance";

// ---- CSV export ------------------------------------------------------------------------

/** Text cells that start with = + - @ would be run as formulas by Excel, so they get a leading quote. */
function safe(text: string): string {
  const t = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${t.replace(/"/g, '""')}"`;
}

function toCsv(rows: Transaction[]): string {
  const head = ["Date", "Time", "Receipt", "Details", "Counterparty", "Category", "Paid in", "Withdrawn", "Balance"];
  const lines = rows.map((t) =>
    [
      t.day,
      t.completedAt.slice(11, 19),
      t.receiptNo,
      safe(t.details),
      safe(t.counterparty ?? ""),
      safe(t.category),
      t.amount > 0 ? (t.amount / 100).toFixed(2) : "",
      t.amount < 0 ? (-t.amount / 100).toFixed(2) : "",
      (t.balance / 100).toFixed(2),
    ].join(","),
  );
  return [head.join(","), ...lines].join("\r\n");
}

function download(name: string, text: string) {
  const blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- table ---------------------------------------------------------------------------------

function pageList(current: number, total: number): number[] {
  const set = new Set([1, total, current - 1, current, current + 1]);
  const pages = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: number[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push(-1);
    out.push(p);
  });
  return out;
}

function SortHead({
  label,
  k,
  sort,
  onSort,
  right = false,
}: {
  label: string;
  k: SortKey | null;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  right?: boolean;
}) {
  const active = k !== null && sort.key === k;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
      className={`px-4 py-3 text-xs font-bold uppercase tracking-wide text-mute ${right ? "text-right" : "text-left"}`}
    >
      {k ? (
        <button type="button" onClick={() => onSort(k)} className="inline-flex items-center gap-1 uppercase hover:text-ink">
          {label}
          {active ? <span aria-hidden="true">{sort.dir === "asc" ? "↑" : "↓"}</span> : null}
        </button>
      ) : (
        label
      )}
    </th>
  );
}

export function TransactionTable({ txs }: { txs: Transaction[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const base = newestFirst(txs);
    if (sort.key === "date") return sort.dir === "desc" ? base : [...base].reverse();
    const val = sort.key === "amount" ? (t: Transaction) => Math.abs(t.amount) : (t: Transaction) => t.balance;
    return [...base].sort((a, b) => (sort.dir === "desc" ? val(b) - val(a) : val(a) - val(b)));
  }, [txs, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const onSort = (key: SortKey) => {
    setPage(1);
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  };

  return (
    <Card className="!p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead className="border-b border-line">
            <tr>
              <SortHead label="Date" k="date" sort={sort} onSort={onSort} />
              <SortHead label="Receipt" k={null} sort={sort} onSort={onSort} />
              <SortHead label="Details" k={null} sort={sort} onSort={onSort} />
              <SortHead label="Category" k={null} sort={sort} onSort={onSort} />
              <SortHead label="Paid in" k="amount" sort={sort} onSort={onSort} right />
              <SortHead label="Withdrawn" k={null} sort={sort} onSort={onSort} right />
              <SortHead label="Balance" k="balance" sort={sort} onSort={onSort} right />
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-b border-[#eef1ed] last:border-0">
                <td className="whitespace-nowrap px-4 py-3">{fmtDateTime(t.completedAt)}</td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px]">{t.receiptNo}</td>
                <td className="max-w-[24rem] px-4 py-3">
                  {t.counterparty ? <div className="truncate font-medium">{t.counterparty}</div> : null}
                  <div className={`truncate ${t.counterparty ? "text-[13px] text-mute" : ""}`} title={t.details}>
                    {t.details}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="rounded-full bg-chip px-2.5 py-1 text-xs font-medium">{t.category}</span>
                  {t.viaFuliza ? (
                    <span className="ml-1.5 rounded-full bg-[#fff1de] px-2 py-1 text-xs font-medium text-[#8a4b00]">via Fuliza</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-pos">{t.amount > 0 ? amount(t.amount) : ""}</td>
                <td className="px-4 py-3 text-right tabular-nums text-neg">{t.amount < 0 ? amount(t.amount) : ""}</td>
                <td className="px-4 py-3 text-right tabular-nums">{amount(t.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
        <span className="text-mute" aria-live="polite">
          Showing {sorted.length === 0 ? 0 : (current - 1) * PAGE_SIZE + 1} to {Math.min(current * PAGE_SIZE, sorted.length)} of{" "}
          {sorted.length.toLocaleString("en-US")}
        </span>
        <nav className="flex flex-wrap items-center gap-1.5" aria-label="Pages">
          <Button className="!min-h-9" disabled={current <= 1} onClick={() => setPage(current - 1)}>
            Previous
          </Button>
          {pageList(current, pages).map((p, i) =>
            p === -1 ? (
              <span key={`gap-${i}`} className="px-1 text-mute" aria-hidden="true">…</span>
            ) : (
              <Button
                key={p}
                variant={p === current ? "primary" : "secondary"}
                className="!min-h-9 !px-3"
                aria-current={p === current ? "page" : undefined}
                onClick={() => setPage(p)}
              >
                {p}
              </Button>
            ),
          )}
          <Button className="!min-h-9" disabled={current >= pages} onClick={() => setPage(current + 1)}>
            Next
          </Button>
        </nav>
      </div>
    </Card>
  );
}

/** The whole Transactions tab: filters, result count, CSV export and the table. */
export function TransactionsView() {
  const { activeTransactions: all } = useStore();
  const { filters, reset } = useFilters();
  const bounds = useMemo(() => dateBounds(all), [all]);
  const filtered = useMemo(() => applyFilters(all, filters, bounds), [all, filters, bounds]);

  const exportCsv = () => {
    download("pesa-lens-transactions.csv", toCsv(newestFirst(filtered)));
    toast.success(`Exported ${filtered.length.toLocaleString("en-US")} rows`, { description: "Saved as pesa-lens-transactions.csv" });
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight">Transactions</h1>
          <p className="text-mute" aria-live="polite">{filtered.length.toLocaleString("en-US")} results</p>
        </div>
        <Button onClick={exportCsv} disabled={filtered.length === 0}>
          <Icon name="download" size={16} />
          Export filtered CSV
        </Button>
      </div>
      <FilterBar txs={all} full />
      {filtered.length === 0 ? (
        <Card className="text-center">
          <p className="mb-4 text-sm text-mute">Nothing matches these filters.</p>
          <Button variant="primary" onClick={reset}>Reset all filters</Button>
        </Card>
      ) : (
        // Keyed by the filters so paging and sorting restart whenever the filters change.
        <TransactionTable key={toQuery(filters, "transactions")} txs={filtered} />
      )}
    </div>
  );
}
