import type {
  BalanceGap,
  OrderedRow,
  ParseWarning,
  RawRow,
  Verification,
} from "../types";

// prev(r) = the balance BEFORE this row happened.
// In true newest-to-oldest order: prev(newer) === older.balance.
const prev = (r: RawRow) => r.balance - r.amount;

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr.slice()];
  const out: T[][] = [];
  arr.forEach((item, i) => {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) out.push([item, ...p]);
  });
  return out; // identity order comes first
}

function internalOk(p: RawRow[]): boolean {
  for (let k = 0; k < p.length - 1; k++) if (prev(p[k]) !== p[k + 1].balance) return false;
  return true;
}

export type OrderResult = {
  rows: OrderedRow[]; // newest first, same-second rows in true order, tie assigned
  gaps: BalanceGap[];
  reorderedGroups: number;
  sums: { paidIn: number; paidOut: number };
  warnings: ParseWarning[];
};

/**
 * Rows that share the same second are not always listed in true order.
 * For each such group, find the order that makes the running balance chain
 * (using the neighbouring groups as anchors). Remaining breaks are reported
 * as balance gaps: places where Safaricom's own balance jumps.
 */
export function orderRows(rows: RawRow[]): OrderResult {
  const warnings: ParseWarning[] = [];
  const groups: RawRow[][] = [];
  for (const r of rows) {
    const g = groups[groups.length - 1];
    if (g && g[0].date === r.date && g[0].time === r.time) g.push(r);
    else groups.push([r]);
  }

  const ordered: OrderedRow[] = [];
  const gaps: BalanceGap[] = [];
  let reorderedGroups = 0;
  let last: RawRow | null = null;

  groups.forEach((g, gi) => {
    let chosen: RawRow[] = g;
    if (g.length > 1 && g.length <= 7) {
      const perms = permutations(g);
      const candidates = perms.filter(
        (p) => internalOk(p) && (!last || prev(last) === p[0].balance),
      );
      const next = groups[gi + 1];
      const pick =
        candidates.length > 1 && next
          ? (candidates.find((p) => next.some((n) => n.balance === prev(p[p.length - 1]))) ??
            candidates[0])
          : candidates[0];
      const fallback = pick ?? perms.find((p) => internalOk(p));
      if (fallback) {
        chosen = fallback;
        if (chosen.some((r, i) => r !== g[i])) reorderedGroups++;
      }
    } else if (g.length > 7) {
      warnings.push({
        code: "LARGE_GROUP",
        message: `${g.length} rows share the second ${g[0].date} ${g[0].time}; order not checked`,
      });
    }

    if (last && prev(last) !== chosen[0].balance) {
      gaps.push({
        receiptNo: last.receiptNo,
        completedAt: `${last.date}T${last.time}+03:00`,
        amount: prev(last) - chosen[0].balance,
      });
    }
    for (let k = 0; k < chosen.length - 1; k++) {
      if (prev(chosen[k]) !== chosen[k + 1].balance) {
        gaps.push({
          receiptNo: chosen[k].receiptNo,
          completedAt: `${chosen[k].date}T${chosen[k].time}+03:00`,
          amount: prev(chosen[k]) - chosen[k + 1].balance,
        });
      }
    }

    chosen.forEach((r, k) => ordered.push({ ...r, tie: chosen.length - 1 - k }));
    last = chosen[chosen.length - 1];
  });

  let paidIn = 0;
  let paidOut = 0;
  for (const r of rows) {
    if (r.amount > 0) paidIn += r.amount;
    else paidOut += -r.amount;
  }
  return { rows: ordered, gaps, reorderedGroups, sums: { paidIn, paidOut }, warnings };
}

/** Compares parsed totals with the statement's own TOTAL line. */
export function checkSummary(
  sums: { paidIn: number; paidOut: number },
  summary: { paidIn: number; paidOut: number } | null,
): boolean | null {
  if (!summary) return null;
  return sums.paidIn === summary.paidIn && sums.paidOut === summary.paidOut;
}

/**
 * verified   = the statement's own totals match what we read (no row was lost).
 * partial    = totals missing or off, but the balance chain has no breaks.
 * unverified = totals off (or missing) AND the balance chain has breaks.
 * Balance gaps alone do NOT fail a statement: Safaricom's own balances can jump.
 */
export function verificationOf(summaryMatch: boolean | null, gaps: number): Verification {
  if (summaryMatch === true) return "verified";
  if (gaps === 0) return "partial";
  return "unverified";
}
