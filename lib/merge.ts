import type { Account, ImportLog, ParsedTransaction, ParseResult, Transaction } from "./types";
import { addDays, dayNum, monthRange, monthsBetween } from "./format";

// ---- identity --------------------------------------------------------------

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The account id is a hash of the mobile number: the number itself is never stored. */
export async function accountIdFor(mobile: string | null): Promise<string> {
  if (!mobile) return "unknown";
  return (await sha256Hex("pesa-lens:" + mobile)).slice(0, 16);
}

/**
 * Idempotency key. Receipt numbers are NOT unique (one Fuliza payment is three
 * rows), so the key combines account, receipt, time, amount and balance.
 * `n` keeps genuinely identical rows from collapsing. Details text is left out
 * because its line wrapping can differ between statements.
 */
export function withIds(accountId: string, parsed: ParsedTransaction[]): Transaction[] {
  const seen = new Map<string, number>();
  return parsed.map((t) => {
    const base = `${accountId}|${t.receiptNo}|${t.completedAt}|${t.amount}|${t.balance}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { ...t, accountId, id: `${base}|${n}` };
  });
}

// ---- merging ---------------------------------------------------------------

export type ImportPlan = {
  account: Account;
  newAccount: boolean;
  hadOtherAccounts: boolean;
  added: Transaction[]; // rows not seen before
  skipped: number; // rows already stored (duplicates)
  log: ImportLog;
};

/** Works out what an import changes. Pure apart from hashing: nothing is written here. */
export async function planImport(args: {
  existingIds: Set<string>;
  accounts: Account[];
  result: ParseResult;
  fileName: string;
  now?: Date;
}): Promise<ImportPlan> {
  const { existingIds, accounts, result, fileName } = args;
  const now = (args.now ?? new Date()).toISOString();
  const accountId = await accountIdFor(result.mobile);

  const all = withIds(accountId, result.transactions);
  const added: Transaction[] = [];
  let skipped = 0;
  for (const t of all) {
    if (existingIds.has(t.id)) skipped++;
    else added.push(t);
  }

  const existing = accounts.find((a) => a.id === accountId);
  const account: Account = existing ?? { id: accountId, label: result.accountLabel, createdAt: now };

  const log: ImportLog = {
    id: `${accountId}:${now}`,
    accountId,
    fileName,
    periodFrom: result.periodFrom,
    periodTo: result.periodTo,
    read: all.length,
    added: added.length,
    skipped,
    verification: result.verification,
    gaps: result.gaps.length,
    importedAt: now,
  };

  return {
    account,
    newAccount: !existing,
    hadOtherAccounts: accounts.some((a) => a.id !== accountId),
    added,
    skipped,
    log,
  };
}

// ---- coverage --------------------------------------------------------------

export type Range = { from: string; to: string };
export type MonthStatus = "full" | "partial" | "none";
export type Coverage = {
  from: string | null;
  to: string | null;
  ranges: Range[]; // merged covered periods
  missing: Range[]; // holes between covered periods
  months: { month: string; status: MonthStatus }[];
};

/** Which days are covered by the imported statement periods, and where the holes are. */
export function computeCoverage(imports: Pick<ImportLog, "periodFrom" | "periodTo">[]): Coverage {
  if (imports.length === 0) return { from: null, to: null, ranges: [], missing: [], months: [] };

  const sorted = imports
    .map((i) => ({ from: i.periodFrom, to: i.periodTo }))
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));

  const ranges: Range[] = [];
  for (const r of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && dayNum(r.from) <= dayNum(last.to) + 1) {
      if (r.to > last.to) last.to = r.to;
    } else {
      ranges.push({ ...r });
    }
  }

  const missing: Range[] = [];
  for (let i = 1; i < ranges.length; i++) {
    missing.push({ from: addDays(ranges[i - 1].to, 1), to: addDays(ranges[i].from, -1) });
  }

  const from = ranges[0].from;
  const to = ranges[ranges.length - 1].to;
  const months = monthsBetween(from, to).map((month) => {
    const mr = monthRange(month);
    const total = dayNum(mr.to) - dayNum(mr.from) + 1;
    let covered = 0;
    for (const r of ranges) {
      const a = Math.max(dayNum(r.from), dayNum(mr.from));
      const b = Math.min(dayNum(r.to), dayNum(mr.to));
      if (b >= a) covered += b - a + 1;
    }
    const status: MonthStatus = covered === 0 ? "none" : covered >= total ? "full" : "partial";
    return { month, status };
  });

  return { from, to, ranges, missing, months };
}

