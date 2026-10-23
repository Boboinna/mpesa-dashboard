import {
  addDays,
  addMonths,
  dayNum,
  fromDayNum,
  mondayOf,
  monthShort,
  fmtDayShort,
} from "./format";
import type { Category, FeeType, Transaction } from "./types";

// Every dashboard number comes from here. Money in/out ignore loans (Fuliza,
// Hustler) and transfers (M-Shwari, Hustler savings): they are not income or
// spending. Fees are counted separately.

export const isIn = (t: Transaction) => t.kind === "income";
export const isOut = (t: Transaction) => t.kind === "expense";
export const isFee = (t: Transaction) => t.kind === "fee";

export function newestFirst(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) =>
    a.completedAt < b.completedAt ? 1 : a.completedAt > b.completedAt ? -1 : b.tie - a.tie,
  );
}

export function dateBounds(txs: Transaction[]): { earliest: string | null; latest: string | null } {
  let earliest: string | null = null;
  let latest: string | null = null;
  for (const t of txs) {
    if (!earliest || t.day < earliest) earliest = t.day;
    if (!latest || t.day > latest) latest = t.day;
  }
  return { earliest, latest };
}

// ---- headline numbers ------------------------------------------------------

export type Summary = {
  moneyIn: number;
  moneyOut: number;
  fees: number;
  net: number; // in - out - fees
  count: number; // distinct receipts
  endBalance: number | null; // balance after the newest row
};

export function summarize(txs: Transaction[]): Summary {
  let moneyIn = 0;
  let moneyOut = 0;
  let fees = 0;
  const receipts = new Set<string>();
  let newest: Transaction | null = null;
  for (const t of txs) {
    receipts.add(t.receiptNo);
    if (isIn(t)) moneyIn += t.amount;
    else if (isOut(t)) moneyOut += -t.amount;
    else if (isFee(t)) fees += -t.amount;
    if (
      !newest ||
      t.completedAt > newest.completedAt ||
      (t.completedAt === newest.completedAt && t.tie > newest.tie)
    ) {
      newest = t;
    }
  }
  return {
    moneyIn,
    moneyOut,
    fees,
    net: moneyIn - moneyOut - fees,
    count: receipts.size,
    endBalance: newest ? newest.balance : null,
  };
}

export function previousRange(from: string, to: string): { from: string; to: string } {
  const len = dayNum(to) - dayNum(from) + 1;
  const prevTo = addDays(from, -1);
  return { from: addDays(prevTo, -(len - 1)), to: prevTo };
}

// ---- cash flow over time ---------------------------------------------------

export type Bucket = "day" | "week" | "month";
export type FlowPoint = { key: string; label: string; title: string; in: number; out: number };

function bucketKey(t: Transaction, b: Bucket): string {
  return b === "day" ? t.day : b === "week" ? mondayOf(t.day, t.dow) : t.month;
}

function nextKey(key: string, b: Bucket): string {
  if (b === "day") return addDays(key, 1);
  if (b === "week") return addDays(key, 7);
  return addMonths(`${key}-01`, 1).slice(0, 7);
}

export function cashFlow(txs: Transaction[], bucket: Bucket): FlowPoint[] {
  const map = new Map<string, { in: number; out: number }>();
  for (const t of txs) {
    if (!isIn(t) && !isOut(t)) continue;
    const k = bucketKey(t, bucket);
    const e = map.get(k) ?? { in: 0, out: 0 };
    if (isIn(t)) e.in += t.amount;
    else e.out += -t.amount;
    map.set(k, e);
  }
  const keys = [...map.keys()].sort();
  if (keys.length === 0) return [];

  // Fill empty buckets so the chart has no holes (capped for huge ranges).
  const filled: string[] = [];
  let cur = keys[0];
  const end = keys[keys.length - 1];
  while (cur <= end && filled.length < 1500) {
    filled.push(cur);
    cur = nextKey(cur, bucket);
  }

  const years = new Set(filled.map((k) => k.slice(0, 4)));
  const multiYear = years.size > 1;
  return filled.map((key) => {
    const e = map.get(key) ?? { in: 0, out: 0 };
    let label: string;
    let title: string;
    if (bucket === "month") {
      label = monthShort(key) + (multiYear ? ` ’${key.slice(2, 4)}` : "");
      title = `${monthShort(key)} ${key.slice(0, 4)}`;
    } else {
      label = fmtDayShort(key);
      title = bucket === "week" ? `Week of ${fmtDayShort(key)} ${key.slice(0, 4)}` : `${fmtDayShort(key)} ${key.slice(0, 4)}`;
    }
    return { key, label, title, in: e.in, out: e.out };
  });
}

// ---- balance ---------------------------------------------------------------

export type BalancePoint = { key: string; label: string; balance: number };

export function balanceSeries(txs: Transaction[], mode: "daily" | "monthly"): BalancePoint[] {
  const sorted = [...txs].sort((a, b) =>
    a.completedAt < b.completedAt ? -1 : a.completedAt > b.completedAt ? 1 : a.tie - b.tie,
  );
  const last = new Map<string, number>();
  for (const t of sorted) last.set(mode === "daily" ? t.day : t.month, t.balance);
  return [...last.entries()].map(([key, balance]) => ({
    key,
    balance,
    label: mode === "daily" ? fmtDayShort(key) : `${monthShort(key)} ${key.slice(0, 4)}`,
  }));
}

// ---- breakdowns ------------------------------------------------------------

export type CategoryRow = { category: Category; total: number; pct: number };

/** Spending by category (expenses and fees). */
export function byCategory(txs: Transaction[]): CategoryRow[] {
  const map = new Map<Category, number>();
  let all = 0;
  for (const t of txs) {
    if (!isOut(t) && !isFee(t)) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + -t.amount);
    all += -t.amount;
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total, pct: all ? (total / all) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);
}

export type CounterpartyRow = { key: string; name: string; total: number; count: number; pct: number };

export function topCounterparties(txs: Transaction[], dir: "out" | "in", limit = 5): CounterpartyRow[] {
  const map = new Map<string, { name: string; total: number; count: number }>();
  for (const t of txs) {
    if (!t.counterpartyKey || !t.counterparty) continue;
    if (dir === "out" ? !isOut(t) : !isIn(t)) continue;
    const e = map.get(t.counterpartyKey) ?? { name: t.counterparty, total: 0, count: 0 };
    e.total += Math.abs(t.amount);
    e.count++;
    map.set(t.counterpartyKey, e);
  }
  const rows = [...map.entries()].map(([key, e]) => ({ key, ...e }));
  rows.sort((a, b) => b.total - a.total);
  const max = rows[0]?.total ?? 0;
  return rows.slice(0, limit).map((r) => ({ ...r, pct: max ? (r.total / max) * 100 : 0 }));
}

/** Spending per weekday, index 0 = Sunday. */
export function byWeekday(txs: Transaction[]): { total: number; count: number }[] {
  const out = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
  for (const t of txs) {
    if (!isOut(t)) continue;
    out[t.dow].total += -t.amount;
    out[t.dow].count++;
  }
  return out;
}

const FEE_LABELS: Record<FeeType, string> = {
  paybill: "Pay Bill charges",
  withdrawal: "Withdrawal charges",
  send: "Send money charges",
  fuliza: "Fuliza fees",
  other: "Other fees",
};

export function feesBreakdown(txs: Transaction[]): { type: FeeType; label: string; total: number; count: number }[] {
  const map = new Map<FeeType, { total: number; count: number }>();
  for (const t of txs) {
    if (!isFee(t)) continue;
    const type = t.feeType ?? "other";
    const e = map.get(type) ?? { total: 0, count: 0 };
    e.total += -t.amount;
    e.count++;
    map.set(type, e);
  }
  return [...map.entries()]
    .map(([type, e]) => ({ type, label: FEE_LABELS[type], ...e }))
    .sort((a, b) => b.total - a.total);
}

export type LoansSummary = {
  fuliza: { borrowed: number; repaid: number; times: number; spendVia: number };
  hustler: { borrowed: number; repaid: number };
  hasAny: boolean;
};

export function loansSummary(txs: Transaction[]): LoansSummary {
  const s: LoansSummary = {
    fuliza: { borrowed: 0, repaid: 0, times: 0, spendVia: 0 },
    hustler: { borrowed: 0, repaid: 0 },
    hasAny: false,
  };
  for (const t of txs) {
    if (t.kind === "loan_in" && t.category === "Fuliza") {
      s.fuliza.borrowed += t.amount;
      s.fuliza.times++;
    } else if (t.kind === "loan_out" && t.category === "Fuliza") {
      s.fuliza.repaid += -t.amount;
    } else if (t.kind === "loan_in") {
      s.hustler.borrowed += t.amount;
    } else if (t.kind === "loan_out") {
      s.hustler.repaid += -t.amount;
    }
    if (isOut(t) && t.viaFuliza) s.fuliza.spendVia += -t.amount;
  }
  s.hasAny = s.fuliza.times > 0 || s.hustler.borrowed > 0 || s.hustler.repaid > 0;
  return s;
}

// ---- recurring and largest ---------------------------------------------------

export type RecurringRow = {
  key: string;
  name: string;
  count: number;
  typical: number; // median amount, cents
  everyDays: number;
  cadence: string;
  lastDay: string;
};

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Payees paid at least 3 times at a regular interval for a similar amount. */
export function recurring(txs: Transaction[], limit = 6): RecurringRow[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of txs) {
    if (!isOut(t) || !t.counterpartyKey) continue;
    const g = groups.get(t.counterpartyKey) ?? [];
    g.push(t);
    groups.set(t.counterpartyKey, g);
  }
  const rows: (RecurringRow & { total: number })[] = [];
  for (const [key, g] of groups) {
    if (g.length < 3) continue;
    const days = g.map((t) => dayNum(t.day)).sort((a, b) => a - b);
    const gaps = days.slice(1).map((d, i) => d - days[i]).filter((d) => d > 0);
    if (gaps.length < 2) continue;
    const every = median(gaps);
    if (every < 1 || every > 45) continue;
    const regular = gaps.filter((d) => Math.abs(d - every) <= Math.max(1, every * 0.4)).length;
    if (regular / gaps.length < 0.6) continue;
    const amounts = g.map((t) => -t.amount);
    const typical = median(amounts);
    const similar = amounts.filter((a) => Math.abs(a - typical) <= typical * 0.15).length;
    if (similar / amounts.length < 0.7) continue;
    const cadence =
      every >= 26 && every <= 34 ? "Monthly" : every >= 6 && every <= 8 ? "Weekly" : `About every ${Math.round(every)} days`;
    rows.push({
      key,
      name: g[0].counterparty ?? key,
      count: g.length,
      typical,
      everyDays: every,
      cadence,
      lastDay: fromDayNum(days[days.length - 1]),
      total: amounts.reduce((a, b) => a + b, 0),
    });
  }
  rows.sort((a, b) => b.total - a.total);
  return rows.slice(0, limit).map((r) => ({
    key: r.key, name: r.name, count: r.count, typical: r.typical,
    everyDays: r.everyDays, cadence: r.cadence, lastDay: r.lastDay,
  }));
}

export function largest(txs: Transaction[], n = 5): Transaction[] {
  return txs
    .filter((t) => isIn(t) || isOut(t))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, n);
}
